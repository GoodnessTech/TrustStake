import deployment from './contracts/deployment-testnet.json';
import artifact from './contracts/TrustStakeCore.json';
import receipts from './contracts/lifecycle-receipts.json';
import indexerData from './contracts/indexer-cache.json';

export const BOHR_CHAIN_ID = 968;
export const BOHR_CHAIN_ID_HEX = '0x3c8';
export const BOHR_RPC_URL = 'https://rpc.bohr.life';
export const BOHR_EXPLORER_URL = 'https://scan.bohr.life';
export const CONTRACT_ADDRESS = deployment.contractAddress;
export const CONTRACT_ABI = artifact.abi;

export const INITIAL_INDEXER_DATA = indexerData;
export const VERIFIED_RECEIPTS = receipts.transactions;

export interface Web3State {
  account: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  botBalance: string;
  isConnecting: boolean;
  error: string | null;
}

export async function requestBohrNetwork(): Promise<boolean> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) return false;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BOHR_CHAIN_ID_HEX }]
    });
    return true;
  } catch (switchError: any) {
    if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BOHR_CHAIN_ID_HEX,
            chainName: 'BOT Chain Testnet',
            nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
            rpcUrls: [BOHR_RPC_URL],
            blockExplorerUrls: [BOHR_EXPLORER_URL]
          }]
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export async function getLiveBalance(address: string): Promise<string> {
  try {
    const res = await fetch(BOHR_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
    });
    const data = await res.json();
    if (data.result) {
      const wei = BigInt(data.result);
      return (Number(wei) / 1e18).toFixed(4);
    }
  } catch (e) {
    console.error('Error reading balance:', e);
  }
  return '0.0000';
}
