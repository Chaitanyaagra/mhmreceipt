/* Minimal zero-dependency test harness. No Jest, no install — just `node`.
   Keeps the project dependency-free, which matters for a static-hosted site
   maintained by a volunteer committee. */
let passed = 0, failed = 0;
const failures = [];

export function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`${label}\n    got:  ${a}\n    want: ${e}`); }
}

export function ok(cond, label) {
  if (cond) passed++;
  else { failed++; failures.push(label); }
}

export function near(actual, expected, label, tol = 0.5) {
  if (Math.abs(actual - expected) <= tol) passed++;
  else { failed++; failures.push(`${label}: got ${actual}, want ~${expected}`); }
}

export function section(name) {
  console.log(`\n  ${name}`);
}

export function report() {
  if (failures.length) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log('   ✗ ' + f));
  }
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}
