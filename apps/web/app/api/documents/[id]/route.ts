import { db } from "db";
import { requireStaffDocumentAccess, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";
import { deleteObject } from "@/lib/storage";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Context) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    const { id } = await params;
    const document = await requireStaffDocumentAccess(user, id);

    // The file goes first. If this fails the row stays, so deleting again works
    // and no patient file is left behind in the bucket.
    try {
      await deleteObject(document.storageKey);
    } catch (error) {
      console.error("Delete failed:", error instanceof Error ? error.name : "unknown");
      return apiError(503, "Could not delete the file. Please try again");
    }

    // Past letter decisions stay, without their link to this document.
    await db.orm.public.QueryPoint.where({ documentId: document.id }).updateAll({
      documentId: null,
    });
    await db.orm.public.Document.where({ id: document.id }).delete();
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
