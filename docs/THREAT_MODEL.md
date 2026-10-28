# TrustStake: Threat Model & Adversarial Analysis

## 1. Adversary Profiles & Scenarios

### A. Malicious Customer
- **Threat**: The customer receives good service, but reports a false failure claim to steal provider collateral or escape reward payment.
- **Protocol Defense**:
  - The provider has an explicit `disputeWindow` (minimum 1 hour, typically 24-72h) to challenge the claim (`challengeFailure`).
  - Challenged commitments remain frozen and are escalated to the pre-agreed `primaryArbitrator`. Collateral is never slashed automatically.

### B. Malicious Provider
- **Threat**: The provider accepts a commitment, receives customer funds, but goes offline without providing service.
- **Protocol Defense**:
  - If the service is not completed, customer files a failure claim with evidence (`reportFailure`).
  - If provider fails to challenge within `disputeWindow`, customer executes `settleUnchallengedFailure`, receiving the refund and the agreed collateral penalty.

### C. Malicious Arbitrator
- **Threat**: Primary arbitrator colludes with one party.
- **Protocol Defense**:
  - The protocol provides an independent, pre-agreed `appealArbitrator`.
  - Either party may appeal the initial ruling within `appealWindow` (`appealDispute`).
  - The appeal arbitrator reviews the complete evidence hash chain and issues the final binding ruling (`resolveAppeal`).

### D. Reentrancy & Malicious Fallbacks
- **Threat**: An attacker deploys a smart contract as customer or provider with a malicious `receive()` fallback that re-enters `confirmCompletion` or `withdrawCollateral`.
- **Protocol Defense**:
  - Guarded with `nonReentrant` modifier.
  - State changes happen before `.call{value: ...}`.
  - Transfer failures automatically switch to pull-payment accounting (`pendingWithdrawals`), preventing denial-of-service.

### E. Compromised Backend or RPC Inconsistencies
- **Threat**: A backend or RPC outage serves stale or corrupted records.
- **Protocol Defense**:
  - The blockchain is the sole authority for financial state.
  - Frontend directly validates the connected chain ID (968) and checks smart contract bytecode and storage via EIP-1193.
  - The backend never possesses signing authority or access to provider private keys.
