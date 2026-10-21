---
name: triage-ci
description: Diagnose a failing CI run by finding the first real failure rather than the last log line, classifying it as defect, flake, infrastructure, or config drift, and fixing the cause without disabling the check. Use when asked to fix the build, fix CI, find out why CI is failing, look at a failing run, or work out what is actually wrong with a red build, and when a pipeline or GitHub Actions run fails, a CI log needs reading, or tests pass locally but fail only in CI.
---

# Triage a red build

Two mistakes account for most wasted time here: reading the last error instead of the first, and making the build green instead of making it correct.

## Get the run and the logs

```bash
gh run list --limit 10
gh run view <run-id>
gh run view <run-id> --log-failed          # the failing steps only
gh run view --job <job-id> --log           # one job in full
```

Without `gh`, ask for the raw log rather than working from a screenshot of the summary. The summary names the step; the cause is usually 200 lines above it.

Also get the context that decides whether this is new:

```bash
gh run list --branch main --limit 10        # is the base branch green?
git log --oneline -5
```

A red base branch means the failure is probably not yours. Say so before investigating the diff.

## Find the first real failure

Scroll up, not down. CI logs end with the cascade, and the cascade is noisy: a compile error produces 40 downstream test failures, a failed install produces a missing-module error in every step, a disk-full condition produces whatever happened to need disk next.

Work from the top of the failing step:

- The first non-zero exit code.
- The first stack trace, as opposed to the last one.
- The first "cannot find", "undefined", "connection refused", or "permission denied".

Then ask whether everything after it is explained by it. If a build step failed, the 40 test failures are one finding, not 41.

For a parallel matrix, compare the legs. One leg failing out of six points at that leg's difference (a runtime version, an OS, a shard boundary). All six failing points at the change.

## Classify before fixing

The fix depends entirely on the class, and these are distinguishable.

| Class | Signal | Fix |
| --- | --- | --- |
| Real defect | Fails deterministically, and fails locally with the same command | Fix the code |
| Flake | Passes on re-run with no change, or fails in some matrix legs only | Fix the test's shared state, clock, or ordering assumption |
| Infrastructure | Network timeout, registry 5xx, runner out of disk or memory, image pull failure | Retry is legitimate; report it so a pattern is visible |
| Config drift | A tool, action, runtime, or dependency resolved to a new version | Pin it, then upgrade deliberately |
| Cache poisoning | Fails only with a warm cache, passes on a cleared one | Fix the cache key so it covers what changed |
| Environment gap | Passes locally, fails in CI, same command | Find the difference: env var, secret, timezone, locale, case sensitivity, available service |

Do not re-run to see if it passes as a first move. A re-run that goes green has destroyed the evidence and told you only that the failure is not fully deterministic.

## Reproduce with the CI command verbatim

The most common reason "it passes locally" is that local and CI are not running the same command.

Copy the command out of the workflow file, with its environment and its flags, and run that:

```bash
rg -n 'run:|env:|NODE_ENV|CI:' .github/workflows/*.yml
CI=true npm test -- --runInBand            # whatever the workflow actually does
```

`CI=true` alone changes behavior in many test runners: no watch mode, no interactive prompts, different snapshot handling, stricter warnings. A test suite that runs in a random order locally and a fixed order in CI (or the reverse) will hide ordering bugs on one side.

Check the other usual differences: Node or Python version, timezone (CI is typically UTC), locale, filesystem case sensitivity, whether a database or cache service is actually running, and whether a secret is present.

## Fix a flake properly

A flake is a defect in the test, or a real race in the code that the test is surfacing. Treat it as a bug with a known reproduction rate.

Get the rate first, so you can prove the fix:

```bash
for i in $(seq 50); do npx vitest run -t 'the flaky test' || echo "FAIL $i"; done
pytest -k test_name --count 50            # pytest-repeat
```

Then look for the three causes, in this order:

1. **Shared state between tests**: a module-level variable, a database row not rolled back, a temporary file, a singleton, a mocked global not restored. Confirm by running the test alone (it passes) and then after its neighbor (it fails).
2. **Real time**: a fixed sleep instead of a wait-for-condition, a timeout tuned to a fast machine, a date boundary, an assertion on a duration. Replace sleeps with a condition poll and inject the clock.
3. **Concurrency and ordering**: two operations that usually complete in the convenient order, an unawaited promise, an assertion before a queue drains.

**Do not add a retry to a flaky test.** A retry converts a visible intermittent failure into an invisible one, and if the flake reflects a real race, the race is still in production. If you must add one to unblock a release, say so explicitly, record the reproduction rate, and leave the issue open.

## Things that are not fixes

Each of these makes the build green and the problem worse. If you choose one knowingly, say so in plain words and leave the reason in the code.

- Skipping or deleting the test that caught it.
- `continue-on-error` on the failing step.
- Lowering a coverage threshold to match current coverage.
- Adding a blanket retry at the job level.
- Widening a version range so the resolver picks something that happens to work.
- Increasing a timeout without explaining why the new value is right.

A skipped test is a failing test nobody can see. If the suite now has skips that it did not have before, that is the headline of your report, not a footnote.

## Report

- **Run**: link to it, and whether the base branch is green.
- **First real failure**: step, file and line, and the message. Say which of the other failures it explains.
- **Class**: from the table, with the evidence that distinguishes it from the neighboring class.
- **Local reproduction**: the exact command, and whether it reproduced.
- **Fix**: what changed and why it addresses the cause.
- **Verification**: pass, fail, and skip counts. For a flake, the failure rate over N runs before and after.
- **Left open**: anything you worked around rather than fixed, named as a workaround.
