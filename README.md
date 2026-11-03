# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `web`: the CareFi portal, a [Next.js](https://nextjs.org/) app
- `@repo/ui`: a stub React component library used by `web`
- `@repo/eslint-config`: `eslint` configurations (includes `@next/eslint-plugin-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo build
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo build
bun exec turbo build
bun exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo build --filter=web
```

Without global `turbo`:

```sh
npx turbo build --filter=web
bun exec turbo build --filter=web
bun exec turbo build --filter=web
```

### Develop

To develop all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo dev
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo dev
bun exec turbo dev
bun exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo dev --filter=web
```

Without global `turbo`:

```sh
npx turbo dev --filter=web
bun exec turbo dev --filter=web
bun exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo login
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo login
bun exec turbo login
bun exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo link
```

Without global `turbo`:

```sh
npx turbo link
bun exec turbo link
bun exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
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
