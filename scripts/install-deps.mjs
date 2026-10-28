import { execSync } from 'child_process';
import fs from 'fs';

console.log('--- TrustStake Environment Setup ---');

try {
  console.log('1. Installing root dependencies (viem, dotenv)...');
  execSync('npm install --no-audit --no-fund', { stdio: 'inherit' });
  console.log('Root dependencies installed successfully.');
} catch (e) {
  console.error('Error installing root dependencies:', e.message);
}

try {
  console.log('2. Installing frontend dependencies in "TrustStake Frontend"...');
  execSync('npm install --no-audit --no-fund', { cwd: './TrustStake Frontend', stdio: 'inherit' });
  console.log('Frontend dependencies installed successfully.');
} catch (e) {
  console.error('Error installing frontend dependencies:', e.message);
}

console.log('--- Done ---');
process.exit(0);
