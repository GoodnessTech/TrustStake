# TrustStake: Adversarial Testing & Verification

## 1. Test Summary
All adversarial attack vectors were subjected to automated verification in `contracts/test/TrustStakeCore.t.sol` and live testnet execution in `scripts/execute-lifecycle.mjs`.

## 2. Attack Vectors & Test Results

| Attack Vector | Simulated Scenario | Test Result |
|---|---|---|
| **Locked Collateral Withdrawal** | Provider deposits 3 BOT, accepts commitment locking 2 BOT, attempts withdrawing 1.5 BOT | Reverted with `TrustStake__CollateralLocked(2000000000000000000, 1500000000000000000)` |
| **Insufficient Stake Acceptance** | Provider has 1 BOT available, attempts accepting commitment requiring 2 BOT | Reverted with `TrustStake__InsufficientAvailableCollateral(1000000000000000000, 2000000000000000000)` |
| **Duplicate Provider Registration** | Address already registered calls `registerProvider()` a second time | Reverted with `TrustStake__ProviderAlreadyRegistered()` |
| **Unchallenged Settle Too Early** | Customer reports failure, immediately calls `settleUnchallengedFailure` within dispute window | Reverted with `TrustStake__DisputeWindowStillActive()` |
| **Double Settlement Attempt** | Successfully completed commitment settles, attacker calls `confirmCompletion()` again | Reverted with `TrustStake__AlreadySettled()` |
| **Unauthorized Evidence Injection** | Third-party address attempts submitting evidence to another's commitment | Reverted with `TrustStake__Unauthorized()` |
| **Excessive Fee Administration** | Protocol owner attempts setting `protocolFeeBps > 500` (5%) | Reverted with `TrustStake__ExcessiveFee()` |
| **Reentrancy Exploitation** | Malicious contract re-enters settlement during native BOT transfer | Blocked by `nonReentrant` modifier (`TrustStake__ReentrantCall`) |

## 3. Gas Profiling (Testnet Measured)

| Operation | Gas Used (Actual Onchain Bohr Testnet) |
|---|---|
| `registerProvider` | 224,028 gas |
| `depositCollateral` | 72,162 gas |
| `createCommitment` | 397,260 - 414,360 gas |
| `acceptCommitment` | 130,899 - 147,999 gas |
| `submitEvidence` | 144,615 gas |
| `confirmCompletion` & Settle | 129,881 gas |
| `reportFailure` | 192,356 gas |
| `challengeFailure` | 133,106 gas |
| `arbitrateDispute` | 58,690 gas |
| `appealDispute` | 155,485 gas |
| `resolveAppeal` & Settle | 116,807 gas |
| **Contract Deployment** | **3,678,088 gas** |
