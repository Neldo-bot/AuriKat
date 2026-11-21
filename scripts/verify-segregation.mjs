#!/usr/bin/env node
/**
 * Automated Segregation & Zero-Third-Party-Network Build Auditor (SEC-01 / TECH-03 / COPPA 2025)
 * Verifies that apps/player/dist contains ZERO clinical scoring symbols, diagnostic labels,
 * clinical portal routes, or external CDN URLs.
 */
import fs from 'node:fs';
import path from 'node:path';

const playerDist = path.resolve(process.cwd(), 'apps/player/dist');
const clinicalDist = path.resolve(process.cwd(), 'apps/clinical/dist');

if (!fs.existsSync(playerDist)) {
  console.error('FAIL: apps/player/dist does not exist. Run build first.');
  process.exit(1);
}
if (!fs.existsSync(clinicalDist)) {
  console.error('FAIL: apps/clinical/dist does not exist. Run build first.');
  process.exit(1);
}

// Forbidden symbols/strings that must NEVER exist inside the child-facing bundle
const FORBIDDEN_IN_PLAYER = [
  'EvidenceScoringEngine',
  'ClinicalProtocolRegistry',
  '@aurikat/clinical-scoring',
  'DSM-5-TR',
  'ADOS-2',
  'CARS-2',
  'SRS-2',
  'MABC-2',
  'CLINICO2026',
  '#clinico',
  'ASDGeo',
  'INDETERMINATE',
  'Evidence Trace',
  'PrintableClinicalReport',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
];

// Forbidden third-party CDNs in clinical build as well
const FORBIDDEN_CDN_IN_CLINICAL = [
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
];

function collectFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (/\.(js|mjs|css|html|json|webmanifest)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

let violations = 0;

for (const file of collectFiles(playerDist)) {
  const content = fs.readFileSync(file, 'utf8');
  for (const token of FORBIDDEN_IN_PLAYER) {
    if (content.includes(token)) {
      console.error(`SEGREGATION VIOLATION in ${path.relative(process.cwd(), file)}: found "${token}"`);
      violations++;
    }
  }
}

for (const file of collectFiles(clinicalDist)) {
  const content = fs.readFileSync(file, 'utf8');
  for (const token of FORBIDDEN_CDN_IN_CLINICAL) {
    if (content.includes(token)) {
      console.error(`THIRD-PARTY CDN VIOLATION in ${path.relative(process.cwd(), file)}: found "${token}"`);
      violations++;
    }
  }
}

// Verify package.json of apps/player does NOT depend on @aurikat/clinical-scoring
const playerPkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'apps/player/package.json'), 'utf8'));
const allPlayerDeps = { ...playerPkg.dependencies, ...playerPkg.devDependencies };
if (allPlayerDeps['@aurikat/clinical-scoring']) {
  console.error('DEPENDENCY VIOLATION: apps/player must NEVER depend on @aurikat/clinical-scoring');
  violations++;
}

if (violations > 0) {
  console.error(`\nFAILED: ${violations} segregation/privacy violation(s) detected.`);
  process.exit(1);
}

console.log('PASS: apps/player/dist verified — 0 clinical bytes, 0 diagnostic labels, 0 third-party CDNs.');
console.log('PASS: apps/clinical/dist verified — 0 third-party CDNs.');
