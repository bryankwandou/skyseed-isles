// One command for the whole suite: bring the static server up, run every browser test
// against it one at a time, tear the server down, and report which ones failed.
// Sequential on purpose — these all fight over the same software GPU, and running them
// in parallel is what made the dungeon test look "flaky" when it was reporting a real bug.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 5610);
const URL_BASE = `http://127.0.0.1:${PORT}/play/`;
const only = process.argv.slice(2);

const free = () => new Promise(res => {
  const s = createServer();
  s.once('error', () => res(false));
  s.once('listening', () => s.close(() => res(true)));
  s.listen(PORT, '127.0.0.1');
});
if (!(await free())) {
  console.error(`port ${PORT} is already in use — stop whatever is on it and retry`);
  process.exit(1);
}

const server = spawn(process.execPath,
  ['node_modules/http-server/bin/http-server', '-p', String(PORT), '-c-1', '--silent', '.'],
  { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch (_) {} };
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

// wait for it to actually answer rather than sleeping a hopeful two seconds
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(URL_BASE); if (r.ok) break; } catch (_) {}
  await new Promise(r => setTimeout(r, 250));
}

const tests = readdirSync('test').filter(f => f.endsWith('.test.mjs')).sort()
  .filter(f => !only.length || only.some(o => f.includes(o)));

const results = [];
for (const file of tests) {
  process.stdout.write(`\n=== ${file} ===\n`);
  const code = await new Promise(res => {
    const t = spawn(process.execPath, ['test/' + file],
      { stdio: 'inherit', env: { ...process.env, TEST_URL: URL_BASE } });
    t.on('exit', c => res(c ?? 1));
  });
  results.push({ file, code });
}
stop();

// the tests report their own verdict on stdout, so a zero exit is not the whole story;
// the runner's job is only to say which files ran and which crashed outright.
console.log('\n=== summary ===');
for (const r of results) console.log((r.code === 0 ? 'ran   ' : 'CRASH ') + r.file);
const crashed = results.filter(r => r.code !== 0);
console.log(`${results.length} test files, ${crashed.length} crashed`);
process.exit(crashed.length ? 1 : 0);
