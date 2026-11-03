# Plan: Polish and rehearsal

1. Find what nothing uses, and remove it.
2. Add `/queue` and `POST /api/points/[id]/resolve`, with checks in `lib/access.ts`.
3. Count handled points as closed in `lib/format.ts`, and show "Handled" on the letter page.
4. Move page links into a header menu, and give the action button a visible error.
5. Test locally: every role against the queue and resolve route, retry, the removed routes, WhatsApp `hi`, one never-seen letter with its time, and clicks in a browser.
6. Update `SPEC.md` and `README.md`, then ship.
7. The owner runs the live rehearsal and records the video after merge.
