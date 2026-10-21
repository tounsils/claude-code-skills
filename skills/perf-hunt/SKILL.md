---
name: perf-hunt
description: Find and fix the actual performance bottleneck by measuring first, attacking the dominant cost, and re-measuring, with every constant derived from a number rather than guessed. Use when something is slow, a page or query or build takes too long, memory grows without bound, or when asked to optimize this, make it faster, profile this, or reduce latency.
---

# Measure, then optimize

Intuition about performance is wrong often enough that acting on it wastes the effort and sometimes makes things slower. Every step here exists to replace a guess with a number.

## No optimization without a before number

Produce a measurement first, every time. If you cannot measure it, you cannot know you improved it, and you cannot tell a 3% change from noise.

Define the metric before measuring: wall time at p50 and p95, queries issued, bytes allocated, peak memory, or requests per second. Pick the one the complaint is actually about. "The page is slow" might be server time, payload size, or render time, and those have no fixes in common.

```bash
# wall time with variance, not one run
hyperfine --warmup 3 'npm run build'
for i in $(seq 10); do /usr/bin/time -f '%e %MkB' <command>; done

# web
curl -w '%{time_starttransfer} %{time_total} %{size_download}\n' -o /dev/null -s <url>

# language profilers
node --cpu-prof --cpu-prof-dir=./prof <script>
python -X importtime -m cProfile -s cumtime <script>
go test -bench . -benchmem -cpuprofile cpu.out
```

Run it enough times to see the spread. A single run of a 2-second operation on a laptop can vary by 30%, which is larger than most optimizations.

For a throwaway measuring script, keep it out of the committed tree, but record what it measured and what it found in the comment next to whatever constant it produced.

## Find the dominant cost

Profile. Do not read the code looking for slow-looking lines.

The distribution is almost always lopsided: one call path accounts for most of the time, and it is frequently not the one that looks expensive. Common surprises: a logging call formatting objects that are never printed, a serializer running twice, an import with side effects, a regex recompiled per iteration, a type conversion in a tight loop.

Rank costs by total contribution, then target the top one. A 90% improvement on something that is 2% of the time is a 1.8% improvement overall and should not be done at all.

## Where the real wins are

In rough order of how often each is the actual answer:

**Queries in a loop.** One query per item in a list, usually hidden behind an ORM relation accessed inside a map. The fix is one query with a join or an `IN` clause. Count queries per request in development; the number should not scale with the result set.

**A missing index.** Run the database's explain on the slow query and look for a sequential scan over a large table. Check that the index matches the query's column order and that a function call or type cast on the column is not preventing its use.

**Work repeated in a loop that could be hoisted.** A compiled regex, a parsed config, a sorted list, a database connection, a template compilation. Compute once outside the loop.

**Fixed-interval polling.** A job that wakes every second to check a table that changes a few times a day. Compute when the next event can occur and sleep until then. At fleet scale this is the difference between a constant load floor and none, and it is the most common accidental database hot spot in a scheduler.

**Payload size.** Returning entire records when the client needs three fields, no compression, no pagination, an unbounded result set. Measure bytes before optimizing code: shipping 4 MB of JSON cannot be fixed in the handler.

**Synchronous IO on a hot path.** A blocking file read, a logging call that waits on a network write, a sequential chain of independent requests that could run concurrently.

**Algorithmic complexity.** A nested loop over the same collection, a repeated linear search that should be a hash lookup, a sort inside a comparison, string concatenation in a loop in a language where strings are immutable.

**Unbounded allocation.** A cache with no eviction, a growing array of all results when only an aggregate is needed, a stream read fully into memory. This shows up as memory growth and then as time, once the garbage collector or swap becomes the cost.

Prefer the algorithmic fix to the micro-optimization. Removing an N+1 beats hand-tuning the loop body that runs N times, and it survives the next refactor.

## Derive every constant

A cache size, batch size, pool size, timeout, or page size chosen because it felt right is a magic number that will be wrong under a different load.

Measure to find it, then record the derivation where the constant lives:

```ts
// 500: batch sizes of 100/250/500/1000 measured against the staging dataset;
// throughput flattens past 500 while p95 latency keeps rising, so 500 is the knee.
// Re-measure if the row width changes materially.
const BATCH_SIZE = 500;
```

The comment says how the value was derived, not what it is. A reader six months later needs to know whether they may change it.

## Re-measure and keep the benchmark

1. Apply one change.
2. Re-measure with the same method and the same number of runs.
3. Report before, after, and the spread. If the improvement is within the noise, it is not an improvement: revert it.
4. Run the test suite. A fast wrong answer is not an optimization, and caching and concurrency changes break correctness in ways that only show under load.
5. Commit the benchmark if the project can host one, so the regression is caught rather than rediscovered.

Change one thing at a time. Two simultaneous optimizations where one helps and one hurts measure as nothing.

## Report

- **Metric and method**: what was measured, how, how many runs, and the variance.
- **Before**: the number, with its spread.
- **The dominant cost**: what the profile showed, with its share of the total.
- **The change**: what you did and why that addressed the dominant cost.
- **After**: the number, same method, with its spread.
- **Correctness**: suite results including pass, fail, and skip counts.
- **Next**: the remaining costs in rank order, with an estimate of what each is worth, so the decision to stop is informed.

State the improvement as a ratio and an absolute. A 40% reduction on 12 ms is not worth a cache invalidation bug.
