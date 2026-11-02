# Plan: Stage 01 — Foundation

Implements [`.claude/specs/01-foundation.md`](../specs/01-foundation.md). Adds Better Auth login, the private bucket helper, the health route and planned migrations, then deploys it all to Railway. It ends with one admin able to log in on the live site.

Nothing here has been run in this repo yet. The design was tested on a throwaway copy, and the spec lists what that did and didn't prove. Commands run from the repo root unless stated.

## Starting state (checked 2026-11-02)

| Item | State | What it means |
|---|---|---|
| Branch | `feature/database`, with uncommitted database work | Step 0 must finish before anything else |
| `feature/foundation` | Doesn't exist | Created in step 0 |
| Remote | `origin` is set to `yashop7/carefi-assesment`, with no remote-tracking branches fetched | Run `git fetch` first, because Railway deploys from GitHub |
| Sample migration | `20261102T1016_init`, with snapshot `a51b4833…` on disk | Matches the `--from` hash in the spec |
| `apps/web/lib`, `apps/web/scripts` | Don't exist | Created in steps 4 to 7 |
| `.env` files | `apps/web/.env` and `packages/db/.env` are both ignored by git | Safe to use. Never read or print them |
| Local Postgres | 16 in Docker container `stoic_nash`, port 5432 | Local work uses it. The rehearsal in step 8 doesn't touch it |
| Node | 23.11.0, but root `engines` says `>=24` | See "Risks" |
| Railway | Nothing created | Step 10 needs you logged in |

## Decisions where the spec is incomplete or conflicts

Each of these is what the plan does unless you say otherwise.

1. **Add `NODE_ENV=production` to the Railway variables.** The spec relies on it being set during pre-deploy, because `seed.ts` only skips the fake patient when `NODE_ENV` is `production`. Railway's docs don't confirm it's set at that point, and the cost of being wrong is a fake patient in production. Setting it is safe for the build: Bun 1.3.13 still installed dev dependencies with it set, which I tested. `prisma` and `turbo` are dev dependencies, so they need to stay installed. Don't set `RAILPACK_PRUNE_DEPS`.
2. **`createExpiringLink(key, expiresIn = 300)`, with `expiresIn` capped at 300.** The spec's signature has no way to make the 1-second link that `check-storage` needs. The cap means no caller can create a longer link.
3. **Use a plain `<button>` on the login and home pages.** `@repo/ui`'s `Button` is a stub that shows an alert when clicked, so the "reuse `@repo/ui`" rule can't apply here.
4. **Edit the root `README.md`.** Lines 19, 21 and 60 mention `docs`, and the definition of done says nothing may reference it. The spec's file list leaves this out. `SPEC.md` keeps its mentions, because they're the instruction to delete it.
5. **Rehearse deployment on a throwaway Postgres container**, so `mydb` is never touched by `db migrate`. Removing that container at the end is part of the step.
6. **`AccessLog.patientId` is optional.** Decided on 2026-11-02 and done with the database work, so a `denied` row can be written for a patient that doesn't exist. The contract, `SPEC.md` and the database spec all match.

## Steps

### 0. Get a clean starting point

This needs your go-ahead, because it commits your database work.

1. Finish the database plan. These must pass:

   ```bash
   bun run --cwd packages/db db:verify
   git status --short
   ```

2. Commit the database work, including `.claude/specs`, `.claude/plans` and `.claude/skills/ship-feature.md`. Then push it and merge it into `main`.
3. Create the branch:

   ```bash
   git fetch origin
   git checkout main
   git pull origin main
   git checkout -b feature/foundation
   ```

If you'd rather not merge yet, branch from `feature/database` instead and merge the two in order.

### 1. Install the dependencies

```bash
cd apps/web
bun add --exact better-auth@1.7.15 auth@1.7.15 pg@8.23.1 kysely@0.29.8 @aws-sdk/client-s3@3.1161.0 @aws-sdk/s3-request-presigner@3.1161.0
bun add --exact --dev @types/pg@8.23.1 @babel/preset-typescript@8.0.1
cd ../..
```

Then edit by hand:

- `apps/web/package.json`: add `"db": "workspace:*"` and the three scripts from the spec.
- `apps/web/next.config.js`: add `transpilePackages: ["db"]`.
- `apps/web/tsconfig.json`: add `"paths": { "@/*": ["./*"] }`, with no `baseUrl`.
- `apps/web/app/layout.tsx`: set the title to "CareFi Patient Locker", with a matching description.

Check the result:

```bash
bun install
bun install --frozen-lockfile     # Railway's install must also pass
git status --short                # Expect apps/web and bun.lock only
```

`postinstall` runs `prisma skills sync`. If it rewrites skill files, stop and look at the diff.

Next, record a baseline:

```bash
bun run check-types
bun run lint
```

