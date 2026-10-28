import fs from 'fs';
import { AbiEvent, AbiFunction, Hex, Address } from 'ox';

const RPC_URL = process.env.BOT_TESTNET_RPC_URL || 'https://rpc.bohr.life';
const deployment = JSON.parse(fs.readFileSync('shared/deployment-testnet.json', 'utf8'));
const artifact = JSON.parse(fs.readFileSync('shared/TrustStakeCore.json', 'utf8'));
const contractAddress = deployment.contractAddress;
const startBlock = deployment.blockNumber;

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

export async function runIndexer() {
  console.log(`[INDEXER] Querying Bohr Testnet RPC for contract ${contractAddress}...`);

  const currentBlockHex = await rpcCall('eth_blockNumber');
  const currentBlock = parseInt(currentBlockHex, 16);
  const chainIdHex = await rpcCall('eth_chainId');
  const chainId = parseInt(chainIdHex, 16);

  // 1. Fetch raw logs
  const rawLogs = await rpcCall('eth_getLogs', [{
    address: contractAddress,
    fromBlock: `0x${startBlock.toString(16)}`,
    toBlock: 'latest'
  }]);

  console.log(`[INDEXER] Found ${rawLogs.length} raw onchain event logs.`);

  // 2. Decode logs using artifact ABI events
  const abiEvents = artifact.abi.filter(item => item.type === 'event');
  const decodedEvents = [];

  for (const log of rawLogs) {
    const topic0 = log.topics[0];
    const matchingEvent = abiEvents.find(ev => {
      try {
        const selector = AbiEvent.getSelector(ev);
        return selector.toLowerCase() === topic0.toLowerCase();
      } catch {
        return false;
      }
    });

    if (matchingEvent) {
      try {
        const decoded = AbiEvent.decode(matchingEvent, {
          data: log.data,
          topics: log.topics
        });
        decodedEvents.push({
          eventName: matchingEvent.name,
          blockNumber: parseInt(log.blockNumber, 16),
          transactionHash: log.transactionHash,
          args: serializeArgs(decoded),
          logIndex: parseInt(log.logIndex, 16)
        });
      } catch (err) {
        decodedEvents.push({
          eventName: matchingEvent.name,
          blockNumber: parseInt(log.blockNumber, 16),
          transactionHash: log.transactionHash,
          decodeError: err.message
        });
      }
    } else {
      decodedEvents.push({
        eventName: 'Unknown',
        topic0,
        transactionHash: log.transactionHash,
        blockNumber: parseInt(log.blockNumber, 16)
      });
    }
  }

  // 3. Reconcile Live Contract State
  const fnGetProviders = artifact.abi.find(item => item.name === 'getRegisteredProviders');
  const provAddrsRaw = await rpcCall('eth_call', [{
    to: contractAddress,
    data: AbiFunction.encodeData(fnGetProviders, [])
  }, 'latest']);
  const registeredAddresses = AbiFunction.decodeResult(fnGetProviders, provAddrsRaw);

  const providers = [];
  const fnGetProvider = artifact.abi.find(item => item.name === 'getProvider');
  const fnGetAvail = artifact.abi.find(item => item.name === 'getAvailableCollateral');

  for (const addr of registeredAddresses) {
    const pRaw = await rpcCall('eth_call', [{
      to: contractAddress,
      data: AbiFunction.encodeData(fnGetProvider, [addr])
    }, 'latest']);
    const pDecoded = AbiFunction.decodeResult(fnGetProvider, pRaw);

    const availRaw = await rpcCall('eth_call', [{
      to: contractAddress,
      data: AbiFunction.encodeData(fnGetAvail, [addr])
    }, 'latest']);
    const availableCollateral = BigInt(availRaw);

    providers.push({
      address: addr,
      name: pDecoded.name ?? pDecoded[2] ?? '',
      category: pDecoded.category ?? pDecoded[3] ?? '',
      metadataURI: pDecoded.metadataURI ?? pDecoded[4] ?? '',
      metadataHash: pDecoded.metadataHash ?? pDecoded[5] ?? '',
      totalCollateral: (pDecoded.totalCollateral ?? pDecoded[6] ?? 0n).toString(),
      totalCollateralBot: (Number(pDecoded.totalCollateral ?? pDecoded[6] ?? 0n) / 1e18).toFixed(4),
      lockedCollateral: (pDecoded.lockedCollateral ?? pDecoded[7] ?? 0n).toString(),
      lockedCollateralBot: (Number(pDecoded.lockedCollateral ?? pDecoded[7] ?? 0n) / 1e18).toFixed(4),
      availableCollateral: availableCollateral.toString(),
      availableCollateralBot: (Number(availableCollateral) / 1e18).toFixed(4),
      stats: {
        accepted: (pDecoded.stats?.commitmentsAccepted ?? pDecoded[8]?.[0] ?? 0n).toString(),
        completed: (pDecoded.stats?.commitmentsCompleted ?? pDecoded[8]?.[1] ?? 0n).toString(),
        failed: (pDecoded.stats?.failuresFinalized ?? pDecoded[8]?.[2] ?? 0n).toString(),
        disputed: (pDecoded.stats?.disputesRaised ?? pDecoded[8]?.[3] ?? 0n).toString(),
        appealed: (pDecoded.stats?.appealsRaised ?? pDecoded[8]?.[4] ?? 0n).toString()
      },
      isActive: Boolean(pDecoded.isActive ?? pDecoded[1])
    });
  }

  // 4. Fetch Commitments
  const fnCounter = artifact.abi.find(item => item.name === 'commitmentCounter');
  const countRaw = await rpcCall('eth_call', [{
    to: contractAddress,
    data: AbiFunction.encodeData(fnCounter, [])
  }, 'latest']);
  const commitmentCount = Number(BigInt(countRaw));

  const commitments = [];
  const fnGetCommitment = artifact.abi.find(item => item.name === 'getCommitment');
  const fnGetEvidence = artifact.abi.find(item => item.name === 'getCommitmentEvidence');

  const statusMap = [
    'Created', 'Cancelled', 'Accepted', 'Completed', 'Disputed',
    'Challenged', 'Arbitrated', 'Appealed', 'FinalArbitrated', 'Settled'
  ];
  const outcomeMap = ['None', 'ProviderSuccess', 'CustomerRefund', 'ProviderFault'];

  for (let i = 1; i <= commitmentCount; i++) {
    const cRaw = await rpcCall('eth_call', [{
      to: contractAddress,
      data: AbiFunction.encodeData(fnGetCommitment, [BigInt(i)])
    }, 'latest']);
    const cDecoded = AbiFunction.decodeResult(fnGetCommitment, cRaw);

    const evRaw = await rpcCall('eth_call', [{
      to: contractAddress,
      data: AbiFunction.encodeData(fnGetEvidence, [BigInt(i)])
    }, 'latest']);
    const evDecoded = AbiFunction.decodeResult(fnGetEvidence, evRaw);

    const statusNum = Number(cDecoded.state?.status ?? cDecoded[4]?.[0] ?? 0);
    const outcomeNum = Number(cDecoded.state?.finalOutcome ?? cDecoded[4]?.[1] ?? 0);

    commitments.push({
      id: i,
      provider: cDecoded.provider || cDecoded[1],
      customer: cDecoded.customer || cDecoded[2],
      terms: {
        reward: (cDecoded.terms?.reward ?? cDecoded[3]?.[2] ?? 0).toString(),
        rewardBot: (Number(cDecoded.terms?.reward ?? cDecoded[3]?.[2] ?? 0) / 1e18).toFixed(4),
        requiredCollateral: (cDecoded.terms?.requiredCollateral ?? cDecoded[3]?.[3] ?? 0).toString(),
        requiredCollateralBot: (Number(cDecoded.terms?.requiredCollateral ?? cDecoded[3]?.[3] ?? 0) / 1e18).toFixed(4),
        maxPenalty: (cDecoded.terms?.maxPenalty ?? cDecoded[3]?.[4] ?? 0).toString(),
        maxPenaltyBot: (Number(cDecoded.terms?.maxPenalty ?? cDecoded[3]?.[4] ?? 0) / 1e18).toFixed(4),
        deadline: Number(cDecoded.terms?.deadline ?? cDecoded[3]?.[5] ?? 0),
        primaryArbitrator: cDecoded.terms?.primaryArbitrator ?? cDecoded[3]?.[9],
        appealArbitrator: cDecoded.terms?.appealArbitrator ?? cDecoded[3]?.[10]
      },
      state: {
        status: statusMap[statusNum] || 'Unknown',
        statusCode: statusNum,
        finalOutcome: outcomeMap[outcomeNum] || 'None',
        settledAt: Number(cDecoded.state?.settledAt ?? cDecoded[4]?.[6] ?? 0)
      },
      evidenceCount: evDecoded.length,
      evidenceList: evDecoded.map(e => ({
        contentHash: e.contentHash || e[0],
        evidenceURI: e.evidenceURI || e[1],
        submitter: e.submitter || e[2],
        timestamp: Number(e.timestamp || e[3])
      }))
    });
  }

  // 5. Global Accounting Snapshot
  const fnTotalCollateral = artifact.abi.find(item => item.name === 'totalProtocolCollateral');
  const totColRaw = await rpcCall('eth_call', [{ to: contractAddress, data: AbiFunction.encodeData(fnTotalCollateral, []) }, 'latest']);
  const totalProtocolCollateral = BigInt(totColRaw);

  const fnTotalLocked = artifact.abi.find(item => item.name === 'totalProtocolLockedCollateral');
  const totLockRaw = await rpcCall('eth_call', [{ to: contractAddress, data: AbiFunction.encodeData(fnTotalLocked, []) }, 'latest']);
  const totalProtocolLocked = BigInt(totLockRaw);

  const fnTotalSettled = artifact.abi.find(item => item.name === 'totalSettlementsExecuted');
  const totSetRaw = await rpcCall('eth_call', [{ to: contractAddress, data: AbiFunction.encodeData(fnTotalSettled, []) }, 'latest']);
  const totalSettlements = Number(BigInt(totSetRaw));

  const indexerData = {
    network: 'BOT Chain Testnet (Bohr)',
    chainId,
    contractAddress,
    startBlock,
    currentBlock,
    indexedThroughBlock: currentBlock,
    indexingLag: 0,
    health: 'healthy',
    lastIndexedAt: new Date().toISOString(),
    protocolMetrics: {
      totalCollateralBot: (Number(totalProtocolCollateral) / 1e18).toFixed(4),
      totalLockedBot: (Number(totalProtocolLocked) / 1e18).toFixed(4),
      totalSettlements,
      activeCommitments: commitments.filter(c => c.state.status === 'Accepted' || c.state.status === 'Disputed').length,
      completedCommitments: commitments.filter(c => c.state.status === 'Settled' && c.state.finalOutcome === 'ProviderSuccess').length,
      registeredProvidersCount: providers.length
    },
    providers,
    commitments,
    events: decodedEvents
  };

  fs.mkdirSync('shared', { recursive: true });
  fs.writeFileSync('shared/indexer-cache.json', JSON.stringify(indexerData, null, 2));

  fs.mkdirSync('TrustStake Frontend/src/contracts', { recursive: true });
  fs.writeFileSync('TrustStake Frontend/src/contracts/indexer-cache.json', JSON.stringify(indexerData, null, 2));

  console.log(`[INDEXER] Indexing completed. Indexed ${providers.length} providers, ${commitments.length} commitments, ${decodedEvents.length} events.`);
  return indexerData;
}

function serializeArgs(obj) {
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeArgs);
  if (typeof obj === 'object' && obj !== null) {
    const res = {};
    for (const key of Object.keys(obj)) {
      res[key] = serializeArgs(obj[key]);
    }
    return res;
  }
  return obj;
}

if (process.argv[1]?.endsWith('indexer.mjs')) {
  runIndexer().catch(console.error);
}
