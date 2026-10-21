#!/usr/bin/env node
// Validates every skill in skills/ against the Agent Skills spec, then applies two
// repo rules that the spec does not cover: no machine-local paths and no credential
// shapes in anything that ships. Zero dependencies so CI needs no install step.
//
// Usage: node scripts/validate.mjs [--quiet]
// Exit code 0 = clean, 1 = at least one error. Warnings never fail the run.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const QUIET = process.argv.includes('--quiet');

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;
const MAX_BODY_LINES = 500;
const ALLOWED_FRONTMATTER_KEYS = new Set(['name', 'description']);

// A description is the only thing Claude sees before the skill triggers, so it has to
// carry the trigger condition. Without one the skill is dead weight in the context window.
const TRIGGER_HINTS = ['use when', 'use this when', 'triggers on', 'use for', 'invoke when'];

const LOCAL_PATH_PATTERNS = [
  { re: /\b[A-Za-z]:[\\/](?:Users|dev|home|Program Files)\b/g, label: 'Windows machine path' },
  { re: /\/(?:Users|home)\/[A-Za-z0-9._-]+\//g, label: 'POSIX home path' },
];

const SECRET_PATTERNS = [
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}/g, label: 'GitHub token' },
  { re: /\bsk-[A-Za-z0-9]{20,}/g, label: 'API secret key' },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, label: 'AWS access key id' },
  { re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g, label: 'private key' },
];

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

/**
 * Parses YAML frontmatter without a YAML dependency. Skill frontmatter is a flat
 * map of two scalar keys, so a line parser is sufficient and cannot drift from the
 * spec the way a partial YAML implementation would. Returns null when the document
 * has no frontmatter block at all.
 */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;

  const data = {};
  const duplicates = [];
  let currentKey = null;

  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (match && !line.startsWith(' ')) {
      currentKey = match[1];
      if (currentKey in data) duplicates.push(currentKey);
      data[currentKey] = stripQuotes(match[2].trim());
    } else if (currentKey && line.startsWith(' ')) {
      // Folded or block scalar continuation.
      data[currentKey] = `${data[currentKey]} ${line.trim()}`.trim();
    } else {
      return { data, duplicates, bodyStart: end + 1, malformed: line };
    }
  }
  return { data, duplicates, bodyStart: end + 1, malformed: null };
}

function stripQuotes(value) {
  if (value.length > 1 && /^(".*"|'.*')$/s.test(value)) return value.slice(1, -1);
  if (value === '>' || value === '|' || value === '>-' || value === '|-') return '';
  return value;
}

/** Collects the relative paths a SKILL.md body points at, so a cited file cannot go missing. */
function citedPaths(body) {
  const found = new Set();
  for (const [, target] of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    found.add(target.split('#')[0].trim());
  }
  for (const [, target] of body.matchAll(/\b((?:references|scripts|assets)\/[A-Za-z0-9._/-]+)/g)) {
    found.add(target);
  }
  return [...found].filter(Boolean);
}

function scanForLeaks(where, text) {
  for (const { re, label } of LOCAL_PATH_PATTERNS) {
    for (const [match] of text.matchAll(re)) {
      err(where, `${label} in shipped text: ${match}. Describe the location, do not hardcode it`);
    }
  }
  for (const { re, label } of SECRET_PATTERNS) {
    if (re.test(text)) err(where, `looks like a committed ${label}`);
    re.lastIndex = 0;
  }
}

