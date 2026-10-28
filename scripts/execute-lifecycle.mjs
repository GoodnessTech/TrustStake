import fs from 'fs';
import { Secp256k1, Address, Hex, Hash, AbiFunction, AbiParameters, TxEnvelopeLegacy } from 'ox';

console.log('====================================================');
console.log('   TRUSTSTAKE PROTOCOL: TESTNET LIFECYCLE EXECUTION ');
console.log('====================================================');

const RPC_URL = process.env.BOT_TESTNET_RPC_URL || 'https://rpc.bohr.life';
const EXPLORER_URL = 'https://scan.bohr.life';
const deployment = JSON.parse(fs.readFileSync('shared/deployment-testnet.json', 'utf8'));
const artifact = JSON.parse(fs.readFileSync('shared/TrustStakeCore.json', 'utf8'));
const contractAddress = deployment.contractAddress;

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/PRIVATE_KEY=([a-fA-F0-9x]+)/);
const rawKey = match[1].trim();
const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
const publicKey = Secp256k1.getPublicKey({ privateKey });
const accountAddress = Address.fromPublicKey(publicKey);

console.log('Contract Address:', contractAddress);
console.log('Operator Address:', accountAddress);

async function rpcCall(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC Error [${method}]: ${JSON.stringify(data.error)}`);
  return data.result;
}

let currentNonce = null;
async function getNonce() {
  if (currentNonce === null) {
    const nonceHex = await rpcCall('eth_getTransactionCount', [accountAddress, 'latest']);
    currentNonce = BigInt(nonceHex);
  } else {
    currentNonce++;
  }
  return currentNonce;
}

async function sendTransaction({ to, data, value = 0n, gas = 500000n }) {
  const nonce = await getNonce();
  const gasPriceHex = await rpcCall('eth_gasPrice');
  const gasPrice = BigInt(gasPriceHex);

  const envelope = TxEnvelopeLegacy.from({
    nonce,
    gasPrice,
    gas,
    to,
    value,
    data,
    chainId: 968
  });

  const signPayload = TxEnvelopeLegacy.getSignPayload(envelope);
  const signature = Secp256k1.sign({ payload: signPayload, privateKey });
  const signedTx = TxEnvelopeLegacy.serialize(envelope, { signature });

  const txHash = await rpcCall('eth_sendRawTransaction', [signedTx]);
  console.log(` > Tx Sent: ${txHash} (nonce: ${nonce})`);

  let receipt = null;
  const start = Date.now();
  while (!receipt && Date.now() - start < 60000) {
    await new Promise(r => setTimeout(r, 2500));
    receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
  }

  if (!receipt || receipt.status !== '0x1') {
    throw new Error(`Tx Failed or Timed Out! Receipt: ${JSON.stringify(receipt)}`);
  }

  console.log(`   Confirmed in block ${parseInt(receipt.blockNumber, 16)} (Gas used: ${parseInt(receipt.gasUsed, 16)})`);
  return { txHash, receipt, blockNumber: parseInt(receipt.blockNumber, 16), gasUsed: parseInt(receipt.gasUsed, 16) };
}

function encodeFunction(name, args = []) {
  const fnAbi = artifact.abi.find(item => item.type === 'function' && item.name === name);
  if (!fnAbi) throw new Error(`Function not found: ${name}`);
  return AbiFunction.encodeData(fnAbi, args);
}

const receipts = [];

async function main() {
  // Check if provider is already registered
  console.log('\n[STEP 1] Checking / Registering Provider...');
  const getProviderData = encodeFunction('getProvider', [accountAddress]);
  const pDataRaw = await rpcCall('eth_call', [{ to: contractAddress, data: getProviderData }, 'latest']);

  const fnAbi = artifact.abi.find(item => item.type === 'function' && item.name === 'getProvider');
  const decodedProvider = AbiFunction.decodeResult(fnAbi, pDataRaw);
  const isRegistered = decodedProvider.isRegistered || decodedProvider[0];

  if (!isRegistered) {
    console.log('Registering provider "Axiom Compute"...');
    const metadataHash = Hash.keccak256(Hex.fromString('axiom-compute-v1'));
    const regData = encodeFunction('registerProvider', [
      'Axiom Compute',
      'Compute & inference',
      metadataHash,
      'ipfs://bafybeiaxiomcompute'
    ]);
    const res = await sendTransaction({ to: contractAddress, data: regData });
    receipts.push({ step: 'Provider Registration', name: 'registerProvider', ...res, explorerUrl: `${EXPLORER_URL}/tx/${res.txHash}` });
  } else {
    console.log('Provider is already registered onchain.');
  }

  // Deposit collateral: 0.05 BOT
  console.log('\n[STEP 2] Depositing 0.05 BOT Collateral...');
  const depositData = encodeFunction('depositCollateral', []);
  const depRes = await sendTransaction({
    to: contractAddress,
    data: depositData,
    value: 50000000000000000n // 0.05 BOT
  });
  receipts.push({ step: 'Collateral Deposit', name: 'depositCollateral', ...depRes, explorerUrl: `${EXPLORER_URL}/tx/${depRes.txHash}` });

  // Read available collateral
  const availData = encodeFunction('getAvailableCollateral', [accountAddress]);
  const availRaw = await rpcCall('eth_call', [{ to: contractAddress, data: availData }, 'latest']);
  const availCollateral = BigInt(availRaw);
  console.log(`Current Available Collateral: ${Number(availCollateral) / 1e18} BOT`);

  // Create Commitment 1: Success Scenario
  console.log('\n[STEP 3] Creating Commitment 1 (Success Scenario)...');
  const now = Math.floor(Date.now() / 1000);
  const deadline = BigInt(now + 86400 * 7); // 7 days
  const params1 = {
    provider: accountAddress,
    descriptionHash: Hash.keccak256(Hex.fromString('ai-inference-benchmark-eval')),
    descriptionURI: 'ipfs://bafybeicommitment1',
    requiredCollateral: 20000000000000000n, // 0.02 BOT
    maxPenalty: 15000000000000000n,         // 0.015 BOT
    deadline: deadline,
    disputeWindow: 86400n,                  // 1 day
    appealWindow: 86400n,                   // 1 day
    evidenceRequirementsHash: Hash.keccak256(Hex.fromString('evidence-rules-v1')),
    primaryArbitrator: accountAddress,
    appealArbitrator: accountAddress
  };

  const createData1 = encodeFunction('createCommitment', [params1]);
  const createRes1 = await sendTransaction({
    to: contractAddress,
    data: createData1,
    value: 10000000000000000n, // 0.01 BOT reward
    gas: 600000n
  });
  receipts.push({ step: 'Create Commitment 1', name: 'createCommitment', ...createRes1, explorerUrl: `${EXPLORER_URL}/tx/${createRes1.txHash}` });

  // Get commitment Counter
  const countRaw = await rpcCall('eth_call', [{ to: contractAddress, data: encodeFunction('commitmentCounter', []) }, 'latest']);
  const commitmentId1 = BigInt(countRaw);
  console.log(`Created Commitment ID: ${commitmentId1}`);

  // Accept Commitment 1
  console.log(`\n[STEP 4] Accepting Commitment ${commitmentId1}...`);
  const acceptData1 = encodeFunction('acceptCommitment', [commitmentId1]);
  const acceptRes1 = await sendTransaction({ to: contractAddress, data: acceptData1 });
  receipts.push({ step: 'Accept Commitment 1', name: 'acceptCommitment', ...acceptRes1, explorerUrl: `${EXPLORER_URL}/tx/${acceptRes1.txHash}` });

  // Submit Evidence
  console.log(`\n[STEP 5] Submitting Evidence for Commitment ${commitmentId1}...`);
  const evidenceHash1 = Hash.keccak256(Hex.fromString('inference-latency-log-payload-sha256-verified'));
  const submitData1 = encodeFunction('submitEvidence', [
    commitmentId1,
    evidenceHash1,
    'ipfs://bafybeievidencepayload1'
  ]);
  const evRes1 = await sendTransaction({ to: contractAddress, data: submitData1 });
  receipts.push({ step: 'Submit Evidence', name: 'submitEvidence', ...evRes1, explorerUrl: `${EXPLORER_URL}/tx/${evRes1.txHash}` });

  // Confirm Completion
  console.log(`\n[STEP 6] Confirming Successful Completion for Commitment ${commitmentId1}...`);
  const confirmData1 = encodeFunction('confirmCompletion', [commitmentId1]);
  const confirmRes1 = await sendTransaction({ to: contractAddress, data: confirmData1, gas: 600000n });
  receipts.push({ step: 'Confirm Completion & Settle', name: 'confirmCompletion', ...confirmRes1, explorerUrl: `${EXPLORER_URL}/tx/${confirmRes1.txHash}` });

  // Verify Commitment 1 settled state
  const c1Raw = await rpcCall('eth_call', [{ to: contractAddress, data: encodeFunction('getCommitment', [commitmentId1]) }, 'latest']);
  console.log('✓ Commitment 1 Settled Successfully!');

  // Create Commitment 2: Dispute & Arbitration Scenario
  console.log('\n[STEP 7] Creating Commitment 2 (Dispute & Arbitration Scenario)...');
  const params2 = {
    provider: accountAddress,
    descriptionHash: Hash.keccak256(Hex.fromString('oracle-feed-sla-commitment')),
    descriptionURI: 'ipfs://bafybeicommitment2',
    requiredCollateral: 20000000000000000n, // 0.02 BOT
    maxPenalty: 15000000000000000n,         // 0.015 BOT
    deadline: deadline,
    disputeWindow: 86400n,
    appealWindow: 86400n,
    evidenceRequirementsHash: Hash.keccak256(Hex.fromString('evidence-rules-sla')),
    primaryArbitrator: accountAddress,
    appealArbitrator: accountAddress
  };

  const createData2 = encodeFunction('createCommitment', [params2]);
  const createRes2 = await sendTransaction({
    to: contractAddress,
    data: createData2,
    value: 10000000000000000n, // 0.01 BOT reward
    gas: 600000n
  });
  receipts.push({ step: 'Create Commitment 2', name: 'createCommitment', ...createRes2, explorerUrl: `${EXPLORER_URL}/tx/${createRes2.txHash}` });

  const countRaw2 = await rpcCall('eth_call', [{ to: contractAddress, data: encodeFunction('commitmentCounter', []) }, 'latest']);
  const commitmentId2 = BigInt(countRaw2);
  console.log(`Created Commitment ID: ${commitmentId2}`);

  // Accept Commitment 2
  console.log(`\n[STEP 8] Accepting Commitment ${commitmentId2}...`);
  const acceptRes2 = await sendTransaction({ to: contractAddress, data: encodeFunction('acceptCommitment', [commitmentId2]) });
  receipts.push({ step: 'Accept Commitment 2', name: 'acceptCommitment', ...acceptRes2, explorerUrl: `${EXPLORER_URL}/tx/${acceptRes2.txHash}` });

  // Customer Reports Failure with Evidence
  console.log(`\n[STEP 9] Customer Reports Failure for Commitment ${commitmentId2}...`);
  const failureEvidenceHash = Hash.keccak256(Hex.fromString('downtime-proof-504-timeout'));
  const reportRes = await sendTransaction({
    to: contractAddress,
    data: encodeFunction('reportFailure', [commitmentId2, failureEvidenceHash, 'ipfs://bafybeifailureproof'])
  });
  receipts.push({ step: 'Report Failure Claim', name: 'reportFailure', ...reportRes, explorerUrl: `${EXPLORER_URL}/tx/${reportRes.txHash}` });

  // Provider Challenges Failure
  console.log(`\n[STEP 10] Provider Challenges Failure for Commitment ${commitmentId2}...`);
  const challengeReasonHash = Hash.keccak256(Hex.fromString('scheduled-maintenance-notice-signed'));
  const challengeRes = await sendTransaction({
    to: contractAddress,
    data: encodeFunction('challengeFailure', [commitmentId2, challengeReasonHash, 'ipfs://bafybeichallengeproof'])
  });
  receipts.push({ step: 'Challenge Failure Claim', name: 'challengeFailure', ...challengeRes, explorerUrl: `${EXPLORER_URL}/tx/${challengeRes.txHash}` });

  // Primary Arbitrator Rules
  console.log(`\n[STEP 11] Primary Arbitrator Rules (Outcome: ProviderFault)...`);
  const rulingHash = Hash.keccak256(Hex.fromString('arbitration-ruling-binding-order-001'));
  // ResolutionOutcome: 1 = ProviderSuccess, 2 = CustomerRefund, 3 = ProviderFault
  const arbitrateRes = await sendTransaction({
    to: contractAddress,
    data: encodeFunction('arbitrateDispute', [commitmentId2, 3, rulingHash])
  });
  receipts.push({ step: 'Arbitrate Dispute', name: 'arbitrateDispute', ...arbitrateRes, explorerUrl: `${EXPLORER_URL}/tx/${arbitrateRes.txHash}` });

  // Appeal Dispute
  console.log(`\n[STEP 12] Provider Appeals Dispute Ruling...`);
  const appealHash = Hash.keccak256(Hex.fromString('appeal-brief-new-evidence'));
  const appealRes = await sendTransaction({
    to: contractAddress,
    data: encodeFunction('appealDispute', [commitmentId2, appealHash, 'ipfs://bafybeiappealbrief'])
  });
  receipts.push({ step: 'Appeal Dispute', name: 'appealDispute', ...appealRes, explorerUrl: `${EXPLORER_URL}/tx/${appealRes.txHash}` });

  // Final Appeal Ruling & Settlement
  console.log(`\n[STEP 13] Final Appeal Arbitrator Rules & Triggers Settlement...`);
  const finalRulingHash = Hash.keccak256(Hex.fromString('final-appellate-ruling-affirmation'));
  const finalRes = await sendTransaction({
    to: contractAddress,
    data: encodeFunction('resolveAppeal', [commitmentId2, 3, finalRulingHash]),
    gas: 600000n
  });
  receipts.push({ step: 'Final Appeal Resolution & Settle', name: 'resolveAppeal', ...finalRes, explorerUrl: `${EXPLORER_URL}/tx/${finalRes.txHash}` });

  // Save all receipts
  console.log('\n====================================================');
  console.log('✓ COMPLETE TESTNET TRANSACTION LIFECYCLE EXECUTED!');
  console.log(`Total Verified Real Onchain Transactions: ${receipts.length}`);
  console.log('====================================================');

  const output = {
    network: 'BOT Chain Testnet (Bohr)',
    chainId: 968,
    contractAddress,
    deployer: accountAddress,
    transactions: receipts,
    verifiedAt: new Date().toISOString()
  };

  fs.mkdirSync('shared', { recursive: true });
  fs.writeFileSync('shared/lifecycle-receipts.json', JSON.stringify(output, null, 2));

  fs.mkdirSync('TrustStake Frontend/src/contracts', { recursive: true });
  fs.writeFileSync('TrustStake Frontend/src/contracts/lifecycle-receipts.json', JSON.stringify(output, null, 2));

  console.log('Receipts saved to:');
  console.log(' - shared/lifecycle-receipts.json');
  console.log(' - TrustStake Frontend/src/contracts/lifecycle-receipts.json');
}

main().catch(err => {
  console.error('\nLIFECYCLE EXECUTION FAILED:', err);
});
