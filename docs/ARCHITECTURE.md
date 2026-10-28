# TrustStake: System Architecture

## 1. Executive Overview
TrustStake is a stake-backed reliability marketplace for human service providers and autonomous AI agents deployed on **BOT Chain Testnet (Bohr, Chain ID: 968)**.
The core primitive is economic accountability: providers deposit native BOT collateral against explicit, measurable service commitments. Customer rewards are funded into escrow upon commitment creation and disbursed strictly upon settled fulfillment, while confirmed failures slash pre-agreed penalties directly to customers.

## 2. Core Components

```
+----------------------------------------------------------------------+
|                           CLIENT TIER                                |
|   React 18 + Vite + DM Mono / Manrope + Lucide Icons                 |
|   - Provider Discovery & Collateral Management                       |
|   - Commitment Creation & Lifecycle Tracking                         |
|   - Cryptographic Proof Surface (/proof) & Health Monitor (/status)   |
|   - Clickable Official BOT Chain & BotScan Explorer Footers          |
+----------------------------------------------------------------------+
                                   |
                +------------------+------------------+
                |                                     |
                v                                     v
+-------------------------------+   +----------------------------------+
|      SERVICES & INDEXER       |   |         BLOCKCHAIN TIER          |
|  - Node.js Resilient Indexer  |   |  BOT Chain Testnet (Bohr: 968)   |
|  - Event-Driven State Engine  |   |  TrustStakeCore.sol              |
|  - Offchain Evidence Service  |   |  - Provider Registration         |
|  - Verified Proof API Server  |   |  - Collateral Escrow & Locking   |
+-------------------------------+   |  - Reward Escrow                 |
                |                   |  - Evidence Content Hashing      |
                +------------------>|  - Dispute & Appeal Arbitration  |
                     JSON-RPC       |  - Automated Settlement Engine   |
                                    +----------------------------------+
```

### A. Protocol Smart Contract (`TrustStakeCore.sol`)
Deployed to Bohr Testnet at `0xcb68b99e5b02b1e6a6aee361089e1adcdacefe00`.
- **State Machine**:
  `Created` -> `Accepted` -> `Completed` -> `Settled`
  or `Accepted` -> `Disputed` -> `Challenged` -> `Arbitrated` -> `Appealed` -> `FinalArbitrated` -> `Settled`.
- **Reentrancy Protection**: OpenZeppelin-style non-reentrant state locks.
- **Accounting Invariants**:
  - `totalCollateral == lockedCollateral + availableCollateral`
  - `lockedCollateral == sum(activeCommitments.requiredCollateral)`
  - Maximum penalty strictly bounded: `maxPenalty <= requiredCollateral`.
  - Protocol fees strictly capped at 5% (`MAX_FEE_BPS = 500`).

### B. Indexer & RPC Adapter (`services/indexer.mjs`)
- Uses native `eth_getLogs` on Bohr RPC (`https://rpc.bohr.life`).
- Decodes contract events with ABI topics and reconciles against live onchain contract calls (`eth_call`).
- Eliminates fabricated balances: offline states are exposed honestly as `Reported but not verified` or `Unavailable`.

### C. Evidence Hash Service (`services/evidence-service.mjs`)
- Captures offchain evidence payloads (logs, latency benchmarks, SLA receipts).
- Anchors canonical `keccak256` and `sha256` content hashes onchain.
- Offchain payloads can be verified against onchain event records at any time.

### D. Proof & Status Surfaces (`/proof`, `/status`)
- `/proof`: Validates onchain bytecode (16,333 bytes), testnet deployment receipt, and verifies each transaction step.
- `/status`: Real-time block height synchronization, indexer lag (0 blocks), and RPC latency.
