import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, logAccess, orNotFound, requireDocumentAccess } from "@/lib/access";
import { createExpiringLink } from "@/lib/storage";

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
