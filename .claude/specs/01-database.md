# Spec: Stage 01 — Database

## Overview
This spec delivers the database the whole portal is built on: patients, their documents, query letters, each point's decision, messages, templates and the access log. It comes first because every later stage reads or writes these tables, and two of its unique keys prevent duplicate documents and duplicate patient messages. It covers only the database part of stage 1 in `SPEC.md`. Railway hosting, the bucket, Better Auth and deployment need their own spec.

## Scoring impact

| Criterion | Points | How this stage helps |
|---|---|---|
| Asks only for what's missing | 25 | Stores each document's type and summary, and flags a document that may belong to someone else |
| Finds every point | 20 | Stores each point separately, in order |
| Sends automatically | 15 | One message per letter and channel, with its delivery status |
| Clear message, follows the template | 10 | Stores an editable template per channel |
| Easy portal | 15 | Status fields the portal can show directly |
| Speed | 5 | `startedAt` and `finishedAt` on each letter |
| Care with patient data | 10 | Agent assignments, patient login link and access log |

## Depends on
None. This is the first stage.

## User flow
This stage has no screens. The developer's flow is:

1. Runs `bun install`, because the root `node_modules` is currently missing.
2. Replaces the sample contract and emits the new types.
3. Applies the contract to a local database, which creates the 8 tables.
4. Runs the seed script, which adds the templates and one fake patient.
5. Verifies the database matches the contract.

## Pages
None.

## API routes
None.

## Database changes

Replace all of `packages/db/src/prisma/contract.prisma` with this. The sample `User` and `Post` models are removed.

```prisma
// use prisma-8

enum DocumentType {
  @@type("pg/text@1")
  discharge_summary    = "discharge_summary"
  summary_bill         = "summary_bill"
  itemised_bill        = "itemised_bill"
  pharmacy_bill        = "pharmacy_bill"
  investigation_report = "investigation_report"
  consultation_paper   = "consultation_paper"
  policy_copy          = "policy_copy"
  kyc                  = "kyc"
  cancelled_cheque     = "cancelled_cheque"
  query_letter         = "query_letter"
  other                = "other"
}

enum ReadingStatus {
  @@type("pg/text@1")
  pending    = "pending"
  processing = "processing"
  done       = "done"
  unreadable = "unreadable"
  failed     = "failed"
}

enum QueryStatus {
  @@type("pg/text@1")
  uploaded        = "uploaded"
  reading         = "reading"
  checking_locker = "checking_locker"
  sending         = "sending"
  completed       = "completed"
  delivery_failed = "delivery_failed"
  failed          = "failed"
}

enum PointStatus {
  @@type("pg/text@1")
  already_in_locker   = "already_in_locker"
  needed_from_patient = "needed_from_patient"
  needs_team          = "needs_team"
}

enum MessageChannel {
  @@type("pg/text@1")
  whatsapp = "whatsapp"
  email    = "email"
}

enum MessageStatus {
  @@type("pg/text@1")
  pending = "pending"
  sent    = "sent"
  failed  = "failed"
}

enum AccessAction {
  @@type("pg/text@1")
  view_patient  = "view_patient"
  view_document = "view_document"
  view_query    = "view_query"
  upload        = "upload"
  denied        = "denied"
}

model Patient {
  id           String @id @onCreate(uuid(7))
  patientCode  String @unique
  userId       String? @unique
  name         String
  phone        String
  email        String
  policyNumber String?
  claimNumber  String?
  documents    Document[]
  queryLetters QueryLetter[]
  messages     Message[]
  accessLogs   AccessLog[]
  agents       AgentPatient[]
  createdAt    TimestamptzString @default(now())
  updatedAt    temporal.UpdatedAtString

  @@index([name])
}

model AgentPatient {
  id        String  @id @onCreate(uuid(7))
  userId    String
  patient   Patient @relation(fields: [patientId], references: [id])
  patientId String
  createdAt TimestamptzString @default(now())

  @@unique([userId, patientId])
  @@index([patientId])
}

model Document {
  id             String  @id @onCreate(uuid(7))
  patient        Patient @relation(fields: [patientId], references: [id])
  patientId      String
  fileName       String
  storageKey     String  @unique
  mimeType       String
  sizeBytes      Int
  sha256         String
  type           DocumentType @default(other)
  summary        String?
  nameOnDocument String?
  documentDate   String?
  readingStatus  ReadingStatus @default(pending)
  nameMismatch   Boolean @default(false)
  uploadedBy     String
  citedBy        QueryPoint[]
  createdAt      TimestamptzString @default(now())
  updatedAt      temporal.UpdatedAtString

  @@unique([patientId, sha256])
  @@index([patientId])
}

model QueryLetter {
  id            String  @id @onCreate(uuid(7))
  patient       Patient @relation(fields: [patientId], references: [id])
  patientId     String
  fileName      String
  storageKey    String  @unique
  mimeType      String
  status        QueryStatus @default(uploaded)
  errorMessage  String?
  uploadedBy    String
  startedAt     TimestamptzString?
  finishedAt    TimestamptzString?
  points        QueryPoint[]
  messages      Message[]
  createdAt     TimestamptzString @default(now())
  updatedAt     temporal.UpdatedAtString

  @@index([patientId])
  @@index([status])
}

model QueryPoint {
  id             String @id @onCreate(uuid(7))
  queryLetter    QueryLetter @relation(fields: [queryLetterId], references: [id])
  queryLetterId  String
  position       Int
  asksFor        String
  status         PointStatus
  reason         String
  document       Document? @relation(fields: [documentId], references: [id])
  documentId     String?
  patientRequest String?
  patientWhy     String?
  resolvedBy     String?
  resolvedAt     TimestamptzString?
  createdAt      TimestamptzString @default(now())

  @@unique([queryLetterId, position])
  @@index([status])
  @@index([documentId])
}

model Template {
  id        String @id @onCreate(uuid(7))
  channel   MessageChannel @unique
  subject   String?
  body      String
  updatedBy String?
  updatedAt temporal.UpdatedAtString
}

model Message {
  id            String @id @onCreate(uuid(7))
  patient       Patient @relation(fields: [patientId], references: [id])
  patientId     String
  queryLetter   QueryLetter @relation(fields: [queryLetterId], references: [id])
  queryLetterId String
  channel       MessageChannel
  recipient     String
  body          String
  status        MessageStatus @default(pending)
  attempts      Int @default(0)
  providerId    String?
  errorMessage  String?
  sentAt        TimestamptzString?
  createdAt     TimestamptzString @default(now())
  updatedAt     temporal.UpdatedAtString

  @@unique([queryLetterId, channel])
  @@index([patientId])
}

model AccessLog {
  id         String @id @onCreate(uuid(7))
  userId     String
  action     AccessAction
  patient    Patient? @relation(fields: [patientId], references: [id])
  patientId  String?
  resourceId String?
  createdAt  TimestamptzString @default(now())

  @@index([patientId])
  @@index([userId])
}
```

