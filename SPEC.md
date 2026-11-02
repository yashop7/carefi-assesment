# CareFi Patient Locker and Auto Query Response: Build Spec

The portal stores each patient's documents. When a query letter is added to a patient's locker, the system works out what the insurer wants, checks the locker, and tells the patient what's still needed on WhatsApp and email, with nobody clicking anything.

**Status:** proposed. Nothing in this spec is built yet except the repo setup and the `demo-langgraph.ts` prototype.

## 1. What CareFi will test

On the final day CareFi uploads query letters we've never seen into patient lockers. They check the system's decisions and whether the right messages reach their test phone and email.

| Judged on | Points | Where this spec covers it |
|---|---|---|
| Finds every point in the letter | 20 | `extractPoints`, section 7 |
| Asks only for what's missing | 25 | Document reading and `checkLocker`, sections 6 and 7 |
| Sends on WhatsApp and email automatically | 15 | `sendMessages`, section 7 |
| Clear message that follows the template | 10 | Section 8 |
| Easy portal | 15 | Section 9 |
| Speed from upload to message | 5 | Background run, section 6 |
| Care with patient data | 10 | Section 5 |

Accuracy is worth 45 of the 100 points, so stage 8 gets real time.

## 2. Stack

| Part | Choice |
|---|---|
| Monorepo | Turborepo with Bun |
| Portal and API | Next.js 16 with TypeScript, in `apps/web` |
| Database | Postgres 15 or newer, on Railway |
| Data layer | Prisma 8 `8.0.0-rc.21`, pinned exactly, in `packages/db` |
| Login | Better Auth with email and password |
| File storage | Private Railway bucket (S3-compatible) |
| Agent workflow | LangGraph.js with `PostgresSaver` |
| AI | OpenAI Responses API, with the model set by `OPENAI_MODEL` |
| WhatsApp | Twilio WhatsApp sandbox |
| Email | Resend with a verified domain |
| Hosting | One always-on Next.js service on Railway |

Don't update `@prisma/orm-postgres` on its own: rc.22 crashes `prisma contract emit` with the current CLI.

### Repo layout

```text
apps/web/
  app/                  Pages and API routes
  lib/auth.ts           Better Auth setup
  lib/access.ts         Every permission check lives here
  lib/storage.ts        Bucket upload and expiring links
  lib/documents.ts      AI reading of uploaded documents
  lib/agent/graph.ts    LangGraph workflow
  lib/agent/nodes.ts    One function per node
  lib/agent/ai.ts       OpenAI helper and response shapes
  lib/messaging/        Twilio, Resend and template filling
  instrumentation.ts    Resumes unfinished letters on startup
  scripts/              Admin creation and the bucket privacy check
packages/db/            Contract, migrations and database client
test-data/              Fake patients, letters and expected answers
```

Delete `apps/docs` and the sample `User` and `Post` models.

## 3. How a letter moves through the system

```text
Staff drops a letter on a patient's page
  -> file saved to bucket, QueryLetter row created, API responds at once
  -> agent runs in the background
       extractPoints -> checkLocker -> safetyChecks -> route
         needs a person      -> addToTeamQueue
         patient must send   -> buildMessage -> sendMessages
         nothing to do       -> finish
       sendMessages
         both sent           -> finish
         one failed          -> retry that channel only, up to 3 attempts
         still failing       -> alertTeam
  -> portal shows the points, decisions, message and delivery status
```

## 4. Database

This is the first thing to build. The contract below replaces `packages/db/src/prisma/contract.prisma`, and it passes `prisma contract emit` on the pinned version. It hasn't yet been applied to a real database.

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

### Why the tables look like this

- **`@@unique([queryLetterId, channel])` on `Message`:** a letter can only ever have one WhatsApp and one email message. This is what stops duplicates on a retry or restart.
- **`@@unique([patientId, sha256])` on `Document`:** uploading the same file twice for a patient shows "already in locker" and doesn't add a second copy.
- **`Document.summary` and `type`:** the AI reads each document once on upload, so the query check is fast and judges content, not just the file name.
- **`Document.nameMismatch`:** flags a document that seems to belong to someone else. It can't be used to answer a query until a person checks it.
- **`QueryLetter.startedAt` and `finishedAt`:** these show the speed for each letter in the portal.
- **`userId` columns are plain text:** Better Auth owns the `user` table (section 5), so those columns have no foreign key. All writes go through `lib/access.ts`.

### Other tables