function validateSkill(slug) {
  const dir = join(SKILLS_DIR, slug);
  const skillPath = join(dir, 'SKILL.md');
  const where = `skills/${slug}`;

  if (!existsSync(skillPath)) {
    err(where, 'no SKILL.md');
    return;
  }
  if (!NAME_RE.test(slug)) {
    err(where, 'folder name must be kebab-case: lowercase letters, digits and single hyphens');
  }

  const raw = readFileSync(skillPath, 'utf8');
  const parsed = parseFrontmatter(raw);
  if (!parsed) {
    err(where, 'SKILL.md has no YAML frontmatter delimited by --- on the first line');
    return;
  }

  const { data, duplicates, bodyStart, malformed } = parsed;
  if (malformed) err(where, `frontmatter line is not a key: value pair: ${malformed.trim()}`);
  for (const key of duplicates) err(where, `duplicate frontmatter key: ${key}`);

  for (const key of Object.keys(data)) {
    if (!ALLOWED_FRONTMATTER_KEYS.has(key)) {
      err(where, `unsupported frontmatter key "${key}". Only name and description are read`);
    }
  }

  if (!data.name) {
    err(where, 'frontmatter is missing name');
  } else {
    if (data.name !== slug) err(where, `name "${data.name}" does not match folder "${slug}"`);
    if (data.name.length > MAX_NAME) err(where, `name exceeds ${MAX_NAME} characters`);
  }

  if (!data.description) {
    err(where, 'frontmatter is missing description, so the skill can never trigger');
  } else {
    if (data.description.length > MAX_DESCRIPTION) {
      err(where, `description exceeds ${MAX_DESCRIPTION} characters`);
    }
    const lower = data.description.toLowerCase();
    if (!TRIGGER_HINTS.some((hint) => lower.includes(hint))) {
      warn(where, 'description states what the skill does but never when to use it');
    }
  }

  const body = raw.split(/\r?\n/).slice(bodyStart);
  const bodyText = body.join('\n');
  if (!bodyText.trim()) err(where, 'SKILL.md has frontmatter but no instructions');
  if (body.length > MAX_BODY_LINES) {
    warn(
      where,
      `body is ${body.length} lines, over the ${MAX_BODY_LINES}-line guideline. Split into references/`,
    );
  }
  if (/^#+\s+when to use/im.test(bodyText)) {
    warn(
      where,
      'a "When to use" heading in the body is never read before triggering. Move it into description',
    );
  }

  for (const cited of citedPaths(bodyText)) {
    if (cited.startsWith('/') || /^[A-Za-z]:/.test(cited)) {
      err(where, `cited path is absolute: ${cited}`);
      continue;
    }
    if (!existsSync(resolve(dir, cited))) err(where, `cites a file that is not shipped: ${cited}`);
  }

  for (const file of walk(dir)) {
    scanForLeaks(relative(ROOT, file).replace(/\\/g, '/'), readFileSync(file, 'utf8'));
  }
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(md|txt|json|ya?ml|mjs|js|ts|py|sh)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function validateManifests(slugs) {
  const marketplacePath = join(ROOT, '.claude-plugin', 'marketplace.json');
  const pluginPath = join(ROOT, '.claude-plugin', 'plugin.json');

  let marketplace;
  try {
    marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));
  } catch (e) {
    err('.claude-plugin/marketplace.json', `unreadable or invalid JSON: ${e.message}`);
    return;
  }

  for (const field of ['name', 'owner', 'plugins']) {
    if (!marketplace[field])
      err('.claude-plugin/marketplace.json', `missing required field: ${field}`);
  }
  if (!marketplace.owner?.name) err('.claude-plugin/marketplace.json', 'owner.name is required');
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    err('.claude-plugin/marketplace.json', 'plugins must be a non-empty array');
    return;
  }

  for (const [i, entry] of marketplace.plugins.entries()) {
    const at = `.claude-plugin/marketplace.json plugins[${i}]`;
    if (!entry.name) err(at, 'missing name');
    if (!entry.source) err(at, 'missing source');
    if (typeof entry.source === 'string') {
      if (entry.source.includes('..')) err(at, 'source must not contain ".."');
      else if (!existsSync(resolve(ROOT, entry.source)))
        err(at, `source path does not exist: ${entry.source}`);
    }
  }

  if (!existsSync(pluginPath)) {
    warn('.claude-plugin/plugin.json', 'absent, so the marketplace entry serves as the manifest');
    return;
  }

  let plugin;
  try {
    plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
  } catch (e) {
    err('.claude-plugin/plugin.json', `invalid JSON: ${e.message}`);
    return;
  }

  // An entry name that differs from the manifest name makes install fail with a
  // "not found in marketplace" error that points at neither file.
  const rootEntry = marketplace.plugins.find((p) => ['.', './'].includes(p.source));
  if (rootEntry && plugin.name !== rootEntry.name) {
    err(
      '.claude-plugin',
      `plugin.json name "${plugin.name}" differs from marketplace entry name "${rootEntry.name}"`,
    );
  }
  for (const field of ['version', 'description', 'author']) {
    if (!plugin[field]) warn('.claude-plugin/plugin.json', `missing ${field}`);
  }
  if (/(?:^|[^a-z])(claude|anthropic|anthropics)(?:[^a-z]|$)/i.test(plugin.name ?? '')) {
    warn(
      '.claude-plugin/plugin.json',
      `name "${plugin.name}" reads as one of Anthropic's own plugins`,
    );
  }

  const readme = join(ROOT, 'README.md');
  if (existsSync(readme)) {
    const text = readFileSync(readme, 'utf8');
    scanForLeaks('README.md', text);
    for (const slug of slugs) {
      if (!text.includes(slug)) warn('README.md', `does not mention the ${slug} skill`);
    }
  }
}

