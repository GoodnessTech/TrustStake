// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrustStakeCore
 * @notice TrustStake is a stake-backed reliability marketplace for service providers and AI agents on BOT Chain.
 * @dev Providers stake native BOT collateral against measurable service commitments.
 *      Customers create service commitments, record evidence, confirm outcomes, or initiate disputes.
 *      The protocol enforces predefined economic rules:
 *        - Successful commitments release locked collateral and pay agreed rewards.
 *        - Confirmed failures apply agreed collateral penalties to customers.
 *        - Disputed outcomes remain frozen until authorized resolution.
 *        - Reliability records accumulate from settled commitments.
 *
 * Architecture references & sound patterns:
 *  - BOTSpend: custom errors, reentrancy protection, checks-effects-interactions, event receipts.
 *  - FlowGuard: strict state separation, bounded fees, immutable terms post-acceptance.
 *  - Kyrve: independent verification, proof surfaces, evidence hash integrity.
 */
contract TrustStakeCore {
    // -------------------------------------------------------------------------
    // Custom Errors (Gas optimized & explicit)
    // -------------------------------------------------------------------------
    error TrustStake__ZeroAddress();
    error TrustStake__ZeroAmount();
    error TrustStake__ProviderAlreadyRegistered();
    error TrustStake__ProviderNotRegistered();
    error TrustStake__ProviderNotActive();
    error TrustStake__InsufficientAvailableCollateral(uint256 available, uint256 required);
    error TrustStake__CollateralLocked(uint256 locked, uint256 requested);
    error TrustStake__TransferFailed();
    error TrustStake__InvalidCommitmentParameters();
    error TrustStake__CommitmentNotFound();
    error TrustStake__CommitmentExpired();
    error TrustStake__Unauthorized();
    error TrustStake__InvalidStateTransition(CommitmentStatus current, CommitmentStatus attempted);
    error TrustStake__DisputeWindowExpired();
    error TrustStake__DisputeWindowStillActive();
    error TrustStake__AppealWindowExpired();
    error TrustStake__AlreadySettled();
    error TrustStake__ArbitratorUnavailable();
    error TrustStake__ExcessiveFee();
    error TrustStake__ReentrantCall();

    // -------------------------------------------------------------------------
    // Enums & Structs
    // -------------------------------------------------------------------------
    enum CommitmentStatus {
        Created,        // Customer created & funded reward, awaiting provider acceptance
        Cancelled,      // Cancelled by customer before acceptance (reward refunded)
        Accepted,       // Provider accepted, required collateral locked
        Completed,      // Mutually or customer-confirmed success
        Disputed,       // Customer claimed failure, awaiting challenge or arbitration
        Challenged,     // Provider challenged failure claim, awaiting primary arbitration
        Arbitrated,     // Primary arbitrator decided, appeal window open
        Appealed,       // One party appealed, awaiting appeal arbitration
        FinalArbitrated,// Appeal arbitrator decided final outcome
        Settled         // Final financial transfers executed, collateral unlocked/penalized
    }

    enum ResolutionOutcome {
        None,
        ProviderSuccess, // Commitment deemed fulfilled, reward paid to provider
        CustomerRefund,  // Commitment dismissed without penalty (e.g. mutual cancellation or no fault)
        ProviderFault    // Commitment failed due to provider, penalty paid to customer
    }

    struct ProviderStats {
        uint256 commitmentsAccepted;
        uint256 commitmentsCompleted;
        uint256 failuresFinalized;
        uint256 disputesRaised;
        uint256 appealsRaised;
    }

    struct Provider {
        bool isRegistered;
        bool isActive;
        string name;
        string category;
        string metadataURI;
        bytes32 metadataHash;
        uint256 totalCollateral;
        uint256 lockedCollateral;
        ProviderStats stats;
        uint256 registeredAt;
    }

    struct CommitmentTerms {
        bytes32 descriptionHash;
        string descriptionURI;
        uint256 reward;              // Escrowed customer reward (native BOT)
        uint256 requiredCollateral;  // Provider collateral locked
        uint256 maxPenalty;          // Maximum penalty on failure (<= requiredCollateral)
        uint256 deadline;            // Timestamp service must be completed by
        uint256 disputeWindow;       // Window duration for provider challenge or arbitration
        uint256 appealWindow;        // Window duration for appeal
        bytes32 evidenceRequirementsHash;
        address primaryArbitrator;   // Pre-agreed primary arbitrator
        address appealArbitrator;    // Pre-agreed appeal arbitrator
    }

    struct CommitmentState {
        CommitmentStatus status;
        ResolutionOutcome finalOutcome;
        uint256 failureReportedAt;
        uint256 arbitratedAt;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 settledAt;
    }

    struct Commitment {
        uint256 id;
        address provider;
        address customer;
        CommitmentTerms terms;
        CommitmentState state;
    }

    struct CreateCommitmentParams {
        address provider;
        bytes32 descriptionHash;
        string descriptionURI;
        uint256 requiredCollateral;
        uint256 maxPenalty;
        uint256 deadline;
        uint256 disputeWindow;
        uint256 appealWindow;
        bytes32 evidenceRequirementsHash;
        address primaryArbitrator;
        address appealArbitrator;
    }

    struct EvidenceRecord {
        bytes32 contentHash;
        string evidenceURI;
        address submitter;
        uint256 timestamp;
    }

    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------
    address public protocolOwner;
    address public feeRecipient;
    uint256 public protocolFeeBps; // Basis points (100 = 1%, max 500 = 5%)
    uint256 public constant MAX_FEE_BPS = 500;

    uint256 private _reentrancyStatus;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 public commitmentCounter;
    address[] public registeredProviderAddresses;

    mapping(address => Provider) public providers;
    mapping(uint256 => Commitment) public commitments;
    mapping(uint256 => EvidenceRecord[]) private _commitmentEvidence;
    mapping(address => uint256) public pendingWithdrawals; // Pull-payment balance safety

    // Global Protocol Accounting Counters
    uint256 public totalProtocolCollateral;
    uint256 public totalProtocolLockedCollateral;
    uint256 public totalEscrowedRewards;
    uint256 public totalSettlementsExecuted;

    // -------------------------------------------------------------------------
    // Events (Complete Receipts)
    // -------------------------------------------------------------------------
    event ProviderRegistered(
        address indexed provider,
        string name,
        string category,
        bytes32 metadataHash,
        string metadataURI,
        uint256 timestamp
    );
    event ProviderMetadataUpdated(address indexed provider, bytes32 metadataHash, string metadataURI);
    event ProviderStatusToggled(address indexed provider, bool isActive);

    event CollateralDeposited(address indexed provider, uint256 amount, uint256 newTotal);
    event CollateralWithdrawalRequested(address indexed provider, uint256 amount, uint256 remainingTotal);
    event CollateralWithdrawn(address indexed recipient, uint256 amount);

    event CommitmentCreated(
        uint256 indexed commitmentId,
        address indexed provider,
        address indexed customer,
        uint256 reward,
        uint256 requiredCollateral,
        uint256 maxPenalty,
        uint256 deadline
    );
    event CommitmentAccepted(uint256 indexed commitmentId, address indexed provider, uint256 lockedCollateral);
    event CommitmentCancelled(uint256 indexed commitmentId, address indexed customer, uint256 refundedReward);
    event CommitmentCompleted(uint256 indexed commitmentId, address indexed customer, address indexed provider);

    event EvidenceSubmitted(
        uint256 indexed commitmentId,
        address indexed submitter,
        bytes32 contentHash,
        string evidenceURI,
        uint256 evidenceIndex
    );

    event FailureReported(uint256 indexed commitmentId, address indexed customer, bytes32 evidenceHash);
    event FailureChallenged(uint256 indexed commitmentId, address indexed provider, bytes32 reasonHash);
    event DisputeArbitrated(
        uint256 indexed commitmentId,
        address indexed arbitrator,
        ResolutionOutcome outcome,
        bytes32 rulingHash
    );
    event DisputeAppealed(uint256 indexed commitmentId, address indexed appellant, bytes32 appealHash);
    event AppealArbitrated(
        uint256 indexed commitmentId,
        address indexed arbitrator,
        ResolutionOutcome outcome,
        bytes32 rulingHash
    );

    event CommitmentSettled(
        uint256 indexed commitmentId,
        ResolutionOutcome finalOutcome,
        uint256 providerPayout,
        uint256 customerPayout,
        uint256 penaltyDeducted,
        uint256 feePaid
    );

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier nonReentrant() {
        if (_reentrancyStatus == _ENTERED) revert TrustStake__ReentrantCall();
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    modifier onlyOwner() {
        if (msg.sender != protocolOwner) revert TrustStake__Unauthorized();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _feeRecipient, uint256 _feeBps) {
        if (_feeRecipient == address(0)) revert TrustStake__ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert TrustStake__ExcessiveFee();

        protocolOwner = msg.sender;
        feeRecipient = _feeRecipient;
        protocolFeeBps = _feeBps;
        _reentrancyStatus = _NOT_ENTERED;
    }

    // -------------------------------------------------------------------------
    // A. Provider Registration & Management
    // -------------------------------------------------------------------------
    function registerProvider(
        string calldata name,
        string calldata category,
        bytes32 metadataHash,
        string calldata metadataURI
    ) external {
        if (providers[msg.sender].isRegistered) revert TrustStake__ProviderAlreadyRegistered();

        providers[msg.sender] = Provider({
            isRegistered: true,
            isActive: true,
            name: name,
            category: category,
            metadataURI: metadataURI,
            metadataHash: metadataHash,
            totalCollateral: 0,
            lockedCollateral: 0,
            stats: ProviderStats(0, 0, 0, 0, 0),
            registeredAt: block.timestamp
        });

        registeredProviderAddresses.push(msg.sender);

        emit ProviderRegistered(msg.sender, name, category, metadataHash, metadataURI, block.timestamp);
    }

    function updateProviderMetadata(bytes32 metadataHash, string calldata metadataURI) external {
        if (!providers[msg.sender].isRegistered) revert TrustStake__ProviderNotRegistered();
        providers[msg.sender].metadataHash = metadataHash;
        providers[msg.sender].metadataURI = metadataURI;

        emit ProviderMetadataUpdated(msg.sender, metadataHash, metadataURI);
    }

    function setProviderActive(bool active) external {
        if (!providers[msg.sender].isRegistered) revert TrustStake__ProviderNotRegistered();
        providers[msg.sender].isActive = active;

        emit ProviderStatusToggled(msg.sender, active);
    }

    // -------------------------------------------------------------------------
    // B. Collateral Management
    // -------------------------------------------------------------------------
    function depositCollateral() external payable nonReentrant {
        if (msg.value == 0) revert TrustStake__ZeroAmount();
        if (!providers[msg.sender].isRegistered) revert TrustStake__ProviderNotRegistered();

        providers[msg.sender].totalCollateral += msg.value;
        totalProtocolCollateral += msg.value;

        emit CollateralDeposited(msg.sender, msg.value, providers[msg.sender].totalCollateral);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert TrustStake__ZeroAmount();
        Provider storage p = providers[msg.sender];
        if (!p.isRegistered) revert TrustStake__ProviderNotRegistered();

        uint256 available = p.totalCollateral - p.lockedCollateral;
        if (amount > available) {
            revert TrustStake__CollateralLocked(p.lockedCollateral, amount);
        }

        p.totalCollateral -= amount;
        totalProtocolCollateral -= amount;

        emit CollateralWithdrawalRequested(msg.sender, amount, p.totalCollateral);

        _safeNativeTransfer(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // C. Commitment Creation
    // -------------------------------------------------------------------------
    function createCommitment(
        CreateCommitmentParams calldata params
    ) external payable nonReentrant returns (uint256) {
        if (params.provider == address(0) || params.primaryArbitrator == address(0) || params.appealArbitrator == address(0)) {
            revert TrustStake__ZeroAddress();
        }
        if (!providers[params.provider].isRegistered) revert TrustStake__ProviderNotRegistered();
        if (!providers[params.provider].isActive) revert TrustStake__ProviderNotActive();
        if (params.deadline <= block.timestamp) revert TrustStake__CommitmentExpired();
        if (params.maxPenalty > params.requiredCollateral) revert TrustStake__InvalidCommitmentParameters();
        if (params.disputeWindow < 1 hours || params.appealWindow < 1 hours) revert TrustStake__InvalidCommitmentParameters();

        uint256 reward = msg.value;
        totalEscrowedRewards += reward;

        commitmentCounter++;
        uint256 id = commitmentCounter;

        Commitment storage c = commitments[id];
        c.id = id;
        c.provider = params.provider;
        c.customer = msg.sender;
        
        c.terms.descriptionHash = params.descriptionHash;
        c.terms.descriptionURI = params.descriptionURI;
        c.terms.reward = reward;
        c.terms.requiredCollateral = params.requiredCollateral;
        c.terms.maxPenalty = params.maxPenalty;
        c.terms.deadline = params.deadline;
        c.terms.disputeWindow = params.disputeWindow;
        c.terms.appealWindow = params.appealWindow;
        c.terms.evidenceRequirementsHash = params.evidenceRequirementsHash;
        c.terms.primaryArbitrator = params.primaryArbitrator;
        c.terms.appealArbitrator = params.appealArbitrator;

        c.state.status = CommitmentStatus.Created;
        c.state.createdAt = block.timestamp;

        emit CommitmentCreated(id, params.provider, msg.sender, reward, params.requiredCollateral, params.maxPenalty, params.deadline);

        return id;
    }

    function cancelCommitment(uint256 commitmentId) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (msg.sender != c.customer) revert TrustStake__Unauthorized();
        if (c.state.status != CommitmentStatus.Created) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.Cancelled);
        }

        c.state.status = CommitmentStatus.Cancelled;
        uint256 rewardToRefund = c.terms.reward;
        c.terms.reward = 0;
        totalEscrowedRewards -= rewardToRefund;

        emit CommitmentCancelled(commitmentId, msg.sender, rewardToRefund);

        if (rewardToRefund > 0) {
            _safeNativeTransfer(msg.sender, rewardToRefund);
        }
    }

    // -------------------------------------------------------------------------
    // D. Commitment Acceptance
    // -------------------------------------------------------------------------
    function acceptCommitment(uint256 commitmentId) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (msg.sender != c.provider) revert TrustStake__Unauthorized();
        if (c.state.status != CommitmentStatus.Created) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.Accepted);
        }
        if (block.timestamp > c.terms.deadline) revert TrustStake__CommitmentExpired();

        Provider storage p = providers[msg.sender];
        uint256 available = p.totalCollateral - p.lockedCollateral;
        if (available < c.terms.requiredCollateral) {
            revert TrustStake__InsufficientAvailableCollateral(available, c.terms.requiredCollateral);
        }

        p.lockedCollateral += c.terms.requiredCollateral;
        totalProtocolLockedCollateral += c.terms.requiredCollateral;
        p.stats.commitmentsAccepted++;

        c.state.status = CommitmentStatus.Accepted;
        c.state.acceptedAt = block.timestamp;

        emit CommitmentAccepted(commitmentId, msg.sender, c.terms.requiredCollateral);
    }

    // -------------------------------------------------------------------------
    // E. Evidence Submission
    // -------------------------------------------------------------------------
    function submitEvidence(
        uint256 commitmentId,
        bytes32 contentHash,
        string calldata evidenceURI
    ) external {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (msg.sender != c.provider && msg.sender != c.customer && msg.sender != c.terms.primaryArbitrator && msg.sender != c.terms.appealArbitrator) {
            revert TrustStake__Unauthorized();
        }
        if (c.state.status == CommitmentStatus.Created || c.state.status == CommitmentStatus.Cancelled || c.state.status == CommitmentStatus.Settled) {
            revert TrustStake__InvalidStateTransition(c.state.status, c.state.status);
        }

        uint256 idx = _commitmentEvidence[commitmentId].length;
        _commitmentEvidence[commitmentId].push(EvidenceRecord({
            contentHash: contentHash,
            evidenceURI: evidenceURI,
            submitter: msg.sender,
            timestamp: block.timestamp
        }));

        emit EvidenceSubmitted(commitmentId, msg.sender, contentHash, evidenceURI, idx);
    }

    // -------------------------------------------------------------------------
    // F. Outcome and Settlement Paths
    // -------------------------------------------------------------------------

    // Path 1: Customer confirms successful completion
    function confirmCompletion(uint256 commitmentId) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (msg.sender != c.customer) revert TrustStake__Unauthorized();
        if (c.state.status != CommitmentStatus.Accepted) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.Completed);
        }

        c.state.status = CommitmentStatus.Completed;
        c.state.finalOutcome = ResolutionOutcome.ProviderSuccess;

        emit CommitmentCompleted(commitmentId, c.customer, c.provider);

        _executeSettlement(commitmentId);
    }

    // Path 2: Customer reports failure with evidence
    function reportFailure(uint256 commitmentId, bytes32 evidenceHash, string calldata evidenceURI) external {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (msg.sender != c.customer) revert TrustStake__Unauthorized();
        if (c.state.status != CommitmentStatus.Accepted) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.Disputed);
        }

        c.state.status = CommitmentStatus.Disputed;
        c.state.failureReportedAt = block.timestamp;
        providers[c.provider].stats.disputesRaised++;

        _commitmentEvidence[commitmentId].push(EvidenceRecord({
            contentHash: evidenceHash,
            evidenceURI: evidenceURI,
            submitter: msg.sender,
            timestamp: block.timestamp
        }));

        emit FailureReported(commitmentId, msg.sender, evidenceHash);
    }

    // Path 3: Provider challenges failure claim
    function challengeFailure(uint256 commitmentId, bytes32 reasonHash, string calldata evidenceURI) external {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (msg.sender != c.provider) revert TrustStake__Unauthorized();
        if (c.state.status != CommitmentStatus.Disputed) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.Challenged);
        }
        if (block.timestamp > c.state.failureReportedAt + c.terms.disputeWindow) {
            revert TrustStake__DisputeWindowExpired();
        }

        c.state.status = CommitmentStatus.Challenged;

        _commitmentEvidence[commitmentId].push(EvidenceRecord({
            contentHash: reasonHash,
            evidenceURI: evidenceURI,
            submitter: msg.sender,
            timestamp: block.timestamp
        }));

        emit FailureChallenged(commitmentId, msg.sender, reasonHash);
    }

    // Path 4: Unchallenged failure settlement
    function settleUnchallengedFailure(uint256 commitmentId) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (c.state.status != CommitmentStatus.Disputed) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.Settled);
        }
        if (block.timestamp <= c.state.failureReportedAt + c.terms.disputeWindow) {
            revert TrustStake__DisputeWindowStillActive();
        }

        c.state.finalOutcome = ResolutionOutcome.ProviderFault;
        _executeSettlement(commitmentId);
    }

    // Path 5: Primary arbitration
    function arbitrateDispute(
        uint256 commitmentId,
        ResolutionOutcome outcome,
        bytes32 rulingHash
    ) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (msg.sender != c.terms.primaryArbitrator) revert TrustStake__Unauthorized();
        if (c.state.status != CommitmentStatus.Challenged && c.state.status != CommitmentStatus.Disputed) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.Arbitrated);
        }
        if (outcome == ResolutionOutcome.None) revert TrustStake__InvalidCommitmentParameters();

        c.state.status = CommitmentStatus.Arbitrated;
        c.state.finalOutcome = outcome;
        c.state.arbitratedAt = block.timestamp;

        emit DisputeArbitrated(commitmentId, msg.sender, outcome, rulingHash);
    }

    // Path 6: Appeal of primary arbitration
    function appealDispute(uint256 commitmentId, bytes32 appealHash, string calldata appealURI) external {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (msg.sender != c.provider && msg.sender != c.customer) revert TrustStake__Unauthorized();
        if (c.state.status != CommitmentStatus.Arbitrated) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.Appealed);
        }
        if (block.timestamp > c.state.arbitratedAt + c.terms.appealWindow) {
            revert TrustStake__AppealWindowExpired();
        }

        c.state.status = CommitmentStatus.Appealed;
        providers[c.provider].stats.appealsRaised++;

        _commitmentEvidence[commitmentId].push(EvidenceRecord({
            contentHash: appealHash,
            evidenceURI: appealURI,
            submitter: msg.sender,
            timestamp: block.timestamp
        }));

        emit DisputeAppealed(commitmentId, msg.sender, appealHash);
    }

    // Path 7: Appeal arbitration
    function resolveAppeal(
        uint256 commitmentId,
        ResolutionOutcome outcome,
        bytes32 rulingHash
    ) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (msg.sender != c.terms.appealArbitrator) revert TrustStake__Unauthorized();
        if (c.state.status != CommitmentStatus.Appealed) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.FinalArbitrated);
        }
        if (outcome == ResolutionOutcome.None) revert TrustStake__InvalidCommitmentParameters();

        c.state.status = CommitmentStatus.FinalArbitrated;
        c.state.finalOutcome = outcome;

        emit AppealArbitrated(commitmentId, msg.sender, outcome, rulingHash);

        _executeSettlement(commitmentId);
    }

    // Path 8: Settle un-appealed arbitration
    function settleArbitration(uint256 commitmentId) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.id == 0) revert TrustStake__CommitmentNotFound();
        if (c.state.status != CommitmentStatus.Arbitrated) {
            revert TrustStake__InvalidStateTransition(c.state.status, CommitmentStatus.Settled);
        }
        if (block.timestamp <= c.state.arbitratedAt + c.terms.appealWindow) {
            revert TrustStake__DisputeWindowStillActive();
        }

        _executeSettlement(commitmentId);
    }

    // -------------------------------------------------------------------------
    // Internal Settlement Engine (Strict Invariants & Gas Optimized)
    // -------------------------------------------------------------------------
    function _executeSettlement(uint256 commitmentId) internal {
        Commitment storage c = commitments[commitmentId];
        if (c.state.status == CommitmentStatus.Settled) revert TrustStake__AlreadySettled();

        Provider storage p = providers[c.provider];

        // Unlock provider collateral
        p.lockedCollateral -= c.terms.requiredCollateral;
        totalProtocolLockedCollateral -= c.terms.requiredCollateral;

        uint256 reward = c.terms.reward;
        c.terms.reward = 0;
        totalEscrowedRewards -= reward;

        c.state.status = CommitmentStatus.Settled;
        c.state.settledAt = block.timestamp;
        totalSettlementsExecuted++;

        if (c.state.finalOutcome == ResolutionOutcome.ProviderSuccess) {
            // Success: Reward paid to provider (minus fee), collateral unlocked
            p.stats.commitmentsCompleted++;
            uint256 feePaid = (protocolFeeBps > 0 && reward > 0) ? (reward * protocolFeeBps) / 10000 : 0;
            uint256 providerPayout = reward - feePaid;

            emit CommitmentSettled(
                commitmentId,
                c.state.finalOutcome,
                providerPayout,
                0,
                0,
                feePaid
            );

            if (feePaid > 0) {
                _safeNativeTransfer(feeRecipient, feePaid);
            }
            if (providerPayout > 0) {
                _safeNativeTransfer(c.provider, providerPayout);
            }
        } else if (c.state.finalOutcome == ResolutionOutcome.ProviderFault) {
            // Failure: agreed penalty deducted from provider total collateral and paid to customer;
            // reward refunded to customer
            p.stats.failuresFinalized++;
            uint256 penaltyDeducted = c.terms.maxPenalty;
            if (penaltyDeducted > p.totalCollateral) {
                penaltyDeducted = p.totalCollateral; // Safeguard bounds
            }
            p.totalCollateral -= penaltyDeducted;
            totalProtocolCollateral -= penaltyDeducted;

            uint256 customerPayout = reward + penaltyDeducted;

            emit CommitmentSettled(
                commitmentId,
                c.state.finalOutcome,
                0,
                customerPayout,
                penaltyDeducted,
                0
            );

            if (customerPayout > 0) {
                _safeNativeTransfer(c.customer, customerPayout);
            }
        } else {
            // CustomerRefund / No Fault / Mutual Dismissal:
            // Collateral fully unlocked with 0 penalty, reward refunded to customer
            emit CommitmentSettled(
                commitmentId,
                c.state.finalOutcome,
                0,
                reward,
                0,
                0
            );

            if (reward > 0) {
                _safeNativeTransfer(c.customer, reward);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Safe Native Transfer Helper with Pull-Payment Fallback
    // -------------------------------------------------------------------------
    function _safeNativeTransfer(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) {
            // Record in pending withdrawals to guarantee funds are never stuck
            pendingWithdrawals[to] += amount;
        }
    }

    function claimPendingWithdrawal() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert TrustStake__ZeroAmount();

        pendingWithdrawals[msg.sender] = 0;
        emit CollateralWithdrawn(msg.sender, amount);

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TrustStake__TransferFailed();
    }

    // -------------------------------------------------------------------------
    // Views & Audit Inspection Helpers
    // -------------------------------------------------------------------------
    function getProvider(address provider) external view returns (Provider memory) {
        return providers[provider];
    }

    function getCommitment(uint256 commitmentId) external view returns (Commitment memory) {
        return commitments[commitmentId];
    }

    function getCommitmentEvidence(uint256 commitmentId) external view returns (EvidenceRecord[] memory) {
        return _commitmentEvidence[commitmentId];
    }

    function getRegisteredProviders() external view returns (address[] memory) {
        return registeredProviderAddresses;
    }

    function getProviderCount() external view returns (uint256) {
        return registeredProviderAddresses.length;
    }

    function getAvailableCollateral(address provider) external view returns (uint256) {
        Provider storage p = providers[provider];
        if (p.totalCollateral < p.lockedCollateral) return 0;
        return p.totalCollateral - p.lockedCollateral;
    }

    // -------------------------------------------------------------------------
    // Protocol Administration
    // -------------------------------------------------------------------------
    function setFeeConfig(address _newFeeRecipient, uint256 _newFeeBps) external onlyOwner {
        if (_newFeeRecipient == address(0)) revert TrustStake__ZeroAddress();
        if (_newFeeBps > MAX_FEE_BPS) revert TrustStake__ExcessiveFee();

        feeRecipient = _newFeeRecipient;
        protocolFeeBps = _newFeeBps;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert TrustStake__ZeroAddress();
        protocolOwner = newOwner;
    }
}
