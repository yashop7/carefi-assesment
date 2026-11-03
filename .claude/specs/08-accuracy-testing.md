# Stage 8: Accuracy testing

## Overview

Accuracy is worth 45 of the 100 points. This stage tests the agent on letters whose correct answer is written down first, scores it, reviews every miss and improves the prompts.

## What gets built

- `test-data/stage8/generate.py`: writes the fake data.
- `test-data/stage8/patients.csv`: 10 fake patients.
- `test-data/stage8/lockers/PAT-xxx/`: each patient's documents.
- `test-data/stage8/letters/PAT-xxx/`: 18 letters, each with its answer beside it. A file name carries the letter number, patient ID and case, like `L01-PAT-801-several-requests.pdf`.
- `apps/web/scripts/score-letters.ts`: runs the real agent, then prints the score and every miss.
- `test-data/stage8/results.md`: scores before and after, and the review of every miss.

## Difficult cases covered

Several requests in one sentence, scanned and blurry letters, combined PDFs, a summary bill when an itemised bill is requested, a request for something already in the locker, a request only the hospital can answer, another patient's document in the locker, and vague wording.

## Rules

- The script stops unless the database, bucket and email service are on this computer, so it can't touch live data or message anyone.
- Everything is fake. Letters stay in their own folder, apart from locker documents.
- Documents are read once and kept between runs, to save OpenAI credit. The script reports its calls and tokens.
- An answer is changed only if the review shows the answer itself was wrong, and `results.md` says so.

## Definition of done

- [ ] 10 fake patients and 15-20 letters, each with a written correct answer.
- [ ] A script scores points found and decisions made, and lists every miss.
- [ ] Every miss has been reviewed.
- [ ] The prompts are improved against the score.
