import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, logAccess, orNotFound, requireDocumentAccess } from "@/lib/access";
import { documentTypeLabel, isBeingRead } from "@/lib/format";
import { createExpiringLink } from "@/lib/storage";
import { RefreshWhileReading, RetryReading } from "../../reading-status";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id, documentId } = await params;
  const { document, patient } = await orNotFound(requireDocumentAccess(user, documentId));
  if (patient.id !== id) notFound();

  await logAccess(user, "view_document", patient.id, document.id);
  const link = await createExpiringLink(document.storageKey, 300, document.fileName);

  return (
    <>
      <Link className="text-link back-link" href={`/patients/${patient.id}`}>
        ← {patient.name}
      </Link>
      <div className="page-title">
        <h1 className="truncate">{document.fileName}</h1>
        <a className="button button-quiet" href={link} target="_blank" rel="noreferrer">
          Open in new tab
        </a>
      </div>
      {isBeingRead(document.readingStatus) && (
        <>
          <p className="muted">Reading this document...</p>
          <RefreshWhileReading />
        </>
      )}
      {document.readingStatus === "unreadable" && (
        <p className="field-error">This file is too unclear to trust. Upload a clearer copy.</p>
      )}
      {document.readingStatus === "failed" && (
        <p className="field-error">
          Reading failed. <RetryReading documentId={document.id} />
        </p>
      )}
      {document.nameMismatch && (
        <p className="field-error">
          The name on this document ({document.nameOnDocument}) doesn&apos;t match this patient.
        </p>
      )}
      {document.readingStatus === "done" && (
        <dl className="profile">
          <div><dt>Type</dt><dd>{documentTypeLabel(document.type)}</dd></div>
          <div><dt>Name on document</dt><dd>{document.nameOnDocument ?? "—"}</dd></div>
          <div><dt>Date</dt><dd>{document.documentDate ?? "—"}</dd></div>
          <div className="profile-wide"><dt>Summary</dt><dd>{document.summary}</dd></div>
        </dl>
      )}
      <p className="muted">
        This secure link lasts 5 minutes. Reload the page if the file stops loading.
      </p>
      {document.mimeType === "application/pdf" ? (
        <iframe className="viewer" src={link} title={document.fileName} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a signed bucket link, so it can't go through the image optimizer
        <img className="viewer-image" src={link} alt={document.fileName} />
      )}
    </>
  );
}
