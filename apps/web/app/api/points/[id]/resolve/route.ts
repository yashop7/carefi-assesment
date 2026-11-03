import { db } from "db";
import { requirePointAccess, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    const { id } = await params;
    const point = await requirePointAccess(user, id);
    if (point.status !== "needs_team") return apiError(409, "This point doesn't need the team");

    await db.orm.public.QueryPoint.where({ id: point.id }).update({
      resolvedBy: user.id,
      resolvedAt: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
