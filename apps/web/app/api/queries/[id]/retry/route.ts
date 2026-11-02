import { db } from "db";
import { after } from "next/server";
import { requireQueryAccess, requireUser } from "@/lib/access";
import { runAgent } from "@/lib/agent/graph";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    const { id } = await params;
    const { letter } = await requireQueryAccess(user, id);

    // One update, so a double click can't start two runs.
    const claimed = await db.orm.public.QueryLetter.where({ id: letter.id, status: "failed" }).update({
      status: "uploaded",
      errorMessage: null,
    });
    if (!claimed) return apiError(409, "This letter hasn't failed");

    after(() => runAgent(letter.id));
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    return handleRouteError(error);
  }
}
