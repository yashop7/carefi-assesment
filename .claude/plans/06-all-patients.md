# Plan: Stage 06 — All patients

1. `apps/web/lib/access.ts`: include each patient's latest letter and its points in `listPatientsFor`.
2. `apps/web/lib/format.ts`: add `openItems`.
3. `apps/web/app/patients/patient-table.tsx`: new client table with the search box. `patients/page.tsx` uses it and links to import and templates for admins.
4. `apps/web/lib/import.ts`: `parseCsv` and row checks. `apps/web/app/api/import/patients/route.ts`: new admin route.
5. `apps/web/app/admin/layout.tsx`: reuse the patients layout.
6. `apps/web/app/admin/import/`: page with reading progress, and a client form for the CSV and folder. Folder files post to the existing documents route.
7. `apps/web/lib/messaging/template.ts`: add the allowed placeholders and their check. `apps/web/app/api/templates/[channel]/route.ts`: new admin `PUT`.
8. `apps/web/app/admin/templates/`: page and a client form with the preview.
9. `packages/db/src/seed.ts`: new wording. `globals.css`: textarea style. `SPEC.md` and `README.md`: notes.
10. Test on a throwaway Postgres with stand-in OpenAI, providers and S3, so nothing reaches the real bucket. Then type checks, lint and build.
