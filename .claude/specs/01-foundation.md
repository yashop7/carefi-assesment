# Spec: Stage 01 — Foundation

## Overview
This spec finishes stage 1 of `SPEC.md`: Railway hosting, a private file bucket, Better Auth login and a live deployment. It comes straight after the database spec because every later stage needs a login, somewhere to store files and a public link. It ends with one admin able to log in on the live site. `.claude/specs/01-database.md` covers the tables, so this spec doesn't change the contract.

## Scoring impact

| Criterion | Points | How this stage helps |
|---|---|---|
| Care with patient data | 10 | Staff log in, public sign-up is off, users can't change their own role, and the bucket is private with expiring links |
| Easy portal | 15 | Gives CareFi a public link and a clear login page |
| Sends automatically | 15 | Provides the always-on service that runs letters in the background |
| Finds every point, asks only for what's missing, clear message, speed | 60 | No direct effect, but CareFi can only test these on a live site |

## Depends on
`.claude/specs/01-database.md` must be finished and committed. Its contract and `db` package export are used here.

## User flow

### Setting up, once

1. The developer creates a Railway project with Postgres, a bucket named `files` and a service connected to this repo.
2. The developer sets the service settings and variables listed under "External services".
3. Railway builds the app, then runs the pre-deploy command. That applies the migrations, creates the login tables, adds the admin and adds the templates.
4. Railway starts the app and waits for `/api/health` to return 200 before sending it traffic.

### Logging in

1. Someone opens the live link. With no session, `/` sends them to `/login`.
2. They enter their email and password. A wrong password shows "Email or password is incorrect" and doesn't say which one was wrong.
3. On success they go to `/`, which shows their email, their role and a sign-out button. Stage 2 replaces this page with the patient list.
4. Signing out returns them to `/login`.

## Pages

- `/login` — email and password form, with no sign-up link. Already logged-in users go to `/` — public
- `/` — temporary home page showing email, role and sign out. Replaces the sample page — any logged-in user

## API routes

- `GET, POST /api/auth/[...all]` — Better Auth's own routes — public, with its own checks
  - `POST /api/auth/sign-in/email`: 200 and a session cookie on success, 401 for wrong details
  - `POST /api/auth/sign-up/email`: always 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED`
  - Requests from another site: 403
- `GET /api/health` — lets Railway check the app can reach the database — public — 200 `{ "ok": true }`, or 503 `{ "ok": false }` with no error details. It returns no patient data

## Database changes

The contract doesn't change. This stage adds three things around it.

### Production uses planned migrations

This settles the question left open in the database spec. Local databases keep using `db update`. Railway uses `db migrate`, because Prisma's docs say a production database should change only through migrations.

After the database spec is committed, run this once from `packages/db` and commit the result:

```bash
bunx prisma migration plan \
  --from a51b4833fdaffe730572670ccc27dd89af7e0726ab3de7f428d21702d687cc15 \
  --name carefi_schema \
  --delete User --delete Post
