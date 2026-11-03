import { db } from "db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, orNotFound, requireAdmin } from "@/lib/access";
import { listAccounts } from "@/lib/users";
import { AccountForm } from "./account-form";
import { AssignPatient, RemoveAssignment } from "./assign-patient";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await orNotFound(requireAdmin(user));

  const accounts = await listAccounts();
  const patients = await db.orm.public.Patient.select("id", "patientCode", "name", "userId")
    .orderBy((patient) => patient.patientCode.asc())
    .limit(1000)
    .all();
  const assignments = await db.orm.public.AgentPatient.select("userId", "patientId").limit(5000).all();

  const label = (patient: { patientCode: string; name: string }) => `${patient.patientCode} ${patient.name}`;
  const options = patients.map((patient) => ({ id: patient.id, label: label(patient) }));
  const freeLockers = patients
    .filter((patient) => !patient.userId)
    .map((patient) => ({ id: patient.id, label: label(patient) }));

  return (
    <>
      <Link className="back-link" href="/patients">
        Back to patients
      </Link>
      <div className="page-title">
        <h1>Accounts</h1>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Role</th>
              <th scope="col">Patients</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const assigned = patients.filter((patient) =>
                assignments.some(({ userId, patientId }) => userId === account.id && patientId === patient.id),
              );
              const locker = patients.find((patient) => patient.userId === account.id);
              return (
                <tr key={account.id}>
                  <td>
                    {account.name}
                    <p className="muted">{account.email}</p>
                  </td>
                  <td><span className="badge">{account.role}</span></td>
                  <td>
                    {account.role === "admin" && <span className="muted">All patients</span>}
                    {account.role === "patient" && (locker ? label(locker) : <span className="muted">No locker</span>)}
                    {account.role === "agent" && (
                      <>
                        <ul className="assigned-list">
                          {assigned.map((patient) => (
                            <li key={patient.id}>
                              {label(patient)}
                              <RemoveAssignment userId={account.id} patientId={patient.id} />
                            </li>
                          ))}
                        </ul>
                        <AssignPatient
                          userId={account.id}
                          patients={options.filter(({ id }) => !assigned.some((patient) => patient.id === id))}
                        />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Add an account</h2>
      <AccountForm lockers={freeLockers} />
    </>
  );
}
