# Plan: Stage 04 — Query Drop and Agent

Spec: `.claude/specs/04-query-agent.md`. Branch: `feature/query-agent`. No contract change.

## Steps

1. **Add the three LangGraph packages** to `apps/web`, pinned.
2. **Write `lib/agent/ai.ts`:** the AI helper and the two response shapes. Export the file-to-AI helper from `lib/documents.ts` so both use it.
3. **Write `lib/agent/nodes.ts`:** the eight nodes and the two routers from the spec, loading from the database rather than keeping patient data in the state.
4. **Write `lib/agent/graph.ts`:** build the graph, connect `PostgresSaver` the first time it's needed, then `runAgent(id)` and `resumeUnfinishedLetters()`.
   - The build runs with no variables, so nothing connects at import time.
   - `runAgent` passes `null` as input when a run has a saved next step, so it continues rather than starting again.
5. **Update `lib/access.ts`:** `requireStaffAccess` for uploads, `requireQueryAccess` for letter pages, and `view_query` logging.
6. **Write the routes:** upload and retry. Retry moves `failed` to `uploaded` in one update, so a double click can't start two runs.
7. **Write the pages:** the drop box, the Query letters tab and the letter page. Refresh every 2 seconds while a letter is being worked on.
8. **Start resuming in `instrumentation.ts`,** alongside unread documents.
9. **Update the docs:** `SPEC.md` sections 3, 7, 10 and 12, `README.md` and `.env.example`.
10. **Static checks:** `check-types`, `lint`, and the build with no variables set.
11. **Rehearse with no OpenAI cost:** a small stand-in OpenAI server in the scratchpad, reached through `OPENAI_BASE_URL`, with a throwaway Postgres and the real bucket. It covers:
    - Every route to the end: mixed, all in locker, no points, other person's letter
    - AI failure then retry, with the finished step not called again
    - Forced channel failure, and restart mid-run with no duplicates
    - Access: patient, other agent, no session, foreign `Origin`, 409
    - `prisma db verify` after the checkpoint tables exist, and logs free of personal data
12. **One real AI check on `gpt-4o-mini`:** one fake letter against a locker of ready-made rows. That's 2 calls, with the key's presence checked first.
13. **Browser check on localhost:** drop a letter, watch the status change, and read the result.
14. **Fix what steps 11 to 13 find.** Rerun only what the fix touches, so no AI call is wasted.
15. **Ship with `.claude/skills/ship-feature.md`.** Check the live deploy carries this stage before deleting the branch.

## Things to watch

- **Nodes can run twice** after a crash or retry. `safetyChecks` deletes this letter's points before saving them, and `sendMessages` skips a channel already sent.
- **`finish` must run once.** That's why `addToTeamQueue` and `buildMessage` run in a line rather than side by side: side by side, `finish` would fire while sending was still going.
- **`db verify` and `db update`** only look after `public`, so the checkpoint tables get their own schema. Check this on a real database.
- **The file itself never goes in the saved state.** Checkpoints are kept, so only what's needed to carry on is saved.
- **`test-data/` stays out of the commit,** as in stage 3: `git add` names paths rather than using `git add .`.
