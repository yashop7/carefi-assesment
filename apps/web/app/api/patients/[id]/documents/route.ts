import { createHash } from "node:crypto";
import { db } from "db";
import { logAccess, requirePatientAccess, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin, isUniqueViolation } from "@/lib/api";
import { deleteObject, putObject } from "@/lib/storage";
import {
  cleanFileName,
  detectFileType,
  MAX_FILE_BYTES,
  MAX_REQUEST_BYTES,
  newStorageKey,
} from "@/lib/uploads";

type Context = { params: Promise<{ id: string }> };

const TOO_LARGE = "This file is over the 20 MB limit";

function duplicate(document: { id: string; fileName: string }) {
  return apiError(409, `Already in this locker as ${document.fileName}`, {
    document: { id: document.id, fileName: document.fileName },
  });
}

async function findDuplicate(patientId: string, sha256: string) {
  return db.orm.public.Document.where({ patientId, sha256 }).first();
}

export async function POST(request: Request, { params }: Context) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    const { id } = await params;
    const patient = await requirePatientAccess(user, id);

    // formData() buffers the whole body, so the size is checked before it.
    const length = Number(request.headers.get("content-length"));
    if (!length || length > MAX_REQUEST_BYTES) return apiError(413, TOO_LARGE);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return apiError(400, "Choose a file to upload");
    }
    if (file.size > MAX_FILE_BYTES) return apiError(413, TOO_LARGE);

    const content = new Uint8Array(await file.arrayBuffer());
    const mimeType = detectFileType(content);
    if (!mimeType) return apiError(415, "Upload a PDF, JPG or PNG file");

    const sha256 = createHash("sha256").update(content).digest("hex");
    const existing = await findDuplicate(patient.id, sha256);
    if (existing) return duplicate(existing);

    const storageKey = newStorageKey(patient.id);
    try {
      await putObject(storageKey, content, mimeType);
    } catch (error) {
      console.error("Upload failed:", error instanceof Error ? error.name : "unknown");
      return apiError(503, "Could not save the file. Please try again");
    }

    let document;
    try {
      document = await db.orm.public.Document.select(
        "id",
        "fileName",
        "mimeType",
        "sizeBytes",
        "readingStatus",
        "createdAt",
      ).create({
        patientId: patient.id,
        fileName: cleanFileName(file.name),
        storageKey,
        mimeType,
        sizeBytes: content.length,
        sha256,
        uploadedBy: user.id,
      });
    } catch (error) {
      await deleteObject(storageKey).catch(() => undefined);
      if (isUniqueViolation(error)) {
        const winner = await findDuplicate(patient.id, sha256);
        if (winner) return duplicate(winner);
      }
      throw error;
    }

    await logAccess(user, "upload", patient.id, document.id);
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
