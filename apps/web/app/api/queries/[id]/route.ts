import { db } from "db";
import { requireQueryAccess, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";
import { isBeingWorkedOn } from "@/lib/format";
import { deleteObject } from "@/lib/storage";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Context) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    const { id } = await params;
    const { letter } = await requireQueryAccess(user, id);

    if (isBeingWorkedOn(letter.status)) {
      return apiError(409, "This letter is still being processed. Try again in a moment");
    }

    // The file goes first. If this fails the row stays, so deleting again works
    // and no letter is left behind in the bucket.
    try {
      await deleteObject(letter.storageKey);
    } catch (error) {
      console.error("Delete failed:", error instanceof Error ? error.name : "unknown");
      return apiError(503, "Could not delete the file. Please try again");
    }

    await db.orm.public.Message.where({ queryLetterId: letter.id }).deleteAll();
    await db.orm.public.QueryPoint.where({ queryLetterId: letter.id }).deleteAll();
    await db.orm.public.QueryLetter.where({ id: letter.id }).delete();
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
