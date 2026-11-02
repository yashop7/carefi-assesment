import { redirect } from "next/navigation";
import { getCurrentUser, orNotFound, requireAdmin, requirePatientAccess } from "@/lib/access";
import { publicPatient } from "@/lib/patients";
import { PatientForm } from "../../patient-form";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  await orNotFound(requireAdmin(user, id));
  const patient = await orNotFound(requirePatientAccess(user, id));

  return (
    <>
      <div className="page-title">
        <h1>Edit patient</h1>
      </div>
      <PatientForm patient={publicPatient(patient)} />
    </>
  );
}
