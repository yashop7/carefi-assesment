import { db } from "db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "./auth";

export type CurrentUser = { id: string; email: string; role: string };
export class NotLoggedInError extends Error {}
export class AccessDeniedError extends Error {}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, role } = session.user;
  return { id, email, role: role ?? "" };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new NotLoggedInError();
  return user;
}

export async function logAccess(
  user: CurrentUser,
  action: "view_patient" | "view_document" | "view_query" | "upload" | "denied",
  patientId: string | null,
  resourceId: string | null,
) {
  await db.orm.public.AccessLog.create({
    userId: user.id,
    action,
    patientId,
    resourceId,
  });
}

// `patientId` has a foreign key, so it's null for a patient that doesn't exist.
async function deny(
  user: CurrentUser,
  patientId: string | null,
  requestedId: string | null = null,
): Promise<never> {
  await logAccess(user, "denied", patientId, requestedId);
  throw new AccessDeniedError();
}

async function canAccessPatient(
  user: CurrentUser,
  patient: { id: string; userId: string | null },
) {
  if (user.role === "admin") return true;
  if (user.role === "patient") return patient.userId === user.id;
  if (user.role !== "agent") return false;
  const assignment = await db.orm.public.AgentPatient.where({
    userId: user.id,
    patientId: patient.id,
  }).first();
  return assignment !== null;
}

export async function requirePatientAccess(user: CurrentUser, patientId: string) {
  const patient = await db.orm.public.Patient.first({ id: patientId });
  if (!patient) return deny(user, null, patientId);
  if (!(await canAccessPatient(user, patient))) {
    return deny(user, patient.id, patientId);
  }
  return patient;
}

// Access is checked against the document's own patient, never one from a URL.
export async function requireDocumentAccess(user: CurrentUser, documentId: string) {
  const document = await db.orm.public.Document.first({ id: documentId });
  if (!document) return deny(user, null, documentId);
  const patient = await requirePatientAccess(user, document.patientId);
  return { document, patient };
}

// Query letters are for staff: patients never see them.
export async function requireStaffAccess(user: CurrentUser, patientId: string) {
  if (user.role === "patient") return deny(user, null, patientId);
  return requirePatientAccess(user, patientId);
}

export async function requireStaffDocumentAccess(user: CurrentUser, documentId: string) {
  const document = await db.orm.public.Document.first({ id: documentId });
  if (!document) return deny(user, null, documentId);
  await requireStaffAccess(user, document.patientId);
  return document;
}

// Access is checked against the letter's own patient, never one from a URL.
export async function requireQueryAccess(user: CurrentUser, queryId: string) {
  const letter = await db.orm.public.QueryLetter.first({ id: queryId });
  if (!letter) return deny(user, null, queryId);
  const patient = await requireStaffAccess(user, letter.patientId);
  return { letter, patient };
}

export async function requireAdmin(user: CurrentUser, patientId?: string) {
  if (user.role !== "admin") await deny(user, null, patientId);
}

export async function listPatientsFor(user: CurrentUser) {
  const patients = db.orm.public.Patient.select(
    "id",
    "patientCode",
    "name",
    "claimNumber",
  )
    .include("documents", (documents) => documents.count())
    .orderBy((patient) => patient.createdAt.desc())
    .limit(500);

  if (user.role === "admin") return patients.all();
  if (user.role !== "agent") return deny(user, null);

  const assignments = await db.orm.public.AgentPatient.where({
    userId: user.id,
  })
    .select("patientId")
    .limit(500)
    .all();
  const ids = assignments.map((assignment) => assignment.patientId);
  if (ids.length === 0) return [];
  return patients.where((patient) => patient.id.in(ids)).all();
}

// For pages: a refusal looks exactly like a page that doesn't exist.
export async function orNotFound<T>(check: Promise<T>): Promise<T> {
  try {
    return await check;
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }
}
