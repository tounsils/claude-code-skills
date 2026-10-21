# Contributing

## Before proposing a skill

Every skill costs context in every session, whether or not it fires, because its description is always resident. So the bar is not "is this useful" but "does Claude get this wrong without it".

Try the task without a skill first. If the result is already good, the skill is not needed. If it is wrong in the same way each time, that specific failure is the skill, and it should be short.

Things that do not work as skills:

- A restatement of a tool's documentation. Claude has read it.
- A general instruction with no trigger. That belongs in `CLAUDE.md`.
- A broad topic. "Backend development" never fires correctly because its description cannot say when it applies.

## Writing one

```
skills/<name>/
├── SKILL.md           required
├── references/        read on demand, keeps SKILL.md short
├── scripts/           for code that would otherwise be rewritten each time
└── assets/            templates and files that end up in the output
```

**Frontmatter** takes exactly two keys. Anything else is ignored at load time, and the validator rejects it.

```yaml
---
name: review-diff
description: Review uncommitted or branch-local changes for defects... Use when asked to review code, review a diff, check this before I commit...
---
```

The `description` is the entire triggering mechanism. Write what the skill does, then the phrases a user would actually type. Include the near misses: someone asking to "look over this branch" wants `review-diff` and will not say "review the diff".

**The body** is instructions, in imperative voice, loaded only after the skill fires. Keep it under 500 lines and well under that if you can. Move detail into `references/` and link it from `SKILL.md` with a line saying when to read it. A reference file nobody is told to open is dead weight.

Do not put a "When to use this skill" section in the body. By then the decision is already made.

**Earn each paragraph.** Cut anything Claude already knows. The value is in sequence, in the step people skip, and in the thing that looks like a fix and is not.

## House rules for this repo

- No machine-local paths in any shipped file. Describe the location. The validator fails the build on this.
- No credentials, tokens, or keys, including in examples. Synthetic values must look synthetic.
- No client or employer names, internal repository names, or private hostnames.
- No em dashes, and no hard-wrapped prose. One line per paragraph.
- Comments in example code say why the code exists. Git holds what changed.
- Every skill's report section names what it did not do.

## Validate

```bash
node scripts/validate.mjs     # spec, cited files, local paths, secret shapes
claude plugin validate .      # the authoritative plugin and marketplace check
npm run format:check          # JSON, YAML and JS only; Markdown is left alone
```

All three run in CI on every push. The first needs nothing installed.

## Test it on real work

A skill that validates is not a skill that works. Before opening a PR, run it against an actual task in a real repository, twice: once where it should fire and once where a neighboring skill should fire instead. A description that pulls a skill into the wrong task is worse than one that occasionally misses.

Say in the PR body what you ran it on and what it got wrong. The second part is what tells a reviewer the skill was used rather than written.

## Pull requests

One skill, or one coherent change to one skill, per PR. Include:

- What failure the skill exists to prevent, and what happened without it.
- The repository and task you tested against.
- Anything it still gets wrong.
