import { Annotation } from "@langchain/langgraph";
import { db } from "db";
import { fileContent, namesDiffer } from "../documents";
import { DeliveryError, sendEmail, sendWhatsApp } from "../messaging/send";
import { fillTemplate } from "../messaging/template";
import { getObject } from "../storage";
import {
  askAI,
  Decisions,
  EXTRACT_INSTRUCTIONS,
  LOCKER_INSTRUCTIONS,
  QueryPoints,
  type Decision,
  type Point,
} from "./ai";

const CHANNELS = ["whatsapp", "email"] as const;
const WHATSAPP_JOIN_LINE =
  'To get this message on WhatsApp, send "join road-depend" to +1 415 523 8886 on WhatsApp, then send "hi".';
type Channel = (typeof CHANNELS)[number];
type Delivery = Record<Channel, "pending" | "sent" | "failed">;
type Result = Omit<Decision, "pointId"> & { point: Point };

const MAX_SEND_ATTEMPTS = 3;
const READING_WAIT_MS = 30_000;

// Saved after every step. File contents and patient details stay out of it, so
// each node loads what it needs from the database.
export const State = Annotation.Root({
  queryLetterId: Annotation<string>(),
  points: Annotation<Point[]>(),
  patientName: Annotation<string | null>(),
  decisions: Annotation<Decision[]>(),
  results: Annotation<Result[]>(),
  messages: Annotation<Record<Channel, string> | null>(),
  emailSubject: Annotation<string>(),
  delivery: Annotation<Delivery>({
    reducer: (_, next) => next,
    default: () => ({ whatsapp: "pending", email: "pending" }),
  }),
  sendAttempts: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
});

type GraphState = typeof State.State;

async function getLetter(id: string) {
  const letter = await db.orm.public.QueryLetter.first({ id });
  if (!letter) throw new Error("Letter not found");
  return letter;
}

async function getPatient(id: string) {
  const patient = await db.orm.public.Patient.first({ id });
  if (!patient) throw new Error("Patient not found");
  return patient;
}

function loadLocker(patientId: string) {
  return db.orm.public.Document.where({ patientId })
    .select("id", "type", "summary", "documentDate", "readingStatus", "nameMismatch")
    .limit(500)
    .all();
}

function setStatus(id: string, change: { status: "reading" | "checking_locker" | "sending" }) {
  return db.orm.public.QueryLetter.where({ id }).update(change);
}

export async function extractPoints(state: GraphState) {
  const letter = await getLetter(state.queryLetterId);
  await setStatus(letter.id, { status: "reading" });

  const content = await getObject(letter.storageKey);
  const { points, patientName } = await askAI("query_points", QueryPoints, EXTRACT_INSTRUCTIONS, [
    fileContent(content, letter.mimeType),
  ]);
  return { points, patientName };
}

