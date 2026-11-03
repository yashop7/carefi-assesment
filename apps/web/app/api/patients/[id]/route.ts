import { db } from "db";
import { requireAdmin, requirePatientAccess, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";
import { fieldErrors, patientUpdateSchema, publicPatient } from "@/lib/patients";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireAdmin(user, id);
    await requirePatientAccess(user, id);

    const parsed = patientUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError(400, "Check the highlighted fields", {
        fields: fieldErrors(parsed.error),
      });
    }

    const patient = await db.orm.public.Patient.where({ id }).update(parsed.data);
    if (!patient) return apiError(404, "Not found");
    return Response.json({ patient: publicPatient(patient) });
  } catch (error) {
    return handleRouteError(error);
  }
}
