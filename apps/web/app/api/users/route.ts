import { db } from "db";
import { requireAdmin, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";
import { createAccount, emailInUse, linkPatientAccount, newAccountSchema } from "@/lib/users";

export async function POST(request: Request) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    await requireAdmin(user);

    const parsed = newAccountSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Check the form");
    const { patientId, ...account } = parsed.data;

    if (await emailInUse(account.email)) return apiError(409, "This email already has an account");

    if (account.role === "patient") {
      if (!patientId) return apiError(400, "Choose the patient's locker");
      const patient = await db.orm.public.Patient.first({ id: patientId });
      if (!patient) return apiError(404, "Not found");
      if (patient.userId) return apiError(409, "This locker already has an account");
    }

    const id = await createAccount(account);
    if (account.role === "patient" && patientId) await linkPatientAccount(id, patientId);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
