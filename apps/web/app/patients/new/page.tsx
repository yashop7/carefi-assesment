import { redirect } from "next/navigation";
import { getCurrentUser, orNotFound, requireAdmin } from "@/lib/access";
import { PatientForm } from "../patient-form";

export default async function NewPatientPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await orNotFound(requireAdmin(user));

  return (
    <>
      <div className="page-title">
        <h1>Add patient</h1>
      </div>
      <PatientForm />
    </>
  );
}
