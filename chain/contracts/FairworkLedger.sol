// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title FairworkLedger
/// @notice A local-only demo-credit ledger with per-milestone escrow for freelance agreements.
/// @dev Credits are plain integers with no monetary value. They are NOT a token: there is no
///      transfer, approval, withdrawal or minting after the constructor. Credits only move as the
///      result of agreement actions (fund, accept, refund, settle). The contract accepts and
///      holds no ETH, has no owner and makes no external calls. Time uses `block.timestamp`; windows are at
///      least one hour so validator timestamp skew (seconds) is irrelevant.
contract FairworkLedger {
    // ---------------------------------------------------------------- constants

    uint256 public constant DEMO_BUYER_CREDITS = 6000;
    uint256 public constant MAX_MILESTONES = 5;
    uint32 public constant MIN_REVIEW_WINDOW = 1 hours;
    uint32 public constant MAX_REVIEW_WINDOW = 30 days;
    uint256 public constant LOCAL_CHAIN_ID = 31337;

    // ---------------------------------------------------------------- types

    enum AgreementStatus {
        Proposed,
        Active,
        Completed,
        Cancelled
    }

    enum MilestoneStatus {
        Unfunded,
        Funded,
        Submitted,
        RevisionRequested,
        Disputed,
        Accepted,
        Resolved,
        Refunded
    }

    struct MilestoneInput {
        uint128 credits;
        uint64 deadline;
        uint8 revisionLimit;
    }

    struct Milestone {
        uint128 credits; // fixed at proposal
        uint64 deadline; // original submission deadline (unix s)
        uint64 dueAt; // current freelancer deadline (starts equal to deadline)
        uint64 submittedAt; // 0 until first submission; updated on resubmission
        uint8 revisionLimit;
        uint8 revisionsUsed;
        MilestoneStatus status;
        bytes32 evidenceHash; // latest submission
        uint128 paidToFreelancer; // set once, at the terminal state
        uint128 refundedToBuyer; // set once, at the terminal state
    }

    struct Agreement {
        address buyer;
        address freelancer;
        address resolver;
        uint32 reviewWindow; // seconds: buyer review time AND freelancer revision turnaround
        AgreementStatus status;
        bool buyerApproved;
        bool freelancerApproved;
        uint8 milestoneCount;
        uint8 openMilestones;
        bytes32 termsHash;
    }

    // ---------------------------------------------------------------- storage

    /// @notice Credits created in the constructor. Never changes afterwards.
    uint256 public immutable totalIssued;

    uint256 private _agreementCount;
    mapping(address => uint256) private _available;
    mapping(uint256 => Agreement) private _agreements;
    mapping(uint256 => Milestone[]) private _milestones;

    // ---------------------------------------------------------------- events

    event DemoCreditsGranted(address indexed account, uint256 credits);
    event AgreementProposed(
        uint256 indexed id,
        address indexed buyer,
        address indexed freelancer,
        address resolver,
        bytes32 termsHash
    );
    event AgreementApproved(uint256 indexed id, address indexed by);
    event AgreementActivated(uint256 indexed id);
    event AgreementCancelled(uint256 indexed id, address indexed by);
    event AgreementCompleted(uint256 indexed id);
    event MilestoneFunded(
        uint256 indexed id,
        uint256 indexed index,
        address indexed buyer,
        uint256 credits
    );
    event WorkSubmitted(uint256 indexed id, uint256 indexed index, bytes32 evidenceHash);
    event RevisionRequested(
        uint256 indexed id,
        uint256 indexed index,
        bytes32 reasonHash,
        uint8 revisionsUsed
    );
    event MilestoneAccepted(
        uint256 indexed id,
        uint256 indexed index,
        address indexed freelancer,
        uint256 credits,
        bool isAuto
    );
    event MilestoneRefunded(
        uint256 indexed id,
        uint256 indexed index,
        address indexed buyer,
        uint256 credits
    );
    event DisputeRaised(
        uint256 indexed id,
        uint256 indexed index,
        address indexed by,
        bytes32 reasonHash
    );
    event DisputeResolved(
        uint256 indexed id,
        uint256 indexed index,
        uint256 toFreelancer,
        uint256 toBuyer,
        bytes32 rationaleHash
    );

    // ---------------------------------------------------------------- errors

    error LocalChainOnly();
    error NotBuyer();
    error NotFreelancer();
    error NotResolver();
    error NotParty();
    error InvalidStatus();
    error InvalidInput();
    error InsufficientCredits();
    error OutOfOrder();
    error DeadlinePassed();
    error WindowExpired();
    error WindowOpen();
    error RevisionLimitReached();

    // ---------------------------------------------------------------- constructor

    /// @param demoBuyer The only account that ever receives credits from nothing.
    constructor(address demoBuyer) {
        if (block.chainid != LOCAL_CHAIN_ID) revert LocalChainOnly();
        if (demoBuyer == address(0)) revert InvalidInput();
        _available[demoBuyer] = DEMO_BUYER_CREDITS;
        totalIssued = DEMO_BUYER_CREDITS;
        emit DemoCreditsGranted(demoBuyer, DEMO_BUYER_CREDITS);
    }

    // ---------------------------------------------------------------- agreement setup

    /// @notice Create an agreement. The proposer (buyer or freelancer) is auto-approved.
    /// @param termsHash keccak256 of the canonical terms JSON stored off chain.
    /// @param reviewWindow Seconds the buyer has to review, and the freelancer has per revision.
    /// @param inputs 1 to 5 milestones with strictly increasing future deadlines.
    /// @return id The new agreement id (starts at 1).
    function propose(
        address buyer,
        address freelancer,
        address resolver,
        bytes32 termsHash,
        uint32 reviewWindow,
        MilestoneInput[] calldata inputs
    ) external returns (uint256 id) {
        if (msg.sender != buyer && msg.sender != freelancer) revert NotParty();
        if (buyer == address(0) || freelancer == address(0) || buyer == freelancer) {
            revert InvalidInput();
        }
        if (resolver == address(0) || resolver == buyer || resolver == freelancer) {
            revert InvalidInput();
        }
        if (termsHash == bytes32(0)) revert InvalidInput();
        if (reviewWindow < MIN_REVIEW_WINDOW || reviewWindow > MAX_REVIEW_WINDOW) {
            revert InvalidInput();
        }
        if (inputs.length == 0 || inputs.length > MAX_MILESTONES) revert InvalidInput();

        // Storage writes live in helpers to keep each function's stack small (no viaIR needed).
        id = _createAgreement(buyer, freelancer, resolver, termsHash, reviewWindow, inputs.length);
        _addMilestones(id, inputs);
    }

    /// @notice The party who has not yet approved accepts the terms. Both approved => Active.
    function approve(uint256 id) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.buyer && msg.sender != a.freelancer) revert NotParty();
        if (a.status != AgreementStatus.Proposed) revert InvalidStatus();
        if (msg.sender == a.buyer) {
            if (a.buyerApproved) revert InvalidStatus();
            a.buyerApproved = true;
        } else {
            if (a.freelancerApproved) revert InvalidStatus();
            a.freelancerApproved = true;
        }
        emit AgreementApproved(id, msg.sender);

        if (a.buyerApproved && a.freelancerApproved) {
            a.status = AgreementStatus.Active;
            emit AgreementActivated(id);
        }
    }

    /// @notice Either party withdraws a proposal that is not yet active.
    function cancelProposal(uint256 id) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.buyer && msg.sender != a.freelancer) revert NotParty();
        if (a.status != AgreementStatus.Proposed) revert InvalidStatus();
        a.status = AgreementStatus.Cancelled;
        emit AgreementCancelled(id, msg.sender);
    }

    // ---------------------------------------------------------------- milestone lifecycle

    /// @notice Buyer locks the milestone's credits. Milestones are funded strictly in order.
    function fundMilestone(uint256 id, uint256 index) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.buyer) revert NotBuyer();
        if (a.status != AgreementStatus.Active) revert InvalidStatus();
        Milestone storage m = _milestone(id, index);
        if (m.status != MilestoneStatus.Unfunded) revert InvalidStatus();
        for (uint256 j = 0; j < index; j++) {
            if (!_isTerminal(_milestones[id][j].status)) revert OutOfOrder();
        }
        if (block.timestamp >= m.deadline) revert DeadlinePassed();
        if (_available[msg.sender] < m.credits) revert InsufficientCredits();

        _available[msg.sender] -= m.credits;
        m.status = MilestoneStatus.Funded;
        emit MilestoneFunded(id, index, msg.sender, m.credits);
    }

    /// @notice Freelancer submits (or resubmits) evidence before the current deadline.
    function submitWork(uint256 id, uint256 index, bytes32 evidenceHash) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.freelancer) revert NotFreelancer();
        Milestone storage m = _milestone(id, index);
        if (m.status != MilestoneStatus.Funded && m.status != MilestoneStatus.RevisionRequested) {
            revert InvalidStatus();
        }
        if (block.timestamp > m.dueAt) revert DeadlinePassed();
        if (evidenceHash == bytes32(0)) revert InvalidInput();

        m.status = MilestoneStatus.Submitted;
        m.submittedAt = uint64(block.timestamp);
        m.evidenceHash = evidenceHash;
        emit WorkSubmitted(id, index, evidenceHash);
    }

    /// @notice Buyer accepts submitted work; credits go to the freelancer. Late acceptance is fine.
    function acceptWork(uint256 id, uint256 index) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.buyer) revert NotBuyer();
        Milestone storage m = _milestone(id, index);
        if (m.status != MilestoneStatus.Submitted) revert InvalidStatus();
        _payFreelancer(id, a, m, index, false);
    }

    /// @notice Buyer asks for changes inside the review window, while revisions remain.
    function requestRevision(uint256 id, uint256 index, bytes32 reasonHash) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.buyer) revert NotBuyer();
        Milestone storage m = _milestone(id, index);
        if (m.status != MilestoneStatus.Submitted) revert InvalidStatus();
        if (block.timestamp > uint256(m.submittedAt) + a.reviewWindow) revert WindowExpired();
        if (m.revisionsUsed >= m.revisionLimit) revert RevisionLimitReached();
        if (reasonHash == bytes32(0)) revert InvalidInput();

        m.status = MilestoneStatus.RevisionRequested;
        m.revisionsUsed++;
        m.dueAt = uint64(block.timestamp + a.reviewWindow);
        emit RevisionRequested(id, index, reasonHash, m.revisionsUsed);
    }

    /// @notice Freelancer claims payment when the buyer stayed silent past the review window.
    function claimAfterReviewTimeout(uint256 id, uint256 index) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.freelancer) revert NotFreelancer();
        Milestone storage m = _milestone(id, index);
        if (m.status != MilestoneStatus.Submitted) revert InvalidStatus();
        if (block.timestamp <= uint256(m.submittedAt) + a.reviewWindow) revert WindowOpen();
        _payFreelancer(id, a, m, index, true);
    }

    /// @notice Buyer takes the credits back when the freelancer missed the current deadline.
    function reclaimMissedDeadline(uint256 id, uint256 index) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.buyer) revert NotBuyer();
        Milestone storage m = _milestone(id, index);
        if (m.status != MilestoneStatus.Funded && m.status != MilestoneStatus.RevisionRequested) {
            revert InvalidStatus();
        }
        if (block.timestamp <= m.dueAt) revert WindowOpen(); // deadline not yet passed

        m.status = MilestoneStatus.Refunded;
        m.refundedToBuyer = m.credits;
        _available[a.buyer] += m.credits;
        emit MilestoneRefunded(id, index, a.buyer, m.credits);
        _closeMilestone(id, a);
    }

    // ---------------------------------------------------------------- disputes

    /// @notice Buyer disputes a submission (inside the review window) or the freelancer disputes
    ///         a revision request. Credits stay locked until the resolver settles.
    function raiseDispute(uint256 id, uint256 index, bytes32 reasonHash) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.buyer && msg.sender != a.freelancer) revert NotParty();
        Milestone storage m = _milestone(id, index);

        if (m.status == MilestoneStatus.Submitted) {
            if (msg.sender != a.buyer) revert NotBuyer();
            if (block.timestamp > uint256(m.submittedAt) + a.reviewWindow) revert WindowExpired();
        } else if (m.status == MilestoneStatus.RevisionRequested) {
            if (msg.sender != a.freelancer) revert NotFreelancer();
        } else {
            revert InvalidStatus();
        }
        if (reasonHash == bytes32(0)) revert InvalidInput();

        m.status = MilestoneStatus.Disputed;
        emit DisputeRaised(id, index, msg.sender, reasonHash);
    }

    /// @notice The agreement's resolver splits one disputed milestone between the parties.
    /// @param toFreelancer Credits for the freelancer; the remainder goes back to the buyer.
    function resolveDispute(
        uint256 id,
        uint256 index,
        uint256 toFreelancer,
        bytes32 rationaleHash
    ) external {
        Agreement storage a = _agreement(id);
        if (msg.sender != a.resolver) revert NotResolver();
        Milestone storage m = _milestone(id, index);
        if (m.status != MilestoneStatus.Disputed) revert InvalidStatus();
        if (toFreelancer > m.credits) revert InvalidInput();

        uint128 paid = uint128(toFreelancer);
        uint128 refunded = m.credits - paid;
        m.status = MilestoneStatus.Resolved;
        m.paidToFreelancer = paid;
        m.refundedToBuyer = refunded;
        _available[a.freelancer] += paid;
        _available[a.buyer] += refunded;
        emit DisputeResolved(id, index, paid, refunded, rationaleHash);
        _closeMilestone(id, a);
    }

    // ---------------------------------------------------------------- views

    function getAgreement(uint256 id) external view returns (Agreement memory) {
        return _agreement(id);
    }

    function getMilestones(uint256 id) external view returns (Milestone[] memory) {
        _agreement(id);
        return _milestones[id];
    }

    function agreementCount() external view returns (uint256) {
        return _agreementCount;
    }

    function availableOf(address account) external view returns (uint256) {
        return _available[account];
    }

    // ---------------------------------------------------------------- internals

    function _agreement(uint256 id) private view returns (Agreement storage) {
        if (id == 0 || id > _agreementCount) revert InvalidInput();
        return _agreements[id];
    }

    function _milestone(uint256 id, uint256 index) private view returns (Milestone storage) {
        if (index >= _milestones[id].length) revert InvalidInput();
        return _milestones[id][index];
    }

    /// @dev The proposer (msg.sender, already checked to be a party) is auto-approved.
    function _createAgreement(
        address buyer,
        address freelancer,
        address resolver,
        bytes32 termsHash,
        uint32 reviewWindow,
        uint256 milestoneCount
    ) private returns (uint256 id) {
        id = ++_agreementCount;
        Agreement storage a = _agreements[id];
        a.buyer = buyer;
        a.freelancer = freelancer;
        a.resolver = resolver;
        a.reviewWindow = reviewWindow;
        a.status = AgreementStatus.Proposed;
        a.buyerApproved = msg.sender == buyer;
        a.freelancerApproved = msg.sender == freelancer;
        a.milestoneCount = uint8(milestoneCount);
        a.openMilestones = uint8(milestoneCount);
        a.termsHash = termsHash;
        emit AgreementProposed(id, buyer, freelancer, resolver, termsHash);
    }

    /// @dev Deadlines must be strictly increasing and in the future; credits must be positive.
    function _addMilestones(uint256 id, MilestoneInput[] calldata inputs) private {
        uint64 previous = uint64(block.timestamp);
        for (uint256 i = 0; i < inputs.length; i++) {
            if (inputs[i].credits == 0 || inputs[i].deadline <= previous) revert InvalidInput();
            previous = inputs[i].deadline;
            Milestone storage m = _milestones[id].push();
            m.credits = inputs[i].credits;
            m.deadline = inputs[i].deadline;
            m.dueAt = inputs[i].deadline;
            m.revisionLimit = inputs[i].revisionLimit;
            // status defaults to Unfunded; every other field starts at zero
        }
    }

    function _isTerminal(MilestoneStatus s) private pure returns (bool) {
        return
            s == MilestoneStatus.Accepted ||
            s == MilestoneStatus.Resolved ||
            s == MilestoneStatus.Refunded;
    }

    function _payFreelancer(
        uint256 id,
        Agreement storage a,
        Milestone storage m,
        uint256 index,
        bool isAuto
    ) private {
        m.status = MilestoneStatus.Accepted;
        m.paidToFreelancer = m.credits;
        _available[a.freelancer] += m.credits;
        emit MilestoneAccepted(id, index, a.freelancer, m.credits, isAuto);
        _closeMilestone(id, a);
    }

    function _closeMilestone(uint256 id, Agreement storage a) private {
        a.openMilestones--;
        if (a.openMilestones == 0) {
            a.status = AgreementStatus.Completed;
            emit AgreementCompleted(id);
        }
    }
}