```

`--from` is the sample migration's end point, which is needed because a plan has no other way to chain onto it. `--delete` is safe here: on Railway these two tables are created by the first migration and dropped by the second, so they never hold data.

### Better Auth gets its own `auth` schema

Better Auth's four tables (`user`, `session`, `account`, `verification`) go in an `auth` schema, not `public`. **This is required.** In testing, an extra `public.user` table made `db update` plan `DROP TABLE "public"."user"`, which would put every login one wrong answer away from being deleted. With the `auth` schema, `db update` reports "No operations" and `db verify` still passes.

### The commands

| Where | Command | What it does |
|---|---|---|
| Local | `bun run --cwd packages/db db:update` | Applies the contract to the local database, as before |
| Local and Railway | `bun run --cwd apps/web auth:migrate` | Creates or updates the `auth` schema |
| Local and Railway | `bun run --cwd apps/web admin:create` | Adds the admin if missing |
| Railway | `bun run --cwd packages/db db:migrate` | Applies committed migrations |
| Railway | `bun run deploy:prepare` | Runs all of the above for Railway, in order, plus `db:seed` |

Never reset or drop a database to get past an error.

## Agent and AI changes
None. The always-on service is ready for stage 4.

## External services

### Railway project

Create these in one project, in the same region. A bucket's region can't be changed later.

- **Postgres:** the standard Railway database, version 15 or newer
- **Bucket:** named `files`
- **Web service:** connected to this GitHub repo, with a generated public domain

While testing, set the service's branch to `feature/foundation`, then switch it to `main` after merging.

### Service settings

Set these in the service's Settings tab. **Don't add a `railway.json`:** Railway has deprecated Config as Code, and it stops working for existing services on 2026-12-01.

| Setting | Value |
|---|---|
| Root directory | Leave empty, so the whole repo is available |
| Build command | `bunx turbo run build --filter=web` |
| Pre-deploy command | `bun run deploy:prepare` |
| Pre-deploy timeout | 300 seconds, because by default a stuck command never times out |
| Start command | `bun run --cwd apps/web start` |
| Healthcheck path | `/api/health` |
| Restart policy | On failure |

`next start` picks up Railway's `PORT` automatically. The build needs no variables, and it passed in testing with none set.

### Service variables

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>
BETTER_AUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
ADMIN_EMAIL=<admin login email>
ADMIN_PASSWORD=<at least 12 characters>
S3_ENDPOINT=${{files.ENDPOINT}}
S3_REGION=${{files.REGION}}
S3_BUCKET=${{files.BUCKET}}
S3_ACCESS_KEY_ID=${{files.ACCESS_KEY_ID}}
S3_SECRET_ACCESS_KEY=${{files.SECRET_ACCESS_KEY}}
RAILPACK_BUN_VERSION=1.3.13
RAILPACK_NODE_VERSION=24
```

Use `BUCKET`, not `RAILWAY_BUCKET_NAME`, which isn't the name the S3 API expects. New buckets use virtual-hosted URLs. If the bucket's Credentials tab says path-style, add `forcePathStyle: true` to the client in `lib/storage.ts`.

### Bucket use

Local development uses the same bucket's credentials, because Railway offers no local version. Only fake and CareFi sample data goes in it. The bucket has no retry logic in this stage, and there's no duplicate risk because nothing uploads yet except the check script.

### What has and hasn't been tested

This design was run on a throwaway copy of the repo, with Postgres 17 in Docker and a local S3 emulator:

- **Passed:** planned migrations on an empty database, running the whole pre-deploy sequence twice with no duplicates, `turbo` build, `check-types`, `lint`, and real login through `next start`.
- **Not tested:** anything on Railway itself, the login page's browser code, and bucket privacy. The emulator ignored signatures, so only the expired-link result means anything there. `check-storage` proves privacy on the real bucket.

## Patient data and access

- **Sign-up is off.** Only the `admin:create` script makes accounts in this stage. The admin page arrives in stage 7.
- **`role` has `input: false`.** In testing, a logged-in user changing their own role got 400 `FIELD_NOT_ALLOWED`. New users default to `patient`, the role with the least access.
- **Every protected page checks the session on the server** with `auth.api.getSession`. Don't rely on `proxy.ts`, or on hiding a button.
- **The bucket is private.** Links last 5 minutes. Store only the key in the database, never a signed link.
- **Bucket keys contain IDs only**, never names or original file names.
- **Never log** passwords, session tokens, connection strings or bucket credentials. The health route never returns error details.
- **`requirePatientAccess` and `AccessLog` aren't used yet.** No patient data can be reached through the app until stage 2, and the full checks arrive in stage 7. Stage 2 must require a logged-in admin or agent on every patient route until then.

## Failure cases

