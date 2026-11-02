import { db } from "db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/access";
import { SignOutButton } from "./sign-out-button";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin" || user.role === "agent") redirect("/patients");

  const patient = await db.orm.public.Patient.where({ userId: user.id }).first();
  if (patient) redirect(`/patients/${patient.id}`);

  return (
    <main className="panel">
      <h1>CareFi Patient Locker</h1>
      <p>Your account isn&apos;t linked to a locker yet. Please contact CareFi.</p>
      <SignOutButton />
    </main>
  );
}
