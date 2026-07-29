/* Loads app-common.js for testing by rewriting its three environment imports
   (Firebase config, the Firestore SDK URL, and leaving tower-plan as-is) to
   local stubs, writing the result to a temp file, and importing that.

   Done this way rather than with a bundler so the tests need nothing installed
   — `node tests/run.mjs` works on a bare checkout. */
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');

export async function loadAppCommon() {
  let src = readFileSync(join(projectRoot, 'app-common.js'), 'utf8');

  // Point the two environment imports at the stubs.
  src = src.replace("import { db } from './firebase-config.js';",
                    "import { db } from './firebase-config.js';"); // stub copied alongside
  src = src.replace(
    /from "https:\/\/www\.gstatic\.com\/firebasejs\/[^"]*firebase-firestore\.js"/,
    'from "./firestore.js"');

  const dir = mkdtempSync(join(tmpdir(), 'mhm-test-'));
  // Copy the real tower-plan and ui-a11y (both dependency-free) and the stubs
  // next to the module, so app-common's imports and re-exports all resolve.
  copyFileSync(join(projectRoot, 'tower-plan.js'), join(dir, 'tower-plan.js'));
  copyFileSync(join(projectRoot, 'ui-a11y.js'), join(dir, 'ui-a11y.js'));
  copyFileSync(join(here, '_stubs', 'firebase-config.js'), join(dir, 'firebase-config.js'));
  copyFileSync(join(here, '_stubs', 'firestore.js'), join(dir, 'firestore.js'));
  writeFileSync(join(dir, 'app-common.js'), src);

  return import(pathToFileURL(join(dir, 'app-common.js')).href);
}