Lint should now pass, because the missing Babel preset has been added. If it fails, note the failure so it isn't blamed on later steps.

### 2. Remove the sample code

Approving this plan approves these deletions. All of it is tracked in git, so it can be recovered.

```bash
grep -rn '"docs"\|apps/docs' apps packages package.json turbo.json --exclude-dir=node_modules --exclude-dir=.next
git rm -r apps/docs
git rm apps/web/app/page.module.css
bun install
bun install --frozen-lockfile
```

The `grep` should only find matches inside `apps/docs` itself. If anything else depends on it, stop.

Then replace `apps/web/app/page.tsx` with a placeholder, so the build isn't broken until step 5, and remove the `docs` lines from `README.md`.

### 3. Plan the production migration

From `packages/db`, with the database work committed:

```bash
bunx prisma migration plan \
  --from a51b4833fdaffe730572670ccc27dd89af7e0726ab3de7f428d21702d687cc15 \
  --name carefi_schema \
  --delete User --delete Post
```

Add this script to `packages/db/package.json`:

```json
"db:migrate": "prisma db migrate --db \"$DATABASE_URL\" --no-interactive"
```

Check the result:

- `ops.json` creates the 8 tables and drops only `User` and `Post`.
- Nothing in it mentions `auth`.
- `git status --short packages/db/migrations` shows the new migration and snapshot, and no `refs/db.json`.

### 4. Add login

Create these exactly as the spec shows:

- `apps/web/lib/auth.ts`
- `apps/web/lib/auth-client.ts`
- `apps/web/app/api/auth/[...all]/route.ts`
- `apps/web/scripts/create-admin.ts`
- `apps/web/.env.example`

You then create `apps/web/.env` from the example, with the local `DATABASE_URL`, a new secret, `BETTER_AUTH_URL=http://localhost:3000` and a fake local admin. I won't read or print that file.

Test against the local database:

```bash
bun run --cwd apps/web auth:migrate
bun run --cwd apps/web admin:create           # "Admin created"
bun run --cwd apps/web admin:create           # "Admin already exists"
ADMIN_PASSWORD= bun run --cwd apps/web admin:create; echo "exit $?"    # Non-zero, password not printed
ADMIN_PASSWORD=short bun run --cwd apps/web admin:create; echo "exit $?"   # Non-zero
bun run --cwd packages/db db:update --dry-run  # No operations
bun run --cwd packages/db db:verify            # Passes
```

The earlier test never ran these `--cwd` script forms, so this is their first real test. The throwaway test never had to run `create schema auth` by hand, so `auth:migrate` appears to create the schema itself. If it fails here with a missing schema, stop: `deploy:prepare` would need an extra step to create it.

If `db update` ever offers to drop an `auth` table, answer no and check `schemaName`.

### 5. Add the pages

- `apps/web/app/login/page.tsx`: server page. Call `auth.api.getSession({ headers: await headers() })`, and redirect to `/` if there's a session.
- `apps/web/app/login/login-form.tsx`: client form using `authClient.signIn.email`. Show the right message by status:
  - 401: "Email or password is incorrect"
  - 429: "Too many attempts. Try again in a minute"
  - Anything else: a general "Something went wrong" message, never the raw error
- `apps/web/app/sign-out-button.tsx`: `authClient.signOut`, then go to `/login`.
- `apps/web/app/page.tsx`: server page that redirects to `/login` with no session, and otherwise shows the email, role and sign-out button.

Import `auth` as a type only in `auth-client.ts`. Keep the login page simple and clear, because the design work belongs to stage 9.

### 6. Add the health route

Create `apps/web/app/api/health/route.ts`:

- Set `export const dynamic = "force-dynamic"`.
- Run `db.orm.public.Template.first()` inside `try`.
- Return 200 `{ "ok": true }`, or 503 `{ "ok": false }` from `catch`.
- Don't log or return the caught error, because it can contain the connection string.

The earlier test route returned 500 when the database was down, so 503 is still unproven. Step 8 tests it. If the client throws while the module loads rather than during the query, move the `db` import inside the `try` with `await import("db")`.

### 7. Add file storage

- `apps/web/lib/storage.ts`: `putObject`, `deleteObject` and `createExpiringLink`, as in the spec and decision 2. Create the S3 client on first use.
- `apps/web/scripts/check-storage.ts`: runs the 4 checks in the spec's table.

For `check-storage`:

- Use a key made only of a random ID, such as `check/<uuid>.txt`, with fake content.
- Build the unsigned URL by removing the signed link's query string.
- Build the changed-signature URL by altering `X-Amz-Signature`.
- Delete the test file in a `finally` block, and confirm it's gone.
- Print each check's name and pass or fail, but never a signed URL or a credential.
- Exit non-zero if any check fails.

`check-types` covers this file now. The script itself can't run until the real bucket exists in step 11.

