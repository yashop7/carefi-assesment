import { logAccess, requireDocumentAccess, requireUser } from "@/lib/access";
import { handleRouteError } from "@/lib/api";
import { createExpiringLink } from "@/lib/storage";

const EXPIRES_IN = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { document } = await requireDocumentAccess(user, id);
    await logAccess(user, "view_document", document.patientId, document.id);
    const url = await createExpiringLink(
      document.storageKey,
      EXPIRES_IN,
      document.fileName,
    );
    return Response.json(
      { url, expiresIn: EXPIRES_IN },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
