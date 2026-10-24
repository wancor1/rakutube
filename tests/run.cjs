const path = require('node:path');
const { spawnSync } = require('node:child_process');
for (const file of ['verify.cjs', 'regressions.cjs', 'settings.cjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file), ...process.argv.slice(2)], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
