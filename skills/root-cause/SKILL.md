---
name: root-cause
description: Debug by reproducing first, isolating the mechanism, then fixing the cause rather than the symptom, and keeping the reproduction as a regression test. Use when asked to debug this, fix this bug, find out why something happens, investigate a failure, or work out what is going wrong, and when a test fails intermittently or flakily, behavior differs between environments, or someone proposes raising a timeout, adding a retry, or skipping a test to make a problem go away.
---

# Find the cause, then fix it

The fix is the easy part. Almost every bad fix comes from skipping straight to it.

## Reproduce before anything else

No reproduction, no fix. A change that makes a symptom disappear without a reproduction has an unknown effect on the cause.

Work toward a reproduction in this order, stopping at the first one that works:

1. **A failing test.** The best outcome: fast, specific, and it becomes the regression test.
2. **A single command** that fails reliably.
3. **A manual sequence** written down step by step, with the exact inputs.
4. **Conditions only**, when the failure is rare: the inputs, environment, and timing under which it has been observed, plus the frequency.

If you reach step 4, say explicitly that the bug is not reproduced and that any fix is therefore a hypothesis. Do not present it as resolved.

## Check the three cheap explanations

Before investigating the code, rule these out. Each takes under a minute and each accounts for a meaningful share of "impossible" bugs.

- **Stale state**: an old build, a cached dependency, a stale lockfile, a dev server that did not reload, a compiled artifact newer than nothing. Clean and rebuild.
- **Environment difference**: a different version of the runtime, a missing or different environment variable, a different OS path separator or line ending, a different locale, timezone, or filesystem case sensitivity. Diff the working environment against the broken one.
- **You are not running the code you are reading**: a shadowed module, an installed copy of the package taking precedence over the local one, the wrong branch, a different config file than the one you opened. Print a unique string from the file you believe is executing and confirm it appears.

## Isolate the mechanism

The goal of this phase is one sentence: "X happens because Y". Until you can write it, you have not found the cause.

**Bisect through history** when the code used to work:

```bash
git bisect start HEAD <known-good-commit>
git bisect run <command-that-fails>
```

This names the commit. It does not name the mechanism, so keep going.

**Bisect through the data** when the failure depends on input: halve the input until the smallest failing case remains. A one-field payload that still fails tells you more than the original 40-field one.

**Bisect through the call path** when neither applies: find the midpoint between where the data is known good and where it is known bad, inspect it there, and repeat. Three iterations covers an eight-layer stack.

**Log the actual value, never the expected one.** `log("reached handler")` tells you nothing. `log({ userId, state: order.state, now })` tells you which assumption is false. Print types alongside values when a type is in question, since `"0"`, `0`, `null`, and `undefined` all read the same in most log output.

For an intermittent failure, suspect shared state between runs (a module-level cache, a database row left behind, a global), real time (a timeout, an ordering assumption, a date boundary), or concurrency (two things racing that usually finish in the convenient order). Run the single failing case in a loop to get the failure rate before and after any fix.

## Then fix the cause

State the mechanism, then the fix, then why the fix addresses that mechanism and not just its symptom.

**If the fix is a constant you cannot justify, you have not found the cause.** Raising a timeout from 5 seconds to 30 because 30 works is a symptom fix: it leaves the real latency unexplained and fails again under load. Either explain why 30 is correct, with the measurement behind it, or keep looking.

Other symptom fixes, each of which hides the cause:

- A null check where the question is why the value is null.
- A retry around something that should not fail.
- A `try`/`catch` that makes an error stop appearing.
- A sleep that makes a race usually resolve correctly.
- Widening a type to accept the wrong value that arrived.
- Disabling the test that caught it.

Any of these can be the right call under deadline pressure. When you choose one knowingly, say so, say what the real cause appears to be, and leave a comment that says why the workaround exists.

Keep the fix minimal. A bug fix that also restructures three files cannot be reviewed as a fix or reverted as one.

## Close the loop

1. Confirm the reproduction now passes.
2. Confirm it failed before the fix: revert the fix, see it fail, reapply. Without this step you do not know your test covers the bug.
3. Run the full suite and report pass, fail, and skip counts.
4. Keep the reproduction as a regression test, named for the behavior rather than the ticket, so it still reads in two years.
5. Look for the same mistake elsewhere. A bug found once in a pattern is usually in the pattern, not in the one site. Grep for it.

## Report

- **Symptom**: what was observed.
- **Reproduction**: the command or steps, and the failure rate if intermittent.
- **Mechanism**: X happens because Y. One or two sentences.
- **Fix**: what changed and why it addresses Y.
- **Verification**: test red before, green after; suite counts including skips.
- **Related sites**: the same pattern elsewhere, fixed or flagged.
- **Still unknown**: anything you could not explain. Say it plainly rather than rounding up to solved.
