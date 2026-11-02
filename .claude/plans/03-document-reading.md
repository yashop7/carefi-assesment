# Plan: Stage 03 — Document Reading

Spec: `.claude/specs/03-document-reading.md`. Branch: `feature/document-reading`. No contract change.

1. Add `openai` to `apps/web`, and `getObject` to `lib/storage.ts`.
2. Write `lib/documents.ts`: the response shape, prompt, `readDocument`, the name check and `resumeUnreadDocuments`.
3. Add `instrumentation.ts`, and start reading from the upload route with `after()`.
4. Add the retry route.
5. Show the results: labels, the profile table, the viewer, the 2-second refresh and the retry button.
6. Static checks: types, lint, and the build with no variables.
7. Test with real OpenAI calls, a throwaway Postgres, the real bucket and fake documents:
   - Summary bill, itemised bill, blurry scan, another person's document, and a document with instructions to the AI.
   - Bad key then retry, restart recovery, 409 and 404 on retry, and a log search.
8. Check the page updates live in the browser.
9. Clean up, commit, push, then ship with `.claude/skills/ship-feature.md`. The user sets `OPENAI_API_KEY` and `OPENAI_MODEL` on Railway.
