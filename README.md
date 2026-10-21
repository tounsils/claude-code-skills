# Claude Code Skills

Ten skills for the work that happens between writing code and shipping it: reviewing a diff, restructuring a file that got too big, opening a PR, finding the tests that are missing, debugging, security review, learning a new codebase, chasing a bottleneck, fixing a red build, and moving dependencies forward.

They are plain Markdown. No dependencies, no services, nothing to run. Claude loads one when the work matches its description and otherwise leaves it out of the context window.

## Install

```bash
claude plugin marketplace add tounsils/claude-code-skills
claude plugin install dev-skills@tounsils-skills
```

Or from inside a session:

```
/plugin marketplace add tounsils/claude-code-skills
/plugin install dev-skills@tounsils-skills
```

Confirm it loaded:

```bash
claude plugin details dev-skills
```

The `Component inventory` line should read `Skills (10)`.

**One skill only.** Each directory under `skills/` is self-contained. Copy the one you want into `~/.claude/skills/` for every project, or `.claude/skills/` in a single repo:

```bash
git clone https://github.com/tounsils/claude-code-skills
cp -r claude-code-skills/skills/review-diff ~/.claude/skills/
```

## The skills

| Skill | Use it when | What it does differently |
| --- | --- | --- |
| [`review-diff`](skills/review-diff/SKILL.md) | Before you commit or open a PR | Reads the deletions and the callers, then refutes each finding before reporting it. Every finding carries a concrete failure scenario or gets dropped |
| [`restructure`](skills/restructure/SKILL.md) | A file got too big to work in | Extracts by seam, not by line count. One move per commit, tests green between each, no behavior change |
| [`ship-pr`](skills/ship-pr/SKILL.md) | The change is done | Writes the message from the diff rather than from memory. Names the auth gate on every new route and proposes a split when the diff holds two features |
| [`test-gaps`](skills/test-gaps/SKILL.md) | A change needs coverage | Ranks gaps by worth instead of chasing a percentage, asserts invariants, and breaks the code to prove each new test can actually fail |
| [`root-cause`](skills/root-cause/SKILL.md) | Something is broken | Reproduces first, bisects to a mechanism, and refuses a fix that is a constant it cannot justify |
| [`audit-security`](skills/audit-security/SKILL.md) | Before pushing auth or input handling | OWASP Top 10 over the diff, reporting who can reach it with what input to get what, not a list of category names |
| [`onboard-repo`](skills/onboard-repo/SKILL.md) | New or inherited codebase | Reads CI for the real commands, traces one feature end to end, and counts occurrences before calling anything a convention |
| [`perf-hunt`](skills/perf-hunt/SKILL.md) | Something is slow | No optimization without a before number and a variance. Every constant gets its derivation recorded next to it |
| [`triage-ci`](skills/triage-ci/SKILL.md) | The build is red | Finds the first real failure instead of the last log line, classifies defect against flake against drift, and will not go green by disabling the check |
| [`bump-deps`](skills/bump-deps/SKILL.md) | Dependencies have drifted | Risk-ordered batches with a commit per batch, changelogs read before editing, and never a major bump mixed with a refactor |

## Other agents

The skills are Markdown procedures, so they are not Claude-specific. Rule files for five other harnesses are generated from the same ten files:

| Harness | File |
| --- | --- |
| The `AGENTS.md` convention | [AGENTS.md](AGENTS.md) |
| Cursor | `.cursor/rules/<skill>.mdc`, one per skill |
| Cline | `.clinerules/dev-skills.md` |
| Windsurf | `.windsurf/rules/dev-skills.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |

They index the skills and point at `skills/<name>/SKILL.md` rather than inlining it, because every one of these agents can read workspace files and four copies of two thousand lines would disagree with each other inside a week.

Regenerate after changing any skill:

```bash
node scripts/generate-harnesses.mjs
```

CI runs `--check` and fails if a generated file has drifted. Do not hand-edit them.

## Does it work

There is an eval suite, which is the part most skills repositories leave out.

```bash
claude plugin eval .
```

Thirteen cases. Ten check that a skill fires on a realistic request and produces what the skill exists to produce. Three check that nothing fires on a request that only sounds adjacent, since a description that over-triggers costs more than one that occasionally misses.

The positive cases are adversarial: each one plants the specific defect its skill is written to catch and surrounds it with easier things to comment on. The diff in `review-diff-finds-deleted-guard` deletes a null guard and adds a cosmetic `.trim()`, and the rubric fails any answer that only mentions the `.trim()`. `root-cause-refuses-timeout-bump` has the user explicitly asking for the symptom fix, and the rubric fails the answer that gives it to them.

Each case is graded twice: a `tool_used` check on whether the skill fired, and an `llm` rubric on whether the answer was right. Either alone is misleading, because a skill can fire and still give a bad answer. Every case also runs without the plugin, so the report shows what the skills contribute rather than what the model would have done anyway.

See [evals/README.md](evals/README.md) for the cheap iteration commands and how to add a case.

## How they are written

A skill is one `SKILL.md`: a description that decides when it loads, and a body that is loaded only once it does. Some ship reference files that get read on demand, so the main file stays short.

Four rules shaped all ten.

**The description is the whole trigger.** It is the only part always resident in the context window, so it has to say what the skill does and when to reach for it. A "When to use this skill" heading in the body is never read in time to matter.

**Context is a shared budget.** Claude is already a strong engineer. These files only carry what it would otherwise have to guess: the order to do things in, the step people skip, the thing that looks like a fix and is not. Nothing here explains what a pull request is.

**Match freedom to fragility.** Where several approaches are reasonable, the skill gives heuristics. Where a sequence is load-bearing, it gives the sequence and says why. `restructure` is strict about committing between moves because that is what keeps a failure attributable; `perf-hunt` is loose about which metric, because the right one depends on the complaint.

**Say what was not done.** Every skill ends by reporting what it skipped, could not verify, or worked around. An honest gap is useful; a silent one is a false report. All of them report test skip counts, because "all tests pass" alongside 48 skips is not true.

## Contributing

A new skill needs to earn its place in the context window. See [CONTRIBUTING.md](CONTRIBUTING.md).

Validation runs on every push, and locally the first command needs nothing installed:

```bash
node scripts/validate.mjs                      # spec, cited files, versions, leaks
node scripts/generate-harnesses.mjs --check    # generated rule files are current
claude plugin validate . --strict              # the authoritative manifest check
npm run format:check                           # JSON, YAML and JS only
```

The validator checks the spec (frontmatter keys, name matching its folder, cited files actually shipped, body length), that `VERSION`, `plugin.json` and `package.json` agree, and two rules the spec leaves alone: no machine-local paths and no credential shapes in anything that ships.

Releases are tagged. See [CHANGELOG.md](CHANGELOG.md). A tag that disagrees with `VERSION` fails the release workflow rather than pinning installers to a version that is not in the tree.

## License

MIT. See [LICENSE](LICENSE).
