import 'dotenv/config';
import { createPublicClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: No PRIVATE_KEY in .env');
    process.exit(1);
  }

  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey);

  console.log('--- TrustStake Wallet Status ---');
  console.log('Account Address:', account.address);

  const bohrTestnet = {
    id: 968,
    name: 'BOT Chain Testnet',
    nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.bohr.life'] } }
  };

  const client = createPublicClient({
    chain: bohrTestnet,
    transport: http()
  });

  try {
    const chainId = await client.getChainId();
    const balance = await client.getBalance({ address: account.address });
    const blockNumber = await client.getBlockNumber();

    console.log('Connected Chain ID:', chainId);
    console.log('Latest Block Number:', blockNumber.toString());
    console.log('Native BOT Balance:', formatEther(balance), 'BOT');
  } catch (err) {
    console.error('Error fetching balance from Bohr Testnet:', err);
  }

  process.exit(0);
}

main();
