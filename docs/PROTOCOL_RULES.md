# TrustStake: Protocol Settlement Rules

## 1. Provider Registration Rules
- Any address may register as a provider by calling `registerProvider(name, category, metadataHash, metadataURI)`.
- Duplicate registrations from the same address revert with `TrustStake__ProviderAlreadyRegistered()`.
- Providers deposit native BOT collateral via `depositCollateral()` payable.

## 2. Commitment Lifecycle Rules
1. **Creation**:
   - Customer calls `createCommitment(params)` and deposits the native BOT reward.
   - Reward is escrowed separately in `totalEscrowedRewards`.
   - Customer cannot cancel once the commitment has been accepted.

2. **Acceptance**:
   - Only the designated provider can accept (`acceptCommitment`).
   - Provider must have sufficient unencumbered collateral: `availableCollateral >= requiredCollateral`.
   - Collateral is locked: `lockedCollateral += requiredCollateral`.

3. **Evidence Submission**:
   - Authorized parties (Customer, Provider, Arbitrators) may submit evidence hashes (`submitEvidence`).
   - The contract records `contentHash` onchain with timestamp and submitter address.

4. **Successful Settlement**:
   - Mutually or customer-confirmed (`confirmCompletion`).
   - Provider locked collateral is released back to available balance.
   - Agreed reward is paid to the provider (minus protocol fee <= 5%).
   - Provider reliability counter increments: `commitmentsCompleted++`.

5. **Dispute & Failure Rules**:
   - Customer reports failure with evidence (`reportFailure`). Commitment status becomes `Disputed`.
   - Provider has `disputeWindow` (e.g. 24-72 hours) to challenge (`challengeFailure`).
   - If unchallenged after the window expires, `settleUnchallengedFailure` pays the penalty and refund to the customer.
   - If challenged, the pre-agreed `primaryArbitrator` rules (`arbitrateDispute`).
   - Either party may appeal within `appealWindow` (`appealDispute`).
   - The pre-agreed `appealArbitrator` delivers final resolution (`resolveAppeal`).
   - Slashed penalties are paid directly to customer; remaining collateral is unlocked; provider reliability counter increments: `failuresFinalized++`.
