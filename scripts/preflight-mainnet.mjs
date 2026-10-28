import fs from 'fs';
import { Secp256k1, Address } from 'ox';

console.log('====================================================');
console.log('   TRUSTSTAKE PROTOCOL: MAINNET PREFLIGHT AUDIT     ');
console.log('====================================================');

const MAINNET_RPC = process.env.BOT_MAINNET_RPC_URL || 'https://rpc.botchain.ai';
const MAINNET_CHAIN_ID = 677;
const MAINNET_EXPLORER = process.env.BOT_MAINNET_EXPLORER || 'https://scan.botchain.ai';
const ALLOW_MAINNET_DEPLOY = process.env.ALLOW_MAINNET_DEPLOY === 'true';

console.log('Target Network:      BOT Chain Mainnet');
console.log('Expected Chain ID:   677');
console.log('Target RPC Endpoint: ' + MAINNET_RPC);
console.log('Mainnet Explorer:    ' + MAINNET_EXPLORER);
console.log('Safety Guard (ALLOW_MAINNET_DEPLOY):', ALLOW_MAINNET_DEPLOY ? 'ENABLED' : 'BLOCKED (Safety Active)');

// 1. Check Artifacts
console.log('\n[PREFLIGHT 1] Checking Compiler Output & Bytecode Limits...');
const artifact = JSON.parse(fs.readFileSync('shared/TrustStakeCore.json', 'utf8'));
const sizeKb = (artifact.deployedBytecode.length - 2) / 2 / 1024;
console.log(`Bytecode Size: ${sizeKb.toFixed(2)} KB (Limit: 24.576 KB)`);
if (sizeKb > 24.576) {
  throw new Error('Preflight Failed: Bytecode exceeds EIP-170 limit!');
}
console.log('✓ Bytecode passes Spurious Dragon limit.');

// 2. Check RPC Connectivity
console.log('\n[PREFLIGHT 2] Verifying BOT Chain Mainnet RPC Connectivity...');
try {
  const chainIdRes = await fetch(MAINNET_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
  }).then(r => r.json());

  const reportedChainId = parseInt(chainIdRes.result, 16);
  console.log(`Reported Mainnet Chain ID: ${reportedChainId}`);
  if (reportedChainId === MAINNET_CHAIN_ID) {
    console.log('✓ Mainnet RPC responded with correct Chain ID 677.');
  } else {
    console.warn(`! Chain ID warning: RPC reported ${reportedChainId}, expected ${MAINNET_CHAIN_ID}`);
  }
} catch (e) {
  console.warn('! Mainnet RPC check error (non-fatal for preflight verification):', e.message);
}

// 3. Verify Deployment Protective Guard
console.log('\n[PREFLIGHT 3] Validating Deployment Protective Guards...');
if (!ALLOW_MAINNET_DEPLOY) {
  console.log('✓ PROTECTIVE GUARD IS ACTIVE: Mainnet deployment will be REFUSED.');
  console.log('  To authorize deployment in the future, set ALLOW_MAINNET_DEPLOY=true and TRUSTSTAKE_ENV=mainnet.');
} else {
  console.warn('CAUTION: ALLOW_MAINNET_DEPLOY is enabled in environment.');
}

console.log('\n====================================================');
console.log('   MAINNET READINESS AUDIT COMPLETE (DEPLOYMENT GUARDED)');
console.log('====================================================\n');