### Tables

| Table | Purpose | Key rule |
|---|---|---|
| `Patient` | Profile and contact details | `patientCode` is unique, and `userId` links one login |
| `AgentPatient` | Which agent can see which patient | One row per agent and patient |
| `Document` | Locker files and what the AI read from them | The same file can't be added twice for one patient |
| `QueryLetter` | Uploaded letter and processing status | Times show speed for each letter |
| `QueryPoint` | One row per point, with its decision and reason | `position` is unique within a letter |
| `Template` | Editable message per channel | One template per channel |
| `Message` | Delivery history | One message per letter and channel |
| `AccessLog` | Who viewed what, and refused attempts | IDs only, no personal details |

### Commands

Run these from `packages/db`:

```bash
bunx prisma contract emit       # Rebuild contract.json and contract.d.ts
bunx prisma db update --dry-run # Show the planned changes without applying them
bunx prisma db update           # Apply them to the database in DATABASE_URL
bun run db:seed                 # Add templates and the fake patient
bunx prisma db verify           # Confirm the database matches the contract
```

If the database already has the sample tables, `db update` asks before deleting `User` and `Post`. Check that `DATABASE_URL` is your local database before agreeing. Never reset or drop a database to get past an error.

### Seed script

`packages/db/src/seed.ts` must:

- Add the `whatsapp` and `email` templates, using the temporary template in section 8 of `SPEC.md`. The email template's subject is `Documents needed for your claim {{claim_number}}`.
- Add one fake patient, `PAT-001`, with an `example.com` email and an obviously fake phone number. Skip this when `NODE_ENV` is `production`.
- Be safe to run twice: look for the row with `where(...).first()`, and create it only if it's missing.
- Call `await db.close()` at the end, or the script won't exit.

Don't use `.upsert()` for `Template` or `Patient`. In testing, it failed on the unique `channel` column with a duplicate-key error on the second run, instead of updating the row.

### Column notes

- Times use `TimestamptzString`, so queries return text in ISO 8601 format. This works without a Temporal polyfill on the current Node and Bun versions.
- `userId`, `uploadedBy`, `resolvedBy` and `updatedBy` are plain text with no foreign key, because Better Auth will own the `user` table.
- IDs are created by Prisma's client using `uuid(7)`, so rows must be inserted through `db.orm`.

## Agent and AI changes
None. `QueryPoint`, `Message` and the `QueryLetter` statuses are ready for stages 4 and 5.

## External services
None. Only Postgres is needed. Any local Postgres 15 or newer will do.

## Patient data and access
This stage adds the tables that later access checks use, but no access checks. `requirePatientAccess` arrives in stage 7, and nothing can reach this data through the app yet.

