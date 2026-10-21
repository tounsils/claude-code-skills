---
type: llm
---

The loop issues two queries per project, so query count scales with the result set. The owner lookup is also redundant: every project in the result already has `ownerId` equal to the `userId` that was passed in.

PASS requires both:

1. The response identifies the queries inside the loop as the dominant cost, and proposes replacing them with a bounded number of queries: a join, an include, a grouped count, or a single `IN` query.
2. The response establishes or asks for a measurement rather than only asserting the fix will help. Any one of these counts: asking for the current timing or query count, proposing to measure before and after, stating that the improvement must be re-measured, or asking how many projects a typical user has.

Credit, but do not require, noticing that the owner lookup is entirely redundant given the `where` clause.

Credit, but do not require, asking whether an index exists on `task.projectId`.

FAIL if the response rewrites the function with no mention of measurement at any point.

FAIL if it proposes caching, parallelising the loop with `Promise.all`, or adding a worker as the primary fix while leaving the per-row queries in place. Mentioning `Promise.all` as a secondary improvement alongside collapsing the queries is acceptable.

Ignore the specific ORM syntax used, including whether it is valid for any particular library.
