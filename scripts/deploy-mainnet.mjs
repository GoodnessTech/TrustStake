import fs from 'fs';

console.log('====================================================');
console.log('   TRUSTSTAKE PROTOCOL: MAINNET DEPLOYMENT SCRIPT   ');
console.log('====================================================');

const ALLOW_MAINNET_DEPLOY = process.env.ALLOW_MAINNET_DEPLOY === 'true';
const TRUSTSTAKE_ENV = process.env.TRUSTSTAKE_ENV;

// STRICT PROTECTIVE GUARD AS REQUIRED BY SECTION 8
if (!ALLOW_MAINNET_DEPLOY || TRUSTSTAKE_ENV !== 'mainnet') {
  console.error('\n[SAFETY REFUSAL] Mainnet deployment is strictly blocked!');
  console.error('Reason: ALLOW_MAINNET_DEPLOY is false or TRUSTSTAKE_ENV is not "mainnet".');
  console.error('TrustStake is currently targeting BOT Chain Testnet (Bohr).');
  console.error('DO NOT deploy to mainnet without explicit deliberate authorization.\n');
  process.exit(1);
}

console.log('Mainnet deployment authorized. Proceeding with caution...');
// The deployment logic follows the exact verified structure of deploy-testnet.mjs with Chain ID 677.
