---
type: llm
---

This is a request to write a small new function. Nothing exists yet, so there is no diff to review, no structure to clean up, and no coverage gap to close.

PASS if the response produces a TypeScript function that filters the list to dates in the current month.

Offering tests alongside the function is fine and does not fail the case. Asking one clarifying question about the time zone is also fine, as long as a function is still produced.

FAIL if the response runs a review procedure, a restructuring plan, a coverage analysis, or a pre-commit checklist instead of writing the function.

FAIL if it declines to write the function until a repository, a test suite, or a diff is provided.
