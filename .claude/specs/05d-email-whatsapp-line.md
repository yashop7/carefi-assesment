# 05d: Email line for WhatsApp, and deleting a letter

## Overview

We keep the WhatsApp reply flow from 05c. Twilio's trial refuses our text at upload time, and Meta and Vonage signups didn't work out, so the automatic email now tells the patient how to get the message on WhatsApp. The team can also delete a query letter uploaded by mistake.

## Changes

- The email ends with a line giving the sandbox join code, the number, and "hi". It's added in `buildMessage`, so the saved template stays as it is, and it's left out when `WHATSAPP_TOKEN` is set.
- `DELETE /api/queries/[id]` removes the file, messages, points and letter. It refuses a letter still being worked on.
- The patient page shows Delete, with a confirm step, next to each finished letter.

## Definition of done

- [ ] The email has the join line and the WhatsApp message doesn't.
- [ ] A signed-out or foreign-origin delete is refused.
- [ ] Deleting a letter leaves no letter, message or point rows.
- [ ] Types and lint pass.
