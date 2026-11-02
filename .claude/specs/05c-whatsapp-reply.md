# Spec: Stage 05c — WhatsApp as a reply

## Overview
Meta blocked the account during signup, and Twilio's trial refuses free text sent through its API (error 21654) and blocks templates (401). A reply to a message from the patient does work on the trial. So without `WHATSAPP_TOKEN`, the WhatsApp message waits until the patient messages the sandbox, then goes out as the reply. Email stays automatic. If `WHATSAPP_TOKEN` is set, the Meta Cloud API sends it as before.

## Flow
1. `sendMessages` saves the WhatsApp `Message` row as `pending`. The channel counts as done, so the letter can finish.
2. The portal shows "Waiting for patient to message".
3. The patient messages +1 415 523 8886. Twilio calls `POST /api/whatsapp`.
4. The route checks Twilio's signature, finds `pending` rows for that number, marks them `sent` and returns them as TwiML.
5. With nothing waiting, the reply is "No new messages from CareFi right now."

## Rules
- No valid signature means 403 and no database read. The sender can only ever get messages addressed to their own number.
- Each row is claimed in one update, so two messages at once can't send it twice.
- Text is XML escaped, and split at Twilio's 1600 character limit.
- "Try again" on an old failed WhatsApp row puts it back to `pending`.

## Environment variables
`TWILIO_AUTH_TOKEN` checks signatures. `BETTER_AUTH_URL` gives the public URL that Twilio signed. `TWILIO_ACCOUNT_SID` and `TWILIO_WHATSAPP_FROM` aren't used.

## Known limits
- Not fully automatic: the patient must join the sandbox and message first. Sandbox membership lasts 72 hours.
- "Sent" means the reply was handed to Twilio. A failure after that isn't reported.

## Definition of done
- [ ] A letter finishes with email sent and WhatsApp waiting, and no Twilio or Meta call
- [ ] A signed message gets the waiting text once, and a second gets "No new messages"
- [ ] An unsigned or wrongly signed request gets 403
- [ ] Another number doesn't get the message
- [ ] `&` and `<` are escaped, and long text is split
- [ ] "Try again" on a failed WhatsApp row sends no second email and makes no AI calls
- [ ] Check-types, lint and build pass