// A letter can arrive just after its documents, so unread ones get a short wait.
async function waitForReading(patientId: string) {
  const deadline = Date.now() + READING_WAIT_MS;
  while (Date.now() < deadline) {
    const locker = await loadLocker(patientId);
    if (!locker.some(({ readingStatus }) => isUnread(readingStatus))) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

function isUnread(readingStatus: string) {
  return ["pending", "processing", "failed"].includes(readingStatus);
}

function documentProblem(document: { readingStatus: string; nameMismatch: boolean }) {
  if (document.nameMismatch) return "the name on it doesn't match this patient";
  if (document.readingStatus === "unreadable") return "it's too unclear to read";
  if (document.readingStatus !== "done") return "it hasn't been read";
  return null;
}

export async function checkLocker(state: GraphState) {
  const letter = await getLetter(state.queryLetterId);
  await setStatus(letter.id, { status: "checking_locker" });
  // Nothing to check, so no need to pay for an AI call.
  if (state.points.length === 0) return { decisions: [] };

  await waitForReading(letter.patientId);
  const locker = (await loadLocker(letter.patientId)).map((document) => ({
    id: document.id,
    type: document.type,
    summary: document.summary,
    date: document.documentDate,
    problem: documentProblem(document),
  }));

  const { decisions } = await askAI("decisions", Decisions, LOCKER_INSTRUCTIONS, [
    {
      type: "input_text",
      text: `<query_points>${JSON.stringify(state.points)}</query_points>
<locker_documents>${JSON.stringify(locker)}</locker_documents>`,
    },
  ]);
  return { decisions };
}

// Never blindly trust the AI. If an answer doesn't hold up, a person checks that
// point rather than the patient getting a wrong message.
export async function safetyChecks(state: GraphState) {
  const letter = await getLetter(state.queryLetterId);
  const patient = await getPatient(letter.patientId);
  const locker = await loadLocker(letter.patientId);
  const someoneElse = Boolean(state.patientName && namesDiffer(patient.name, state.patientName));
  const anyUnread = locker.some(({ readingStatus }) => isUnread(readingStatus));

  const problemWith = (decision: Decision | undefined) => {
    if (someoneElse) return "The name on this letter doesn't match this patient.";
    if (!decision) return "The AI skipped this point.";
    if (decision.status === "already_in_locker") {
      const cited = locker.find(({ id }) => id === decision.documentId);
      if (!cited) return "The AI cited a document that isn't in this locker.";
      const problem = documentProblem(cited);
      if (problem) return `The AI cited a document, but ${problem}.`;
    }
    if (decision.status === "needed_from_patient") {
      if (!decision.patientRequest || !decision.patientWhy) {
        return "The AI said the patient must send something, but not what or why.";
      }
      if (anyUnread) return "A locker document hasn't been read, so this may not be missing.";
    }
    return null;
  };

  const results = state.points.map((point): Result => {
    const decision = state.decisions.find(({ pointId }) => pointId === point.id);
    const problem = problemWith(decision);
    if (problem || !decision) {
      return {
        point,
        status: "needs_team",
        documentId: null,
        reason: problem ?? "",
        patientRequest: null,
        patientWhy: null,
      };
    }
    return {
      point,
      status: decision.status,
      documentId: decision.status === "already_in_locker" ? decision.documentId : null,
      reason: decision.reason,
      patientRequest: decision.status === "needed_from_patient" ? decision.patientRequest : null,
      patientWhy: decision.status === "needed_from_patient" ? decision.patientWhy : null,
    };
  });

  // This step can run twice after a restart, so start clean.
  await db.orm.public.QueryPoint.where({ queryLetterId: letter.id }).deleteAll();
  for (const [position, result] of results.entries()) {
    await db.orm.public.QueryPoint.create({
      queryLetterId: letter.id,
      position,
      asksFor: result.point.asksFor,
      status: result.status,
      reason: result.reason,
      documentId: result.documentId,
      patientRequest: result.patientRequest,
      patientWhy: result.patientWhy,
    });
  }
  return { results };
}

// Points are saved by safetyChecks. A letter with none still needs a person.
export async function addToTeamQueue(state: GraphState) {
  if (state.results.length > 0) return {};
  await db.orm.public.QueryPoint.where({ queryLetterId: state.queryLetterId }).deleteAll();
  await db.orm.public.QueryPoint.create({
    queryLetterId: state.queryLetterId,
    position: 0,
    asksFor: "Read this letter",
    status: "needs_team",
    reason: "No requests were found, or the letter was too unclear to read.",
  });
  return {};
}

// Our code fills the template, not the AI, so the format never changes.
export async function buildMessage(state: GraphState) {
  const letter = await getLetter(state.queryLetterId);
  await setStatus(letter.id, { status: "sending" });
  const patient = await getPatient(letter.patientId);

  const requestedItems = state.results
    .filter(({ status }) => status === "needed_from_patient")
    .map((result, index) => `${index + 1}. ${result.patientRequest}\n   Why: ${result.patientWhy}`)
    .join("\n\n");

  const values = {
    patient_name: patient.name,
    patient_id: patient.patientCode,
    claim_number: patient.claimNumber,
    requested_items: requestedItems,
  };
  const whatsapp = await db.orm.public.Template.first({ channel: "whatsapp" });
  const email = await db.orm.public.Template.first({ channel: "email" });
  if (!whatsapp || !email) throw new Error("Template not found");

  const whatsappBody = fillTemplate(whatsapp.body, values);
  const filledEmail = fillTemplate(email.body, values);
  // Without Meta, WhatsApp only reaches the patient once they message us.
  const emailBody =
    filledEmail && !process.env.WHATSAPP_TOKEN ? `${filledEmail}\n\n${WHATSAPP_JOIN_LINE}` : filledEmail;
  const emailSubject = fillTemplate(email.subject ?? "Documents needed for your claim", values);
  if (whatsappBody && emailBody && emailSubject) {
    return { messages: { whatsapp: whatsappBody, email: emailBody }, emailSubject };
  }

  // Nothing was sent, so these points can't say the patient was asked.
  await db.orm.public.QueryPoint.where({
    queryLetterId: letter.id,
    status: "needed_from_patient",
  }).updateAll({
    status: "needs_team",
    reason: "No message was sent because the patient's profile is missing a detail it needs, such as the claim number.",
  });
  return { messages: null };
}

function deliver(
  message: { id: string; channel: Channel; recipient: string; body: string },
  emailSubject: string,
) {
  if (message.channel === "whatsapp") return sendWhatsApp(message.recipient, message.body);
  return sendEmail(message.recipient, emailSubject, message.body, message.id);
}

async function sendOne(channel: Channel, state: GraphState, recipient: string, patientId: string) {
  const queryLetterId = state.queryLetterId;
  const message =
    (await db.orm.public.Message.where({ queryLetterId, channel }).first()) ??
    (await db.orm.public.Message.create({
      queryLetterId,
      patientId,
      channel,
      recipient,
      body: state.messages![channel],
    }));
  // The row is what stops a duplicate after a retry or restart.
  if (message.status === "sent") return "sent";

  const row = db.orm.public.Message.where({ id: message.id });
  // Without Meta, WhatsApp waits and goes out as a reply when the patient messages
  // us (app/api/whatsapp/route.ts), so there's nothing more to do here.
  if (channel === "whatsapp" && !process.env.WHATSAPP_TOKEN) {
    if (message.status === "failed") await row.update({ status: "pending", errorMessage: null });
    return "sent";
  }
  try {
    const providerId = await deliver({ ...message, channel }, state.emailSubject);
    await row.update({
      status: "sent",
      attempts: message.attempts + 1,
      providerId,
      errorMessage: null,
      sentAt: new Date().toISOString(),
    });
    return "sent";
  } catch (error) {
    const reason = error instanceof DeliveryError ? error.message : "Could not deliver this message";
    console.error("Send failed:", channel, reason);
    await row.update({
      status: "failed",
      attempts: message.attempts + 1,
      errorMessage: reason,
    });
    return "failed";
  }
}

export async function sendMessages(state: GraphState) {
  const attempt = state.sendAttempts + 1;
  // Waits 1s, then 2s, before each retry.
  if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt - 1)));

  const letter = await getLetter(state.queryLetterId);
  const patient = await getPatient(letter.patientId);
  const recipients = { whatsapp: patient.phone, email: patient.email };

  const delivery = { ...state.delivery };
  await Promise.all(
    CHANNELS.filter((channel) => delivery[channel] !== "sent").map(async (channel) => {
      delivery[channel] = await sendOne(channel, state, recipients[channel], patient.id);
    }),
  );
  return { delivery, sendAttempts: attempt };
}

