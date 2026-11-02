import { after } from "next/server";
import { requireDocumentAccess, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";
import { readDocument } from "@/lib/documents";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    const { id } = await params;
    const { document } = await requireDocumentAccess(user, id);
    if (document.readingStatus !== "failed") {
      return apiError(409, "This document hasn't failed");
    }
    after(() => readDocument(document.id));
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    return handleRouteError(error);
  }
}
