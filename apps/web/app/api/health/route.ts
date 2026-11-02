import { db } from "db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.orm.public.Template.first();
    return Response.json({ ok: true });
  } catch {
    // The error can contain the connection string, so it's never logged or returned.
    return Response.json({ ok: false }, { status: 503 });
  }
}
