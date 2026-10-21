---
name: review-diff
description: Review uncommitted or branch-local changes for defects, ranked by severity, with a concrete failure scenario behind every finding. Use when asked to review code, review a diff, review my changes, check this before I commit, look over this branch, or do a pre-PR pass. Reviews the change, not the whole repository.
---

# Review a diff

Review the change, not the file. A correct line can be a defect because of what the diff did around it.

## Scope the diff first

Establish exactly what changed before reading anything:

```bash
git merge-base HEAD origin/main          # or origin/master, or the real base branch
git diff --stat $(git merge-base HEAD origin/main)
git diff $(git merge-base HEAD origin/main)
git status --short                        # uncommitted work the diff above misses
```

If there is no base branch, review `git diff HEAD` plus untracked files.

Review every changed file. If the diff is larger than roughly 1500 lines, say so, review the files that carry logic, and name the files you skipped. Never silently sample.

## Read the deletions

Removed lines are the highest-yield and most-skipped part of a diff. For every deletion ask what it was protecting.

A deleted guard clause, null check, `try` block, bounds test, timeout, lock, or early return is a finding until proven otherwise. The replacement code usually handles the happy path the old guard also handled, which is why the loss is invisible.

## Read the callers

A changed function signature, return type, thrown error, or nullability is only safe if every caller agrees. Grep for the symbol across the repo, including tests and any dynamic dispatch by string name. A caller the compiler cannot see is the one that breaks in production.

## Pass over these dimensions

Run each pass over the whole diff rather than finishing one file at a time. Different passes find different defects in the same line.

| Pass | What to look for |
| --- | --- |
| Correctness | Off-by-one, inverted condition, wrong operator precedence, assignment in a conditional, reversed arguments at a call site |
| Boundaries | Empty collection, single element, null and undefined, zero, negative, max int, very long string, duplicate keys, unicode and surrogate pairs |
| Error handling | Swallowed exceptions, an error logged and then execution continues, a rejected promise with no handler, partial writes with no rollback |
| State and concurrency | Shared mutable state, a read-then-write race, non-idempotent retry, unawaited async call, mutation of a parameter the caller still owns |
| Resources | Unclosed handle, unbounded growth, a listener added without removal, a connection acquired outside the block that releases it |
| Contracts | Breaking API or schema change, changed default value, altered serialization, a migration with no reverse |
| Security | New or changed route with no named auth gate, user input reaching a query, path, template, or shell, a secret or token in source or fixtures |
| Performance | Query inside a loop, a call that was cached and now is not, fixed-interval polling of a large table, synchronous IO on a hot path |
| Tests | New branch with no test, a test that asserts the implementation rather than the behavior, a test that cannot fail |

## Verify before reporting

For each candidate finding, write the failure scenario: specific inputs or state, and the wrong output, crash, or corruption that results.

If you cannot write that scenario, the finding is a guess. Drop it. A review of ten real defects is worth more than thirty plausible ones, because a reviewer who finds one false positive stops trusting the other twenty-nine.

Then try to refute each surviving finding. Read the surrounding code again looking for the thing that already handles it: a validator upstream, a type that makes the state unreachable, a caller that cannot pass that value. Findings that survive their own refutation are the report.

## Report

Order by severity, worst first. For each finding give:

- `path/to/file.ts:42`
- One sentence stating the defect.
- The failure scenario: inputs, then consequence.
- The fix, as a diff or one sentence.

State the severity basis, not a bare label: what breaks, for whom, and how often.

Close with what you did not cover: files skipped, behavior you could not verify without running it, and any assumption you made about the base branch.

## Keep out of the report

- Style and formatting the project's linter or formatter owns. If the linter should have caught it and did not, report the gap in the config instead, once.
- Rewrites of code the diff did not touch.
- Preferences dressed as defects. If both forms work, it is not a finding.
- Praise. The author asked what is wrong.

If the diff is clean, say so in one line and name the dimensions you checked. A clean verdict with no basis is indistinguishable from no review.
