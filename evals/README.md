# Eval suite

Thirteen cases. Ten check that a skill fires on a realistic request and produces the thing the skill exists to produce. Three check that nothing fires on a request that only sounds adjacent, because a description that over-triggers is worse than one that occasionally misses.

## Run it

From the repository root:

```bash
claude plugin eval .
```

Each case runs three times with the plugin and three times without it, so the report shows what the skills contribute rather than what the model would have done anyway. That is 78 model runs, which costs real money and takes a while.

While iterating, drop the baseline arm and the repeats:

```bash
claude plugin eval . --ablation none --runs 1          # 13 runs
claude plugin eval . --tag smoke --ablation none --runs 1   # 5 runs
claude plugin eval . --case review-diff-finds-deleted-guard
```

Results land in `evals/results/<timestamp>/`, which is gitignored. The run prints a path to an HTML report.

## How a case is built

```
evals/<case-name>/
├── prompt.md              frontmatter: limits and tools. body: what the user types
└── graders/
    ├── skill-fired.md     did the right skill produce this
    └── criteria.md        is the answer actually right
```

Two graders per case, deliberately. `skill-fired` is a `tool_used` check on the `Skill` tool and answers whether the plugin did the work. `criteria` is an `llm` rubric and answers whether the work was any good. Either one alone is misleading: a skill can fire and give a bad answer, and a good answer can arrive with the skill never loading.

`tool_used` graders on the `Skill` tool are excluded from the score in a two-arm run, since they can never pass without the plugin. They still show as pass or fail indicators. The negative cases set `arm: both` so their "no skill fired" check is scored in both arms.

## The prompts are adversarial on purpose

Each positive case plants the specific thing its skill is written to catch, phrased the way a user would phrase it and never naming the skill:

| Case | What it plants |
| --- | --- |
| `review-diff-finds-deleted-guard` | A deleted null guard, surrounded by cosmetic changes that are easier to comment on |
| `restructure-extracts-by-seam` | Pricing rules tangled with database, mail, logging, and clock calls |
| `ship-pr-names-auth-gate` | A new admin export route with no gate shown, plus an irreversible migration |
| `test-gaps-covers-boundaries` | A divide with no guard against zero parts |
| `root-cause-refuses-timeout-bump` | A user explicitly asking for the symptom fix |
| `audit-security-finds-idor` | A lookup by id behind `requireLogin` with no ownership filter |
| `perf-hunt-measures-first` | Two queries per row, and no measurement offered |
| `onboard-repo-reads-ci-not-readme` | A README that disagrees with CI, and three entry points past the obvious one |
| `triage-ci-finds-first-failure` | A failed install followed by 41 cascading test failures |
| `bump-deps-batches-by-risk` | A security patch, three safe bumps, and three majors in one list |

A case that passes because the model is generally capable is not evidence the skill works. The rubrics are written so the generic answer fails: commenting only on the `.trim()` in the diff, rewriting the handler without tests, bumping the timeout, or upgrading everything at once each fail their case.

## Adding a case

```bash
claude plugin eval init --bare my-case
```

Then write the prompt as a user would type it, add the two graders, and run that case alone until the graders behave. Rubrics need concrete PASS and FAIL conditions: a vague rubric gives a different verdict on different runs and makes the whole suite's score untrustworthy.

If a case needs real files in the workspace rather than content pasted into the prompt, add a `case.yaml` with `context.scaffold_script`. Note that the script runs only when the suite is invoked with `--scaffold`, so a case that depends on one behaves differently without the flag. Every case here is self-contained for that reason.