| Tables | Owned by | Created by |
|---|---|---|
| `user`, `session`, `account`, `verification` | Better Auth | Better Auth CLI, stage 1 |
| Checkpoint tables | LangGraph | `PostgresSaver.setup()`, in a separate `langgraph` schema |

Run `prisma db verify` after creating them. If it objects to the Better Auth tables, move those to their own schema as well.

### Database commands

Run these from `packages/db`:

```bash
bunx prisma contract emit   # Rebuild contract.json and contract.d.ts
bunx prisma db update       # Apply the contract to a dev database
bunx prisma db verify       # Check the database matches the contract
```

Next.js has no Prisma 8 plugin, so add `prisma contract emit` as a prebuild step. `packages/db` also needs an `exports` entry so `apps/web` can import `db`.

## 5. Login and permissions

There's no public signup. Accounts are created by a seed script or by an admin. `role` is a Better Auth additional field with `input: false`, so users can't change their own role.

| Action | Admin | Agent | Patient |
|---|---|---|---|
| See patient list | All | Assigned only | None |
| Open patient profile and documents | All | Assigned only | Own only |
| Upload documents | All | Assigned only | Own only |
| Upload query letters | All | Assigned only | None |
| See query decisions and team reasons | All | Assigned only | None |
| See message history | All | Assigned only | Own only |
| Resolve team queue items | Yes | Assigned only | No |
| Edit templates, add patients, assign agents | Yes | No | No |
| See access log | Yes | No | No |

### Rules

1. Every page and API route calls `requirePatientAccess(user, patientId, action)` in `lib/access.ts`. Hiding a button is never the check.
2. An access failure returns 404, so someone can't discover which patients exist. It also writes a `denied` row to `AccessLog`.
3. The bucket is private. Files open through links that expire after 5 minutes, created only after the access check.
4. Opening a patient or document writes to `AccessLog`.
5. Logs carry IDs, never names, phone numbers, message text or document contents.
6. All secrets stay in environment variables.

Patient records are sent to OpenAI, Twilio and the email provider. Only fake and CareFi sample data goes through this build. A real launch would need agreements with those providers first.

## 6. Upload flows

### Document upload

1. Check access, type (PDF, JPG, PNG) and size (up to 20 MB).
2. Compute the SHA-256 and stop if this patient already has that file.
3. Save to the bucket and create the `Document` row with `readingStatus: pending`.
4. Read it in the background. The AI returns the type, summary, name on the document, date and whether it's readable.
5. Set `nameMismatch` if the name clearly differs from the patient's. Set `unreadable` if the file is too blurry to trust.

### Query letter drop

1. The patient page has a drag-and-drop box for a PDF or image.
2. Check access, save the file and create the `QueryLetter` row with `status: uploaded`.
3. Respond straight away, then start the agent with Next.js `after()`.
4. The page checks the status every 2 seconds and shows Reading -> Checking locker -> Sending -> Done.

If a document is still being read when a letter arrives, `checkLocker` waits up to 30 seconds for it. It then treats that document as unavailable and sends any point relying on it to the team.

### Bulk import

CareFi's patients may only arrive at evaluation, so an admin needs a fast way to load them:

- Upload a CSV with `patientCode, name, phone, email, policyNumber, claimNumber`.
- Upload a folder of files named `<patientCode>/<anything>`, or drop many files onto one patient.
- The import page shows reading progress for each file.

## 7. The agent

`lib/agent/graph.ts` uses the graph from `demo-langgraph.ts`, with these changes:

| Demo | Real app |
|---|---|
| Hard-coded patient and letter | Loaded from the database using `queryLetterId` |
| Text letter | The stored PDF or image is sent to the AI |
| `MemorySaver` | `PostgresSaver`, so progress survives a restart |
| `alreadySent` in memory | `Message` rows and the unique key |
| Simulated sending | Twilio and Resend |
| Results printed to the console | Saved to `QueryPoint` and `QueryLetter` |
| One test patient | `thread_id` is the `queryLetterId` |

### Nodes

| Node | Job | On failure |
|---|---|---|
| `extractPoints` | AI lists every separate request. One sentence asking for two things becomes two points. | Retry 3 times, then `status: failed` and it appears in the team queue |
| `checkLocker` | AI gives each point one status, using the saved document details. | Same as above |
| `safetyChecks` | Our code checks the AI's answers. | Bad answers go to the team |
| `addToTeamQueue` | Makes those points visible in the portal. | Not applicable |
| `buildMessage` | Our code fills the template. The AI writes only the request and reason text. | Not applicable |
| `sendMessages` | Sends on both channels. Retries only the failed one, waiting 1s and then 2s. | Goes to `alertTeam` after 3 attempts |
| `alertTeam` | Sets `delivery_failed` and shows it in the team queue. | Not applicable |

