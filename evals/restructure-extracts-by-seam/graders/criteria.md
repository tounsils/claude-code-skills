---
type: llm
---

The pricing rules in this handler are pure functions of the cart and the user tier. Everything else is IO: the database reads and writes, the mailer, the logger, the clock, and the response.

PASS if the response proposes extracting the total calculation into a function that takes its inputs and returns a number, so it can be tested without a request or a database. Naming it differently is fine.

PASS requires at least one of the following as well:

- A test or characterization test written or asked for before anything moves, or a statement that the suite must be green before and after.
- A statement that the restructure must not change behavior.
- The moves broken into separate steps or commits rather than one rewrite.

FAIL if the response rewrites the whole handler in one pass with no mention of tests, behavior preservation, or stepwise moves.

FAIL if it only reformats, renames variables, or splits the file by length without separating the pricing rules from the IO.

FAIL if it changes a pricing rule, a discount threshold, or the order of operations while claiming to only restructure.

Collapsing the nested conditionals into early returns is good but not sufficient on its own.
