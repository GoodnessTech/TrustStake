# TrustStake: Deployment & Operations Guide

## 1. Network Environments

### Active Target: BOT Chain Testnet (Bohr)
- **Chain ID**: `968` (`0x3c8`)
- **RPC Endpoint**: `https://rpc.bohr.life`
- **Block Explorer**: `https://scan.bohr.life`
- **Native Currency**: `BOT` (18 Decimals)
- **Contract Address**: `0xcb68b99e5b02b1e6a6aee361089e1adcdacefe00`
- **Deployment Transaction**: `0x0e8cf1456562d8f76b4fe3a299eba2378f973fdafa94b740829e92d49bfe0630`
- **Block Number**: `28439734`

### Prepared Target: BOT Chain Mainnet (DO NOT DEPLOY)
- **Chain ID**: `677`
- **RPC Endpoint**: `https://rpc.botchain.ai`
- **Block Explorer**: `https://scan.botchain.ai`
- **Protective Guard**: `ALLOW_MAINNET_DEPLOY=false`

---

## 2. Reproducible Development Commands

### Compilation
```bash
npm run compile # or node scripts/compile.mjs
```

### Pre-Deployment Verification Tests
```bash
npm run test:contracts # or node scripts/test-contracts.mjs
```

### Testnet Deployment
```bash
npm run deploy:testnet # or node scripts/deploy-testnet.mjs
```

### End-to-End Lifecycle Execution
```bash
node scripts/execute-lifecycle.mjs
```

### Event Indexer & Sync
```bash
npm run indexer # or node services/indexer.mjs
```

### Mainnet Preflight Checks
```bash
npm run preflight:mainnet # or node scripts/preflight-mainnet.mjs
```

### Mainnet Deployment (Protected)
```bash
npm run deploy:mainnet # Refuses execution unless ALLOW_MAINNET_DEPLOY=true and TRUSTSTAKE_ENV=mainnet
```

### Frontend Development Server
```bash
cd "TrustStake Frontend"
npm run dev
```

---

## 3. Mainnet Readiness Checklist
- [x] Solidity compiler configured with optimizer (200 runs) and EVM Cancun/Paris compatibility.
- [x] Spurious Dragon bytecode size limit verified (16.33 KB < 24.576 KB).
- [x] Real-life testnet deployment verified on Bohr Testnet.
- [x] 13 end-to-end lifecycle transactions executed onchain.
- [x] Mainnet preflight script implemented and passing.
- [x] Protective guard `ALLOW_MAINNET_DEPLOY=false` enforced.
- [x] Clickable official BOT Chain and BotScan links present in footer.
