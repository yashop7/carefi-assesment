import { db } from "db";
import { listPatientsFor, requireAdmin, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin, isUniqueViolation } from "@/lib/api";
import { fieldErrors, newPatientSchema, publicPatient } from "@/lib/patients";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ patients: await listPatientsFor(user) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    await requireAdmin(user);

    const parsed = newPatientSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError(400, "Check the highlighted fields", {
        fields: fieldErrors(parsed.error),
      });
    }

    const patient = await db.orm.public.Patient.create(parsed.data);
    return Response.json({ patient: publicPatient(patient) }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError(409, "Check the highlighted fields", {
        fields: { patientCode: "This patient ID is already in use" },
      });
    }
    return handleRouteError(error);
  }
}
