import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "db";
import { apiError } from "@/lib/api";

// Twilio's limit for one WhatsApp message.
const MAX_LENGTH = 1600;

// Twilio signs each request with our auth token, so nobody else can ask this
// route for a patient's messages. The steps come from Twilio's webhook docs.
function isFromTwilio(request: Request, form: FormData) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature");
  if (!token || !signature) return false;

  const fields = [...form.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}${value}`)
    .join("");
  const received = Buffer.from(signature, "base64");
  // Twilio can sign an https URL with or without its port.
  return ["", ":443"].some((port) => {
    const url = `${process.env.BETTER_AUTH_URL}${port}/api/whatsapp`;
    const expected = createHmac("sha1", token).update(`${url}${fields}`).digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function reply(texts: string[]) {
  const parts = texts.flatMap((text) => text.match(new RegExp(`[\\s\\S]{1,${MAX_LENGTH}}`, "g")) ?? []);
  const messages = parts.map((part) => `<Message>${escapeXml(part)}</Message>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${messages}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

// The patient messaged our WhatsApp number. Twilio's trial only allows free text
// as a reply, so this is when their waiting messages go out.
export async function POST(request: Request) {
  const form = await request.formData();
  if (!isFromTwilio(request, form)) return apiError(403, "Forbidden");

  const recipient = String(form.get("From")).replace("whatsapp:", "");
  const waiting = await db.orm.public.Message.where({
    channel: "whatsapp",
    status: "pending",
    recipient,
  })
    .orderBy((message) => message.createdAt.asc())
    .limit(20)
    .all();

  const texts: string[] = [];
  for (const message of waiting) {
    // One update, so two messages at once can't send this twice.
    const claimed = await db.orm.public.Message.where({ id: message.id, status: "pending" }).update({
      status: "sent",
      attempts: message.attempts + 1,
      providerId: String(form.get("MessageSid")),
      errorMessage: null,
      sentAt: new Date().toISOString(),
    });
    if (claimed) texts.push(message.body);
  }
  return reply(texts.length > 0 ? texts : ["No new messages from CareFi right now."]);
}