export async function alertTeam(state: GraphState) {
  await db.orm.public.QueryLetter.where({ id: state.queryLetterId }).update({
    status: "delivery_failed",
    errorMessage: "A message could not be delivered after 3 attempts.",
    finishedAt: new Date().toISOString(),
  });
  return {};
}

export async function finish(state: GraphState) {
  await db.orm.public.QueryLetter.where({ id: state.queryLetterId }).update({
    status: "completed",
    errorMessage: null,
    finishedAt: new Date().toISOString(),
  });
  return {};
}

function patientMustSend(state: GraphState) {
  return state.results.some(({ status }) => status === "needed_from_patient");
}

export function routeResults(state: GraphState) {
  if (state.results.length === 0 || state.results.some(({ status }) => status === "needs_team")) {
    return "addToTeamQueue";
  }
  return patientMustSend(state) ? "buildMessage" : "finish";
}

export function routeAfterTeam(state: GraphState) {
  return patientMustSend(state) ? "buildMessage" : "finish";
}

export function routeMessage(state: GraphState) {
  return state.messages ? "sendMessages" : "finish";
}

export function routeDelivery(state: GraphState) {
  if (CHANNELS.every((channel) => state.delivery[channel] === "sent")) return "finish";
  return state.sendAttempts < MAX_SEND_ATTEMPTS ? "sendMessages" : "alertTeam";
}
