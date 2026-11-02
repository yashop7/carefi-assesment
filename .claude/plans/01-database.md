# Plan: Stage 01 — Database

Implements [`.claude/specs/01-database.md`](../specs/01-database.md). Replaces the sample contract with the 8-table CareFi contract, applies it to the local database, seeds it, and proves the unique keys and enum checks work. There is no application code beyond `src/seed.ts`.

Nothing here has been run yet. Commands run from `packages/db` unless stated. Work on the existing `feature/database` branch.

## Starting state (checked 2026-11-02)

| Item | State | What it means |
|---|---|---|
| Root `node_modules` | Missing, so `packages/db/node_modules` symlinks are broken | `bun install` must come first |
| `@prisma/orm-postgres` | `8.0.0-rc.21`, exact | Correct, leave it alone |
| `prisma` | `^8.0.0-rc.29`; the lockfile resolves rc.29 | Pin it exactly. `bun.lock` will change too |
| `DATABASE_URL` | `localhost`, database `mydb` | Local, as the spec requires |
| Postgres | 16.14 in Docker container `stoic_nash`, port 5432 | Meets the 15+ requirement |
| Tables in `mydb` | `User` and `Post`, **0 rows each** | `db update` will ask to delete them, and no data is lost |
| Database marker | `a51b4833…`, the sample `20261102T1016_init` migration | Matches the migration on disk |
| Node | 23.11.0, but root `engines` says `>=24` | See "Risks" |
| `.env` | Ignored by git | Confirmed with `git check-ignore` |

## Decisions where the spec is incomplete or conflicts

Each of these is what the plan does unless you say otherwise.

1. **`db update` runs with `--db "$DATABASE_URL"`.** The spec says to leave `migrations/` alone, but plain `db update` writes `migrations/app/refs/db.json` and a new snapshot. That ref would point past the last migration, so a later `migration plan` would refuse with `MIGRATION.HASH_NOT_IN_GRAPH`. Passing `--db` suppresses the ref, even for the default database (`references/migration-model.md`, ref table). The `db:update` script includes the flag.
2. **The constraint test script is temporary and not committed.** The definition of done asks for test scripts, but "Files to create" lists only `seed.ts`, and the rules forbid other application code. It lives at `src/check-constraints.tmp.ts` and is deleted once it passes, with its output reported in the PR. To keep it for later stages, it needs adding to the spec's file list.
3. **`bun.lock` is committed.** The spec doesn't list it, but pinning `prisma` changes it.
4. **The two `Patient` fields the template needs are seeded.** `PAT-001` gets a fake `claimNumber` (`CL-9921`) and `policyNumber` (`HP-4471`), as in the demo. Otherwise `{{claim_number}}` has no value and stage 5 sending would stop for this patient.

## Steps

### 1. Pin and install

Edit `packages/db/package.json`:

```json
{
  "exports": { ".": "./src/prisma/db.ts" },
  "scripts": {
    "contract:emit": "prisma contract emit",
    "postinstall": "prisma skills sync || exit 0",
    "db:update": "prisma db update --db \"$DATABASE_URL\"",
    "db:verify": "prisma db verify",
    "db:seed": "bun run src/seed.ts",
    "check-types": "tsc --noEmit"
  }
}
```

Keep the other fields as they are, and change `prisma` to exactly `8.0.0-rc.29`. Then, from the repo root:

```bash
bun install
git status --short          # Expect package.json and bun.lock only
grep -n '"prisma": \["prisma@\|"@prisma/orm-postgres": \["' bun.lock   # rc.29 and rc.21
```

The `postinstall` step runs `prisma skills sync`, which can rewrite the 468 tracked skill files. If it does, stop and look at the diff before continuing, because a version change there means the wrong packages were installed.

### 2. Record a baseline

From the repo root, before changing the contract:

```bash
bun run check-types
bun run lint
```

Note any existing failures so they aren't blamed on this stage. `apps/web` and `apps/docs` are included, and neither has been checked since `node_modules` went missing.

### 3. Replace the contract and emit

1. Replace all of `src/prisma/contract.prisma` with the contract in the spec. Copy it exactly.
2. Run `bunx prisma contract emit`.
3. Check the result. Use `-w`, because a plain search for `Post` could also match unrelated words:

