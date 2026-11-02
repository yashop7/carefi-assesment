# Plan: Stage 02 — One Patient Locker

Spec: `.claude/specs/02-patient-locker.md`. Branch: `feature/patient-locker`. No contract change.

## Steps

1. **Confirm how the ORM reports a unique-key failure.** Run a duplicate `Patient.create` against a throwaway Postgres and record the error's shape. `isUniqueViolation` is written against what it actually throws, not what the docs imply.
2. **Add `zod`** to `apps/web`, pinned to 4.6.7.
3. **Write the helpers:** `lib/access.ts`, `lib/api.ts`, `lib/patients.ts`, `lib/uploads.ts`, `lib/format.ts`, and the file name option on `createExpiringLink`.
4. **Write the patient routes:** `GET, POST /api/patients` and `GET, PATCH /api/patients/[id]`.
5. **Write the document routes:** `POST /api/patients/[id]/documents` and `GET /api/documents/[id]/link`.
6. **Write the pages:** role redirect at `/`, header layout, list, add, profile with tabs, edit, viewer, and the error and 404 pages. Then the client pieces: patient form and drop box. Then the styles.
7. **Update the docs:** `SPEC.md` section 9 and `README.md`.
8. **Static checks:** `check-types`, `lint`, and the build with no variables set.
9. **Rehearse against a throwaway Postgres, with the real bucket and fake data only.** A script in the scratchpad covers every Definition of done item that an API can prove:
   - Run `deploy:prepare` on an empty database, and make test agent and patient accounts through `auth.$context`.
   - Start `next start`, then exercise patients, documents, access, logging and failures.
   - Search the server output for the fake names, phones, emails, file names and signed links.
   - Delete every test object from the bucket afterwards.
10. **Browser check on localhost with generated test accounts:** login, add patient, a field error, drag-and-drop upload, duplicate message, viewer showing a PDF and an image, tabs, and both colour schemes.
11. **Fix whatever steps 9 and 10 find**, and rerun them.
12. **Ship with `.claude/skills/ship-feature.md`:**
    - Commit and push `feature/patient-locker`, then open and squash merge the PR through the GitHub MCP.
    - Railway deploys from whichever branch it's set to. Check the live deploy actually carries this stage before calling it done.
    - Delete the branch only after that.

## Things to watch

- **`AccessLog.patientId` has a foreign key.** A refusal for a patient that doesn't exist must write `patientId: null`, or the log write itself fails and hides the refusal.
- **Layouts don't rerun on navigation.** Each page repeats its own access check, so the layout's check is only for the header.
- **Document pages:** check access against the document's own `patientId`, never the one in the URL.
- **`request.formData()` buffers the whole body,** so the size check on `Content-Length` must come first.
- **The build runs with no variables,** so nothing may touch the database or bucket at import time. `db.ts` already works this way for the health route.
- **A viewer inside an iframe depends on the bucket's headers.** Check this on the real bucket, since the emulator won't show it. "Open in new tab" stays as the way out.
- **The live admin login is the user's to do,** because the real password isn't used by me on production.
