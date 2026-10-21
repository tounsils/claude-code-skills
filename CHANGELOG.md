# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [semantic versioning](https://semver.org/spec/v2.0.0.html), applied to the skills as a published interface: a changed skill name or a removed skill is a major, a new skill or a new reference file is a minor, and a correction inside an existing skill is a patch.

## [Unreleased]

### Changed

- Rewrote the trigger clauses of `perf-hunt`, `root-cause` and `triage-ci` to lead with request-shaped phrasings ("use when asked to fix the build") instead of situational ones ("use when the build is red"). The first eval run found all three failing the same way: the answer was right and the skill never loaded, while the other seven fired every time.

  **This change is not demonstrated to help.** The claim that it took `perf-hunt` and `root-cause` to 3 of 3 was drawn from a single 3-run measurement and did not survive repetition. See Known issues.

### Known issues

- **Trigger measurement at 3 runs per case is too noisy to detect a change of this size.** One case was measured five times at 3 runs each under configurations that included an identical revert to a previously measured state. It scored 1.00 once and 0.50 four times, with the same skill text, the same judge model and the same run count. Any before-and-after conclusion from 3 runs in this suite, including the ones previously recorded here, should be treated as unsupported. A trustworthy trigger rate needs on the order of 20 to 30 runs per case.

- `root-cause-refuses-timeout-bump` fails its own `criteria` rubric in roughly two runs of three, across 12 runs under four configurations, with a Sonnet judge. Whether the rubric is too strict or the skill genuinely does not produce what it asks for is undetermined: that needs one failing transcript read with `--keep-temp`, not more aggregate runs.

- `triage-ci-finds-first-failure` fires on roughly 2 runs of 3, up from 0 of 3 originally, but within the noise described above.

- A plugin installed at user scope and a plugin targeted by path both load during an eval run, so two copies of the same skill with different text can be present at once. Confirmed by diffing the cached copy against the working tree mid-run. Uninstalling the user-scope copy did not change any score, so this was not the cause of the variance, but it makes any eval run against a working tree untrustworthy unless the installed copy is removed first.

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
