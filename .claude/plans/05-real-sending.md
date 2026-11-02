# Plan: Stage 05 — Real Sending

Spec: `.claude/specs/05-real-sending.md`

## Step 1: Template filling

Create `apps/web/lib/messaging/template.ts` with `fillTemplate(text, values)`.

- Replace every `{{name}}` in one pass with a function replacer. One pass means text from the AI can't be filled in again, and a function means `$` in a value stays literal.
- Return `null` if any placeholder has no value.

## Step 2: Providers

Create `apps/web/lib/messaging/send.ts`.

- `DeliveryError`: its message holds only our own text and a numeric code, so it's safe to log and save.
- `sendWhatsApp(to, body)`: returns the Twilio sid. Posts the message, then checks its status once a second for up to 5 seconds. `failed` or `undelivered` throws. A failed check is ignored.
- `sendEmail(to, subject, body, key)`: returns the Resend id. Sends `Idempotency-Key: key`.
- Read variables inside the functions, because the build runs with none set. Missing ones throw "not set up".
- `TWILIO_API_URL` and `RESEND_API_URL` point at stand-in servers in tests.

## Step 3: Agent nodes

In `apps/web/lib/agent/nodes.ts`:

- `State`: `messages` can be null, and add `emailSubject`.
- `buildMessage`: use `fillTemplate`. If anything comes back null, move `needed_from_patient` points to `needs_team` with the reason and return `messages: null`.
- Add `routeMessage`: `sendMessages` when there are messages, otherwise `finish`.
- `sendOne`: replace `deliver` with the real calls, using the row's recipient and body. Save and log a `DeliveryError` message, or fixed text for anything else.
- Remove `SIMULATE_SEND_FAILURE`.

## Step 4: Graph and retry

- `graph.ts`: replace the `buildMessage` edge with a conditional one.
- `runAgent`: if the run has finished but has saved messages, call `updateState(config, { sendAttempts: 0 }, "buildMessage")`, so its next step is `sendMessages`. Living in `runAgent` means a restart during a retry also recovers.
- Retry route: claim `failed` or `delivery_failed` in one update.

## Step 5: Pages

- Create `message-list.tsx`: channel, status badge, recipient and body. `showDelivery` adds attempts and the error for staff. `providerId === "simulated"` shows "Simulated".
- Letter page: use `MessageList`, and show "Try again" for both failed statuses.
- Patient page: load messages on the Messages tab, newest first, with an empty state.

## Step 6: Docs

Update `.env.example`, `README.md` and `SPEC.md` (graph, retry, variables).

## Step 7: Test with no real AI or provider calls

Throwaway Postgres, the existing OpenAI stand-in, and a new stand-in for Twilio and Resend that records every send and can be told to refuse or to fail after accepting.

1. Normal letter: both channels called once, with the right recipient, body and subject. Ends "Sent".
2. WhatsApp refused: 3 attempts, 1 email, "Delivery failed", and the error on the page.
3. Twilio accepts then fails: same as above.
4. "Try again" with Twilio healthy: 1 more WhatsApp, 0 more emails, 0 AI calls, ends "Sent". Second retry returns 409.
5. Restart mid-send: no duplicate sends.
6. No claim number: 0 sends, points on team, "Needs team".
7. No credentials: "Delivery failed" and "not set up", no sends.
8. Messages tab: admin, assigned agent and own patient 200, other agent 404, patient sees no attempts or errors.
9. Stage 4 flows still pass, and letters with nothing to send make no provider calls.
10. Logs and saved errors contain no personal data.
11. `check-types`, `lint`, and a build with no variables.

## Step 8: Ship

Use `ship-feature.md`, committing named paths so `test-data/` stays out. A real phone and inbox test needs the user's Twilio and Resend keys, and is reported as not done until then.
