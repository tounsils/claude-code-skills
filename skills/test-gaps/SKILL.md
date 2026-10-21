---
name: test-gaps
description: Find the untested branches that matter, write tests that can actually fail, and report pass, fail, and skip counts honestly. Use when asked to add tests, write tests for this, improve coverage, find test gaps, check what is untested, or when a change needs test coverage before it ships.
---

# Find the gaps, then write tests that can fail

Coverage percentage is not the goal. A suite at 90% that cannot fail is worth less than one at 40% that catches regressions.

## Find the real commands first

Read the CI config, not the README. The README rots; CI has to pass.

```bash
cat .github/workflows/*.yml 2>/dev/null | grep -A3 -E 'run:|script:'
cat package.json | grep -A12 '"scripts"'
cat Makefile pyproject.toml tox.ini 2>/dev/null
```

Run the suite before writing anything and record the baseline: passed, failed, skipped, duration. You need the before number to prove you did not break anything.

## Locate the gaps

If coverage tooling is configured, use it, and read the branch numbers rather than the line numbers. Line coverage counts a line with two outcomes as covered after one.

```bash
npx vitest run --coverage        # or jest --coverage
pytest --cov --cov-branch --cov-report=term-missing
go test -cover ./...
```

If there is no coverage tooling, do not add it just for this. Derive the gaps by reading: for each changed or named function, list its branches, then grep the test files for each one.

Then rank. Not every uncovered branch deserves a test. In descending order of worth:

1. **Decision logic**: pricing, permissions, state transitions, validation, retry and backoff, anything with a threshold.
2. **Error paths**: the `catch`, the failure return, the timeout. These are the least-tested and most-reached code in production.
3. **Boundaries** on anything the above touches.
4. **Regression sites**: code that has been fixed before. `git log -S` a distinctive line to find whether this area has a history.

Skip entirely: getters, generated code, framework glue with no decision in it, and a thin wrapper that only forwards arguments. Testing those produces the 90% suite that catches nothing.

## Assert invariants, not examples

An example test proves one input works. An invariant holds for every input, so it keeps working when the implementation changes.

```ts
// example: passes, proves little
expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);

// invariant: nothing is lost, at any input
for (const [total, parts] of cases) {
  const shares = splitEvenly(total, parts);
  expect(shares).toHaveLength(parts);
  expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
  expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
}
```

Write both when the example documents intent. The invariant is what survives a rewrite.

## The boundary matrix

For anything taking a collection, a number, or a string, cover: empty, exactly one, many, the maximum, null and undefined separately, zero, negative, duplicates, out-of-order input, and for strings whitespace-only plus multi-byte characters. For anything with time: the epoch, a leap day, a daylight-saving transition, and a timezone other than the test machine's.

Pick the ones that can actually reach the code. A function taking `NonEmptyArray` does not need an empty case; the type is the test.

## Confirm each test can go red

A test that cannot fail is the most expensive thing in a suite, because it buys confidence it does not provide.

For each test you write, break the code it covers (invert the condition, return a constant, delete the guard), run that one test, confirm it fails with a message that points at the real cause, then revert. If it still passes, the test asserts nothing: it is probably over-mocked, asserting on a mock's return value rather than the behavior.

Do this every time. It takes seconds and it is the only proof the test works.

## Mocking

Mock the boundary, not the logic. Network, clock, filesystem, randomness: mock these. The function under test: never.

A test whose assertions are all about calls made to mocks tests your mock configuration. If you cannot test a decision without mocking four things, the decision needs extracting from its surroundings before it needs a test. Say so rather than building the four mocks.

## Report honestly

Give the numbers, before and after:

```
before:  312 passed, 0 failed, 48 skipped   (11.4s)
after:   329 passed, 0 failed, 48 skipped   (12.1s)
```

**Always report the skip count.** A suite reported as "all tests pass" with 48 skips is a false report. If skips exist, say what they are and why: a pending feature, a broken fixture, a platform guard, or a test someone disabled to go green. The last case is a defect and belongs in the report.

Also report:

- Branches you left untested, and why they were not worth it.
- Any test you found that cannot fail, as a finding.
- Any place where testing the logic required restructuring first, with what you would extract.
