# Spec: Stage 05 — Real Sending

## Overview
This spec delivers stage 5 of `SPEC.md`: when a patient must send something, the message goes out on real WhatsApp (Twilio) and email (Resend) with no clicks. Staff and patients can see message history, a failed delivery can be retried from the portal, and a message with a missing detail is held back for the team.

## Scoring impact

| Criterion | Points | How this stage helps |
|---|---|---|
| Sends on WhatsApp and email automatically | 15 | `sendMessages` calls the real providers |
| Clear message that follows the template | 10 | Our code fills the saved template, and an incomplete message never goes out |
| Easy portal | 15 | Messages tab, delivery status and a "Try again" button |
| Care with patient data | 10 | Logs and saved errors never carry names, numbers or message text |

## Depends on
Stage 4 (`.claude/specs/04-query-agent.md`).

## User flow

1. Staff drop a letter. When the patient must send something, both messages go out on their own.
2. The letter's page shows each channel's status, attempts and any problem.
3. If a channel fails 3 times, the page shows "Delivery failed" and "Try again". Trying again sends only the failed channel.
4. If a template placeholder has no value, such as a missing claim number, nothing is sent and the points go to the team with the reason.
5. The patient's Messages tab shows every message sent for that patient.

## Graph

```text
buildMessage → sendMessages | finish (when a placeholder has no value)
```

The rest of the graph is unchanged. `sendMessages` still retries only the failed channel, after 1s and 2s.

## Retrying a failed delivery

A delivery failure ends the graph run. `POST /api/queries/[id]/retry` now also accepts `delivery_failed`. `runAgent` sees a finished run with saved messages, resets the attempt count, and goes back to the sending step. Nothing is read again, so a retry makes no AI calls, and a channel already sent is skipped.

## Providers

Both use plain `fetch`, so there are no new dependencies. Both calls have a 15-second timeout.

- **Twilio:** `POST /2010-04-01/Accounts/{sid}/Messages.json` with `To`, `From` and `Body`. Twilio can accept a message and fail it a moment later, such as when a number hasn't joined the sandbox. So we check its status for up to 5 seconds, and count `failed` or `undelivered` as a failure. If the check itself fails, we treat the message as accepted, because retrying could send it twice.
- **Resend:** `POST /emails` with `from`, `to`, `subject` and `text`. The `Message` row's id is the `Idempotency-Key`, so a repeat after a crash doesn't send a second email. Plain text only, so nothing from a letter can become HTML.

With no credentials, the channel fails with "not set up" and never pretends to have sent.

## Pages

- `/patients/[id]?tab=messages` — message history — admin, assigned agent, own patient. Patients don't see attempts or provider errors.
- `/patients/[id]/queries/[queryId]` — adds the channel's problem and "Try again" for `delivery_failed`.

Old rows from stage 4 show "Simulated", never "Sent".

## API routes

- `POST /api/queries/[id]/retry` — now accepts `failed` and `delivery_failed`. Other responses are unchanged.

## Database changes

None.

## Patient data and access

- Message history uses the existing patient access check, so another agent gets 404 and a `denied` row.
- `errorMessage` and logs hold our own fixed text and the provider's numeric error code only.
- The email subject and body go to Resend, and the body goes to Twilio. Only fake and CareFi sample data goes through this build.

## Failure cases

| What goes wrong | What happens |
|---|---|
| Provider refuses or is down | Retries that channel after 1s and 2s, then `delivery_failed` |
| Twilio accepts, then fails the message | Same as above |
| Credentials missing | Same as above, with "not set up" on the message |
| Placeholder has no value | No message. Points move to `needs_team` with the reason |
| Restart mid-send | Resumes, and skips channels already marked `sent` |
| Crash between Twilio accepting and us saving | One repeat WhatsApp is possible, as `SPEC.md` accepts |
| Retry on a letter that hasn't failed | 409 |

## Files to change

- `apps/web/lib/agent/nodes.ts` — real sending, held-back messages, new route
- `apps/web/lib/agent/graph.ts` — new edge, retry goes back to the sending step
- `apps/web/app/api/queries/[id]/retry/route.ts` — accepts `delivery_failed`
- `apps/web/app/patients/[id]/page.tsx` — Messages tab
- `apps/web/app/patients/[id]/queries/[queryId]/page.tsx` — shared message list, retry button
- `apps/web/.env.example`, `SPEC.md`, `README.md`

## Files to create

- `apps/web/lib/messaging/template.ts` — fills a template, reports a missing value
- `apps/web/lib/messaging/send.ts` — Twilio and Resend calls
- `apps/web/app/patients/[id]/message-list.tsx` — message cards used by both pages

## New dependencies

None.

## Environment variables

Required to send: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `RESEND_API_KEY`, `EMAIL_FROM`.

Optional, for tests only: `TWILIO_API_URL`, `RESEND_API_URL`. `SIMULATE_SEND_FAILURE` is removed.

## Out of scope

- Delivery webhooks from Twilio and Resend
- Template editor and rejecting unknown placeholders on save — stage 6
- The `/queue` page and resolving team points — stage 9
- Sending again after a held-back message is fixed — stage 9

## Rules for implementation

- Never log names, phone numbers, emails, message text or secrets.
- Never mark a message `sent` unless the provider accepted it.
- Use the recipient and body saved on the `Message` row, so a retry sends exactly the same message.
- Use Bun for all package commands, and `db.orm` for the database.

## Definition of done

- [ ] A dropped letter reaches a real phone and inbox automatically
- [ ] A forced failure retries only that channel, then shows "Delivery failed"
- [ ] "Try again" sends only the failed channel, makes no AI calls, and ends "Sent"
- [ ] Twilio accepting and then failing a message counts as a failure
- [ ] Restarting mid-run sends no duplicates
- [ ] A missing claim number sends nothing and moves the points to the team
- [ ] Missing credentials fail honestly
- [ ] The Messages tab works for staff and the patient, and another agent gets 404
- [ ] Patients don't see attempts or provider errors
- [ ] Logs contain no names, numbers, emails or message text
- [ ] `bun run check-types` and `bun run lint` pass, and the build passes with no variables set