### Rules in `safetyChecks`

A point goes to the team if any of these is true:

- The AI skipped it.
- It cites a document that isn't in this patient's locker.
- The cited document has `nameMismatch`, or it's unreadable or still unread.
- The AI says the patient must send something but doesn't say what.

A letter with no points also goes to the team.

### AI rules

- Responses use `client.responses.parse` with a Zod shape, so the format is fixed.
- If there's no valid response, the system stops. No message is better than a wrong one.
- Letter contents are treated as data, never as instructions.
- A summary bill doesn't satisfy a request for an itemised bill. Judge by what's in the document.

### Duplicate sends

Before each send, `sendMessages` inserts or finds the `Message` row, and skips it if it's already `sent`. A crash exactly between the provider accepting a message and the database saving `sent` can still cause one repeat. That small risk is accepted for this build.

### Restart recovery

`instrumentation.ts` finds letters in `uploaded`, `reading`, `checking_locker` or `sending` on startup, and resumes each one with its `thread_id`.

### Final status

| Outcome | `QueryLetter.status` | Portal shows |
|---|---|---|
| Message delivered on both channels | `completed` | "Sent" |
| Everything already in the locker | `completed` | "No action needed" |
| Only team points | `completed` | "Needs team" |
| Message sent, and some points need a person | `completed` | "Sent, needs team" |
| A channel failed 3 times | `delivery_failed` | "Delivery failed", with a retry button |
| AI or system failure | `failed` | "Failed", with a retry button |

## 8. Message template

Our code fills in the template, so the format never changes. Admins can edit it in the portal, and it's replaced with CareFi's version when that arrives.

### Placeholders

| Placeholder | Example |
|---|---|
| `{{patient_name}}` | Asha Verma |
| `{{patient_id}}` | PAT-001 |
| `{{claim_number}}` | CL-9921 |
| `{{requested_items}}` | Numbered list of what's needed and why |

Saving a template with an unknown placeholder is rejected. Sending also stops if a placeholder has no value, and the letter goes to the team.

### Temporary template

```text
Hello {{patient_name}},

Your insurance company needs the following for your claim {{claim_number}}:

{{requested_items}}

Please send these as soon as you can. We already have your other documents, so
there is no need to send them again.

Team CareFi
```

Requested items are written in simple language and say why each one is needed:

```text
1. A hospital bill that lists each charge separately.
   Why: The insurer needs to see the room, medicine and surgeon charges.
```

## 9. Portal pages

| Route | Who | Shows |
|---|---|---|
| `/login` | Everyone | Email and password |
| `/patients` | Admin, agent | Search, ID, name, open items and latest query status |
| `/patients/[id]` | Admin, agent, own patient | Profile and tabs: Documents, Query letters, Messages |
| `/patients/new` | Admin | Add-patient form |
| `/patients/[id]/edit` | Admin | Edit a profile. The patient ID can't change |
| `/patients/[id]/documents/[documentId]` | Admin, agent, own patient | Document viewer, using an expiring link |
| `/patients/[id]/queries/[queryId]` | Admin, agent | Letter, each point with its decision and reason, cited document, message and delivery status, time taken |
| `/queue` | Admin, agent | Points needing a person and failed deliveries, with resolve and retry |
| `/admin/templates` | Admin | Template editor and preview |
| `/admin/import` | Admin | CSV and file import |
| `/admin/users` | Admin | Accounts and agent assignments |
| `/admin/access-log` | Admin | Who viewed what |

Status badges use the same words everywhere, and each page has clear empty and error states.

## 10. API routes

Every route checks login and permissions first.

| Route | Purpose |
|---|---|
| `/api/auth/[...all]` | Better Auth |
| `GET /api/health` | Railway's healthcheck. Public, and returns no patient data |
| `GET, POST /api/patients` | List and create patients |
| `GET, PATCH /api/patients/[id]` | Read and edit a profile |
| `POST /api/patients/[id]/documents` | Upload a document |
| `GET /api/documents/[id]/link` | Get an expiring file link |
| `POST /api/patients/[id]/queries` | Upload a letter and start the agent |
| `GET /api/queries/[id]` | Status, points and messages, used for the 2-second check |
| `POST /api/queries/[id]/retry` | Retry a failed letter or channel |
| `POST /api/points/[id]/resolve` | Mark a team item as handled |
| `GET, PUT /api/templates/[channel]` | Read and edit a template |
| `POST /api/import/patients` | Import the CSV |

