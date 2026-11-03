import { db } from "db";
import { requireAdmin, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";

type Context = { params: Promise<{ id: string; patientId: string }> };

export async function DELETE(request: Request, { params }: Context) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    await requireAdmin(user);

    const { id, patientId } = await params;
    await db.orm.public.AgentPatient.where({ userId: id, patientId }).deleteAll();
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
