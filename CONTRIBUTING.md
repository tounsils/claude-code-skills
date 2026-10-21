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

## Generated files

Five harness files are generated from `skills/`, so do not hand-edit them:

- `AGENTS.md`
- `.cursor/rules/*.mdc`
- `.clinerules/dev-skills.md`
- `.windsurf/rules/dev-skills.md`
- `.github/copilot-instructions.md`

After changing any skill's name or description, regenerate and commit the result:

```bash
node scripts/generate-harnesses.mjs
```

To change what those files say, edit `scripts/generate-harnesses.mjs`. CI runs `--check` and fails on drift.

## Validate

```bash
node scripts/validate.mjs                      # spec, cited files, versions, leaks
node scripts/generate-harnesses.mjs --check    # generated files current
claude plugin validate . --strict              # authoritative manifest check
npm run format:check                           # JSON, YAML and JS only
```

All four run in CI on every push. The first two need nothing installed.

## Add an eval case

A new skill needs one. A skill with no eval is a claim with no evidence, and the first thing that breaks when a model changes is triggering.

```bash
claude plugin eval init --bare my-case
claude plugin eval . --case my-case --ablation none --runs 1
```

Two graders: a `tool_used` check that your skill fired, and an `llm` rubric on whether the answer was right. See [evals/README.md](evals/README.md) for the layout and the cheap iteration commands.

Write the prompt the way a user would type it, and never name the skill in it. Then make the rubric adversarial: plant the specific thing your skill is written to catch, and write the FAIL conditions so that the answer a capable model gives without your skill does not pass. A case that passes on general competence proves nothing about the skill.

Consider a negative case too, if your skill's description shares vocabulary with an existing one.

## Test it on real work

A skill that validates and evals clean is still not a skill that works. Before opening a PR, run it against an actual task in a real repository, twice: once where it should fire and once where a neighboring skill should fire instead.

Say in the PR body what you ran it on and what it got wrong. The second part is what tells a reviewer the skill was used rather than written.

## Pull requests

One skill, or one coherent change to one skill, per PR. Include:

- What failure the skill exists to prevent, and what happened without it.
- The repository and task you tested against.
- Anything it still gets wrong.
