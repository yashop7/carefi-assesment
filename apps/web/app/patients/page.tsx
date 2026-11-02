import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, listPatientsFor } from "@/lib/access";

export default async function PatientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "agent") redirect("/");

  const patients = await listPatientsFor(user);
  const isAdmin = user.role === "admin";

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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Patient ID</th>
                <th scope="col">Name</th>
                <th scope="col">Claim number</th>
                <th scope="col" className="number">Documents</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td className="mono">{patient.patientCode}</td>
                  <td>
                    <Link className="text-link" href={`/patients/${patient.id}`}>
                      {patient.name}
                    </Link>
                  </td>
                  <td>{patient.claimNumber ?? "—"}</td>
                  <td className="number">{patient.documents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