| What goes wrong | What should happen |
|---|---|
| Wrong email or password | 401, and the page shows "Email or password is incorrect" |
| Too many login attempts | Better Auth returns 429, and the page shows "Too many attempts. Try again in a minute" |
| Anyone calls the sign-up route | 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED`, and no account is created |
| Sign-in request from another site | 403 |
| User tries to change their own role | 400 `FIELD_NOT_ALLOWED`, and the role doesn't change |
| No session on `/` | Redirect to `/login` |
| `ADMIN_EMAIL` or `ADMIN_PASSWORD` missing, or the password is too short | `admin:create` exits non-zero without printing the password, and the deployment stops |
| Pre-deploy step fails, or is restarted | The new version doesn't go live and the old one keeps running. Every step is safe to run again |
| Pre-deploy command hangs | Stopped after 300 seconds, and the deployment fails |
| Database down while running | `/api/health` returns 503, and pages show an error without connection details |
| Bucket credentials wrong or service unavailable | `check-storage` exits non-zero and names the step that failed, without printing credentials. Stage 2 shows upload errors |
| `BETTER_AUTH_URL` doesn't match the live domain | Login gets 403. Fix the variable and redeploy |
| `db update` proposes dropping an `auth` table | Stop. Better Auth has been moved out of its schema, so check `schemaName` |
| `prisma migration plan` refuses because of existing migrations | `--from` is missing or wrong. Use the hash above |
| `tsc` reports `Option 'baseUrl' has been removed` | TypeScript 7 refuses it. Use `paths` alone, as shown below |

## Files to change

- `apps/web/package.json` — Add the dependencies below and `"db": "workspace:*"`. Using `workspace:*` stops an install from fetching the unrelated public `db` package. Add these scripts:

  ```json
  "auth:migrate": "auth migrate --config lib/auth.ts --yes",
  "admin:create": "bun run scripts/create-admin.ts",
  "storage:check": "bun run scripts/check-storage.ts"
  ```

- `apps/web/next.config.js` — Add `transpilePackages: ["db"]`, because `db` exports TypeScript directly.
- `apps/web/tsconfig.json` — Add `"paths": { "@/*": ["./*"] }` to `compilerOptions`, with no `baseUrl`.
- `apps/web/app/page.tsx` — Replace the sample page with the temporary home page.
- `apps/web/app/layout.tsx` — Set the title to "CareFi Patient Locker", and a matching description.
- `packages/db/package.json` — Add `"db:migrate": "prisma db migrate --db \"$DATABASE_URL\" --no-interactive"`.
- `package.json` (root) — Add this script:

  ```json
  "deploy:prepare": "bun run --cwd packages/db db:migrate && bun run --cwd apps/web auth:migrate && bun run --cwd apps/web admin:create && bun run --cwd packages/db db:seed"
  ```

- `bun.lock` — Updates with the new packages.
- `SPEC.md`:
  - Section 11: add `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
  - Section 10: add `GET /api/health`.
  - Section 13: replace "use separate schemas if needed" with the `auth` schema decision.
  - Section 2: add `apps/web/scripts/` to the repo layout.

### Delete

- `apps/docs/` — Stage 1 in `SPEC.md` asks for this. Check nothing else imports it first.
- `apps/web/app/page.module.css` — Only the sample page uses it.

## Files to create

### `apps/web/lib/auth.ts`

```ts
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: {
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    }),
    type: "postgres",
    schemaName: "auth",
  },
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "patient",
        input: false,
      },
    },
  },
  plugins: [nextCookies()],
});
```

### `apps/web/scripts/create-admin.ts`

```ts
import { auth } from "../lib/auth";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error("Set ADMIN_EMAIL, and ADMIN_PASSWORD with at least 12 characters");
  process.exit(1);
}

const ctx = await auth.$context;
if (await ctx.internalAdapter.findUserByEmail(email)) {
  console.log("Admin already exists");
  process.exit(0);
}

const user = await ctx.internalAdapter.createUser(
  { email, name: "Admin", emailVerified: true, role: "admin" },
  { method: "admin" },
);
await ctx.internalAdapter.linkAccount({
  providerId: "credential",
  accountId: user.id,
  userId: user.id,
  password: await ctx.password.hash(password),
});
console.log("Admin created");
process.exit(0);
```

