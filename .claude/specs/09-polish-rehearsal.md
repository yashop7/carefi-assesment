# Stage 9: Polish and rehearsal

## Overview

Finishes the team queue, makes the portal easier to move around, removes what the app doesn't use, and sets out the live rehearsal.

## What gets built

- `/queue`: points that need a person and failed letters, with "Mark handled" and "Try again". An admin sees all, an agent sees assigned patients, and a patient gets a 404.
- `POST /api/points/[id]/resolve`: marks a team point as handled.
- A header menu on every staff page, in place of buttons on the patient list.
- Handled points no longer count as open items.
- A failed action now shows its error.

## What gets removed

- `packages/ui`, starter images, starter README text and the extra starter config.
- `GET /api/patients`, `GET /api/patients/[id]` and `GET /api/documents/[id]/link`, which nothing calls. Pages make their own 5-minute links after the access check.
- `scripts/check-storage.ts`, the leftover "simulated" status and a debugging log.
- Duplicate root dependencies and an unused Babel preset.
- AI tool files leave the repo and stay on this computer.

## What stays on purpose

The Meta WhatsApp sender stays, although it's off today. The assignment gives 15 points for WhatsApp with no manual step, and setting `WHATSAPP_TOKEN` is the way to get there.

## Rehearsal on the live link

1. Sign in as admin, open Accounts, and add one agent and one patient account.
2. Open Patients and check the 10 patients and their documents are loaded.
3. Send `join road-depend` and then `hi` to the sandbox number from the test phone.
4. Upload a letter that has never been tested, and time it until the status changes.
5. Check each point on the letter's page against what the letter asks.
6. Check that the email arrived, then send `hi` and check that WhatsApp arrived.
7. Open Team queue and mark a point handled.
8. Sign in as the agent and open another agent's patient. It should show a 404, then appear under Denied only in Access log.
9. Record this run as the backup video.

## Definition of done

- [ ] The team queue works, with access checks.
- [ ] Status badges, retry buttons and errors are clear.
- [ ] Unused code is gone and the build still passes.
- [ ] Someone new can follow a case without help (needs the live rehearsal).
- [ ] The rehearsal passes end to end on the live link (needs the live rehearsal).
