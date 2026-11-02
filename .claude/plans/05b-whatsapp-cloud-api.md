# Plan: Stage 05b — WhatsApp Cloud API

Spec: `.claude/specs/05b-whatsapp-cloud-api.md`

1. Replace the Twilio code in `send.ts` with one Cloud API call, and remove the status check, since the API has no equivalent without a webhook.
2. Tighten `LOCKER_INSTRUCTIONS`: if the patient can get it, it is never `needs_team` just because it's missing.
3. Update `.env.example`, `README.md` and `SPEC.md`.
4. Rerun the flow tests against a stand-in Graph API, with no real AI or provider calls.
5. Run the new instructions 3 times on `gpt-4o-mini` with a missing cheque.
6. Ship with `ship-feature.md`. The user adds the Meta values, then does a real send.