/**
 * Four files carry the version, and a release tagged from a VERSION that disagrees
 * with plugin.json pins users to the wrong one silently. Treat any disagreement as
 * an error rather than letting the release workflow discover it.
 */
function validateVersions() {
  const sources = [
    ['VERSION', (t) => t.trim()],
    ['.claude-plugin/plugin.json', (t) => JSON.parse(t).version],
    ['package.json', (t) => JSON.parse(t).version],
  ];

  const found = [];
  for (const [rel, extract] of sources) {
    const full = join(ROOT, rel);
    if (!existsSync(full)) continue;
    try {
      const value = extract(readFileSync(full, 'utf8'));
      if (value) found.push([rel, value]);
      else warn(rel, 'declares no version');
    } catch (e) {
      err(rel, `could not read a version from it: ${e.message}`);
    }
  }

  const distinct = new Set(found.map(([, v]) => v));
  if (distinct.size > 1) {
    err('version', `disagreement across files: ${found.map(([r, v]) => `${r}=${v}`).join(', ')}`);
  }

  const changelog = join(ROOT, 'CHANGELOG.md');
  const current = found[0]?.[1];
  if (current && existsSync(changelog)) {
    const text = readFileSync(changelog, 'utf8');
    if (!text.includes(`[${current}]`)) {
      warn('CHANGELOG.md', `has no entry for version ${current}`);
    }
  }
}

const PROMPT_FIELDS = new Set([
  'schema_version',
  'name',
  'description',
  'tags',
  'plugins',
  'runs',
  'expected_outcome',
  'model',
  'max_turns',
  'timeout_seconds',
  'allowed_tools',
  'append_system_prompt',
  'env',
]);

// Grader options by type. An unknown key is an error in the eval loader, so catching
// it here is cheaper than discovering it when a suite scores zero.
const GRADER_OPTIONS = {
  regex: ['pattern', 'flags', 'match', 'target'],
  tool_used: ['tool', 'input_match', 'min', 'max'],
  tool_order: ['before', 'after'],
  file_exists: ['path', 'exists'],
  llm: ['criteria', 'focus'],
  baseline: ['baseline_file', 'criteria'],
};
const GRADER_COMMON = ['type', 'weight', 'arm'];

/**
 * Checks the eval suite's shape without running it. `claude plugin eval` is the
 * authority on behavior, but it needs an account that has the command and it costs
 * a model run per case, so a structural pass belongs in the free gate: a case with
 * no grader fails to load, an unknown frontmatter key is an error, and a tool_used
 * grader naming a renamed skill passes its own load and then never fires.
 */
