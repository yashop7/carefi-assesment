import { db } from "db";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin } from "@/lib/api";
import { templateProblem } from "@/lib/messaging/template";

type Context = { params: Promise<{ channel: string }> };

const templateSchema = z.object({
  subject: z.string().trim().max(200).nullish(),
  body: z.string().trim().min(1, "Enter the message").max(4000),
});

export async function PUT(request: Request, { params }: Context) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    await requireAdmin(user);

    const { channel } = await params;
    if (channel !== "whatsapp" && channel !== "email") return apiError(404, "Not found");

    const parsed = templateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Check the template");

    const subject = channel === "email" ? parsed.data.subject || null : null;
    if (channel === "email" && !subject) return apiError(400, "Enter the email subject");

    const problem = templateProblem(parsed.data.body, subject);
    if (problem) return apiError(400, problem);

    const template = await db.orm.public.Template.where({ channel }).update({
      subject,
      body: parsed.data.body,
      updatedBy: user.id,
    });
    if (!template) return apiError(404, "Not found");
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
