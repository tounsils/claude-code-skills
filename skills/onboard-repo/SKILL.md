---
name: onboard-repo
description: Map an unfamiliar codebase into an architecture document and a handoff note: real build and test commands, module boundaries, data model, the end-to-end path of one feature, and the parts that will bite you. Use when starting on a new or inherited repository, or when asked to explain this codebase, how does this project work, document the architecture, where do I start, or write a handoff.
---

# Map an unfamiliar codebase

Two deliverables: `ARCHITECTURE.md` describing how the system is put together, and a handoff note covering how to work in it. Produce both from evidence, not from the README.

## Read in this order

Each step narrows what matters, so do not skip ahead.

**1. The manifest and the lockfile.** `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `*.csproj`, `Gemfile`. The dependency list tells you the framework, the database client, the test runner, the queue, and the auth library before you open a single source file. The lockfile's absence is itself a finding.

**2. The CI configuration, not the README.** `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `azure-pipelines.yml`.

This is the single highest-value file in an unfamiliar repo. READMEs rot because nothing breaks when they go stale. CI has to pass, so its commands are the real build, the real test invocation, the real lint configuration, and the real deployment target. Where the README and CI disagree, CI is right.

**3. Entry points.** The `main`, the server bootstrap, the route registration, the CLI definition, the scheduled jobs, the queue consumers, the migrations directory. Run a search for each kind rather than assuming one:

```bash
rg -n 'def main|func main|if __name__|createServer|listen\(|app\.(use|listen)'
rg -l 'cron|schedule|@scheduled|celery|sidekiq|worker'
```

Count the entry points. A repo with four of them (web, worker, cron, CLI) is a different thing to reason about than one with a single server, and the extra three are what surprise people later.

**4. Configuration and its precedence.** Find every layer that supplies a setting: defaults in code, a config file, environment variables, a secret store, per-environment overrides. Then determine which wins. One setting with several owners and no documented precedence is the most reliable source of "works on my machine" in any codebase. Write the precedence down.

Record the names of required configuration keys in your notes, but keep real values out of any document.

**5. The data model.** Schema files, migrations, ORM models, type definitions. Note the core entities, their relationships, and which tables carry most of the rows. The migrations directory read in order is also the project's history: it shows what was renamed, what was abandoned, and where the model fought the domain.

**6. One feature, end to end.** This is the step that converts a file inventory into understanding.

Pick one real user-facing operation and follow it the whole way: the request arrives, the route matches, the middleware runs, the handler validates, the service decides, the repository queries, the response serializes, the client renders. Write down each hop with its file and line.

Doing this once tells you the layering convention, the error handling convention, the validation convention, the auth convention, and the test convention, all from evidence. Reading twenty files without tracing one path tells you none of them.

**7. The tests.** Run them. Record pass, fail, and skip counts, and the wall time. Then look at what they actually cover: if the only tests are over utility functions, the project's real logic is unverified and every change is riskier than it looks.

A high skip count is a finding. Find out why each group is skipped: pending work, a broken fixture, a platform guard, or a test someone disabled to get a green build.

**8. Git history as a heat map.** Churn concentrates where the design is wrong or where the work is.

```bash
git log --format='%h' -n 400 --name-only | rg -v '^[0-9a-f]{7,}$|^$' | sort | uniq -c | sort -rn | head -25
git log --format='%an' | sort | uniq -c | sort -rn | head
git log -1 --format='%ar'
```

The top of the churn list is where to be careful. The author list tells you who to ask, and whether the knowledge left with someone. The last commit date tells you whether this is maintained.

## Do not infer conventions from one file

An existing pattern is not evidence it is correct, and the first file you open is not representative.

Before writing "this project uses X", count:

```bash
rg -l 'pattern-a' | wc -l
rg -l 'pattern-b' | wc -l
```

If it is 40 to 3, the convention is the 40 and the 3 are legacy. If it is 20 to 18, there is no convention, which is itself the most useful thing you can tell someone. Say so instead of picking a winner.

## ARCHITECTURE.md

Keep it to what a new contributor cannot get from the file tree.

```markdown
# Architecture

## What this system does
Two or three sentences in domain terms, not technology terms.

## Shape
The runtime pieces and how they communicate. A D2 or Mermaid diagram if
it clarifies; prose if the diagram would only restate three boxes.

## Entry points
Each one: what triggers it, where it lives, what it owns.

## Request path
The traced feature from step 6, hop by hop, with file references.

## Data model
Core entities and relationships. Where the volume is.

## Boundaries
Which module may call which. What is deliberately isolated and why.
This is the section that decays first, so note the date.

## Configuration
Every layer that supplies settings, and which layer wins. Key names only.

## What is not here
Services this depends on but does not contain. Where they are documented.
```

## Handoff note

The practical half. What the architecture document does not cover.

```markdown
# Handoff

## Run it
Exact commands, taken from CI, with the prerequisites that are not obvious.

## Test it
The real invocation. Current counts: passed, failed, skipped.

## Conventions, with evidence
Each one: the convention, and the count of files following it.

## What will bite you
The non-obvious traps. Each one costs the next person an afternoon:
a build step that must run first, a required local service, a test that
needs a specific timezone, a generated file that must not be hand-edited,
a module where the churn is concentrated.

## Open questions
What you could not determine, and who or what would answer it.
```

Name the traps concretely. "Be careful with the auth module" helps nobody; "the session middleware must be registered before the router or every route silently runs ungated, see `server.ts:40`" saves a day.

## Report

The two documents, plus:

- How long the suite takes and its pass, fail, and skip counts.
- The three files with the highest churn.
- Anything that looks abandoned: a dependency unmaintained for years, a directory last touched before a major migration, a feature flag permanently off.
- What you did not read, and why.