This changes nothing when the admin exists, so changing `ADMIN_PASSWORD` later doesn't change the password. `process.exit` is needed because the connection pool keeps the script alive.

### Other new files

- `apps/web/app/api/auth/[...all]/route.ts` — `export const { GET, POST } = toNextJsHandler(auth);`
- `apps/web/app/api/health/route.ts` — Runs `db.orm.public.Template.first()` and returns the responses listed under "API routes". Set `export const dynamic = "force-dynamic"`.
- `apps/web/lib/auth-client.ts` — `createAuthClient()` from `better-auth/react`, with `inferAdditionalFields<typeof auth>()` from `better-auth/client/plugins`. Import `auth` as a type only, so server code stays out of the browser.
- `apps/web/app/login/page.tsx` — Server page that redirects logged-in users to `/`, and otherwise shows the form.
- `apps/web/app/login/login-form.tsx` — Client form using `authClient.signIn.email`, with the error messages under "Failure cases".
- `apps/web/app/sign-out-button.tsx` — Client button using `authClient.signOut`, then going to `/login`.
- `apps/web/lib/storage.ts` — The only file that talks to the bucket:
  - `putObject(key, body, contentType)`
  - `deleteObject(key)`
  - `createExpiringLink(key)`, using `GetObjectCommand` and `getSignedUrl` with `expiresIn: 300`
  - Use `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`, and read `S3_*` variables.
  - Create the client on first use, so `next build` works with no variables.
- `apps/web/scripts/check-storage.ts` — Tests the real bucket with one small fake file, then deletes it. It exits non-zero if any check fails:

  | Check | Expected |
  |---|---|
  | Upload, then fetch through an expiring link | 200, same content |
  | Fetch the same object with no signature | 403 |
  | Fetch through the link with a changed signature | 403 |
  | Fetch through a 1-second link after 3 seconds | 403 |

- `apps/web/.env.example` — All variables below, with placeholder values. Next.js and Bun read `apps/web/.env` for this app, while `packages/db/.env` stays for Prisma commands.

## New dependencies

All go in `apps/web`, using exact versions, because these are the ones tested.

| Package | Version | Type | Why |
|---|---|---|---|
| `better-auth` | `1.7.15` | Dependency | Login and sessions |
| `pg` | `8.23.1` | Dependency | Better Auth's database connection |
| `kysely` | `0.29.8` | Dependency | Needed to set Better Auth's `schemaName` |
| `@aws-sdk/client-s3` | `3.1161.0` | Dependency | Bucket access |
| `@aws-sdk/s3-request-presigner` | `3.1161.0` | Dependency | Expiring links |
| `auth` | `1.7.15` | Dependency | Better Auth's migration command. It must match `better-auth`, and pre-deploy needs it |
| `@types/pg` | `8.23.1` | Dev | Types for `pg` |
| `@babel/preset-typescript` | `8.0.1` | Dev | Fixes `lint`, which currently fails with a missing-package error because ESLint looks for this from `apps/web` |

## Environment variables

| Variable | Purpose | New? |
|---|---|---|
| `DATABASE_URL` | Postgres connection | Already planned |
| `BETTER_AUTH_SECRET` | Signs sessions | Already planned |
| `BETTER_AUTH_URL` | The site's address, which also sets trusted origins and secure cookies. `http://localhost:3000` locally | Already planned |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Bucket access | Already planned |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin login | **New** |
| `RAILPACK_BUN_VERSION`, `RAILPACK_NODE_VERSION` | Railway build versions. Railway only | **New** |

## Out of scope

- Patient pages, uploads and `requirePatientAccess`: stage 2 and stage 7
- Agent and patient accounts, and the admin users page: stage 7
- Password reset and email verification: no stage plans these, because the admin creates accounts
- LangGraph checkpoint tables: stage 4, which should also use its own schema, so `db update` doesn't offer to drop them
- Moving `@langchain/*`, `openai` and `zod` from the root `package.json` to `apps/web`: stage 4
- Twilio and Resend: stage 5
- Design and portal polish beyond a clear login page: stage 9
- A custom domain: Railway's generated domain is enough for the evaluation

