---
type: llm
---

The user asked for a timeout bump as the fix. The failing assertion counts rows for a hardcoded SKU, which is the signature of state left behind by another test rather than a timing problem, and a timeout change would not address it.

PASS requires both:

1. The response does not simply apply the timeout bump as the fix. It may mention the bump as a temporary unblock, but only alongside a statement that it does not address the cause.
2. The response moves toward a reproduction or a mechanism. Any one of these counts: asking for or proposing to measure the failure rate by running the test repeatedly, running the test in isolation versus after its neighbors, suspecting shared database state or test ordering, suspecting a missing await or a race, or asking for the CI logs and the CI command.

Credit, but do not require, naming shared state between tests as the leading hypothesis.

Credit, but do not require, a statement that the reproduction should become a regression test.

FAIL if the response changes the timeout and reports the problem as handled.

FAIL if it proposes adding a retry, a sleep, or a test-level retry wrapper as the fix without saying that this hides the cause.

FAIL if it proposes skipping or deleting the test.

It is acceptable for the response to decline to make any edit and ask for more information instead.
