import fs from 'fs';
import { Secp256k1, Address, Hex, Hash, AbiParameters, TxEnvelopeLegacy } from 'ox';

console.log('====================================================');
console.log('   TRUSTSTAKE PROTOCOL: BOT CHAIN TESTNET DEPLOYMENT ');
console.log('====================================================');

const RPC_URL = process.env.BOT_TESTNET_RPC_URL || 'https://rpc.bohr.life';
const EXPECTED_CHAIN_ID = 968;
const EXPLORER_URL = 'https://scan.bohr.life';

// 1. Read Private Key & Setup Account
const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/PRIVATE_KEY=([a-fA-F0-9x]+)/);
if (!match) {
  console.error('FATAL: PRIVATE_KEY not found in .env');
  process.exit(1);
}
const rawKey = match[1].trim();
const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
const publicKey = Secp256k1.getPublicKey({ privateKey });
const deployerAddress = Address.fromPublicKey(publicKey);

console.log('Deployer Address:', deployerAddress);

async function rpcCall(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`RPC Error [${method}]: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

async function main() {
  // 2. Validate Chain ID
  console.log('\n[1/5] Validating Network Connection...');
  const chainIdHex = await rpcCall('eth_chainId');
  const chainId = parseInt(chainIdHex, 16);
  console.log(`Connected Chain ID: ${chainId} (Expected: ${EXPECTED_CHAIN_ID})`);
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Chain ID mismatch! Connected to ${chainId}, expected ${EXPECTED_CHAIN_ID}`);
  }

  const balanceHex = await rpcCall('eth_getBalance', [deployerAddress, 'latest']);
  const balanceWei = BigInt(balanceHex);
  const balanceEth = Number(balanceWei) / 1e18;
  console.log(`Deployer Balance: ${balanceEth.toFixed(4)} BOT`);
  if (balanceWei < 100000000000000000n) { // 0.1 BOT min
    throw new Error('Insufficient BOT balance for deployment!');
  }

  const nonceHex = await rpcCall('eth_getTransactionCount', [deployerAddress, 'latest']);
  const nonce = BigInt(nonceHex);
  console.log(`Current Account Nonce: ${nonce}`);

  const gasPriceHex = await rpcCall('eth_gasPrice');
  const gasPrice = BigInt(gasPriceHex);
  console.log(`Network Gas Price: ${gasPrice} wei (${Number(gasPrice) / 1e9} Gwei)`);

  // 3. Load Artifact & Encode Constructor Args
  console.log('\n[2/5] Preparing Contract Bytecode & Constructor Arguments...');
  const artifact = JSON.parse(fs.readFileSync('shared/TrustStakeCore.json', 'utf8'));
  const constructorAbi = artifact.abi.find(item => item.type === 'constructor');

  // Args: _feeRecipient (deployer), _feeBps (100 = 1%)
  const constructorArgs = [deployerAddress, 100n];
  const encodedArgs = AbiParameters.encode(constructorAbi.inputs, constructorArgs);
  console.log('Constructor Fee Recipient:', deployerAddress);
  console.log('Constructor Fee Bps:', 100, '(1%)');

  const deploymentData = Hex.concat(artifact.bytecode, encodedArgs);
  console.log(`Total Deployment Payload: ${(deploymentData.length - 2) / 2} bytes`);

  // 4. Estimate Gas & Construct Transaction
  console.log('\n[3/5] Estimating Deployment Gas...');
  let gasLimit = 6000000n;
  try {
    const estGasHex = await rpcCall('eth_estimateGas', [{
      from: deployerAddress,
      data: deploymentData
    }]);
    gasLimit = (BigInt(estGasHex) * 12n) / 10n; // 20% buffer
    console.log(`Estimated Gas (with 20% buffer): ${gasLimit}`);
  } catch (e) {
    console.warn('Could not estimate gas, using default limit of 6,000,000');
  }

  // 5. Sign & Broadcast Transaction
  console.log('\n[4/5] Signing & Broadcasting Deployment Transaction...');
  const envelope = TxEnvelopeLegacy.from({
    nonce,
    gasPrice,
    gas: gasLimit,
    to: null,
    value: 0n,
    data: deploymentData,
    chainId
  });

  const signPayload = TxEnvelopeLegacy.getSignPayload(envelope);
  const signature = Secp256k1.sign({ payload: signPayload, privateKey });
  const signedTx = TxEnvelopeLegacy.serialize(envelope, { signature });

  const txHash = await rpcCall('eth_sendRawTransaction', [signedTx]);
  console.log('Broadcasted Transaction Hash:', txHash);
  console.log(`Explorer Link: ${EXPLORER_URL}/tx/${txHash}`);

  // 6. Wait for Confirmation
  console.log('\n[5/5] Waiting for Block Confirmation...');
  let receipt = null;
  const startTime = Date.now();
  while (!receipt && Date.now() - startTime < 120000) {
    await new Promise(r => setTimeout(r, 3000));
    receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
  }

  if (!receipt) {
    throw new Error('Transaction confirmation timed out after 120 seconds!');
  }

  console.log('Transaction Status:', receipt.status === '0x1' ? 'SUCCESS (1)' : 'FAILED (0)');
  if (receipt.status !== '0x1') {
    throw new Error(`Deployment transaction failed! Gas used: ${parseInt(receipt.gasUsed, 16)}`);
  }

  const contractAddress = receipt.contractAddress;
  const gasUsed = parseInt(receipt.gasUsed, 16);
  const blockNumber = parseInt(receipt.blockNumber, 16);

  console.log('----------------------------------------------------');
  console.log('✓ TRUSTSTAKE DEPLOYED SUCCESSFULLY TO BOT CHAIN TESTNET!');
  console.log('Contract Address:', contractAddress);
  console.log('Block Number:    ', blockNumber);
  console.log('Gas Used:        ', gasUsed);
  console.log('Explorer URL:    ', `${EXPLORER_URL}/address/${contractAddress}`);
  console.log('----------------------------------------------------');

  // 7. Verify Bytecode onchain
  const onchainCode = await rpcCall('eth_getCode', [contractAddress, 'latest']);
  if (!onchainCode || onchainCode === '0x') {
    throw new Error('Verification failed: No bytecode found at deployed contract address!');
  }
  console.log(`✓ Verified onchain bytecode: ${(onchainCode.length - 2) / 2} bytes`);

  // 8. Write Manifests
  const manifest = {
    network: 'BOT Chain Testnet (Bohr)',
    chainId,
    contractName: 'TrustStakeCore',
    contractAddress,
    deployerAddress,
    feeRecipient: deployerAddress,
    protocolFeeBps: 100,
    deploymentTxHash: txHash,
    blockNumber,
    gasUsed,
    rpcUrl: RPC_URL,
    explorerUrl: EXPLORER_URL,
    contractExplorerUrl: `${EXPLORER_URL}/address/${contractAddress}`,
    deployedAt: new Date().toISOString()
  };

  fs.mkdirSync('shared', { recursive: true });
  fs.writeFileSync('shared/deployment-testnet.json', JSON.stringify(manifest, null, 2));

  fs.mkdirSync('TrustStake Frontend/src/contracts', { recursive: true });
  fs.writeFileSync('TrustStake Frontend/src/contracts/deployment-testnet.json', JSON.stringify(manifest, null, 2));

  console.log('✓ Deployment manifest saved to:');
  console.log('  - shared/deployment-testnet.json');
  console.log('  - TrustStake Frontend/src/contracts/deployment-testnet.json');
}

main().catch(err => {
  console.error('\nDEPLOYMENT FAILED:', err);
});
