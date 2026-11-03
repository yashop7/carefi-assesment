# Plan: Accuracy testing

1. Write `generate.py` and create the patients, lockers, letters and answers.
2. Write `score-letters.ts` and add a `score` script to `apps/web/package.json`.
3. Run 2-3 letters first to check the script, then run all 18 for the first score.
4. Review every miss. Decide if the prompt, the code or the written answer is at fault.
5. Improve the prompts in `lib/agent/ai.ts` and `lib/documents.ts`, then score again.
6. Write `test-data/stage8/results.md`, update `README.md`, then ship.