```bash
grep -c  'Patient' src/prisma/contract.d.ts   # More than 0
grep -cw 'Post'    src/prisma/contract.d.ts   # 0
```

Never edit `contract.json` or `contract.d.ts` by hand.

### 4. Apply to the local database

```bash
set -a; . ./.env; set +a
docker exec stoic_nash psql "$DATABASE_URL" -Atc 'select (select count(*) from "User"), (select count(*) from "Post");'
bun run db:update --dry-run
```

Continue only if the first command prints `0|0` and the dry run shows 8 new tables and drops only `User` and `Post`. Then:

```bash
bunx prisma db update --db "$DATABASE_URL" --no-interactive   # Expect CLI.CONSENT_REQUIRED, nothing changes
bun run db:update --delete User --delete Post
bun run db:verify
git status --short packages/db/migrations                     # Expect nothing, run from the repo root
docker exec stoic_nash psql "$DATABASE_URL" -Atc "select count(*) from pg_tables where schemaname = 'public';"   # 8
```

Approving this plan approves deleting those two empty tables. If either has gained rows, stop and ask. Never reset or drop the database to get past an error.

### 5. Write the seed script

Create `src/seed.ts`. The shape below follows the Prisma references but hasn't been compiled, so adjust it to the emitted types if needed.

```ts
import { db } from './prisma/db';

const body = `Hello {{patient_name}},

Your insurance company needs the following for your claim {{claim_number}}:

{{requested_items}}

Please send these as soon as you can. We already have your other documents, so
there is no need to send them again.

Team CareFi`;

const templates = [
  { channel: 'whatsapp', subject: null, body },
  { channel: 'email', subject: 'Documents needed for your claim {{claim_number}}', body },
] as const;

try {
  let templatesAdded = 0;
  for (const template of templates) {
    const existing = await db.orm.public.Template.where({ channel: template.channel }).first();
    if (!existing) {
      await db.orm.public.Template.create(template);
      templatesAdded++;
    }
  }

  let patientsAdded = 0;
  if (process.env['NODE_ENV'] !== 'production') {
    const existing = await db.orm.public.Patient.where({ patientCode: 'PAT-001' }).first();
    if (!existing) {
      await db.orm.public.Patient.create({
        patientCode: 'PAT-001',
        name: 'Asha Verma',
        phone: '+910000000000',
        email: 'asha@example.com',
        policyNumber: 'HP-4471',
        claimNumber: 'CL-9921',
      });
      patientsAdded++;
    }
  }

  console.log(`Seed finished: ${templatesAdded} templates and ${patientsAdded} patients added`);
} finally {
  await db.close();
}
```

- Use find-then-create. Don't use `.upsert()`, which the spec says fails on the second run.
- Log counts only, never patient details.
- A failed query must still exit non-zero, so don't catch errors here.

### 6. Check the seed

```bash
bun run db:seed     # 2 templates and 1 patient added
bun run db:seed     # 0 and 0 added
docker exec stoic_nash psql "$DATABASE_URL" -Atc 'select (select count(*) from "Template"), (select count(*) from "Patient");'   # 2|1
```

### 7. Test the constraints

Write `src/check-constraints.tmp.ts`. Each case runs in its own `db.transaction`, because a refused insert aborts the transaction. Each one ends by throwing, so everything rolls back and no test rows stay behind.

| Case | Setup | Expected |
|---|---|---|
| Duplicate document | Create a patient, then two `Document` rows with the same `patientId` and `sha256` | `23505` on `Document`'s unique key |
| Duplicate message | Create a patient and letter, then two `Message` rows with the same `queryLetterId` and `channel` | `23505` on `Message`'s unique key |
| Invalid enum | Create a `Message` with `channel: 'sms' as never` | `23514`, the check constraint |
| Relations | Create a letter with one point and one message, then read with `.include('points').include('messages')` | Both related rows returned |

Rules for the script:

- Use `tx.orm` for everything inside a transaction, never `db.orm`.
- Check that the first insert succeeded and that the error's `sqlState` and `constraint` match. A setup mistake also throws, so "it threw" proves nothing.
- If the client rejects `sms` before reaching Postgres, also send it through a parameterised `tx.raw.sql` insert, so the database's own check is what gets tested.
- Call `await db.close()` at the end, and exit non-zero if any case fails.

Then:

