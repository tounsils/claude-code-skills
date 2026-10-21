# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [semantic versioning](https://semver.org/spec/v2.0.0.html), applied to the skills as a published interface: a changed skill name or a removed skill is a major, a new skill or a new reference file is a minor, and a correction inside an existing skill is a patch.

## [Unreleased]

### Changed

- Rewrote the trigger clauses of `perf-hunt`, `root-cause` and `triage-ci`. The first eval run found all three failing the same way: the answer was right but the skill never loaded. The seven that fired led their trigger list with request-shaped phrasings ("use when asked to review code"); these three led with situational ones ("use when something is slow", "the build is red"). Measured over three runs each, before and after:

  | Skill | Fired before | Fired after |
  | --- | --- | --- |
  | `perf-hunt` | 1 of 3 | 3 of 3 |
  | `root-cause` | 0 of 3 | 3 of 3 |
  | `triage-ci` | 0 of 3 | 1 of 3 |

### Known issues

- `triage-ci` still loads on roughly one request in three. Its description now overlaps `root-cause` on test failures and on finding out why something broke, so the two may be competing. Unresolved, and the reason this is not yet tagged as a release.

## [0.1.0]

First release. Ten skills, a plugin marketplace, generated rule files for five other agent harnesses, and an eval suite.

### Added

- `review-diff`: severity-ranked review of a working or branch diff. Reads the deletions and the callers, then tries to refute each finding before reporting it.
- `restructure`: structural cleanup with no behavior change. Extracts by seam rather than line count, one move per commit. Ships a detection catalog and extraction recipes as reference files.
- `ship-pr`: commit message and pull request derived from the diff, with a pre-submit checklist covering auth gates, secrets, migrations, and breaking changes.
- `test-gaps`: finds untested branches worth covering, asserts invariants, and breaks the code to prove each new test can fail.
- `root-cause`: reproduce, isolate the mechanism, then fix the cause. Refuses a fix that is a constant it cannot justify.
- `audit-security`: OWASP Top 10 over a diff, reporting exploitability rather than category names. Ships a full checklist as a reference file.
- `onboard-repo`: maps an unfamiliar codebase into an architecture document and a handoff note, reading CI for the real commands.
- `perf-hunt`: measure, find the dominant cost, fix, re-measure. No optimization without a before number and its variance.
- `triage-ci`: finds the first real failure rather than the last log line, and classifies defect against flake against drift.
- `bump-deps`: risk-ordered upgrade batches with a commit per batch, and never a major bump mixed with a refactor.
- Plugin marketplace at `.claude-plugin/marketplace.json`, so installing all ten is two commands.
- Zero-dependency validator at `scripts/validate.mjs`. Checks the Agent Skills spec, that cited files ship, that versions agree across files, and two rules the spec leaves alone: no machine-local paths and no credential shapes in shipped text.
- Generated rule files for Cursor, Cline, Windsurf, GitHub Copilot, and the `AGENTS.md` convention, written from the skills by `scripts/generate-harnesses.mjs`. CI fails when they drift.
- Eval suite under `evals/`, runnable with `claude plugin eval .`. Covers each skill firing on a realistic request, plus negative cases that fail if a skill fires on a request it should ignore.

[unreleased]: https://github.com/tounsils/claude-code-skills/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tounsils/claude-code-skills/releases/tag/v0.1.0
