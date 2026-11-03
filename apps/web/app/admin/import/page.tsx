import { db } from "db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, orNotFound, requireAdmin } from "@/lib/access";
import { documentTypeLabel, isBeingRead } from "@/lib/format";
import { RefreshWhileReading, ActionButton } from "../../patients/[id]/reading-status";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await orNotFound(requireAdmin(user));

  const patients = await db.orm.public.Patient.select("id", "patientCode").limit(1000).all();
  const documents = await db.orm.public.Document.select("id", "fileName", "type", "readingStatus", "patientId")
    .orderBy((document) => document.createdAt.desc())
    .limit(100)
    .all();
  const codes = new Map(patients.map((patient) => [patient.id, patient.patientCode]));

  return (
    <>
      <div className="page-title">
        <h1>Import</h1>
      </div>
      <ImportForm patients={patients} />

      <h2>Reading progress</h2>
      {documents.some(({ readingStatus }) => isBeingRead(readingStatus)) && <RefreshWhileReading />}
      {documents.length === 0 ? (
        <div className="empty">
          <p>No documents yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Patient ID</th>
                <th scope="col">File</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="mono">{codes.get(document.patientId) ?? "—"}</td>
                  <td>
                    <Link className="text-link" href={`/patients/${document.patientId}/documents/${document.id}`}>
                      {document.fileName}
                    </Link>
                  </td>
                  <td>
                    <div className="status-cell">
                      {isBeingRead(document.readingStatus) && <span className="badge">Reading</span>}
                      {document.readingStatus === "done" && (
                        <span className="badge badge-good">{documentTypeLabel(document.type)}</span>
                      )}
                      {document.readingStatus === "unreadable" && (
                        <span className="badge badge-warn">Unreadable</span>
                      )}
                      {document.readingStatus === "failed" && (
                        <>
                          <span className="badge badge-warn">Reading failed</span>
                          <ActionButton url={`/api/documents/${document.id}/read`} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
