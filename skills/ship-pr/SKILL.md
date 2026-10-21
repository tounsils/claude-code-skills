---
name: ship-pr
description: Turn a finished change into a commit message and pull request derived from the actual diff, with a pre-submit checklist covering auth gates, secrets, migrations, and breaking changes. Use when asked to commit this, write a commit message, open a PR, raise a pull request, write the PR description, or get this ready to push.
---

# Commit and open the PR

Write the message from the diff, never from the conversation. What you remember doing and what the diff contains are different things, and the diff is what reviewers get.

## Read the change first

```bash
git merge-base HEAD origin/main
git diff --stat $(git merge-base HEAD origin/main)
git diff $(git merge-base HEAD origin/main)
git status --short
git log --oneline $(git merge-base HEAD origin/main)..HEAD
```

Then read the repo's conventions before writing anything:

- `.github/pull_request_template.md` or `.github/PULL_REQUEST_TEMPLATE/`. If a template exists, fill it in rather than inventing a structure.
- `CONTRIBUTING.md` for the commit convention, branch naming, and whether the project squashes.
- `git log --oneline -30` to match the house style. If the last thirty subjects are Conventional Commits, use Conventional Commits.

## Pre-submit checklist

Run every item against the diff. Report each as pass, fail, or not applicable. Stop and raise anything that fails before writing the PR.

- **Debug residue**: leftover `console.log`, `print`, `debugger`, `binding.pry`, commented-out blocks, a hardcoded local URL or port, a test skipped to make the suite pass.
- **Secrets**: a token, key, password, connection string, or private key in source, config, tests, or fixtures. Synthetic values must look synthetic and say so.
- **Auth gate on every route**: for each new or changed endpoint, name the gate that protects it. If the answer is "the global middleware", confirm the route is actually inside it. Write the gate into the PR body, one line per route.
- **Authorization, not just authentication**: a logged-in user reaching another user's record is the defect this item exists for. Check that the query filters by the caller's scope.
- **Migrations**: reversible, and safe to run while the old code is still serving traffic. A column drop or a rename in the same deploy as the code change breaks during rollout.
- **Breaking changes**: a changed signature, response shape, default value, config key, or env var. Each needs a line in the PR body and a note on who has to act.
- **Generated and vendored files**: lockfiles and build output included deliberately, not by accident. Say which are generated so the reviewer skips them.
- **Tests**: the new behavior has one, and the suite passes. Report pass, fail, and skip counts. A skipped test is a failing test nobody can see, so never report "all green" with skips unmentioned.
- **Scope**: one demonstrable change. See below.

## Split an overloaded diff

If the diff contains more than one demonstrable change, say so and propose the split before committing. The signals: unrelated directories, a refactor plus a feature, a dependency bump plus a bug fix, or a summary you can only write with "and".

Roughly 400 lines and 15 files is where review quality falls off. Past that, a reviewer skims. A change that cannot be split (a rename across the codebase, a generated client) should say so in the PR body with the reason.

To split: `git add -p` the first coherent change, commit it, repeat. If the work is already in one commit, `git reset --soft HEAD~1` and stage it in pieces.

## Commit message

Subject line: imperative mood, under 72 characters, stating what changed.

Body: why the change exists. The problem it solves, the constraint that shaped the approach, the alternative rejected and the reason. Wrap at 72 columns. Skip the body only when the subject is genuinely complete, which is rare for anything but a typo fix.

The commit says what changed and why. It does not narrate the process, list the files (the diff does), thank anyone, or describe how the change was produced.

```
Cache the permission lookup per request

The authorization check hit the permissions table once per rendered row,
so a 200-row list issued 200 identical queries. Memoize per request
rather than globally: permissions change mid-session on role edits, and a
process-lifetime cache served stale grants until restart.
```

Add no trailers beyond what the project already uses. Do not add co-author or tool-attribution trailers unless the repo's existing commits carry them.

## PR body

Four sections. Keep each short enough to read before the diff.

```markdown
## Problem
What was broken or missing, and how it showed up. Link the issue.

## Solution
What changed and why this approach. Name the alternative you rejected.

## Testing
The commands you ran and their result, including pass/fail/skip counts.
The manual verification, if the change needs a real run to prove.

## Risk
Auth gate per new or changed route. Breaking changes and who must act.
Migration reversibility. What you could not verify. How to roll back.
```

Say in the body that you read the diff yourself. Never request review on code no human has read.

Link every reference and only to something that resolves. A bare issue number, a branch name as plain text, or a URL on an unpushed branch is dead on arrival, and the last one is worse than nothing because it looks checkable.

Keep local machine paths out of the commit message, the PR body, and any linked artifact. Describe the location, do not paste it.

## Before you push

- Confirm you are not on the default branch. If you are, branch first.
- Confirm the author identity on the commits is the one the project expects: `git log -1 --format='%an <%ae>'`.
- Push, then confirm the branch exists on the remote before writing any URL that points at it.

Opening a PR is outward-facing. Draft the commit and the body, show them, and push only when the user says to, unless they have already said to go ahead.
