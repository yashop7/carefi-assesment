import { db } from "db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, logAccess, orNotFound, requireQueryAccess } from "@/lib/access";
import {
  formatDate,
  isBeingWorkedOn,
  pointStatusLabel,
  queryStatusLabel,
  timeTaken,
} from "@/lib/format";
import { createExpiringLink } from "@/lib/storage";
import { MessageList } from "../../message-list";
import { RefreshWhileReading, RetryButton } from "../../reading-status";

export default async function QueryPage({
  params,
}: {
  params: Promise<{ id: string; queryId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id, queryId } = await params;
  const { letter, patient } = await orNotFound(requireQueryAccess(user, queryId));
  if (patient.id !== id) notFound();

  await logAccess(user, "view_query", patient.id, letter.id);
  const link = await createExpiringLink(letter.storageKey, 300, letter.fileName);

  const points = await db.orm.public.QueryPoint.where({ queryLetterId: letter.id })
    .include("document", (document) => document.select("id", "fileName"))
    .orderBy((point) => point.position.asc())
    .limit(200)
    .all();
  const messages = await db.orm.public.Message.where({ queryLetterId: letter.id })
    .orderBy((message) => message.channel.desc())
    .limit(2)
    .all();
  const taken = timeTaken(letter.startedAt, letter.finishedAt);
  const statusLabel = queryStatusLabel(letter.status, points);

  return (
    <>
      <Link className="text-link back-link" href={`/patients/${patient.id}?tab=queries`}>
        ← {patient.name}
      </Link>
      <div className="page-title">
        <h1 className="truncate">{letter.fileName}</h1>
        <a className="button button-quiet" href={link} target="_blank" rel="noreferrer">
          Open letter
        </a>
      </div>

      {isBeingWorkedOn(letter.status) && <RefreshWhileReading />}
      <dl className="profile">
        <div>
          <dt>Status</dt>
          <dd className="status-cell">
            <span className={letter.status.endsWith("failed") ? "badge badge-warn" : "badge"}>
              {statusLabel}
            </span>
            {letter.status.endsWith("failed") && <RetryButton url={`/api/queries/${letter.id}/retry`} />}
          </dd>
        </div>
        <div><dt>Uploaded</dt><dd>{formatDate(letter.createdAt)}</dd></div>
        <div><dt>Time taken</dt><dd>{taken ?? "—"}</dd></div>
        {letter.errorMessage && (
          <div className="profile-wide"><dt>Problem</dt><dd>{letter.errorMessage}</dd></div>
        )}
      </dl>

      <h2>What the insurer asked for</h2>
      {points.length === 0 ? (
        <div className="empty">
          <p>{isBeingWorkedOn(letter.status) ? "Working on this letter..." : "No points saved."}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Point</th>
                <th scope="col">Decision</th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.id}>
                  <td>{point.asksFor}</td>
                  <td>
                    <span className={point.status === "needs_team" ? "badge badge-warn" : "badge"}>
                      {pointStatusLabel(point.status)}
                    </span>
                  </td>
                  <td>
                    {point.reason}
                    {point.document && (
                      <p className="summary">
                        <Link className="text-link" href={`/patients/${patient.id}/documents/${point.document.id}`}>
                          {point.document.fileName}
                        </Link>
                      </p>
                    )}
                    {point.status === "already_in_locker" && !point.document && (
                      <p className="summary">This document has since been deleted.</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {messages.length > 0 && (
        <>
          <h2>Message to the patient</h2>
          <MessageList messages={messages} showDelivery />
        </>
      )}
    </>
  );
}
