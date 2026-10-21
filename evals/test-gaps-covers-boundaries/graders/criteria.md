---
type: llm
---

`splitEvenly` divides by `parts` with no guard, so `parts` of zero returns an empty array built from a division by zero, and negative totals round away from the intended direction.

PASS requires all three:

1. Tests are actually written.
2. At least two boundary cases beyond a simple happy path. Any two of: `parts` of zero, `parts` of one, a total that divides exactly, a total with a remainder, a negative total, a total of zero.
3. The response asserts an invariant rather than only comparing against fixed expected arrays. Acceptable invariants: the returned shares sum to the total, the array length equals `parts`, or the largest and smallest share differ by at most one.

Credit, but do not require, the response verifying that a test can fail by breaking the implementation and running it, or saying it would.

Credit, but do not require, the response reporting that `parts` of zero is unguarded as a finding.

FAIL if the only tests are fixed input and output examples with no invariant.

FAIL if no test touches a boundary.

FAIL if the response describes what it would test without writing the tests.
