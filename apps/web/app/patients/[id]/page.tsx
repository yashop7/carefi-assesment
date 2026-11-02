import { db } from "db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, logAccess, orNotFound, requirePatientAccess } from "@/lib/access";
import {
  documentTypeLabel,
  formatBytes,
  formatDate,
  isBeingRead,
  isBeingWorkedOn,
  queryStatusLabel,
} from "@/lib/format";
import { DocumentUpload } from "./document-upload";
import { QueryDrop } from "./query-drop";
import { RefreshWhileReading, RetryButton } from "./reading-status";

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const patient = await orNotFound(requirePatientAccess(user, id));
  await logAccess(user, "view_patient", patient.id, patient.id);

  const tabs = [
    { key: "documents", label: "Documents" },
    ...(user.role === "patient" ? [] : [{ key: "queries", label: "Query letters" }]),
    { key: "messages", label: "Messages" },
  ];
  const requested = (await searchParams).tab;
  const tab = tabs.find(({ key }) => key === requested)?.key ?? "documents";

  const documents =
    tab === "documents"
      ? await db.orm.public.Document.where({ patientId: patient.id })
          .select(
            "id",
            "fileName",
            "sizeBytes",
            "createdAt",
            "type",
            "summary",
            "readingStatus",
            "nameMismatch",
          )
          .orderBy((document) => document.createdAt.desc())
          .limit(500)
          .all()
      : [];

  const letters =
    tab === "queries"
      ? await db.orm.public.QueryLetter.where({ patientId: patient.id })
          .select("id", "fileName", "status", "createdAt")
          .include("points", (points) => points.select("status").limit(200))
          .orderBy((letter) => letter.createdAt.desc())
          .limit(200)
          .all()
      : [];

  return (
    <>
      {user.role !== "patient" && (
        <Link className="text-link back-link" href="/patients">
          ← All patients
        </Link>
      )}
      <div className="page-title">
        <div>
          <h1>{patient.name}</h1>
          <p className="muted mono">{patient.patientCode}</p>
        </div>
        {user.role === "admin" && (
          <Link className="button button-quiet" href={`/patients/${patient.id}/edit`}>
            Edit
          </Link>
        )}
      </div>

      <dl className="profile">
        <div><dt>Phone</dt><dd>{patient.phone}</dd></div>
        <div><dt>Email</dt><dd>{patient.email}</dd></div>
        <div><dt>Policy number</dt><dd>{patient.policyNumber ?? "—"}</dd></div>
        <div><dt>Claim number</dt><dd>{patient.claimNumber ?? "—"}</dd></div>
      </dl>

      <nav className="tabs" aria-label="Patient sections">
        {tabs.map(({ key, label }) => (
          <Link
            key={key}
            href={`/patients/${patient.id}?tab=${key}`}
            className={key === tab ? "tab tab-active" : "tab"}
            aria-current={key === tab ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "documents" && (
        <>
          <DocumentUpload patientId={patient.id} />
          {documents.some(({ readingStatus }) => isBeingRead(readingStatus)) && (
            <RefreshWhileReading />
          )}
          {documents.length === 0 ? (
            <div className="empty">
              <p>No documents yet. Upload the first one above.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">File</th>
                    <th scope="col">Type</th>
                    <th scope="col">Size</th>
                    <th scope="col">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <Link className="text-link" href={`/patients/${patient.id}/documents/${document.id}`}>
                          {document.fileName}
                        </Link>
                        {document.summary && <p className="summary">{document.summary}</p>}
                      </td>
                      <td>
                        <div className="status-cell">
                          {isBeingRead(document.readingStatus) && <span className="badge">Reading</span>}
                          {document.readingStatus === "done" && <span className="badge">{documentTypeLabel(document.type)}</span>}
                          {document.readingStatus === "unreadable" && <span className="badge badge-warn">Unreadable, upload a clearer copy</span>}
                          {document.readingStatus === "failed" && (
                            <>
                              <span className="badge badge-warn">Reading failed</span>
                              <RetryButton url={`/api/documents/${document.id}/read`} />
                            </>
                          )}
                          {document.nameMismatch && <span className="badge badge-warn">Name doesn&apos;t match</span>}
                        </div>
                      </td>
                      <td>{formatBytes(document.sizeBytes)}</td>
                      <td>{formatDate(document.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {tab === "queries" && (
        <>
          <QueryDrop patientId={patient.id} />
          {letters.some(({ status }) => isBeingWorkedOn(status)) && <RefreshWhileReading />}
          {letters.length === 0 ? (
            <div className="empty"><p>No query letters yet.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Letter</th>
                    <th scope="col">Status</th>
                    <th scope="col">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {letters.map((letter) => (
                    <tr key={letter.id}>
                      <td>
                        <Link className="text-link" href={`/patients/${patient.id}/queries/${letter.id}`}>
                          {letter.fileName}
                        </Link>
                      </td>
                      <td>
                        <span className={letter.status.endsWith("failed") ? "badge badge-warn" : "badge"}>
                          {queryStatusLabel(letter.status, letter.points)}
                        </span>
                      </td>
                      <td>{formatDate(letter.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {tab === "messages" && (
        <div className="empty"><p>No messages yet.</p></div>
      )}
    </>
  );
}
