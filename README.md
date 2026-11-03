# CareFI-PatientLocker

## Patient locker

Staff log in at `/patients`, add a patient, and upload PDF, JPG or PNG files to that patient's locker. A repeat of a file is refused. Files stay in the private bucket and open through 5-minute links. All access rules are in `apps/web/lib/access.ts`.

## Document reading

After upload, the AI reads each file once in the background and saves its type, summary, name and date (`apps/web/lib/documents.ts`). Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `apps/web/.env` and on Railway.

## Query letters

Staff drop a letter on a patient's Query letters tab. A LangGraph agent (`apps/web/lib/agent/`) lists every point, checks the locker, and shows each decision and its reason on the letter's page. Progress is saved in the `langgraph` schema, so a restart carries on from the last step.

## Sending

When the patient must send something, the agent emails the template through Resend straight away (`apps/web/lib/messaging/`). A failed email retries alone, then the letter shows "Delivery failed" with "Try again". Set `RESEND_API_KEY` and `EMAIL_FROM` in `apps/web/.env` and on Railway. Without them, sending fails rather than pretending to work.

WhatsApp isn't fully automatic in this build. Twilio's trial sandbox only allows free text as a reply, so the message waits, marked "Waiting for patient to message". To receive it, the patient sends `join road-depend` to +1 415 523 8886, then any message. `POST /api/whatsapp` checks Twilio's signature with `TWILIO_AUTH_TOKEN` and replies with what's waiting for that number. Set that URL under "When a message comes in" in the sandbox settings. Membership lasts 72 hours. "Sent" means the reply was handed to Twilio. The automatic email ends with these steps, so the patient knows what to do.

With a Meta account, set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` instead, and WhatsApp sends automatically through the Meta Cloud API.

## Loading CareFi's data

Sign in as an admin and open **Import** on the patient list. Upload a CSV with `patientCode, name, phone, email, policyNumber, claimNumber`, then choose a folder with one folder per patient, like `PAT-001/discharge.pdf`. Bad rows and unmatched files are listed, and the rest still load. Put query letters on the patient's page, because that starts the agent.

Open **Templates** to paste in CareFi's WhatsApp and email text. The next message uses it.

## Team queue

**Team queue** lists every point that needs a person, and every letter that failed or couldn't be delivered. "Mark handled" clears a point, and "Try again" reruns a letter. An agent sees only assigned patients.

## Accounts and privacy

There is no public signup. An admin opens **Accounts** on the patient list to add agents and patients, assign patients to an agent, and link a patient account to its locker. Share the password with the person directly.

An agent sees only assigned patients, and a patient sees only their own locker. Anything else returns a 404 and writes a `denied` row. **Access log** shows who opened, uploaded or deleted what, and **Denied only** shows the refused attempts. Log rows keep IDs only.

## Accuracy

The agent is scored on 18 fake letters in `test-data/stage8`, each with its answer written first. See `test-data/stage8/results.md` for the score, every miss and how to run it.
