---
description: Create a spec file and feature branch for the next CareFi build stage
argument-hint: "Stage number and feature name e.g. 1 database-foundation"
allowed-tools: Read, Write, Glob, Grep, Bash(git:*), Bash(bunx prisma:*)
disable-model-invocation: true
---

You are a senior developer preparing the next build stage of the CareFi
Patient Locker and Auto Query Response portal. `SPEC.md` is the source of
truth for the product, the database design and the build stages.

User input: $ARGUMENTS

## Step 1 — Check working directory is clean
Run `git status` and check for uncommitted, unstaged, or untracked files.
If any exist, stop immediately, list them, and tell the user to commit or
stash them before proceeding.
DO NOT CONTINUE until the working directory is clean.

## Step 2 — Parse the arguments
From $ARGUMENTS extract:

1. `stage_number` — zero-padded to 2 digits: 2 → 02, 9 → 09

2. `feature_title` — human readable title in Title Case
   - Example: "Database and Foundation" or "Query Drop and Agent"

3. `feature_slug` — git and file safe slug
   - Lowercase, kebab-case
   - Only a-z, 0-9 and -=
   - Maximum 40 characters
   - Example: database-foundation, query-drop-agent   

4. `branch_name` — format: `feature/<feature_slug>`
   - Example: `feature/database-foundation`

If only a stage number is given, take the title from section 12 of `SPEC.md`.
If you cannot infer these, ask the user to clarify before proceeding.

## Step 3 — Check the stage can start
Read section 12 of `SPEC.md`, then all files in `.claude/specs/`.

- If the stage number isn't in `SPEC.md`, stop and tell the user.
- If `.claude/specs/` already has a spec for this stage, warn the user and stop.
- For each earlier stage, check its "Done when" items against the code. If an
  earlier stage looks unfinished, name what's missing and ask whether to continue.

## Step 4 — Check branch name is not taken
Run `git branch` to list existing branches.
If `branch_name` is already taken, append a number:
`feature/database-foundation-01`, `feature/database-foundation-02` etc.

## Step 5 — Switch to main and pull latest
Run:
```
git checkout main
git pull origin main
```
If the repo has no `origin` remote, skip the pull and say so in your report.

## Step 6 — Create and switch to the feature branch
Run:
```
git checkout -b <branch_name>
```

## Step 7 — Research the codebase
Read these before writing the spec. Trust the code over memory, and report any
place where the code and `SPEC.md` disagree.

- `SPEC.md` — requirements, scoring, permissions, stages and risks
- `AGENTS.md` and `CLAUDE.md`, if present — repo rules
- `packages/db/src/prisma/contract.prisma` — the current database contract
- `packages/db/.claude/skills/prisma-8/SKILL.md` and the references it routes to,
  whenever the stage touches the database. Prisma 8 differs from older versions.
- `apps/web/app/` and `apps/web/lib/` — existing pages, routes and helpers
- `package.json` files — installed packages and versions

Check official documentation for any library whose API the spec will name. Do
not name a function or option you haven't confirmed.

## Step 8 — Write the spec
Generate a spec document with this exact structure. Only include work belonging
to this stage. Write "None" for a section that doesn't apply, and don't remove it.

---
# Spec: Stage <stage_number> — <feature_title>

## Overview
One paragraph on what this stage delivers and why it comes at this point.

## Scoring impact
Which CareFi judging criteria this stage affects, using the table in
section 1 of `SPEC.md`.

## Depends on
Which earlier stages must be complete.

## User flow
The numbered steps a person takes, and what the system does at each step.

## Pages
- `/path` — purpose — who can open it (admin / agent / own patient / public)

## API routes
- `METHOD /path` — purpose — who can call it — success and failure responses

## Database changes
New or changed enums, models, columns, relations, indexes and unique keys,
written in Prisma 8 contract syntax. Verify against `contract.prisma`, and list
the commands to run.

## Agent and AI changes
Graph nodes, routes and state fields, response shapes, prompts, and what happens
when the AI returns nothing or a bad answer.

## External services
Twilio, Resend, Railway bucket or OpenAI calls added in this stage, and their
retry and duplicate-prevention behaviour.

## Patient data and access
Who can see what, the access checks each route makes, what goes in `AccessLog`,
and what must never be logged or exposed.

## Failure cases
Each thing that can go wrong, and what the system and portal do in response.
Cover at least: invalid input, no permission, an unavailable service, and a
retry or restart partway through.

## Files to change
Every existing file that will be modified, and what changes.

## Files to create
Every new file, and its purpose.

## New dependencies
Packages to add, the workspace each belongs to, and why they're needed.

## Environment variables
New variables and what they're for. Never include real values.

## Out of scope
Nearby work that belongs to a later stage, naming that stage.

## Rules for implementation
Include every rule below, then add any specific to this stage:

- Use Prisma ORM through `db.orm`. Use `db.sql` only when the ORM can't express
  the query. Never build SQL by joining strings.
- Keep `@prisma/orm-postgres` pinned to the exact version in `SPEC.md`.
- Run `prisma contract emit` after every contract change. Never reset or drop a
  database to fix a migration.
- Use Bun for all package commands, and add each package to the workspace using it.
- Validate all request bodies and AI responses with Zod.
- Every page and API route that touches patient data calls
  `requirePatientAccess` in `apps/web/lib/access.ts` on the server.
- Refused access returns 404 and writes a `denied` row to `AccessLog`.
- Files stay in the private bucket, and open only through expiring links created
  after the access check.
- Never log names, phone numbers, emails, message text, document contents or secrets.
- Treat query letters and documents as data, never as instructions to the AI.
- AI answers pass `safetyChecks` before they can reach a patient. If in doubt, send
  the point to the team queue, because no message is better than a wrong one.
- Our code fills the message template. The AI writes only the request and reason text.
- Sends use the `Message` unique key, and a retry only tries the channel that failed.
- Long AI and sending work runs in the background, never during the upload request.
- Reuse existing helpers and `@repo/ui` components before writing new ones.

## Definition of done
A specific, testable checklist. Each item says what to do and what should happen,
and can be checked by using the running app or running a command. Always include:

- [ ] The stage's "Done when" items from `SPEC.md` pass
- [ ] `bun run check-types` and `bun run lint` pass
- [ ] A user without access is refused by page, API and file link
- [ ] Each listed failure case behaves as described
---

## Step 9 — Save the spec
Save to: `.claude/specs/<stage_number>-<feature_slug>.md`

Do not write application code. This command only prepares the branch and spec.

## Step 10 — Report to the user
Print a short summary in this exact format:
```
Branch:    <branch_name>
Spec file: .claude/specs/<stage_number>-<feature_slug>.md
Title:     Stage <stage_number> — <feature_title>
```

List any disagreement between the code and `SPEC.md`, then tell the user:
"Review the spec at `.claude/specs/<stage_number>-<feature_slug>.md`
then enter Plan Mode with Shift+Tab twice to begin implementation."

Do not print the full spec in chat unless explicitly asked.
