---
tags: [fires, onboard-repo]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 14
expected_outcome: Trusts the CI commands over the README and proposes tracing one feature end to end.
---

I just inherited this service and I'm the only one on it now. Where do I start?

Here's the tree:

```
.github/workflows/ci.yml
Makefile
README.md
alembic/versions/            (23 migrations)
app/main.py
app/api/routes/{orders,users,webhooks}.py
app/services/{pricing,fulfilment,notify}.py
app/models.py
app/worker.py
app/cron.py
tests/test_pricing.py
tests/test_utils.py
pyproject.toml
```

The README says to run `python app/main.py` and `pytest`.

`.github/workflows/ci.yml` runs:

```yaml
- run: uv sync --frozen
- run: uv run alembic upgrade head
- run: uv run pytest -q --cov=app --cov-branch
- run: uv run ruff check app tests
```

`pytest` on its own gives me `ModuleNotFoundError: No module named 'app'`.
