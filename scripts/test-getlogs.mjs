import fs from 'fs';

const deployment = JSON.parse(fs.readFileSync('shared/deployment-testnet.json', 'utf8'));
const contractAddress = deployment.contractAddress;
const startBlock = deployment.blockNumber;

async function checkGetLogs() {
  const rpc = 'https://rpc.bohr.life';

  console.log(`Testing eth_getLogs for contract ${contractAddress} from block ${startBlock}...`);

  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getLogs',
      params: [{
        address: contractAddress,
        fromBlock: `0x${startBlock.toString(16)}`,
        toBlock: 'latest'
      }]
    })
  }).then(r => r.json());

  if (res.error) {
    console.warn('eth_getLogs returned error:', res.error);
    console.log('Using state-polling & receipt-based event observation adapter.');
  } else {
    console.log(`✓ eth_getLogs SUCCEEDED! Retrieved ${res.result.length} log events from Bohr testnet.`);
  }
}

checkGetLogs().catch(console.error);
