import { db } from "db";
import { after } from "next/server";
import { logAccess, requireStaffAccess, requireUser } from "@/lib/access";
import { runAgent } from "@/lib/agent/graph";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";
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

export async function POST(request: Request, { params }: Context) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    const { id } = await params;
    const patient = await requireStaffAccess(user, id);

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

    const storageKey = newStorageKey(patient.id, "queries");
    try {
      await putObject(storageKey, content, mimeType);
    } catch (error) {
      console.error("Upload failed:", error instanceof Error ? error.name : "unknown");
      return apiError(503, "Could not save the file. Please try again");
    }

    let query;
    try {
      query = await db.orm.public.QueryLetter.select("id", "status").create({
        patientId: patient.id,
        fileName: cleanFileName(file.name),
        storageKey,
        mimeType,
        uploadedBy: user.id,
      });
    } catch (error) {
      await deleteObject(storageKey).catch(() => undefined);
      throw error;
    }

    await logAccess(user, "upload", patient.id, query.id);
    const queryId = query.id;
    after(() => runAgent(queryId));
    return Response.json({ query }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
