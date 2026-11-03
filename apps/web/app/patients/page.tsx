import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, listPatientsFor, orNotFound } from "@/lib/access";
import { openItems, queryStatusLabel } from "@/lib/format";
import { PatientTable } from "./patient-table";

export default async function PatientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const patients = await orNotFound(listPatientsFor(user));
  const isAdmin = user.role === "admin";
  const rows = patients.map(({ queryLetters, ...patient }) => {
    const latest = queryLetters[0];
    return {
      ...patient,
      openItems: latest ? openItems(latest.points) : 0,
      latestQuery: latest ? queryStatusLabel(latest.status, latest.points) : null,
    };
  });

  return (
    <>
      <div className="page-title">
        <h1>Patients</h1>
        {isAdmin && (
          <Link className="button" href="/patients/new">
            Add patient
          </Link>
        )}
      </div>
      {patients.length === 0 ? (
        <div className="empty">
          <p>{isAdmin ? "No patients yet. Add the first one to start a locker." : "No patients are assigned to you yet."}</p>
        </div>
      ) : (
        <PatientTable patients={rows} />
      )}
    </>
  );
}
