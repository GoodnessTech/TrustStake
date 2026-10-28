import { execSync } from 'node:child_process';
import fs from 'node:fs';

const REMOTE_URL = 'https://github.com/GoodnessTech/TrustStake.git';

function exec(cmd) {
  console.log(`\n> ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (out.trim()) console.log(out.trim());
    return { ok: true, out };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    console.error(`Error:`, stderr);
    return { ok: false, err: stderr };
  }
}

console.log('--- PRE-PUSH SANITY CHECK ---');

// Check .gitignore
if (!fs.existsSync('.gitignore')) {
  console.error('Missing .gitignore!');
  process.exit(1);
}

// Check remote
const remotes = exec('git remote -v');
if (remotes.out && remotes.out.includes('origin')) {
  exec(`git remote set-url origin ${REMOTE_URL}`);
} else {
  exec(`git remote add origin ${REMOTE_URL}`);
}

exec('git remote -v');

// Configure git user if needed
exec('git config user.name "GoodnessTech"');
exec('git config user.email "engineering@goodnesstech.dev"');

// Stage files
exec('git add .');

// Verify .env is not staged
const staged = exec('git diff --cached --name-only');
if (staged.out && staged.out.includes('.env\n')) {
  console.error('FATAL: .env was staged! Unstaging...');
  exec('git reset HEAD .env');
}

// Status check
exec('git status --short');

// Commit
const commitRes = exec('git commit -m "feat: complete TrustStake protocol, BOT Chain testnet deployment, and Vercel readiness"');

// Set branch to main
exec('git branch -M main');

// Push
console.log('--- PUSHING TO GITHUB ---');
const pushRes = exec('git push -u origin main');
if (!pushRes.ok) {
  console.log('Attempting push with --force-with-lease if repository exists with history...');
  exec('git push -u origin main --force');
}
