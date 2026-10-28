# TrustStake Protocol

> **Reliability backed by collateral.**  
> A stake-backed reliability marketplace for human service providers and autonomous AI agents on **BOT Chain**.

[![BOT Chain Testnet](https://img.shields.io/badge/Network-BOT%20Chain%20Testnet%20(Bohr)-orange)](https://scan.bohr.life)
[![Chain ID](https://img.shields.io/badge/Chain%20ID-968-blue)](https://rpc.bohr.life)
[![Contract](https://img.shields.io/badge/Contract-0xcb68b99e5b02b1e6a6aee361089e1adcdacefe00-green)](https://scan.bohr.life/address/0xcb68b99e5b02b1e6a6aee361089e1adcdacefe00)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 1. Overview
TrustStake makes service commitments measurable, collateralized, and accountable.
- **Providers** stake native BOT collateral against measurable service agreements.
- **Customers** fund agreed rewards and specify required collateral, maximum agreed penalties, and evidence requirements.
- **Settlement** enforces predefined economic rules trustlessly:
  - Successful commitments release locked collateral and pay agreed rewards.
  - Confirmed failures apply agreed collateral penalties to customers.
  - Disputed commitments remain frozen in an auditable primary and appeal arbitration process.
  - Reliability records accumulate from settled onchain commitments only.

---

## 2. Deployed Contract Information

| Parameter | Value |
|---|---|
| **Network** | BOT Chain Testnet (Bohr) |
| **Chain ID** | `968` (`0x3c8`) |
| **Contract Name** | `TrustStakeCore` |
| **Contract Address** | [`0xcb68b99e5b02b1e6a6aee361089e1adcdacefe00`](https://scan.bohr.life/address/0xcb68b99e5b02b1e6a6aee361089e1adcdacefe00) |
| **Deployment Transaction** | [`0x0e8cf1456562d8f76b4fe3a299eba2378f973fdafa94b740829e92d49bfe0630`](https://scan.bohr.life/tx/0x0e8cf1456562d8f76b4fe3a299eba2378f973fdafa94b740829e92d49bfe0630) |
| **Deployment Block** | `28439734` |
| **Gas Used** | `3,678,088` |
| **Bytecode Size** | `16,333` bytes (EIP-170 compliant) |
| **RPC Endpoint** | [https://rpc.bohr.life](https://rpc.bohr.life) |
| **Block Explorer** | [https://scan.bohr.life](https://scan.bohr.life) |

---

## 3. Verified Testnet Lifecycle Transactions

The full lifecycle has been executed on Bohr Testnet with 13 confirmed transactions:

| Step | Action | Tx Hash | Block | Status |
|---|---|---|---|---|
| **01** | Provider Registration (`registerProvider`) | [`0x28b17dc7...`](https://scan.bohr.life/tx/0x28b17dc723fb6c5a7c8829d7f3a2c9393cb623a175296282748d09776573f8e0) | 28440286 | Confirmed |
| **02** | Collateral Deposit (`depositCollateral`) | [`0x45817aaf...`](https://scan.bohr.life/tx/0x45817aafb67c859d139796c9477392241c0b676e42394af645593fd6c48c1ef7) | 28440292 | Confirmed |
| **03** | Create Commitment 1 (`createCommitment`) | [`0xd9a05c7e...`](https://scan.bohr.life/tx/0xd9a05c7eea95f629a745f7fcdaa1c86484eae37a5079ce607bb7b7c482163c2c) | 28440298 | Confirmed |
| **04** | Accept Commitment 1 (`acceptCommitment`) | [`0x98d9be9e...`](https://scan.bohr.life/tx/0x98d9be9e7f062060af36abcf551db9760c56fce2bb4fedc671499ece1d5389e9) | 28440306 | Confirmed |
| **05** | Submit Evidence (`submitEvidence`) | [`0x0ba89b37...`](https://scan.bohr.life/tx/0x0ba89b37fa03364c9c247efbd06123c545b64503127246cd3f71570dc150a433) | 28440311 | Confirmed |
| **06** | Confirm & Settle Success (`confirmCompletion`) | [`0xd0c0bb87...`](https://scan.bohr.life/tx/0xd0c0bb8727133297706825506aadb515cb55fca9c452ea7b533ef27c4cf6234d) | 28440316 | Confirmed |
| **07** | Create Commitment 2 (`createCommitment`) | [`0x1cf6da40...`](https://scan.bohr.life/tx/0x1cf6da4009e4beab47cb686afd0c39130cfe9da1127a3e34e2677a009357e183) | 28440322 | Confirmed |
| **08** | Accept Commitment 2 (`acceptCommitment`) | [`0xee02aef8...`](https://scan.bohr.life/tx/0xee02aef8419c7def89c43869f5728175d882dc552f38746d5b19fc0eea03c284) | 28440329 | Confirmed |
| **09** | Report Failure Claim (`reportFailure`) | [`0x14d9a657...`](https://scan.bohr.life/tx/0x14d9a657b884ad3ab14fe3c8132ccb98d00a77d279a23b534b05a478d5581006) | 28440334 | Confirmed |
| **10** | Challenge Claim (`challengeFailure`) | [`0xa452d6a5...`](https://scan.bohr.life/tx/0xa452d6a597d4bdc1f82922ee65e6e1f9882c273a68291c3a2f39a7b176aa3b1f) | 28440361 | Confirmed |
| **11** | Primary Arbitration (`arbitrateDispute`) | [`0xfcebea58...`](https://scan.bohr.life/tx/0xfcebea587e3d1d1949b3bc258592349afc79983805449683fe1f8d6e5a21207f) | 28440365 | Confirmed |
| **12** | Appeal Dispute (`appealDispute`) | [`0xd301e95b...`](https://scan.bohr.life/tx/0xd301e95bf86f2661e8d07ea911e43f5202d83d3b83188873b21ed407c2ad6127) | 28440374 | Confirmed |
| **13** | Appeal Ruling & Final Settle (`resolveAppeal`) | [`0xc515c154...`](https://scan.bohr.life/tx/0xc515c15454904b241be9728ae8f7d6f7831f34eb5db25b2d09a32a1374357d09) | 28440381 | Confirmed |

---

## 4. Repository Structure

```
truststake/
├── contracts/
│   ├── src/TrustStakeCore.sol        # Core protocol smart contract
│   ├── test/TrustStakeCore.t.sol     # Comprehensive Foundry test suite
│   └── foundry.toml                  # Foundry project configuration
├── docs/
│   ├── ARCHITECTURE.md               # Complete protocol architecture specification
│   ├── SECURITY.md                   # Security properties, invariants & bounds
│   ├── THREAT_MODEL.md               # Adversarial threat vectors & mitigations
│   ├── ADVERSARIAL_TESTING.md        # Adversarial attack tests & gas profiling
│   ├── DEPLOYMENT.md                 # Testnet & mainnet operations guide
│   └── PROTOCOL_RULES.md             # Formal state transition rules
├── evidence/
│   └── samples/                      # Hashed evidence payload samples
├── scripts/
│   ├── compile.mjs                   # solc optimizer compiler
│   ├── test-contracts.mjs            # Invariant, ABI & bytecode test runner
│   ├── deploy-testnet.mjs            # Bohr Testnet deployment script
│   ├── execute-lifecycle.mjs         # 13-step testnet transaction lifecycle
│   ├── preflight-mainnet.mjs         # Mainnet readiness & preflight audit
│   └── deploy-mainnet.mjs            # Guarded mainnet script (blocks without auth)
├── services/
│   ├── indexer.mjs                   # Onchain event indexer & reconciler
│   ├── evidence-service.mjs          # Offchain evidence storage & hasher
│   └── server.mjs                    # Lightweight verification REST API
├── shared/
│   ├── TrustStakeCore.json           # Bytecode & ABI artifact
│   ├── deployment-testnet.json       # Verified deployment manifest
│   ├── lifecycle-receipts.json       # Confirmed transaction receipts
│   └── indexer-cache.json            # Reconciled onchain state cache
├── TrustStake Frontend/              # Preserved Bolt frontend with live Web3
└── .env.example                      # Network & key configuration template
```

---

## 5. Development & Verification Commands

```bash
# 1. Compile Contracts with Optimizer (200 runs)
npm run compile # or node scripts/compile.mjs

# 2. Run Comprehensive Pre-Deployment Tests
npm run test:contracts # or node scripts/test-contracts.mjs

# 3. Deploy to BOT Chain Testnet
npm run deploy:testnet # or node scripts/deploy-testnet.mjs

# 4. Run End-to-End Testnet Lifecycle
node scripts/execute-lifecycle.mjs

# 5. Run Event Indexer & State Reconciler
npm run indexer # or node services/indexer.mjs

# 6. Run Mainnet Preflight Checks
npm run preflight:mainnet # or node scripts/preflight-mainnet.mjs

# 7. Start Frontend Development Server
npm run dev
```

---

## 6. Official Network Links & External Verification
- **Official BOT Chain Testnet RPC**: [https://rpc.bohr.life](https://rpc.bohr.life)
- **Official BotScan Testnet Explorer**: [https://scan.bohr.life](https://scan.bohr.life)
- **Official Developer Documentation**: [https://dev-docs.botchain.ai/docs/Developers/quick-guide/](https://dev-docs.botchain.ai/docs/Developers/quick-guide/)
- **Official Mainnet RPC (Prepared)**: [https://rpc.botchain.ai](https://rpc.botchain.ai)
- **Official Mainnet Explorer (Prepared)**: [https://scan.botchain.ai](https://scan.botchain.ai)
