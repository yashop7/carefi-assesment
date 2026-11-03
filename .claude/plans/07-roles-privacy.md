# Plan: Roles and privacy

1. Add `delete_file` to `AccessAction`, emit the contract and plan a migration.
2. `lib/access.ts`: add the action. `lib/users.ts`: list accounts and create one with the Better Auth adapter, as `create-admin.ts` does.
3. Log deletes in `api/documents/[id]` and `api/queries/[id]`.
4. Routes, all admin only:
   - `POST /api/users`: add an account.
   - `POST /api/users/[id]/patients`: assign a patient to an agent.
   - `DELETE /api/users/[id]/patients/[patientId]`: remove the assignment.
5. Pages: `/admin/users` and `/admin/access-log`, with links from the patient list.
6. Use `orNotFound` on `/admin/templates`, `/admin/import` and `/patients`.
7. Test locally with a throwaway database and stand-ins, with no OpenAI calls:
   - agent and patient against page, API and file link
   - assign and remove
   - denied rows on the log page
8. Update `SPEC.md` and `README.md`, then ship.