### 8. Rehearse the deployment locally

Use a throwaway container on another port, so `mydb` stays untouched:

```bash
docker run -d --name carefi-foundation-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=app -p 55434:5432 postgres:17
export DATABASE_URL='postgresql://postgres:test@localhost:55434/app'
export BETTER_AUTH_URL=http://localhost:3111 BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=$(openssl rand -hex 16) NODE_ENV=production

bun run deploy:prepare
bun run deploy:prepare     # Second run changes nothing
```

Variables already set in the shell take priority over `.env`, but confirm the rehearsal really used port 55434 by checking that `mydb` gained no migrations.

Check the database:

| Check | Expected |
|---|---|
| `bun run --cwd packages/db db:verify` | Passes |
| Tables in `public` and `auth` | 8 and 4 |
| `Template`, `Patient` | 2 and 0 |
| Users | 1 |

Build with no variables set, then start the app:

```bash
env -u DATABASE_URL -u BETTER_AUTH_URL -u BETTER_AUTH_SECRET -u ADMIN_EMAIL -u ADMIN_PASSWORD bunx turbo run build --filter=web
PORT=3111 bun run --cwd apps/web start
```

Test these with `curl`:

| Request | Expected |
|---|---|
| `GET /api/health` | 200 `{ "ok": true }` |
| `POST /api/auth/sign-up/email` | 400, and still 1 user |
| Sign-in with a wrong password | 401 |
| Sign-in with `Origin: https://evil.example.com` | 403 |
| Sign-in with the right password | 200 and a cookie |
| `POST /api/auth/update-user` with `{"role":"patient"}` | 400, and the role doesn't change |
| Repeated wrong sign-ins | 429 eventually |
| `GET /` with no session | Redirect to `/login` |

Then test the two failure cases that need a restart:

- **Database unavailable:** restart with `DATABASE_URL='postgresql://x:x@localhost:1/x'`. `/api/health` should return 503, and `/` should show an error with no connection details. Check the server output doesn't contain the URL either.
- **Wrong `BETTER_AUTH_URL`:** restart with a different value. Sign-in from the page should get 403.

Then **test the login page in a real browser**, which has never been done. Check a wrong password, the 429 message, login, the home page with its role, sign-out, and that `/` then redirects to `/login`.

Clean up, and confirm nothing is left:

```bash
docker rm -f carefi-foundation-test
docker ps -a --filter name=carefi-foundation-test
```

### 9. Update `SPEC.md` and run the final local checks

Make these `SPEC.md` edits:

- Section 2: add `apps/web/scripts/` to the repo layout.
- Section 10: add `GET /api/health`.
- Section 11: add `ADMIN_EMAIL` and `ADMIN_PASSWORD`, plus `NODE_ENV` for Railway.
- Section 13: replace "use separate schemas if needed" with the `auth` schema decision.

Then:

```bash
bun run check-types
bun run lint
bun install --frozen-lockfile
git status --short      # No .env, and no temporary files
```

Don't commit without your go-ahead. Step 10 can't start until the branch is pushed, so I'll ask at this point.

### 10. Set up Railway and deploy

Only start this after step 9 passes and the branch is on GitHub.

**What you do, because it involves your account and secrets:**

1. Log in to Railway, and connect GitHub to it.
2. Generate `BETTER_AUTH_SECRET`, and choose the admin email and password. Enter them in the Railway dashboard, not in chat.

**What can be done for you with the Railway tools, after you confirm the project name and region:**

1. Create the project, with Postgres, a bucket named `files` and the web service, all in the same region. A bucket's region can't be changed later.
2. Set the service to deploy from `feature/foundation`, and generate a public domain.
3. Apply the service settings from the spec's table. Don't add `railway.json` or `railway.toml`.
4. Set the non-secret variables from the spec, plus `NODE_ENV=production`. Check that the bucket's Credentials tab says virtual-hosted URLs. If it says path-style, add `forcePathStyle: true` to the client.

Then deploy, and watch it through these stages:

| Stage | If it fails, look for |
|---|---|
| Install | Lockfile mismatch |
| Build | `turbo` missing, or the wrong Bun or Node version |
| Pre-deploy | `prisma` or `auth` not found, the database not reachable, or `ADMIN_*` missing |
| Healthcheck | `/api/health` not returning 200, or `next` not found by `bun run` |

Read logs to diagnose failures. Never reset the database, and ask before anything on Railway that deletes something.

### 11. Prove the bucket is private

Add the bucket's `S3_*` values to `apps/web/.env`, then:

```bash
bun run --cwd apps/web storage:check
```

All 4 checks must pass, and the test file must be gone afterwards. **If the unsigned or changed-signature check doesn't return 403, stop and fix it.** Stage 2 can't start until it passes, because the local test could never prove this.

