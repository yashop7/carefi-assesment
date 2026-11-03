# Stage 8 results

18 fake letters and 41 points, run with `gpt-4o-mini` on a test database. The answers were written before the first run and none were changed.

## Score

| Version | Points found | Decisions right | Extra points |
|---|---|---|---|
| Before any change | 41/41 | 36/41 (88%) | 2 |
| Final, run 1 | 41/41 | 40/41 (98%) | 0 |
| Final, run 2 | 41/41 | 39/41 (95%) | 0 |
| Final, run 3 | 41/41 | 39/41 (95%) | 0 |

The same prompt can give a different answer between runs, so the final version was run three times. The final prompts were tuned on these same letters, so a letter the agent hasn't seen may score lower. Stage 9 tests one.

## Misses in the first run

| Letter | Case | What went wrong | Fix | Now |
|---|---|---|---|---|
| L01 | Several requests | A missing report went to the team instead of the patient | The decision order says missing is not a reason for the team | Fixed |
| L02 | Summary bill, not itemised | One bill became three points | The letter step keeps one document as one point | Fixed |
| L03 | Already in locker | A complete blood count wasn't matched to "blood test report" | The prompt says to match by meaning | Still misses in 2 of 3 runs |
| L05 | Combined PDF | The summary described only the first document in the file | The reading step names every document in a file | Fixed |
| L11 | Vague wording | "All relevant documents" went to the patient | A request naming no document goes to the team | Fixed |

## Misses found while improving

| Letter | Case | What went wrong | Fix | Now |
|---|---|---|---|---|
| L03 | Already in locker | The AI miscopied a long document ID | The AI gets short IDs, and the code maps them back | Fixed |
| L06 | Combined PDF, item missing | A hospital bill was accepted as a pharmacy bill | Different kinds of document never stand in for each other | Fixed |
| L07 | Another patient's document | A good discharge summary was called someone else's | Documents with a problem go in their own list | Fixed |
| L10 | Blurry document | The patient was asked for what may be the blurry file | New safety rule: an unreadable document sends "missing" points to the team | Fixed |
| L14 | One sentence with details | PAN and Aadhaar answers swapped | Each answer repeats the request it belongs to | Fixed |
| L04, L15, L17 | Hospital only, dates, vague | Decisions changed between runs | A clearer order of questions and temperature 0 | Fixed in the last 3 runs |

## Misses still open

- **L03, blood test report (2 of 3 runs):** the patient is asked for a report that's already in the locker. It costs them a repeat upload, and the message says not to resend anything already given.
- **L07, blood test report (3 of 3 runs):** the only report in the locker belongs to someone else. The agent asks the patient for their own report instead of telling the team. The patient gets a fair request, and the document keeps its "Name doesn't match" badge, but no team item is created.

## Trade-off from the new safety rule

If a locker holds an unreadable document, anything the agent thinks is missing goes to the team, and the patient gets no automatic message for those points. This avoids asking for something already uploaded, but sends more work to the team for those patients.

## After adding policy and claim numbers to the files

Letters and locker documents now show each patient's policy and claim number, so the same 18 letters were scored again. The prompts didn't change.

| Run | Points found | Decisions right | Extra points |
|---|---|---|---|
| 1 | 41/41 | 38/41 (93%) | 0 |
| 2 | 41/41 | 39/41 (95%) | 0 |

- **L07, blood test report (2 of 2 runs):** the same open miss as above.
- **L14, Aadhaar card (2 of 2 runs):** the patient is asked for an Aadhaar card already in the locker. The agent's reason talks about the PAN card, so the answers are still getting mixed up.
- **L15, consultation paper (1 of 2 runs):** the patient is asked for a paper already in the locker.

L03 didn't miss in these two runs. Two runs are too few to say whether anything really improved or got worse.

## How to run

Use a test database, a test bucket and a stand-in email service on this computer. The script stops otherwise.

```
python3 test-data/stage8/generate.py
bun run --cwd apps/web score          # all letters
bun run --cwd apps/web score L01 L05  # only these
```

A full run after the first takes 34 OpenAI calls and about 73,000 tokens. Documents are read once and kept.
