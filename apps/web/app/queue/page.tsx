import { db } from "db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, orNotFound, queuePatientIds, requireStaff } from "@/lib/access";
import { formatDate, queryStatusLabel } from "@/lib/format";
import { ActionButton } from "../patients/[id]/reading-status";

export default async function QueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await orNotFound(requireStaff(user));

  const ids = await queuePatientIds(user);
  const allowed = ({ patientId }: { patientId: string }) => !ids || ids.includes(patientId);

  const points = await db.orm.public.QueryPoint.where({ status: "needs_team" })
    .where((point) => point.resolvedAt.isNull())
    .include("queryLetter", (letter) =>
      letter
        .select("id", "fileName", "patientId")
        .include("patient", (patient) => patient.select("patientCode", "name")),
    )
    .orderBy((point) => point.createdAt.asc())
    .limit(500)
    .all();
  const openPoints = points.flatMap(({ queryLetter, ...point }) =>
    queryLetter && allowed(queryLetter) ? [{ ...point, letter: queryLetter }] : [],
  );

  const letters = await db.orm.public.QueryLetter.where((letter) =>
    letter.status.in(["failed", "delivery_failed"]),
  )
    .select("id", "fileName", "patientId", "status", "errorMessage", "createdAt")
    .include("patient", (patient) => patient.select("patientCode", "name"))
    .orderBy((letter) => letter.createdAt.asc())
    .limit(200)
    .all();
  const failedLetters = letters.filter(allowed);

  return (
    <>
      <div className="page-title">
        <h1>Team queue</h1>
      </div>

      <div className="stats">
        <div className="stat">
          Points waiting
          <strong>{openPoints.length}</strong>
        </div>
        <div className="stat">
          Failed letters
          <strong>{failedLetters.length}</strong>
        </div>
      </div>

      <h2>Points that need a person</h2>
      {openPoints.length === 0 ? (
        <div className="empty"><p>Nothing is waiting for the team.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Point</th>
                <th scope="col">Why</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {openPoints.map((point) => (
                <tr key={point.id}>
                  <td>
                    {point.letter.patient?.name}
                    <p className="muted mono">{point.letter.patient?.patientCode}</p>
                  </td>
                  <td>
                    {point.asksFor}
                    <p className="summary">
                      <Link className="text-link" href={`/patients/${point.letter.patientId}/queries/${point.letter.id}`}>
                        {point.letter.fileName}
                      </Link>
                    </p>
                  </td>
                  <td>{point.reason}</td>
                  <td><ActionButton url={`/api/points/${point.id}/resolve`} label="Mark handled" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Letters that failed</h2>
      {failedLetters.length === 0 ? (
        <div className="empty"><p>No failed letters or deliveries.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Letter</th>
                <th scope="col">Problem</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {failedLetters.map((letter) => (
                <tr key={letter.id}>
                  <td>
                    {letter.patient?.name}
                    <p className="muted mono">{letter.patient?.patientCode}</p>
                  </td>
                  <td>
                    <Link className="text-link" href={`/patients/${letter.patientId}/queries/${letter.id}`}>
                      {letter.fileName}
                    </Link>
                    <p className="summary">{formatDate(letter.createdAt)}</p>
                  </td>
                  <td>
                    <span className="badge badge-warn">{queryStatusLabel(letter.status, [])}</span>
                    {letter.errorMessage && <p className="summary">{letter.errorMessage}</p>}
                  </td>
                  <td><ActionButton url={`/api/queries/${letter.id}/retry`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
