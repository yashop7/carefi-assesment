import { db } from "db";
import { requireAdmin, requireUser } from "@/lib/access";
import { apiError, handleRouteError, isForeignOrigin, isUniqueViolation } from "@/lib/api";
import { readPatientRows } from "@/lib/import";
import { newPatientSchema } from "@/lib/patients";

const MAX_CSV_BYTES = 1024 * 1024;
const MAX_ROWS = 1000;

export async function POST(request: Request) {
  if (isForeignOrigin(request)) return apiError(403, "Forbidden");
  try {
    const user = await requireUser();
    await requireAdmin(user);

    const length = Number(request.headers.get("content-length"));
    if (!length) return apiError(400, "Choose a CSV file");
    if (length > MAX_CSV_BYTES) return apiError(413, "This CSV is over the 1 MB limit");

    const { missing, rows } = readPatientRows(await request.text());
    if (missing.length > 0) return apiError(400, `Missing columns: ${missing.join(", ")}`);
    if (rows.length === 0) return apiError(400, "This CSV has no patients");
    if (rows.length > MAX_ROWS) return apiError(413, `Import up to ${MAX_ROWS} patients at a time`);

    let added = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    for (const [index, row] of rows.entries()) {
      // The header is row 1, so this matches what a spreadsheet shows.
      const rowNumber = index + 2;
      const parsed = newPatientSchema.safeParse(row);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ row: rowNumber, message: `${String(issue?.path[0])}: ${issue?.message}` });
        continue;
      }
      try {
        await db.orm.public.Patient.create(parsed.data);
        added++;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        skipped++;
      }
    }

    return Response.json({ added, skipped, errors });
  } catch (error) {
    return handleRouteError(error);
  }
}