```bash
bun run src/check-constraints.tmp.ts
rm src/check-constraints.tmp.ts
docker exec stoic_nash psql "$DATABASE_URL" -Atc 'select count(*) from "Patient";'   # Still 1
```

### 8. Check the failure cases

| Failure case | How to check |
|---|---|
| Duplicate document or message, invalid enum | Step 7 |
| Seed run twice | Step 6 |
| `db update` with no one to answer | Step 4 |
| `DATABASE_URL` wrong, or Postgres down | `DATABASE_URL='postgresql://x:x@localhost:1/x' bunx prisma db verify` and the same for `bun run db:seed`. Both should fail with an error and a non-zero exit, and work again afterwards. This avoids stopping the container |
| `DATABASE_URL` missing | Run `bun run db:seed` from a temporary copy of the environment with the variable unset, and expect a non-zero exit |
| `db update` stopped partway | Run `bun run db:update` again, which should change nothing, then `bun run db:verify`. **The interruption itself isn't simulated**, so say so in the report |
| `typeChoice` crash on rc.22 | **Not reproduced**, because installing rc.22 would churn the lockfile. Confirm the rc.21 pin from step 1 and say so in the report |

### 9. Final checks

From the repo root:

```bash
bun run check-types
bun run lint
git status --short    # No .env, no migrations/, no temporary script
```

`packages/db` has no `lint` script and the spec doesn't add one, so `lint` doesn't cover it. If `tsc` isn't found in `packages/db`, add `"typescript": "7.0.2"` as a dev dependency, as `apps/web` does, and report it as a change from the spec's "no new dependencies".

Don't commit until asked.

## Definition of done

| Spec item | Step |
|---|---|
| `contract emit` succeeds, with `Patient` and no `Post` | 3 |
| `db update` creates the 8 tables | 4 |
| `db verify` reports a match | 4 |
| Seed adds 2 templates and 1 patient, then nothing | 6 |
| Duplicate `Document` refused | 7 |
| Duplicate `Message` refused | 7 |
| `channel: "sms"` refused | 7 |
| `QueryLetter` includes return related rows | 7 |
| `git status` doesn't list `.env` | 9 |
| Stage 1 database items pass | 4 (the live link and login belong to the foundation spec) |
| `check-types` and `lint` pass | 9 |
| Access refusal | Not applicable until stage 7 |
| Each failure case behaves as described | 8, with the two limits noted there |

## Files

| File | Change |
|---|---|
| `packages/db/package.json` | Exports, 4 scripts, exact `prisma` pin |
| `bun.lock` | The `prisma` pin |
| `packages/db/src/prisma/contract.prisma` | Replaced |
| `packages/db/src/prisma/contract.json`, `contract.d.ts` | Regenerated |
| `packages/db/src/seed.ts` | New |

## Risks

- **Node 23.11 is below the `>=24` in root `engines`.** `TimestamptzString` doesn't need `Temporal`, and the docs say the CLI doesn't either, so this may not cause problems. If the CLI or `tsc` misbehaves, upgrade to Node 24 before debugging further. Railway should run 24 either way.
- **`migrations/` still describes the sample schema after this stage.** `mydb`'s marker will point at a contract that no migration produces, so `db migrate` on this database would fail with `MIGRATION.MARKER_MISMATCH`. That's expected until the foundation spec picks the production path. If it uses migrations, plan with `--from a51b4833…`, because `migration plan` refuses to run over existing migrations without an origin.
- **The contract has never been applied to a real database.** `SPEC.md` says so too. If `db update` rejects it, any fix must also go into section 4 of `SPEC.md`.

## Contract issues for later stages

The spec says to copy the contract exactly, so this plan doesn't change these. They're cheapest to fix now, before any data exists.

1. **`AccessLog.patientId` is required and has a foreign key.** `SPEC.md` section 5 says a refused request returns 404 and writes a `denied` row. A request for a patient ID that doesn't exist can't write that row, because the insert fails the foreign key. Unless stage 7 handles it, that request becomes a 500 rather than a 404, which reveals which patients exist. Making the column optional would fix it.
2. **`QueryPoint.status` and `reason` are required.** `extractPoints` finds points before `checkLocker` decides them, and stage 4 says to save results as it goes. Points can't be saved until they have a decision, so a crash between those two nodes relies entirely on the LangGraph checkpoint. That's workable if stage 4 writes points after `safetyChecks`, as the demo's flow suggests.
