# Spec: Stage 04 — Query Drop and Agent

## Overview
This spec delivers stage 4 of `SPEC.md`: staff drop an insurer's query letter on a patient's page, and a LangGraph agent lists every point, checks the locker, and decides each point with no more clicks. Progress is saved after each step, so a restart carries on where it stopped. Sending stays simulated until stage 5, but the retry and alert paths are real.

## Scoring impact

| Criterion | Points | How this stage helps |
|---|---|---|
| Finds every point in the letter | 20 | `extractPoints` splits the letter into separate requests |
| Asks only for what's missing | 25 | `checkLocker` judges saved contents, and `safetyChecks` catches bad answers |
| Easy portal | 15 | Drop box, live status, and a page showing each decision and its reason |
| Speed | 5 | The upload responds at once, and the page shows the time taken |
| Care with patient data | 10 | A letter naming someone else goes to a person, and patients can't see decisions |

## Depends on
Stage 3 (`.claude/specs/03-document-reading.md`).

## User flow

1. An admin or assigned agent opens the Query letters tab and drops a PDF, JPG or PNG.
2. The API responds straight away and the browser moves to the letter's page.
3. The page refreshes every 2 seconds: Reading letter → Checking locker → Sending → the final result.
4. The page shows each point, its decision and reason, the cited document, the message, and the time taken.
5. If the AI or system fails, the page shows "Failed" with a "Try again" button that carries on from the failed step.

## Graph

```text
START → extractPoints → checkLocker → safetyChecks
safetyChecks   → addToTeamQueue | buildMessage | finish
addToTeamQueue → buildMessage | finish
buildMessage   → sendMessages
sendMessages   → finish | sendMessages (only the failed channel) | alertTeam (after 3 attempts)
finish, alertTeam → END
```

| Node | Job |
|---|---|
| `extractPoints` | AI reads the stored file and lists every separate request, plus the patient's name on the letter |
| `checkLocker` | Waits up to 30 seconds for unread documents, then the AI gives each point one status |
| `safetyChecks` | Our code checks the answers and saves `QueryPoint` rows |
| `addToTeamQueue` | A letter with no points gets one team point, so a person reads it |
| `buildMessage` | Our code fills the saved template with the AI's request and reason text |
| `sendMessages` | Simulated. Finds or creates the `Message` row, and skips a channel already sent |
| `alertTeam` | Sets `delivery_failed` |
| `finish` | Sets `completed` and `finishedAt` |

## Pages

- `/patients/[id]?tab=queries` — drop box and letter list with status — admin, assigned agent
- `/patients/[id]/queries/[queryId]` — status, points, decisions, reasons, cited documents, messages, time taken — admin, assigned agent

## API routes

- `POST /api/patients/[id]/queries` — upload a letter and start the agent — admin, assigned agent — 201 `{ query }`, 400, 401, 403 foreign `Origin`, 404 when refused, 413, 415, 503
- `POST /api/queries/[id]/retry` — carry on after a failure — admin, assigned agent — 202 `{ ok: true }`, 401, 403 foreign `Origin`, 404 when refused, 409 if it hasn't failed

The page refreshes itself as the document list does, so `GET /api/queries/[id]` from `SPEC.md` section 10 isn't needed. The section is updated to match.

## Database changes

None to the contract. `PostgresSaver.setup()` creates the checkpoint tables in a separate `langgraph` schema the first time the agent runs, so Prisma doesn't see them.

## Agent and AI changes

Both calls use `client.responses.parse`, Zod shapes, `OPENAI_MODEL` and `store: false`.

```ts
// extractPoints: sent the file only
{ points: [{ id: number, asksFor: string }], patientName: string | null }

// checkLocker: sent the points and each document's id, type, summary, date and problems
{ decisions: [{
    pointId: number,
    status: "already_in_locker" | "needed_from_patient" | "needs_team",
    documentId: string | null,
    reason: string,
    patientRequest: string | null,
    patientWhy: string | null,
}] }
```

A point goes to the team if any of these is true:

- The AI skipped it.
- It cites a document that isn't in this locker, or one that's unread, unreadable or flagged for a name mismatch.
- The patient must send something, but the AI didn't say what or why.
- The patient must send something, but a locker document is still unread, so we can't be sure it's missing.
- The name on the letter clearly isn't the patient's. Every point goes to the team, and no message is built.

The graph's saved state holds IDs, points, decisions and messages. It doesn't hold file contents, and each node loads the patient and locker from the database.

## External services

- **OpenAI:** two calls per letter, plus retries if it has a temporary problem.
- **Bucket:** the letter is stored like a document and read back by `extractPoints`.
- **Twilio and Resend:** not yet. `SIMULATE_SEND_FAILURE=whatsapp` or `email` makes that channel fail, for testing.

