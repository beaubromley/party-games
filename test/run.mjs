// npm test                 everything, browser groups side by side
// npm run test:quick       rules only, a few seconds
// npm test -- tv newer     rules plus just those groups
import { spawn } from 'node:child_process';

const GROUPS = ['newer', 'tv', 'party', 'classic', 'extras']; // longest first
const AT_ONCE = 3;
const asked = process.argv.slice(2);
const quick = asked.includes('--quick');
const unknown = asked.filter(a => a !== '--quick' && !GROUPS.includes(a));
if (unknown.length) { console.error(`Unknown group: ${unknown.join(', ')}. Choose from ${GROUPS.join(', ')}.`); process.exit(2); }

const failed = [], began = Date.now();
const seconds = from => `${Math.round((Date.now() - from) / 1000)}s`;
function run(name, file) {
  return new Promise(resolve => {
    const start = Date.now(), child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', file], { cwd: new URL('..', import.meta.url) });
    let out = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
    const limit = setTimeout(() => { out += '\nTimed out.'; child.kill('SIGKILL'); }, 8 * 60000);
    child.on('close', code => {
      clearTimeout(limit);
      console.log(`${code ? 'FAIL' : 'ok  '} ${name} (${seconds(start)})`);
      if (code) { failed.push(name); console.log(out.slice(-3000)); }
      resolve();
    });
  });
}
await run('smoke', 'test/smoke.mjs');
await run('rules', 'test/rules.mjs');
if (!quick && !failed.length) {
  const queue = asked.length ? GROUPS.filter(g => asked.includes(g)) : [...GROUPS];
  await Promise.all(Array.from({ length: AT_ONCE }, async () => { while (queue.length) { const g = queue.shift(); await run(g, `test/ui/${g}.mjs`); } }));
}
console.log(failed.length ? `Failed: ${failed.join(', ')} (${seconds(began)})` : `All passed (${seconds(began)})`);
process.exit(failed.length ? 1 : 0);