### 12. Check the live site

Run the `curl` table from step 8 against the live domain, and repeat the browser check. Also check:

- The session cookie is `Secure` and `HttpOnly`.
- `prisma db verify` passes, using `DATABASE_PUBLIC_URL`. Pass it through the environment, not in chat.
- `public` has 8 tables and `auth` has 4.
- `Template` has 2 rows, and `Patient` has **0**. If a patient exists, `NODE_ENV` didn't reach pre-deploy, so stop and fix it before going further.
- A redeploy succeeds, adds no second admin and doesn't change the templates.

### 13. Merge

With your go-ahead, open the PR and merge it (`.claude/skills/ship-feature.md` covers this). Then switch the Railway service's branch to `main`, confirm the deploy succeeds, and re-check `/api/health` and login.

## Definition of done

| Spec item | Step |
|---|---|
| `db update --dry-run` reports no operations with `auth` present | 4 |
| `db verify` passes with `auth` present | 4, 8 |
| `admin:create` adds, then reports it exists, and exits non-zero with no password | 4 |
| Build passes with no variables | 8 |
| Live login, role shown, sign-out and redirect | 12 |
| Cookie is `Secure` and `HttpOnly` | 12 |
| Wrong password message | 8, 12 |
| Sign-up refused, role change refused, foreign origin refused | 8, 12 |
| `/api/health` returns 200 | 8, 12 |
| Redeploy adds no duplicates | 8, 12 |
| Railway `db verify`, table and row counts | 12 |
| `storage:check` passes all 4 checks | 11 |
| `apps/docs` gone, and nothing references it | 2 |
| `git status` lists no `.env` | 9 |
| `check-types` and `lint` pass | 9 |
| Logged-out user sent to `/login` | 8, 12 |

### Failure cases

| Failure case | How it's checked |
|---|---|
| Wrong password, sign-up, foreign origin, role change, no session | Steps 8 and 12 |
| Too many attempts | Step 8, on the API and in the browser |
| `ADMIN_*` missing or too short | Step 4 |
| Database down | Step 8, using a bad URL rather than stopping a container |
| Wrong `BETTER_AUTH_URL` | Step 8 |
| Bucket credentials wrong | Step 11: run once with a wrong secret, and expect a non-zero exit with no credentials printed |
| `db update` offering to drop `auth`, and `migration plan` refusing | Seen in the earlier test. Not repeated, because they're warnings about what to do |
| `baseUrl` refused | Seen in the earlier test. Avoided in step 1 |
| Pre-deploy fails or hangs, keeping the old version live | **Not simulated.** Step 10 confirms the 300-second timeout is set, and step 8 proves the sequence is safe to re-run. The report will say so |

## Files

| File | Change |
|---|---|
| `apps/web/package.json`, `next.config.js`, `tsconfig.json` | Dependencies, scripts, `transpilePackages`, `paths` |
| `apps/web/app/layout.tsx`, `page.tsx` | Title, and the temporary home page |
| `apps/web/app/login/page.tsx`, `login/login-form.tsx`, `sign-out-button.tsx` | New pages and buttons |
| `apps/web/app/api/auth/[...all]/route.ts`, `api/health/route.ts` | New routes |
| `apps/web/lib/auth.ts`, `auth-client.ts`, `storage.ts` | New helpers |
| `apps/web/scripts/create-admin.ts`, `check-storage.ts` | New scripts |
| `apps/web/.env.example` | New |
| `packages/db/package.json`, `packages/db/migrations/` | `db:migrate`, and the new migration and snapshot |
| `package.json`, `bun.lock` | `deploy:prepare`, and the new packages |
| `SPEC.md`, `README.md` | Step 9, and decision 4 |
| `apps/docs/`, `apps/web/app/page.module.css` | Deleted |

## Risks

- **Nothing has run on Railway.** The most likely problems are Railpack's handling of the build, pre-deploy and start commands in a Bun monorepo. Step 10 lists where to look.
- **Dev dependencies must survive to pre-deploy.** `prisma` is a dev dependency and pre-deploy uses it. `NODE_ENV=production` doesn't remove it from the install, and pruning appears to be opt-in, but the Railway docs I found don't say this outright. If pre-deploy can't find `prisma`, move it to `dependencies` in `packages/db`.
- **Node 23.11 locally.** It's below the `>=24` in `engines`. Railway uses 24 through `RAILPACK_NODE_VERSION`, so a local pass doesn't fully prove the live run. If the CLI or `tsc` misbehaves locally, upgrade to 24 before debugging further.
- **Local development shares the real bucket.** Only fake data may go in it, and that matters from stage 2 onwards.
- **Railway's Config as Code cutoff is 2026-12-01.** Using service settings avoids it, but those settings live outside the repo. If the service is ever recreated, they must be re-entered from the spec.
