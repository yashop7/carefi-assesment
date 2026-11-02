# Spec: Stage 05b — WhatsApp Cloud API

## Overview
Twilio's sandbox refused every plain text message with error 21654 `ContentSid Required`, even from a direct call. So WhatsApp now goes through Meta's WhatsApp Cloud API. Only `sendWhatsApp` changes: retries, duplicate protection and the portal stay the same. This spec also makes the AI ask the patient for anything they can get themselves.

## Provider

`POST https://graph.facebook.com/v23.0/{phone number id}/messages` with a bearer token and:

```json
{ "messaging_product": "whatsapp", "recipient_type": "individual", "to": "919000000000", "type": "text", "text": { "body": "..." } }
```

## Environment variables

Add `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. Remove `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_WHATSAPP_FROM`. `WHATSAPP_API_URL` is optional, for tests only.

## Known limits

- Plain text only reaches someone who messaged the number in the last 24 hours. Each recipient must be added on Meta's API Setup page first.
- Meta can accept a message and fail it later, and reports that only by webhook. There is no webhook in this build, so "Sent" means Meta accepted it.
- Temporary tokens expire quickly. Use a system user token for the evaluation.

## Files to change

- `apps/web/lib/messaging/send.ts` — Cloud API replaces Twilio
- `apps/web/lib/agent/ai.ts` — what the patient can get goes to the patient
- `apps/web/.env.example`, `SPEC.md`, `README.md`

## Definition of done

- [ ] A dropped letter reaches a real phone automatically
- [ ] A refused message retries only WhatsApp, then shows "Delivery failed"
- [ ] "Try again" sends only the failed channel with no AI calls
- [ ] Restarting mid-run sends no duplicates
- [ ] Missing credentials fail honestly
- [ ] A missing cancelled cheque is asked from the patient
- [ ] `bun run check-types` and `bun run lint` pass, and the build passes with no variables set
