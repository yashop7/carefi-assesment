import { db } from "db";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin, isUniqueViolation } from "@/lib/api";
import { findAccount } from "@/lib/users";

type Context = { params: Promise<{ id: string }> };

const assignSchema = z.object({ patientId: z.string().min(1, "Choose a patient") });

export async function POST(request: Request, { params }: Context) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    await requireAdmin(user);

    const { id } = await params;
    const agent = await findAccount(id);
    if (agent?.role !== "agent") return apiError(404, "Not found");

    const parsed = assignSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "Choose a patient");
    const { patientId } = parsed.data;

    const patient = await db.orm.public.Patient.first({ id: patientId });
    if (!patient) return apiError(404, "Not found");

    await db.orm.public.AgentPatient.create({ userId: agent.id, patientId });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    // Already assigned, so there's nothing to change.
    if (isUniqueViolation(error)) return Response.json({ ok: true });
    return handleRouteError(error);
  }
}
