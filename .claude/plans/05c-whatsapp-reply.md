# Plan: Stage 05c — WhatsApp as a reply

1. `apps/web/app/api/whatsapp/route.ts`: new route. Check the signature, claim `pending` rows for the sender, return TwiML.
2. `apps/web/lib/agent/nodes.ts`: in `sendOne`, without `WHATSAPP_TOKEN`, leave WhatsApp waiting and count the channel as done. Put a failed row back to `pending`.
3. `apps/web/app/patients/[id]/message-list.tsx`: show "Waiting for patient to message".
4. Docs: `.env.example`, `README.md`, `SPEC.md`.
5. Test on a throwaway Postgres with a stand-in OpenAI and Resend, signing requests the way Twilio does. Then type checks, lint and build.
6. After merge: set the sandbox's "When a message comes in" to `https://web-production-53814.up.railway.app/api/whatsapp` (POST), then message the sandbox for a live test.
