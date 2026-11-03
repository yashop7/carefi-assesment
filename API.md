# CareFi Patient Locker: API and Responsibility Guide

This guide explains what each part of the system does, who can call each API, and what the AI decides. It describes the code on `main`.

**Contents**

1. [How the system fits together](#1-how-the-system-fits-together)
2. [Who is responsible for what](#2-who-is-responsible-for-what)
3. [Roles and access rules](#3-roles-and-access-rules)
4. [API access table](#4-api-access-table)
5. [API reference](#5-api-reference)
6. [Portal pages](#6-portal-pages)
7. [What the AI does](#7-what-the-ai-does)
8. [How a query letter moves through the system](#8-how-a-query-letter-moves-through-the-system)
9. [Database tables](#9-database-tables)
10. [Outside services](#10-outside-services)
11. [Environment variables](#11-environment-variables)
12. [Known limits](#12-known-limits)

---

## 1. How the system fits together

There is one web app. It serves the portal and the API, and runs the AI agent in the background after a request has been answered.

```text
 Admin / Agent / Patient                         Patient's phone
           |                                           |
           | browser, logged-in session                | sends "hi"
           v                                           v
 +-------------------------------+                  Twilio
 |  apps/web (Next.js on Railway)| <--- webhook ------+
 |                               | --- reply text --->
 |  Pages       what people see  |
 |  API routes  what people do   | ---> OpenAI   reads files, makes decisions
 |  lib/access  who can do it    | ---> Resend   sends email
 |  lib/agent   LangGraph agent  | ---> Meta     sends WhatsApp, only if set up
 +-------------------------------+
           |              |
           v              v
       PostgreSQL     Tigris bucket
       the records    the files (private)
```

---

## 2. Who is responsible for what

### Apps and packages

| Location | Responsible for |
|---|---|
| `apps/web` | The portal, the API routes, the agent and all sending |
| `packages/db` | The database schema, migrations, the seed script and the shared `db` client |
| `packages/eslint-config` | Shared lint rules |
| `packages/typescript-config` | Shared TypeScript settings |

### Code inside `apps/web`

| File or folder | Responsible for |
|---|---|
| `app/**/page.tsx` | Portal pages. Each page makes its own access check |
| `app/api/**/route.ts` | The API routes in [section 5](#5-api-reference) |
| `instrumentation.ts` | On startup, carries on with documents and letters that a restart interrupted |
| `lib/access.ts` | Every permission check, the access log, and the patient list for each role |
| `lib/api.ts` | Error responses, and refusing requests from other websites |
| `lib/auth.ts`, `lib/auth-client.ts` | Login, with Better Auth. Public signup is off |
| `lib/users.ts` | Creating accounts and linking a patient account to a locker |
| `lib/patients.ts` | Checking patient fields such as phone, email and patient ID |
| `lib/import.ts` | Reading the patient CSV |
| `lib/uploads.ts` | File size limit, file type check from the content, and storage paths |
| `lib/storage.ts` | Saving, reading and deleting bucket files, and 5-minute file links |
| `lib/documents.ts` | Reading a locker document with AI, and comparing names |
| `lib/agent/graph.ts` | The order of the agent's steps, saved progress and resuming |
| `lib/agent/nodes.ts` | What each agent step does, including the safety checks |
| `lib/agent/ai.ts` | The two AI prompts for query letters and the shape of their answers |
| `lib/messaging/template.ts` | Checking and filling message templates |
| `lib/messaging/send.ts` | Calling Resend and Meta |
| `lib/format.ts` | Labels shown in the portal, and how open items are counted |
| `scripts/create-admin.ts` | Creating the first admin from environment variables |
| `scripts/score-letters.ts` | Scoring the agent against the test letters, on local services only |

### Who decides what

| Decision | Made by |
|---|---|
| What a document is and what it contains | AI |
| What a query letter is asking for | AI |
| Whether each request is in the locker, needed from the patient, or needs the team | AI, then checked by code |
| Whether an AI answer can be trusted | Code (`safetyChecks`) |
| Whether a name matches the patient | Code (`namesDiffer`) |
| Who can see or change something | Code (`lib/access.ts`) |
| The wording and format of the message around the requested items | The template, filled in by code |
| The wording of each requested item and its reason | AI |
| When and where a message is sent | Code |
| Anything the system isn't sure about | A person, through the team queue |

---

## 3. Roles and access rules

| Role | Who | Reach | How the account is made |
|---|---|---|---|
| `admin` | CareFi manager | All patients and all settings | `scripts/create-admin.ts` |
| `agent` | CareFi team member | Only patients assigned to them | An admin, on the Accounts page |
| `patient` | The patient | Only their own locker | An admin, on the Accounts page |

### What each role can do

| Action | Admin | Agent | Patient |
|---|---|---|---|
| See the patient list | All | Assigned | No |
| Open a profile and its documents | All | Assigned | Own |
| Upload documents | All | Assigned | Own |
| Retry a failed document reading | All | Assigned | Own |
| Delete documents | All | Assigned | No |
| See messages | All | Assigned | Own, without delivery details |
| Upload, open, retry and delete query letters | All | Assigned | No |
| Use the team queue | All | Assigned | No |
| Add or edit patients, import a CSV | Yes | No | No |
| Add accounts, assign patients to agents | Yes | No | No |
| Edit templates, see the access log | Yes | No | No |

### How the checks work

- **The server always checks.** Hiding a button is never the protection. Each page and route runs a check from `lib/access.ts`.
- **The check uses the record's own patient.** For a document, letter or point, the patient comes from the database row, never from the URL.
- **A refusal looks like a missing page.** The response is 404, so nobody can find out which patients exist, and a `denied` row goes in the access log.
- **Files stay private.** Files open through links that last 5 minutes, and a link is made only after the access check.
- **Roles can't be self-assigned.** The `role` field can't be set through a login or profile request, and the Accounts form can only create agents and patients.

| Check | Allows |
|---|---|
| `requireUser` | Anyone logged in |
| `requireAdmin` | Admin |
| `requireStaff` | Admin and agent |
| `requirePatientAccess` | Admin, the assigned agent, the patient themselves |
| `requireDocumentAccess` | Same as above, using the document's patient |
| `requireStaffAccess` | Admin and the assigned agent |
| `requireStaffDocumentAccess` | Same as above, using the document's patient |
| `requireQueryAccess` | Same as above, using the letter's patient |
| `requirePointAccess` | Same as above, using the patient of the point's letter |

---

## 4. API access table

"Assigned" means an agent who is assigned to that patient. "Own" means the patient the locker belongs to.

| Method and route | Public | Admin | Agent | Patient | Writes to access log |
|---|---|---|---|---|---|
| `GET /api/health` | Yes | Yes | Yes | Yes | No |
| `GET`, `POST /api/auth/*` | Yes | Yes | Yes | Yes | No |
| `POST /api/whatsapp` | Twilio only | No | No | No | No |
| `POST /api/patients` | No | Yes | No | No | No |
| `PATCH /api/patients/[id]` | No | Yes | No | No | No |
| `POST /api/import/patients` | No | Yes | No | No | No |
| `POST /api/patients/[id]/documents` | No | Yes | Assigned | Own | `upload` |
| `POST /api/documents/[id]/read` | No | Yes | Assigned | Own | No |
| `DELETE /api/documents/[id]` | No | Yes | Assigned | No | `delete_file` |
| `POST /api/patients/[id]/queries` | No | Yes | Assigned | No | `upload` |
| `POST /api/queries/[id]/retry` | No | Yes | Assigned | No | No |
| `DELETE /api/queries/[id]` | No | Yes | Assigned | No | `delete_file` |
| `POST /api/points/[id]/resolve` | No | Yes | Assigned | No | No |
| `POST /api/users` | No | Yes | No | No | No |
| `POST /api/users/[id]/patients` | No | Yes | No | No | No |
| `DELETE /api/users/[id]/patients/[patientId]` | No | Yes | No | No | No |
| `PUT /api/templates/[channel]` | No | Yes | No | No | No |

Any refused request also writes a `denied` row, except a request with no login or from another website.

---

## 5. API reference

### Rules for every logged-in route

Each route runs these checks in order:

1. **Origin:** a browser request from another website gets 403.
2. **Login:** no valid session gets 401.
3. **Access:** no permission gets 404, and a `denied` row in the access log.
4. **Input:** bad input gets 400, 413 or 415, depending on the problem.

Errors look like this:

```json
{ "error": "A message that is safe to show" }
```

| Status | Meaning |
|---|---|
| 400 | The input is wrong or missing |
| 401 | Not logged in |
| 403 | The request came from another website, or the Twilio signature is wrong |
| 404 | The record doesn't exist, or this user isn't allowed to know about it |
| 409 | The action conflicts with the current state |
| 413 | The file or CSV is too large |
| 415 | The file isn't a PDF, JPG or PNG |
| 503 | A service failed. Logs hold only the error name, never its message |

### Public

#### `GET /api/health`

Railway's healthcheck. It runs one small database query and returns no patient data.

- **Returns:** `200 { "ok": true }`, or `503 { "ok": false }`.

#### `GET`, `POST /api/auth/*`

Handled by Better Auth. The portal uses it to sign in with email and password, sign out and check the session. Signup is off.

#### `POST /api/whatsapp`

Twilio calls this when a patient messages the WhatsApp number. The portal never calls it.

- **Access:** no login. The `x-twilio-signature` header must match, using `TWILIO_AUTH_TOKEN`. Otherwise 403.
- **Input:** Twilio's form fields. The route uses `From` and `MessageSid`.
- **Does:** finds up to 20 pending WhatsApp messages for that phone number, oldest first, and marks each one sent. Each message can be claimed only once, so two requests at the same moment can't send it twice.
- **Returns:** Twilio XML holding the messages, split at 1600 characters. If nothing is waiting, it says "No new messages from CareFi right now."
- **Touches:** `Message`.

### Patients

#### `POST /api/patients`

Creates a patient. **Admin only.**

- **Body:** JSON with `patientCode`, `name`, `phone`, `email`, and optionally `policyNumber` and `claimNumber`.
- **Rules:** the phone needs its country code, like `+919876543210`. The patient ID uses letters, numbers and dashes, and is stored in capitals.
- **Returns:** `201 { "patient": { ... } }`.
- **Errors:** 400 with a `fields` object for bad fields. 409 if the patient ID is in use.
- **Touches:** `Patient`.

#### `PATCH /api/patients/[id]`

Edits a profile. **Admin only.** The patient ID can't be changed.

- **Body:** JSON with `name`, `phone`, `email`, and optionally `policyNumber` and `claimNumber`.
- **Returns:** `200 { "patient": { ... } }`.
- **Touches:** `Patient`.

#### `POST /api/import/patients`

Adds patients from a CSV. **Admin only.**

- **Body:** the raw CSV text, up to 1 MB and 1000 rows.
- **Columns:** `patientCode`, `name`, `phone` and `email` are required. `policyNumber` and `claimNumber` are optional. Column order doesn't matter.
- **Does:** a patient whose ID already exists is skipped, not updated. A bad row is reported and the others still load.
- **Returns:** `200 { "added": 8, "skipped": 1, "errors": [{ "row": 4, "message": "..." }] }`. Row numbers match the spreadsheet.
- **Touches:** `Patient`.

The Import page uploads each patient's documents through `POST /api/patients/[id]/documents`, using the folder name to find the patient.

### Documents

#### `POST /api/patients/[id]/documents`

Uploads a file to a locker. **Admin, assigned agent, or the patient.**

- **Body:** multipart form with one `file`, up to 20 MB.
- **Rules:** the type comes from the file's content, so a renamed file can't get through. Only PDF, JPG and PNG are accepted. The same file can't be added to one locker twice.
- **Does:** saves the file, creates the row, answers, and then reads the document with AI in the background.
- **Returns:** `201 { "document": { "id", "fileName", "mimeType", "sizeBytes", "readingStatus", "createdAt" } }`.
- **Errors:** 409 with the existing document if it's a duplicate. 413, 415, or 503 if the bucket fails.
- **Touches:** bucket, `Document`, `AccessLog`, then OpenAI.

#### `POST /api/documents/[id]/read`

Tries the AI reading again after it failed. **Admin, assigned agent, or the patient.**

- **Returns:** `202 { "ok": true }`. The reading runs in the background.
- **Errors:** 409 if the document's reading hasn't failed.
- **Touches:** `Document`, bucket, OpenAI.

#### `DELETE /api/documents/[id]`

Deletes a document and its file. **Admin or assigned agent.**

- **Does:** deletes the file first. If that fails, the row stays and the delete can be tried again. Past decisions stay, without their link to this document.
- **Returns:** `200 { "ok": true }`.
- **Touches:** bucket, `QueryPoint`, `Document`, `AccessLog`.

### Query letters

#### `POST /api/patients/[id]/queries`

Uploads a query letter and starts the agent. **Admin or assigned agent.**

- **Body:** multipart form with one `file`, up to 20 MB. PDF, JPG or PNG.
- **Does:** saves the file, creates the row, answers at once, and then runs the agent in the background.
- **Returns:** `201 { "query": { "id", "status" } }`.
- **Touches:** bucket, `QueryLetter`, `AccessLog`, then everything in [section 8](#8-how-a-query-letter-moves-through-the-system).

#### `POST /api/queries/[id]/retry`

Runs a failed letter or failed delivery again. **Admin or assigned agent.**

- **Does:** carries on from the saved step, so finished AI calls aren't paid for twice and a message already sent isn't sent again. A double click can't start two runs.
- **Returns:** `202 { "ok": true }`.
- **Errors:** 409 if the letter's status isn't `failed` or `delivery_failed`.
- **Touches:** `QueryLetter`, then the agent.

#### `DELETE /api/queries/[id]`

Deletes a letter, its file, its points and its message records. **Admin or assigned agent.**

- **Returns:** `200 { "ok": true }`.
- **Errors:** 409 while the letter is still being processed. 503 if the bucket fails, and then nothing is removed.
- **Touches:** bucket, `Message`, `QueryPoint`, `QueryLetter`, `AccessLog`.

#### `POST /api/points/[id]/resolve`

Marks a team queue item as handled, and records who did it and when. **Admin or assigned agent.**

- **Returns:** `200 { "ok": true }`.
- **Errors:** 409 if the point's status isn't `needs_team`.
- **Touches:** `QueryPoint`.

### Accounts

#### `POST /api/users`

Adds an agent or patient account. **Admin only.** Admin accounts can't be made here.

- **Body:** JSON with `email`, `name`, `password` (12 to 128 characters) and `role` (`agent` or `patient`). A patient also needs `patientId`.
- **Returns:** `201 { "ok": true }`.
- **Errors:** 409 if the email has an account or the locker already has one. 404 if the locker doesn't exist.
- **Touches:** the `auth` schema, `Patient`.

#### `POST /api/users/[id]/patients`

Assigns a patient to an agent. **Admin only.**

- **Body:** JSON with `patientId`.
- **Returns:** `201 { "ok": true }`, or `200` if already assigned.
- **Errors:** 404 if the user isn't an agent or the patient doesn't exist.
- **Touches:** `AgentPatient`.

#### `DELETE /api/users/[id]/patients/[patientId]`

Removes that assignment. **Admin only.**

- **Returns:** `200 { "ok": true }`, even if it wasn't assigned.
- **Touches:** `AgentPatient`.

### Templates

#### `PUT /api/templates/[channel]`

Edits the message template. **Admin only.** `channel` is `whatsapp` or `email`.

- **Body:** JSON with `body` (up to 4000 characters), and `subject` (up to 200 characters), which email requires.
- **Placeholders:** `{{patient_name}}`, `{{patient_id}}`, `{{claim_number}}` and `{{requested_items}}`. The body must include `{{requested_items}}`, and an unknown placeholder is refused, so a typo can't stop messages later.
- **Returns:** `200 { "ok": true }`.
- **Touches:** `Template`.

---

## 6. Portal pages

Without a login, every page below sends the person to `/login`. A person without access gets a 404.

| Page | What it's for | Admin | Agent | Patient |
|---|---|---|---|---|
| `/login` | Sign in | Public | Public | Public |
| `/` | Sends each person to their starting page | To `/patients` | To `/patients` | To their locker |
| `/patients` | Patient list | All | Assigned | No |
| `/patients/new` | Add a patient | Yes | No | No |
| `/patients/[id]` | Profile, documents, messages. Query letters tab for staff | All | Assigned | Own, no letters tab |
| `/patients/[id]/edit` | Edit a profile | Yes | No | No |
| `/patients/[id]/documents/[documentId]` | One document, with a 5-minute link | All | Assigned | Own |
| `/patients/[id]/queries/[queryId]` | One letter, its decisions and messages, with a 5-minute link | All | Assigned | No |
| `/queue` | Points that need a person, and failed letters | All | Assigned | No |
| `/admin/users` | Accounts and patient assignments | Yes | No | No |
| `/admin/templates` | Message templates | Yes | No | No |
| `/admin/import` | Load patients and their documents | Yes | No | No |
| `/admin/access-log` | Who opened or changed what, with a Denied view | Yes | No | No |

Pages read the database directly, after their access check. That's why there are no `GET` routes for patients, documents or letters.

---

## 7. What the AI does

The AI is used in three places. All three use the OpenAI Responses API, the model in `OPENAI_MODEL` (`gpt-4o-mini` on live), a fixed answer shape, and `store: false`.

| | 1. Read a document | 2. Find what the letter asks | 3. Check the locker |
|---|---|---|---|
| **Code** | `readDocument` in `lib/documents.ts` | `extractPoints` in `lib/agent/nodes.ts` | `checkLocker` in `lib/agent/nodes.ts` |
| **Runs when** | A document is uploaded or retried | A letter's agent run starts | Straight after step 2, unless no points were found |
| **Is sent** | The file | The letter file | The points, plus each document's type, summary, date and any problem |
| **Gives back** | Readable or not, type, summary, name on it, date | The list of requests, and the patient's name on the letter | For each point: a status, a reason, the document it found, and the patient's wording |
| **Calls** | 1 per document | 1 per letter | 1 per letter, none if no points |

A normal letter costs **2 AI calls**, and steps 2 and 3 are tried up to 3 times if a call fails. Step 3 doesn't send files, because step 1's summaries already describe them. This is what keeps a letter fast and cheap.

### The three decisions

| Status | Meaning | What happens |
|---|---|---|
| `already_in_locker` | A usable document satisfies the request | The document is linked, and the patient isn't asked |
| `needed_from_patient` | The patient has to send it | It goes in the message, with the AI's simple request and reason |
| `needs_team` | A hospital, doctor or insurer must act, the request is vague, or a document has a problem | It goes to the team queue, with the reason |

### Safety checks on AI answers

`safetyChecks` runs after step 3. If an answer fails, that point goes to the team, not the patient.

| Check | Result |
|---|---|
| The name on the letter doesn't match the patient | All points go to the team |
| The AI skipped a point | That point goes to the team |
| The AI cited a document that isn't in this locker | That point goes to the team |
| The cited document has the wrong name, is unreadable or is unread | That point goes to the team |
| The AI asked the patient for something, without saying what or why | That point goes to the team |
| The AI asked the patient, but a locker document is unread or unreadable | That point goes to the team, because the item may not be missing |
| The letter has no requests, or is too blurry | One "Read this letter" item goes to the team |

### What the AI can't do

- It can't send anything. Code sends messages.
- It can't change the message format. Code fills the template, in one pass, so AI text can't add placeholders.
- It can't see or change who has access. It has no tools, and it only answers in the fixed shape.
- It can't take orders from a letter. The prompts treat files as data, and any answer is still checked by code.
- It gets short IDs like `doc1`, and code maps them back to real ones, because the AI can miscopy a long ID.

### What OpenAI receives

File names and profile fields such as phone, email and policy number aren't sent as separate data. **The files themselves are sent, and they can contain the patient's details.** That's why only fake and CareFi sample data should go through this build.

### Accuracy

On the 18 test letters, the agent found 41 of 41 points in the latest two runs and got 38 and 39 of 41 decisions right (93% and 95%). The prompts were tuned on these same letters, so new letters may score lower. Details and open misses are in [test-data/stage8/results.md](test-data/stage8/results.md).

---

## 8. How a query letter moves through the system

```text
Staff uploads a letter
        |
        v
POST /api/patients/[id]/queries      saves the file, answers at once
        |
        v  (background)
extractPoints    AI lists what the letter asks             status: reading
        |
        v
checkLocker      waits up to 30s for unread documents,     status: checking_locker
        |        then AI decides each point
        v
safetyChecks     code checks each answer, saves the points
        |
        +-- any point for the team, or no points ---> addToTeamQueue --+
        |                                                              |
        |<-------------------------- patient must send something ------+
        |                                                              |
        +-- nothing to send -------------------------------------------+--> finish
        |
        v
buildMessage     code fills both templates                 status: sending
        |
        |  a detail the template needs is missing:
        |  the points go to the team, no message ---------------------> finish
        v
sendMessages     email through Resend
        |        WhatsApp through Meta, or held for the patient's "hi"
        |
        +-- all done ------------------------------------------------> finish
        +-- a channel failed, tries left: retry that channel only
        |   (up to 3 attempts, waiting 1s, then 2s)
        +-- still failing ---> alertTeam                           status: delivery_failed
```

Progress is saved after each step in the `langgraph` database schema, so a restart or retry carries on from the last finished step. Any error that stops a run sets the letter to `failed`, and it then shows in the team queue with a "Try again" button.

### WhatsApp today

The live app uses Twilio's sandbox, which only allows free text as a reply. So:

1. The agent creates the WhatsApp message as `pending`.
2. The email goes out straight away, with a line telling the patient how to join and send `hi`.
3. The patient sends `hi`, Twilio calls `POST /api/whatsapp`, and the message goes back as the reply.

If `WHATSAPP_TOKEN` is set, the agent sends through Meta directly instead, with no step for the patient. The email line is then dropped too.

### Status labels

| Stored status | Label in the portal |
|---|---|
| `uploaded` | Starting |
| `reading` | Reading letter |
| `checking_locker` | Checking locker |
| `sending` | Sending |
| `completed` | Sent, Sent, needs team, Needs team, or No action needed, depending on the points |
| `delivery_failed` | Delivery failed |
| `failed` | Failed |

---

## 9. Database tables

### `public` schema (Prisma)

| Table | Holds | Written by |
|---|---|---|
| `Patient` | Profile, policy and claim numbers, linked login | Patient routes, import, account creation |
| `AgentPatient` | Which agent has which patient | Assignment routes |
| `Document` | File details and the AI's reading | Upload, delete, document reading |
| `QueryLetter` | Letter details, status and timings | Letter routes, agent |
| `QueryPoint` | Each request, its decision and reason, and who handled it | Agent, resolve route |
| `Template` | The WhatsApp and email templates | Seed script, template route |
| `Message` | Each message, its delivery status and attempts. One per letter and channel, which stops duplicates | Agent, WhatsApp route |
| `AccessLog` | User, action, patient and record IDs. No names or contents | `logAccess` |

### Other schemas

| Schema | Holds | Managed by |
|---|---|---|
| `auth` | Users, sessions, login accounts | Better Auth |
| `langgraph` | The agent's saved progress | LangGraph |

The bucket holds files under `patients/<patientId>/documents/` and `patients/<patientId>/queries/`, each with a random file name.

---

## 10. Outside services

| Service | Used for | Direction | What it receives | Called from |
|---|---|---|---|---|
| **OpenAI** | Reading files and making decisions | App calls it | Files, points, document summaries | `lib/documents.ts`, `lib/agent/ai.ts` |
| **Resend** | Email | App calls it | Patient's email address, subject, message | `lib/messaging/send.ts` |
| **Twilio** | WhatsApp, as a reply | Twilio calls the app | Patient's message text as the reply | `app/api/whatsapp/route.ts` |
| **Meta WhatsApp** | WhatsApp with no patient step. Off on live | App calls it | Patient's phone number, message | `lib/messaging/send.ts` |
| **Tigris** | File storage, through the S3 API | App calls it | Every uploaded file | `lib/storage.ts` |
| **Railway** | Hosting, PostgreSQL, health checks | Railway calls `/api/health` | No patient data through the health route | `app/api/health/route.ts` |

The app never calls Twilio itself. It only checks Twilio's signature and answers Twilio's request.

---

## 11. Environment variables

Names only. Values stay in `.env` locally and in Railway variables on live.

| Variable | Used for | Needed |
|---|---|---|
| `DATABASE_URL` | Database, login, agent progress | Yes |
| `BETTER_AUTH_SECRET` | Signing login sessions | Yes |
| `BETTER_AUTH_URL` | The app's address. Also used for the origin check and the Twilio signature | Yes |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Creating the first admin | At deploy |
| `OPENAI_API_KEY` | OpenAI, read by the SDK | Yes |
| `OPENAI_MODEL` | Which model the AI uses | Yes |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | File storage | Yes |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending email | Yes |
| `TWILIO_AUTH_TOKEN` | Checking that a webhook really came from Twilio | For the `hi` flow |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Sending through Meta. Setting the token also switches off the `hi` flow | No |
| `RESEND_API_URL`, `WHATSAPP_API_URL` | Pointing at a stand-in service during tests | No |

---

## 12. Known limits

| Limit | Effect |
|---|---|
| WhatsApp needs the patient's `hi` unless Meta is set up | The patient has to join the sandbox and message first. Sandbox membership lasts 72 hours |
| A letter shows "Sent" while its WhatsApp message is still `pending` | "Sent" means the email went and WhatsApp is ready. Check the message's own status to see if WhatsApp went out |
| A patient's new upload doesn't re-check the letter | The point stays "Asked from patient". Uploading the letter again runs a new check |
| A CSV import skips patients that already exist | Fix an existing patient with the Edit page, not by importing again |
| Accounts and patients have no delete route, and passwords have no reset route | These need a direct database change |
| Deleting a letter leaves its saved agent progress in `langgraph` | That progress holds the letter's requests and the filled message text, including the patient's name |
| Admin edits aren't in the access log | The log covers opening records, uploads, deletes and refusals, but not profile, template or account changes |
| The agent can miss on new letters | Known misses are listed in [test-data/stage8/results.md](test-data/stage8/results.md). A person can check any decision on the letter's page |
