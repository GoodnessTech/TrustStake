import fs from 'fs';
import path from 'path';
import solc from 'solc';

console.log('--- Compiling TrustStake Smart Contracts ---');

const contractPath = path.resolve('contracts/src/TrustStakeCore.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'TrustStakeCore.sol': {
      content: source
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.gasEstimates']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  let hasError = false;
  for (const err of output.errors) {
    if (err.severity === 'error') {
      console.error('COMPILE ERROR:', err.formattedMessage);
      hasError = true;
    } else {
      console.warn('COMPILE WARNING:', err.formattedMessage);
    }
  }
  if (hasError) {
    console.error('Compilation failed due to errors.');
    throw new Error('Compilation failed');
  }
}

const contract = output.contracts['TrustStakeCore.sol']['TrustStakeCore'];
const bytecode = contract.evm.bytecode.object;
const deployedBytecode = contract.evm.deployedBytecode.object;
const abi = contract.abi;
const gasEstimates = contract.evm.gasEstimates;

console.log('Contract Name: TrustStakeCore');
console.log('Bytecode length:', bytecode.length / 2, 'bytes');
console.log('Deployed Bytecode length:', deployedBytecode.length / 2, 'bytes');
console.log('ABI functions count:', abi.filter(x => x.type === 'function').length);
console.log('Gas estimates creation execution cost:', gasEstimates?.creation?.executionCost || 'N/A');

// Save artifacts
const artifact = {
  contractName: 'TrustStakeCore',
  abi,
  bytecode: `0x${bytecode}`,
  deployedBytecode: `0x${deployedBytecode}`,
  gasEstimates,
  compiler: {
    version: solc.version(),
    optimizer: { enabled: true, runs: 200 }
  },
  compiledAt: new Date().toISOString()
};

fs.mkdirSync('shared', { recursive: true });
fs.writeFileSync('shared/TrustStakeCore.json', JSON.stringify(artifact, null, 2));

fs.mkdirSync('TrustStake Frontend/src/contracts', { recursive: true });
fs.writeFileSync('TrustStake Frontend/src/contracts/TrustStakeCore.json', JSON.stringify(artifact, null, 2));

console.log('Artifacts successfully saved to:');
console.log(' - shared/TrustStakeCore.json');
console.log(' - TrustStake Frontend/src/contracts/TrustStakeCore.json');