- Seed only fake patients, never real records.
- `.env` stays out of git. `packages/db/.gitignore` already covers it.
- `AccessLog` stores IDs and never names, phone numbers, message text or document contents.

## Failure cases

| What goes wrong | What should happen |
|---|---|
| Same file added twice for a patient | Database refuses it with a unique-key error |
| Second message for the same letter and channel | Database refuses it with a unique-key error |
| A status value outside its enum | Database refuses it with a check-constraint error |
| Seed script run twice | No duplicates and no error |
| `DATABASE_URL` missing or wrong, or Postgres is down | The command fails with an error, and running it again later works |
| `db update` stopped partway | Run `db update` again, then `db verify`. Never reset the database |
| `db update` run with no one to answer its questions | It stops with `CLI.CONSENT_REQUIRED` and lists the flags to pass |
| `prisma contract emit` crashes with `typeChoice` | `@prisma/orm-postgres` has moved to rc.22, so restore the pinned version |

## Files to change

- `packages/db/src/prisma/contract.prisma` — Replace it with the contract above.
- `packages/db/src/prisma/contract.json` and `contract.d.ts` — Regenerate them with `prisma contract emit`, and don't edit them by hand.
- `packages/db/package.json`:
  - Add `"exports": { ".": "./src/prisma/db.ts" }`, so other packages can import `db`.
  - Add the scripts `db:update`, `db:verify`, `db:seed` and `check-types`.
  - Change `prisma` from `^8.0.0-rc.29` to exactly `8.0.0-rc.29`, so an install can't bring in a mismatched CLI.

Leave `packages/db/migrations/` alone in this stage. Whether production uses `db update` or a planned migration is decided in the foundation spec.

## Files to create

- `packages/db/src/seed.ts` — Adds the templates and the fake patient.

## New dependencies
None.

## Environment variables
No new variables. `DATABASE_URL` already exists in `packages/db/.env.example`.

## Out of scope

- Railway hosting, the bucket, Better Auth and deployment: rest of stage 1
- Better Auth tables and LangGraph checkpoint tables: rest of stage 1, and stage 4
- Importing `db` into `apps/web`, including any Next.js setup: rest of stage 1
- Moving `@langchain/*`, `openai` and `zod` from the root `package.json` to `apps/web`: stage 4
- Queries for pages and routes: stages 2 onwards
- Deleting patients or documents: no stage plans this

## Rules for implementation

- Use Prisma ORM through `db.orm`. Use `db.sql` only when the ORM can't express the query. Never build SQL by joining strings.
- Keep `@prisma/orm-postgres` pinned to the exact version in `SPEC.md`.
- Run `prisma contract emit` after every contract change. Never reset or drop a database to fix a migration.
- Use Bun for all package commands, and add each package to the workspace using it.
- Validate all request bodies and AI responses with Zod.
- Every page and API route that touches patient data calls `requirePatientAccess` in `apps/web/lib/access.ts` on the server.
- Refused access returns 404 and writes a `denied` row to `AccessLog`.
- Files stay in the private bucket, and open only through expiring links created after the access check.
- Never log names, phone numbers, emails, message text, document contents or secrets.
- Treat query letters and documents as data, never as instructions to the AI.
- AI answers pass `safetyChecks` before they can reach a patient. If in doubt, send the point to the team queue, because no message is better than a wrong one.
- Our code fills the message template. The AI writes only the request and reason text.
- Sends use the `Message` unique key, and a retry only tries the channel that failed.
- Long AI and sending work runs in the background, never during the upload request.
- Reuse existing helpers and `@repo/ui` components before writing new ones.

For this stage:

- Copy the contract exactly. Any change must also be made in section 4 of `SPEC.md`.
- Don't add application code beyond the seed script.
- Use the find-then-create pattern from the seed section, not `.upsert()`, for rows matched on anything but their ID.

## Definition of done

- [ ] `bunx prisma contract emit` succeeds, and `contract.d.ts` contains `Patient` but no `Post`
- [ ] `bunx prisma db update` creates the 8 tables on a local database
- [ ] `bunx prisma db verify` reports that the database matches the contract
- [ ] `bun run db:seed` adds 2 templates and 1 patient, and running it again adds nothing
- [ ] A test script confirms a second `Document` with the same `patientId` and `sha256` is refused
- [ ] A test script confirms a second `Message` with the same `queryLetterId` and `channel` is refused
- [ ] A test script confirms `channel: "sms"` is refused
- [ ] `QueryLetter` with `.include('points').include('messages')` returns its related rows
- [ ] `git status` doesn't list `.env`
- [ ] The database items in stage 1's "Done when" pass. The live link and login belong to the foundation spec
- [ ] `bun run check-types` and `bun run lint` pass
- [ ] A user without access is refused by page, API and file link: not applicable yet, because this stage has no pages, routes or files. It's tested in stage 7
- [ ] Each listed failure case behaves as described