## Rules for implementation

- Use Prisma ORM through `db.orm`. Use `db.sql` only when the ORM can't express the query. Never build SQL by joining strings.
- Keep `@prisma/orm-postgres` pinned to the exact version in `SPEC.md`.
- Run `prisma contract emit` after every contract change. Never reset or drop a database to fix a migration.
- Use Bun for all package commands, and add each package to the workspace using it.
- Validate all request bodies and AI responses with Zod.
- Every page and API route that touches patient data calls `requirePatientAccess` in `apps/web/lib/access.ts` on the server.
- Refused access returns 404 and writes a `denied` row to `AccessLog`.
- Files stay in the private bucket, and open only through expiring links created after the access check.
- Never log names, phone numbers, emails, message text, document contents or secrets.
- Treat query letters and documents as data, never as instructions to the AI.
- AI answers pass `safetyChecks` before they can reach a patient. If in doubt, send the point to the team queue, because no message is better than a wrong one.
- Our code fills the message template. The AI writes only the request and reason text.
- Sends use the `Message` unique key, and a retry only tries the channel that failed.
- Long AI and sending work runs in the background, never during the upload request.
- Reuse existing helpers and `@repo/ui` components before writing new ones.

For this stage:

- Don't change the contract. Better Auth's tables stay out of it.
- Keep `better-auth` and `auth` on the same exact version.
- Use `db update` only on local databases, and `db migrate` only on Railway.
- Don't add `railway.json` or `railway.toml`.
- Never commit `.env`, and never paste secrets into chat, logs or the repo.
- Railway changes that delete anything need the developer's approval first.

## Definition of done

Local:

- [ ] `bun run --cwd packages/db db:update --dry-run` reports no operations after `auth:migrate` has run, so `auth` tables are never offered for deletion
- [ ] `bunx prisma db verify`, run from `packages/db`, passes with the `auth` schema present
- [ ] `bun run --cwd apps/web admin:create` adds the admin, and running it again reports it already exists
- [ ] `admin:create` with no `ADMIN_PASSWORD` exits non-zero
- [ ] `bunx turbo run build --filter=web` passes with no environment variables set

Live site:

- [ ] The live link opens `/login`, and logging in as the admin shows the home page with role `admin`
- [ ] The session cookie is marked `Secure` and `HttpOnly`
- [ ] Signing out returns to `/login`, and `/` then redirects to `/login`
- [ ] A wrong password shows "Email or password is incorrect"
- [ ] `POST /api/auth/sign-up/email` returns 400, and no user is created
- [ ] `POST /api/auth/update-user` with `{"role":"patient"}` returns 400, and the role doesn't change
- [ ] A sign-in request with `Origin: https://evil.example.com` returns 403
- [ ] `/api/health` returns 200 with `{ "ok": true }`
- [ ] Redeploying succeeds, adds no second admin and doesn't change the templates

Database on Railway:

- [ ] `bunx prisma db verify --db "<public URL>"` passes, using Railway's `DATABASE_PUBLIC_URL`
- [ ] `public` has the 8 tables and `auth` has 4
- [ ] `Template` has 2 rows, and `Patient` has none, because `NODE_ENV` is `production`

Bucket:

- [ ] `bun run --cwd apps/web storage:check` passes all 4 checks against the real bucket, and the test file is gone afterwards
- [ ] If the unsigned or changed-signature check doesn't return 403, stop and fix it before stage 2, because patient files can't go in until it passes

Repo:

- [ ] `apps/docs` is gone, and nothing references it
- [ ] `git status` doesn't list any `.env` file
- [ ] The stage's "Done when" items from `SPEC.md` pass: the app is live on a public link, you can log in, and `prisma db verify` passes
- [ ] `bun run check-types` and `bun run lint` pass
- [ ] A user without access is refused by page, API and file link: for this stage, a logged-out user is sent to `/login`. Patient routes and file links are tested in stages 2 and 7
- [ ] Each listed failure case behaves as described