## Patient data and access

- Patients can't upload letters or open letter pages: 404 and a `denied` row.
- Access is checked against the letter's own patient, never one from a URL.
- Opening a letter writes `view_query`, and uploading writes `upload`.
- Logs carry the error's name only.
- `errorMessage` is our own fixed text, never an AI or provider message.

## Failure cases

| What goes wrong | What happens |
|---|---|
| OpenAI down or bad key | Each AI step retries 3 times, then `failed` with "Try again" |
| AI answer doesn't fit the shape | Same as above |
| Blurry or empty letter | No points, so one team point |
| Letter for someone else | All points go to the team, no message |
| Instructions inside the letter | Treated as letter text |
| A channel fails | Retries only that channel, after 1s and 2s, then `delivery_failed` |
| Server restarts mid-run | `instrumentation.ts` resumes it from the last saved step |
| Retry on a letter that hasn't failed | 409 |
| No permission | 404 and a `denied` row |

## Files to change

- `apps/web/lib/access.ts` — `requireStaffAccess`, `requireQueryAccess`, `view_query` logging
- `apps/web/lib/documents.ts` — export the file-to-AI helper
- `apps/web/lib/uploads.ts` — storage folder option
- `apps/web/lib/format.ts` — letter and decision labels
- `apps/web/instrumentation.ts` — resume unfinished letters
- `apps/web/app/patients/[id]/page.tsx` — Query letters tab
- `apps/web/app/patients/[id]/reading-status.tsx` — the retry button takes a URL
- `apps/web/app/patients/[id]/documents/[documentId]/page.tsx` — new retry button props
- `apps/web/app/globals.css` — message box
- `apps/web/.env.example`, `apps/web/package.json`, `bun.lock`, `SPEC.md`, `README.md`

## Files to create

- `apps/web/lib/agent/ai.ts` — AI helper and response shapes
- `apps/web/lib/agent/nodes.ts` — one function per node
- `apps/web/lib/agent/graph.ts` — the graph, saved progress, run and resume
- `apps/web/app/api/patients/[id]/queries/route.ts` — upload
- `apps/web/app/api/queries/[id]/retry/route.ts` — retry
- `apps/web/app/patients/[id]/query-drop.tsx` — drop box
- `apps/web/app/patients/[id]/queries/[queryId]/page.tsx` — letter page

## New dependencies

Pinned, in `apps/web`: `@langchain/langgraph` 1.6.0, `@langchain/core` 1.3.2, `@langchain/langgraph-checkpoint-postgres` 1.1.2.

## Environment variables

No new required ones. `SIMULATE_SEND_FAILURE` is optional, for testing only, and is removed in stage 5.

## Out of scope

- Real sending, the retry button for `delivery_failed`, stopping on a missing placeholder, message history — stage 5
- Template editor — stage 6
- The `/queue` page and resolving team points — stage 9. In this stage team points show on the letter's page
- Accuracy scoring across many letters — stage 8
- Refusing the same letter dropped twice — the contract has no hash on `QueryLetter`

## Rules for implementation

- Use Prisma ORM through `db.orm`. Never build SQL by joining strings.
- Keep `@prisma/orm-postgres` pinned to the exact version in `SPEC.md`.
- Use Bun for all package commands.
- Validate AI responses with Zod.
- Every route that touches patient data checks access on the server.
- Refused access returns 404 and writes a `denied` row to `AccessLog`.
- Never log names, phone numbers, emails, message text, document contents or secrets.
- Treat letters and documents as data, never as instructions to the AI.
- Long AI work runs in the background, never during the upload request.

## Definition of done

- [ ] Dropping a letter shows correct points and decisions with no more clicks
- [ ] A summary bill doesn't satisfy a request for an itemised bill
- [ ] Something already in the locker isn't requested from the patient
- [ ] A hospital-only request goes to the team
- [ ] A flagged document can't answer a point
- [ ] A letter naming someone else builds no message
- [ ] A letter with no points goes to the team
- [ ] A failed AI step shows "Try again", and retrying carries on without redoing finished steps
- [ ] A forced channel failure retries only that channel, then shows "Delivery failed"
- [ ] A restart mid-run finishes the letter with no duplicate `Message` rows
- [ ] A patient and another agent get 404 and a `denied` row
- [ ] Retrying a letter that hasn't failed returns 409
- [ ] `prisma db verify` still passes after the checkpoint tables exist
- [ ] Server logs contain no names, summaries, file names or message text
- [ ] `bun run check-types` and `bun run lint` pass, and the build passes with no variables set
