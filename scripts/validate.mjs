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

if (!QUIET) {
  for (const w of warnings) console.log(`warn  ${w}`);
}
for (const e of errors) console.error(`error ${e}`);

const summary = `${slugs.length} skills checked, ${errors.length} errors, ${warnings.length} warnings`;
console.log(errors.length ? `FAIL  ${summary}` : `ok    ${summary}`);
process.exit(errors.length ? 1 : 0);