## 11. Environment variables

These go in `.env` locally and Railway variables in production. Commit only `.env.example`.

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
ADMIN_EMAIL
ADMIN_PASSWORD
OPENAI_API_KEY
OPENAI_MODEL
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
RESEND_API_KEY
EMAIL_FROM
```

Railway also sets `NODE_ENV=production`, so the seed never adds the fake patient, plus `RAILPACK_BUN_VERSION` and `RAILPACK_NODE_VERSION`.

## 12. Build stages

Each stage ends with something you can test. Don't start a stage until the one before it passes.

### Stage 1: Database and foundation

- Replace the sample models with the contract in section 4, then emit and apply it.
- Create the Postgres database and private bucket on Railway.
- Add Better Auth with one seeded admin login.
- Deploy `apps/web` to Railway and delete `apps/docs`.

**Done when:** the app is live on a public link, you can log in, and `prisma db verify` passes.

### Stage 2: One patient locker

- Build the add-patient form, patient profile and tabs.
- Build document upload, duplicate check and the viewer with expiring links.

**Done when:** you can add a patient, upload a document, open it again, and a repeat upload is refused.

### Stage 3: Document reading

- Build the background reading step with status on the page.

**Done when:** a summary bill and an itemised bill get different types, a blurry scan is marked unreadable, and another person's document is flagged.

### Stage 4: Query drop and agent

- Build the drop box, background start and status page.
- Move the demo into `lib/agent`, using `PostgresSaver` and saving results as it goes.
- Keep sending simulated for now.

**Done when:** dropping a letter shows correct points and decisions without any more clicks.

### Stage 5: Real sending

- Connect Twilio and Resend, and add the template and message history.

**Done when:** a dropped letter reaches a real phone and inbox automatically, a forced failure retries only that channel, and restarting mid-run sends no duplicates.

### Stage 6: All patients

- Build the patient list and search, bulk import and the template editor.

**Done when:** 10 patients and their documents load in a few minutes, and an edited template shows up in the next message.

### Stage 7: Roles and privacy

- Add agent and patient accounts, assignments and the access checks.
- Add the access log and its page.

**Done when:** an agent gets a 404 for another agent's patient by page, API and file link, a patient sees only their own locker, and the denied attempts appear in the log.

### Stage 8: Accuracy testing

- Create 10 fake patients and 15-20 letters, each with a written correct answer.
- Add a script that scores points found and decisions made, then lists every miss.
- Include these difficult cases:
  - Several requests in one sentence
  - Scanned and blurry letters
  - Combined PDFs
  - A summary bill when an itemised bill is requested
  - A request for something already in the locker
  - A request only the hospital can answer
  - Another patient's document in the locker
  - Vague wording

**Done when:** you have a score, every miss has been reviewed, and the prompts are improved against it.

### Stage 9: Polish and rehearsal

- Finish the team queue, status badges, retry buttons and clear errors.
- Rehearse the whole evaluation on the live link with a letter you've never tested, and time it.
- Record a backup demo video.

**Done when:** someone new can follow a case without help, and the rehearsal passes end to end.

## 13. Risks

| Risk | Plan |
|---|---|
| Twilio's sandbox sends only to numbers that have joined, and joining can expire | Get CareFi's number early, and have it join and send a message shortly before the evaluation |
| WhatsApp may block free-form messages if the number hasn't messaged recently | Test the same sequence yourself and confirm it first |
| Resend needs a verified domain to reach CareFi's address | Verify a domain in stage 5 |
| CareFi's data and template arrive late | Bulk import and the template editor |
| Blurry scans read badly | Test in stage 3, and send doubtful documents to the team |
| Prisma 8 is a release candidate | Stay on the pinned version, and don't update before the evaluation |
| Better Auth or checkpoint tables conflict with Prisma | `db update` plans to drop any table in `public` that isn't in the contract. Better Auth's tables live in an `auth` schema, and stage 4's checkpoint tables also need their own schema |

## 14. Open questions for CareFi

1. What are the evaluation date and time?
2. What test phone number and email will they use?
3. Should the messages go to the test contacts in the patient profiles?
4. When will the message template arrive?
5. Should the patient get a message when everything is already in the locker? This spec sends nothing and shows "No action needed".
6. Will they upload through the portal themselves? This spec assumes yes, using an agent or admin login we give them.
