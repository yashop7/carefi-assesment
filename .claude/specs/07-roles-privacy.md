# Stage 7: Roles and privacy

## Overview

An admin can add agent and patient accounts, give agents their patients, and link a patient account to its locker. An admin can also see who viewed what, including refused attempts. The access rules already exist in `lib/access.ts`, so this stage adds the missing pages and closes the gaps.

## What gets built

- `/admin/users`: add an agent or patient account, assign and remove an agent's patients, see which locker a patient account opens.
- `/admin/access-log`: latest 200 rows with time, person, action, patient and item, plus a "Denied only" view.
- Deleting a document or letter writes a log row.
- `/admin/templates`, `/admin/import` and `/patients` now refuse with a 404 and a `denied` row instead of redirecting.

## Not in this stage

- Password reset, removing accounts, or changing a role.
- The team queue, which stage 9 finishes.

## Rules

- There is still no public signup. Only an admin can add an account.
- Passwords are at least 12 characters, like the admin account, and are never logged or shown again.
- A patient account must be linked to a locker that has no account yet.
- Log rows keep IDs only. The page looks up the email and patient ID when it is opened.

## Definition of done

- [ ] An agent gets a 404 for another agent's patient by page, API and file link.
- [ ] An assigned agent can open the patient, and loses access when removed.
- [ ] A patient sees only their own locker, and can't reach letters, deletes or admin pages.
- [ ] Denied attempts appear on the access log page.
- [ ] Types, lint and build pass.
