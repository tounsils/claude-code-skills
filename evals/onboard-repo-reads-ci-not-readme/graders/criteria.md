---
type: llm
---

The README is stale: CI runs everything through `uv run`, which is why bare `pytest` cannot import the package. There are also four entry points, not one: the API, the worker, the cron module, and the migrations.

PASS requires both:

1. The response treats the CI configuration as the authoritative source for the real commands, and resolves the import error by running the suite the way CI does rather than by changing the test configuration or the Python path. Saying the README is out of date is enough.
2. The response identifies that there is more than one entry point. Naming the worker or the cron module alongside the API satisfies this.

PASS also requires at least one of:

- A proposal to trace one real feature end to end through the layers, rather than reading files in isolation.
- A note that only two test files exist against nine source modules, so the real logic is largely unverified.
- A proposal to read the migrations in order to learn the data model.

FAIL if the response fixes the import error by adding a path hack, a conftest change, or an editable install, while presenting the README commands as correct.

FAIL if it produces only a directory-by-directory description of the tree with no reading order and no commands.

Ignore whether the response offers to write an architecture document or a handoff note, and ignore its formatting.
