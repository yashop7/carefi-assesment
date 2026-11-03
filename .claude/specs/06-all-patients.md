# Stage 06: All patients

## Overview

CareFi gives us 10 patients with documents and a message template, possibly only at evaluation. An admin can load them in a few minutes and put the template in place. The portal also shows every patient at a glance.

## Scope

**Patient list (`/patients`)**
- A search box filters by patient ID, name or claim number. It filters in the browser, so patient details stay out of URLs and logs.
- New columns: open items and latest query status.
- Open items are points in the latest letter that are asked from the patient or need the team.

**Import (`/admin/import`, admin only)**
- Upload a CSV with `patientCode, name, phone, email, policyNumber, claimNumber`. Each row is checked with the same rules as the Add patient form.
- Existing patient IDs are skipped, and bad rows are listed by row number. Good rows still load.
- Choose a folder with files in `<patientCode>/<anything>`. Each file uses the normal document upload, so its checks and access log still apply.
- The page shows the reading progress of recent files.

**Template editor (`/admin/templates`, admin only)**
- Edit the WhatsApp and email text, and the email subject, with a live preview.
- Saving refuses unknown placeholders, and a body without `{{requested_items}}`.
- The next message uses the saved text. Messages already made don't change.

**Template wording**
- The seed's "We already have your other documents" is wrong for an empty locker, so it changes. The live template gets changed in the editor, or replaced with CareFi's.

## Not in this stage

- Editing existing patients through the CSV.
- Zip upload, or uploading query letters through the import.
- Agent assignment and the access log for deletes (Stage 7).

## Definition of done

- [ ] 10 patients load from a CSV, and bad rows are reported without stopping the rest.
- [ ] A folder of documents reaches the right lockers, and a file with no matching patient is reported.
- [ ] Search finds a patient by ID, name or claim number.
- [ ] An edited template shows up in the next message.
- [ ] Agents and patients can't use import or template routes or pages.
- [ ] Types, lint and build pass.