function validateEvals(slugs) {
  const evalsDir = join(ROOT, 'evals');
  if (!existsSync(evalsDir)) return;

  const cases = readdirSync(evalsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'results')
    .map((e) => e.name)
    .filter((name) => ['prompt.md', 'case.yaml'].some((f) => existsSync(join(evalsDir, name, f))));

  if (cases.length === 0) {
    warn('evals/', 'directory exists but holds no cases');
    return;
  }

  const slugSet = new Set(slugs);
  const covered = new Set();

  for (const name of cases) {
    const dir = join(evalsDir, name);
    const where = `evals/${name}`;

    const promptPath = join(dir, 'prompt.md');
    if (existsSync(promptPath)) {
      const parsed = parseFrontmatter(readFileSync(promptPath, 'utf8'));
      if (!parsed) {
        err(where, 'prompt.md has no frontmatter');
      } else {
        for (const key of Object.keys(parsed.data)) {
          if (!PROMPT_FIELDS.has(key)) err(where, `prompt.md has unknown field "${key}"`);
        }
        const body = readFileSync(promptPath, 'utf8').split(/\r?\n/).slice(parsed.bodyStart);
        if (!body.join('\n').trim()) err(where, 'prompt.md has no prompt body');
      }
    }

    const gradersDir = join(dir, 'graders');
    const graders = existsSync(gradersDir)
      ? readdirSync(gradersDir).filter((f) => f.endsWith('.md'))
      : [];
    const yamlDeclaresGraders =
      existsSync(join(dir, 'case.yaml')) &&
      /^graders:/m.test(readFileSync(join(dir, 'case.yaml'), 'utf8'));

    if (graders.length === 0 && !yamlDeclaresGraders) {
      err(where, 'no graders, so the case fails to load');
    }

    for (const file of graders) {
      const at = `${where}/graders/${file}`;
      const parsed = parseFrontmatter(readFileSync(join(gradersDir, file), 'utf8'));
      if (!parsed) {
        err(at, 'no frontmatter');
        continue;
      }

      const { data } = parsed;
      const allowed = GRADER_OPTIONS[data.type];
      if (!data.type) {
        err(at, 'frontmatter is missing type');
        continue;
      }
      if (!allowed) {
        err(
          at,
          `unknown grader type "${data.type}". One of: ${Object.keys(GRADER_OPTIONS).join(', ')}`,
        );
        continue;
      }
      for (const key of Object.keys(data)) {
        if (!allowed.includes(key) && !GRADER_COMMON.includes(key)) {
          err(at, `key "${key}" is not valid for a ${data.type} grader`);
        }
      }

      if (data.type === 'llm') {
        const body = readFileSync(join(gradersDir, file), 'utf8')
          .split(/\r?\n/)
          .slice(parsed.bodyStart)
          .join('\n');
        if (!body.trim() && !data.criteria) err(at, 'llm grader has no rubric');
      }

      if (data.type === 'tool_used' && data.input_match) {
        try {
          new RegExp(data.input_match);
        } catch (e) {
          err(at, `input_match is not a valid regex: ${e.message}`);
        }

        // A grader asserting a skill fired is tied to that skill's directory name.
        // Rename the skill and the grader still loads, still runs, and matches
        // nothing forever. Require that it names at least one skill that exists.
        const named = [...slugSet].filter((slug) => data.input_match.includes(slug));
        if (data.tool === 'Skill' && named.length === 0) {
          err(at, 'input_match names no skill in skills/, so it can never match');
        }
        for (const slug of named) covered.add(slug);
      }
    }
  }

  for (const slug of slugs) {
    if (!covered.has(slug)) warn('evals/', `no case asserts that ${slug} fires`);
  }
}

/** The generated harness files ship too, so they get the same leak scan as the skills. */
function scanShippedDocs() {
  const docs = [
    'README.md',
    'CONTRIBUTING.md',
    'AGENTS.md',
    'CHANGELOG.md',
    '.github/copilot-instructions.md',
    '.clinerules/dev-skills.md',
    '.windsurf/rules/dev-skills.md',
  ];
  for (const rel of docs) {
    const full = join(ROOT, rel);
    if (existsSync(full)) scanForLeaks(rel, readFileSync(full, 'utf8'));
  }

  const cursorDir = join(ROOT, '.cursor', 'rules');
  if (!existsSync(cursorDir)) return;
  for (const file of readdirSync(cursorDir)) {
    scanForLeaks(`.cursor/rules/${file}`, readFileSync(join(cursorDir, file), 'utf8'));
  }
}

if (!existsSync(SKILLS_DIR) || !statSync(SKILLS_DIR).isDirectory()) {
  console.error('error: no skills/ directory at the repo root');
  process.exit(1);
}

const slugs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

if (slugs.length === 0) {
  console.error('error: skills/ contains no skill directories');
  process.exit(1);
}

for (const slug of slugs) validateSkill(slug);
validateManifests(slugs);
validateVersions();
validateEvals(slugs);
scanShippedDocs();

if (!QUIET) {
  for (const w of warnings) console.log(`warn  ${w}`);
}
for (const e of errors) console.error(`error ${e}`);

const summary = `${slugs.length} skills checked, ${errors.length} errors, ${warnings.length} warnings`;
console.log(errors.length ? `FAIL  ${summary}` : `ok    ${summary}`);
process.exit(errors.length ? 1 : 0);
