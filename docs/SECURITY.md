# TrustStake: Security Specification & Guarantees

## 1. Security Philosophy
TrustStake treats all user stakes and escrowed rewards as financial infrastructure. The design minimizes trust assumptions, enforces strict Checks-Effects-Interactions, and isolates protocol administration from adjudication.

## 2. Invariant Security Guarantees
1. **Collateral Withdrawal Invariant**:
   A provider cannot withdraw collateral locked against open or disputed commitments.
   `availableCollateral = totalCollateral - lockedCollateral`.
   Any attempt to withdraw more than `availableCollateral` reverts with `TrustStake__CollateralLocked`.

2. **Capped Slashing Invariant**:
   No dispute outcome or malicious claim can slash more than `min(maxPenalty, lockedCollateral, totalCollateral)`. Slashing beyond the agreed commitment terms is mathematically impossible.

3. **No Unilateral AI Slashing**:
   AI agents or automated oracles cannot execute collateral slashing without authorized human or multi-sig arbitration (`primaryArbitrator` or `appealArbitrator`). If an adjudicator fails to respond, collateral remains frozen rather than automatically transferred.

4. **Checks-Effects-Interactions & Reentrancy Guards**:
   All state updates (status transitions, collateral deductions, fee recordings) occur strictly BEFORE external native BOT value transfers. All value-transferring external calls are guarded with the `nonReentrant` modifier.

5. **Pull-Payment Fallback Protection**:
   If an external recipient contract fails during settlement (e.g. reverting fallback, out of gas, or griefing), the funds are credited to `pendingWithdrawals[recipient]`. The protocol state never locks or bricks; the recipient can claim their balance via `claimPendingWithdrawal()`.

6. **Fee Bounds**:
   Protocol fees cannot exceed 500 basis points (5%). The owner cannot arbitrarily hike fees or seize collateral.

## 3. Known Limitations & Non-Audited Status
- **Audit Disclosure**: This codebase has undergone internal automated testing, fuzz invariant verification, and live testnet execution. It has **NOT** been audited by an independent external auditing firm.
- **Arbitrator Trust**: The protocol relies on the integrity of the designated `primaryArbitrator` and `appealArbitrator` specified mutually in the commitment terms.
