// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/TrustStakeCore.sol";

interface Vm {
    function warp(uint256) external;
    function roll(uint256) external;
    function prank(address) external;
    function deal(address, uint256) external;
    function expectRevert(bytes calldata) external;
}

contract TrustStakeCoreTest {
    Vm constant vm = Vm(address(bytes20(uint160(uint256(keccak256("hevm cheat code"))))));

    TrustStakeCore core;

    address protocolOwner = address(0xAA1);
    address feeRecipient = address(0xBB2);
    address provider = address(0x111);
    address provider2 = address(0x222);
    address customer = address(0x333);
    address primaryArbitrator = address(0x444);
    address appealArbitrator = address(0x555);
    address attacker = address(0x666);

    uint256 constant INITIAL_COLLATERAL = 10 ether;
    uint256 constant REWARD_AMOUNT = 1 ether;
    uint256 constant REQUIRED_COLLATERAL = 2 ether;
    uint256 constant MAX_PENALTY = 1.5 ether;

    event ProviderRegistered(address indexed provider, string name, string category, bytes32 metadataHash, string metadataURI, uint256 timestamp);
    event CollateralDeposited(address indexed provider, uint256 amount, uint256 newTotal);
    event CommitmentCreated(uint256 indexed commitmentId, address indexed provider, address indexed customer, uint256 reward, uint256 requiredCollateral, uint256 maxPenalty, uint256 deadline);
    event CommitmentAccepted(uint256 indexed commitmentId, address indexed provider, uint256 lockedCollateral);
    event CommitmentCompleted(uint256 indexed commitmentId, address indexed customer, address indexed provider);
    event CommitmentSettled(uint256 indexed commitmentId, TrustStakeCore.ResolutionOutcome finalOutcome, uint256 providerPayout, uint256 customerPayout, uint256 penaltyDeducted, uint256 feePaid);

    receive() external payable {}

    function setUp() public {
        vm.prank(protocolOwner);
        core = new TrustStakeCore(feeRecipient, 100); // 1% fee (100 bps)

        vm.deal(provider, 100 ether);
        vm.deal(provider2, 100 ether);
        vm.deal(customer, 100 ether);
        vm.deal(attacker, 100 ether);
    }

    // -------------------------------------------------------------------------
    // 1. Provider Registration Tests
    // -------------------------------------------------------------------------
    function test_ProviderRegistration_Success() public {
        vm.prank(provider);
        core.registerProvider(
            "Northstar Oracles",
            "Data & oracles",
            keccak256("metadata-1"),
            "ipfs://provider-1"
        );

        TrustStakeCore.Provider memory p = core.getProvider(provider);
        require(p.isRegistered, "Provider should be registered");
        require(p.isActive, "Provider should be active");
        require(keccak256(bytes(p.name)) == keccak256(bytes("Northstar Oracles")), "Name mismatch");
        require(core.getProviderCount() == 1, "Count should be 1");
    }

    function test_ProviderRegistration_DuplicateRevert() public {
        vm.prank(provider);
        core.registerProvider("Alpha", "Compute", keccak256("meta"), "uri");

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(TrustStakeCore.TrustStake__ProviderAlreadyRegistered.selector));
        core.registerProvider("Alpha Duplicate", "Compute", keccak256("meta2"), "uri2");
    }

    // -------------------------------------------------------------------------
    // 2. Collateral Management Tests
    // -------------------------------------------------------------------------
    function test_CollateralDepositAndWithdrawal() public {
        vm.prank(provider);
        core.registerProvider("Beta Provider", "Storage", keccak256("meta"), "uri");

        vm.prank(provider);
        core.depositCollateral{value: 5 ether}();

        require(core.getAvailableCollateral(provider) == 5 ether, "Available collateral mismatch");
        require(core.totalProtocolCollateral() == 5 ether, "Protocol collateral mismatch");

        // Withdraw 2 ether
        uint256 balanceBefore = provider.balance;
        vm.prank(provider);
        core.withdrawCollateral(2 ether);

        require(core.getAvailableCollateral(provider) == 3 ether, "Available after withdrawal mismatch");
        require(provider.balance == balanceBefore + 2 ether, "Balance increment mismatch");
    }

    function test_CollateralWithdrawal_LockedCollateralRevert() public {
        _registerAndDeposit(provider, 3 ether);

        uint256 commitmentId = _createStandardCommitment(provider, customer, 1 ether, 2 ether, 1.5 ether);

        vm.prank(provider);
        core.acceptCommitment(commitmentId);

        // Available is now 3 - 2 = 1 ether. Trying to withdraw 1.5 ether should revert
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(TrustStakeCore.TrustStake__CollateralLocked.selector, 2 ether, 1.5 ether));
        core.withdrawCollateral(1.5 ether);
    }

    // -------------------------------------------------------------------------
    // 3. Commitment Creation & Acceptance
    // -------------------------------------------------------------------------
    function test_CommitmentCreationAndAcceptance_Success() public {
        _registerAndDeposit(provider, 5 ether);

        uint256 deadline = block.timestamp + 3 days;
        TrustStakeCore.CreateCommitmentParams memory params = TrustStakeCore.CreateCommitmentParams({
            provider: provider,
            descriptionHash: keccak256("desc"),
            descriptionURI: "ipfs://desc",
            requiredCollateral: REQUIRED_COLLATERAL,
            maxPenalty: MAX_PENALTY,
            deadline: deadline,
            disputeWindow: 2 days,
            appealWindow: 2 days,
            evidenceRequirementsHash: keccak256("evidence-req"),
            primaryArbitrator: primaryArbitrator,
            appealArbitrator: appealArbitrator
        });

        vm.prank(customer);
        uint256 commitmentId = core.createCommitment{value: REWARD_AMOUNT}(params);

        TrustStakeCore.Commitment memory c = core.getCommitment(commitmentId);
        require(c.customer == customer, "Customer mismatch");
        require(c.status == TrustStakeCore.CommitmentStatus.Created, "Status should be Created");
        require(c.reward == REWARD_AMOUNT, "Reward mismatch");

        // Provider accepts
        vm.prank(provider);
        core.acceptCommitment(commitmentId);

        c = core.getCommitment(commitmentId);
        require(c.status == TrustStakeCore.CommitmentStatus.Accepted, "Status should be Accepted");
        require(core.getAvailableCollateral(provider) == 5 ether - REQUIRED_COLLATERAL, "Available collateral mismatch");
    }

    function test_CommitmentAcceptance_InsufficientCollateralRevert() public {
        _registerAndDeposit(provider, 1 ether); // only 1 ether deposited

        uint256 commitmentId = _createStandardCommitment(provider, customer, 0.5 ether, 2 ether, 1.5 ether);

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(TrustStakeCore.TrustStake__InsufficientAvailableCollateral.selector, 1 ether, 2 ether));
        core.acceptCommitment(commitmentId);
    }

    // -------------------------------------------------------------------------
    // 4. Evidence Submission
    // -------------------------------------------------------------------------
    function test_EvidenceSubmission_Success() public {
        _registerAndDeposit(provider, 5 ether);
        uint256 commitmentId = _createStandardCommitment(provider, customer, 1 ether, 2 ether, 1.5 ether);

        vm.prank(provider);
        core.acceptCommitment(commitmentId);

        bytes32 evidenceHash = keccak256("execution-evidence-payload");
        vm.prank(provider);
        core.submitEvidence(commitmentId, evidenceHash, "ipfs://evidence-1");

        TrustStakeCore.EvidenceRecord[] memory records = core.getCommitmentEvidence(commitmentId);
        require(records.length == 1, "Evidence record count mismatch");
        require(records[0].contentHash == evidenceHash, "Hash mismatch");
        require(records[0].submitter == provider, "Submitter mismatch");
    }

    // -------------------------------------------------------------------------
    // 5. Successful Completion & Settlement
    // -------------------------------------------------------------------------
    function test_SuccessfulCompletion_SettlesWithRewardAndFee() public {
        _registerAndDeposit(provider, 5 ether);
        uint256 commitmentId = _createStandardCommitment(provider, customer, 1 ether, 2 ether, 1.5 ether);

        vm.prank(provider);
        core.acceptCommitment(commitmentId);

        uint256 providerBalanceBefore = provider.balance;
        uint256 feeRecipientBalanceBefore = feeRecipient.balance;

        // Customer confirms completion
        vm.prank(customer);
        core.confirmCompletion(commitmentId);

        TrustStakeCore.Commitment memory c = core.getCommitment(commitmentId);
        require(c.status == TrustStakeCore.CommitmentStatus.Settled, "Should be Settled");
        require(c.finalOutcome == TrustStakeCore.ResolutionOutcome.ProviderSuccess, "Outcome mismatch");

        // 1 ether reward with 1% fee (100 bps): provider gets 0.99 ether, fee recipient gets 0.01 ether
        require(provider.balance == providerBalanceBefore + 0.99 ether, "Provider reward mismatch");
        require(feeRecipient.balance == feeRecipientBalanceBefore + 0.01 ether, "Fee mismatch");
        require(core.getAvailableCollateral(provider) == 5 ether, "Collateral should be fully unlocked");

        TrustStakeCore.Provider memory p = core.getProvider(provider);
        require(p.commitmentsCompleted == 1, "Completed counter mismatch");
    }

    // -------------------------------------------------------------------------
    // 6. Failure Claim & Dispute Adjudication
    // -------------------------------------------------------------------------
    function test_FailureReportAndArbitration() public {
        _registerAndDeposit(provider, 5 ether);
        uint256 commitmentId = _createStandardCommitment(provider, customer, 1 ether, 2 ether, 1.5 ether);

        vm.prank(provider);
        core.acceptCommitment(commitmentId);

        // Customer reports failure
        bytes32 evidenceHash = keccak256("failure-report-proof");
        vm.prank(customer);
        core.reportFailure(commitmentId, evidenceHash, "ipfs://failure-evidence");

        TrustStakeCore.Commitment memory c = core.getCommitment(commitmentId);
        require(c.status == TrustStakeCore.CommitmentStatus.Disputed, "Should be Disputed");

        // Provider challenges failure
        vm.prank(provider);
        core.challengeFailure(commitmentId, keccak256("rebuttal"), "ipfs://rebuttal");

        c = core.getCommitment(commitmentId);
        require(c.status == TrustStakeCore.CommitmentStatus.Challenged, "Should be Challenged");

        // Primary arbitrator decides ProviderFault
        vm.prank(primaryArbitrator);
        core.arbitrateDispute(commitmentId, TrustStakeCore.ResolutionOutcome.ProviderFault, keccak256("ruling-1"));

        c = core.getCommitment(commitmentId);
        require(c.status == TrustStakeCore.CommitmentStatus.Arbitrated, "Should be Arbitrated");

        // Warp past appeal window (2 days)
        vm.warp(block.timestamp + 3 days);

        uint256 customerBalanceBefore = customer.balance;
        core.settleArbitration(commitmentId);

        c = core.getCommitment(commitmentId);
        require(c.status == TrustStakeCore.CommitmentStatus.Settled, "Should be Settled");

        // Customer receives refund of reward (1 ether) + agreed penalty (1.5 ether) = 2.5 ether
        require(customer.balance == customerBalanceBefore + 2.5 ether, "Customer penalty payout mismatch");

        // Provider collateral slashed by 1.5 ether -> remaining total = 3.5 ether
        TrustStakeCore.Provider memory p = core.getProvider(provider);
        require(p.totalCollateral == 3.5 ether, "Provider collateral after slash mismatch");
        require(p.failuresFinalized == 1, "Failures finalized counter mismatch");
    }

    // -------------------------------------------------------------------------
    // Helper Setup Functions
    // -------------------------------------------------------------------------
    function _registerAndDeposit(address p, uint256 depositAmt) internal {
        vm.prank(p);
        core.registerProvider("Test Provider", "Compute", keccak256("meta"), "ipfs://meta");

        if (depositAmt > 0) {
            vm.prank(p);
            core.depositCollateral{value: depositAmt}();
        }
    }

    function _createStandardCommitment(
        address p,
        address cust,
        uint256 reward,
        uint256 requiredCollateral,
        uint256 maxPenalty
    ) internal returns (uint256) {
        TrustStakeCore.CreateCommitmentParams memory params = TrustStakeCore.CreateCommitmentParams({
            provider: p,
            descriptionHash: keccak256("standard-commitment"),
            descriptionURI: "ipfs://desc",
            requiredCollateral: requiredCollateral,
            maxPenalty: maxPenalty,
            deadline: block.timestamp + 7 days,
            disputeWindow: 2 days,
            appealWindow: 2 days,
            evidenceRequirementsHash: keccak256("evidence-req"),
            primaryArbitrator: primaryArbitrator,
            appealArbitrator: appealArbitrator
        });

        vm.prank(cust);
        return core.createCommitment{value: reward}(params);
    }
}
