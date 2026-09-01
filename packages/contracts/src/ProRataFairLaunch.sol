// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Timed fixed-price launch with pro-rata oversubscription, permissionless refunds, and no owner withdrawal.
contract ProRataFairLaunch is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS = 100;
    uint16 public constant BPS = 10_000;
    uint256 public constant PRICE_SCALE = 1 ether;
    uint64 public constant INCIDENT_GRACE_PERIOD = 7 days;

    IERC20 public immutable saleToken;
    IERC20 public immutable quoteToken;
    uint256 public immutable saleAllocation;
    uint256 public immutable pricePerToken;
    uint256 public immutable minimumRaise;
    uint256 public immutable maximumRaise;
    uint256 public immutable walletCap;
    uint64 public immutable startsAt;
    uint64 public immutable endsAt;
    uint64 public immutable claimDeadline;
    uint16 public immutable saleFeeBps;
    address public immutable creator;
    address public immutable securityCouncil;
    address public immutable proceedsRecipient;
    address public immutable operationsRecipient;
    address public immutable rewardsRecipient;
    address public immutable referralRegistry;
    address public immutable unsoldRecipient;

    uint256 public totalContributed;
    uint256 public totalSettledContribution;
    uint256 public totalTokensClaimed;
    bool public activated;
    bool public paused;
    bool public cancelled;
    mapping(address => uint256) public contributed;
    mapping(address => address) public referrerOf;
    mapping(address => bool) public settled;

    event Contributed(address indexed contributor, uint256 amount, address indexed referrer);
    event Activated(address indexed creator);
    event Claimed(address indexed contributor, uint256 tokens, uint256 acceptedQuote, uint256 refundedQuote);
    event Refunded(address indexed contributor, uint256 amount);
    event PauseChanged(bool paused);
    event Cancelled();
    event UnsoldSwept(uint256 amount, address indexed recipient);

    struct Config {
        address saleToken;
        address quoteToken;
        uint256 saleAllocation;
        uint256 pricePerToken;
        uint256 minimumRaise;
        uint256 maximumRaise;
        uint256 walletCap;
        uint64 startsAt;
        uint64 endsAt;
        uint64 claimDeadline;
        uint16 saleFeeBps;
        address creator;
        address securityCouncil;
        address proceedsRecipient;
        address operationsRecipient;
        address rewardsRecipient;
        address referralRegistry;
        address unsoldRecipient;
    }

    constructor(Config memory config) {
        require(config.saleToken != address(0), "zero sale token");
        require(config.saleAllocation > 0, "zero allocation");
        require(config.pricePerToken > 0, "zero price");
        require(config.minimumRaise > 0 && config.maximumRaise >= config.minimumRaise, "invalid raise");
        require(
            Math.mulDiv(config.saleAllocation, config.pricePerToken, PRICE_SCALE) == config.maximumRaise,
            "price mismatch"
        );
        require(config.walletCap > 0, "zero cap");
        require(config.startsAt < config.endsAt && config.claimDeadline > config.endsAt, "invalid time");
        require(config.saleFeeBps <= MAX_FEE_BPS, "fee cap");
        require(config.creator != address(0) && config.securityCouncil != address(0), "zero authority");
        require(config.proceedsRecipient != address(0) && config.operationsRecipient != address(0), "zero recipient");
        require(config.rewardsRecipient != address(0) && config.unsoldRecipient != address(0), "zero recipient");
        saleToken = IERC20(config.saleToken);
        quoteToken = IERC20(config.quoteToken);
        saleAllocation = config.saleAllocation;
        pricePerToken = config.pricePerToken;
        minimumRaise = config.minimumRaise;
        maximumRaise = config.maximumRaise;
        walletCap = config.walletCap;
        startsAt = config.startsAt;
        endsAt = config.endsAt;
        claimDeadline = config.claimDeadline;
        saleFeeBps = config.saleFeeBps;
        creator = config.creator;
        securityCouncil = config.securityCouncil;
        proceedsRecipient = config.proceedsRecipient;
        operationsRecipient = config.operationsRecipient;
        rewardsRecipient = config.rewardsRecipient;
        referralRegistry = config.referralRegistry;
        unsoldRecipient = config.unsoldRecipient;
    }

    receive() external payable {
        contribute(address(0));
    }

    function contribute(address referrer) public payable nonReentrant {
        require(address(quoteToken) == address(0), "ERC20 quote");
        _recordContribution(msg.sender, msg.value, referrer);
    }

    /// @notice Opens the contribution window as a separate creator-signed action.
    /// @dev A newly created canary remains sealed until this succeeds.
    function activate() external {
        require(msg.sender == creator, "not creator");
        require(!activated && !cancelled, "activation closed");
        require(block.timestamp < startsAt, "window started");
        activated = true;
        emit Activated(msg.sender);
    }

    function contributeToken(uint256 amount, address referrer) external nonReentrant {
        require(address(quoteToken) != address(0), "native quote");
        require(amount > 0, "zero contribution");
        quoteToken.safeTransferFrom(msg.sender, address(this), amount);
        _recordContribution(msg.sender, amount, referrer);
    }

    function claim() external nonReentrant {
        _settle(msg.sender);
    }

    /// @notice Anyone may settle a successful contributor so claims cannot become stranded.
    function settleFor(address contributor) external nonReentrant {
        _settle(contributor);
    }

    function _settle(address contributor) private {
        require(block.timestamp > endsAt, "sale open");
        require(!isRefunding(), "refund mode");
        require(totalContributed >= minimumRaise, "minimum missed");
        require(!settled[contributor], "already settled");
        uint256 contribution = contributed[contributor];
        require(contribution > 0, "no contribution");
        settled[contributor] = true;
        totalSettledContribution += contribution;

        uint256 denominator = totalContributed > maximumRaise ? totalContributed : maximumRaise;
        uint256 tokens = saleAllocation * contribution / denominator;
        uint256 accepted =
            totalContributed > maximumRaise ? maximumRaise * contribution / totalContributed : contribution;
        uint256 refundAmount = contribution - accepted;
        uint256 fee = accepted * saleFeeBps / BPS;
        uint256 referralShare = fee * 2_000 / BPS;
        uint256 operationsShare = fee * 5_000 / BPS;
        uint256 rewardsShare = fee - operationsShare - referralShare;
        address referrer = referrerOf[contributor];
        if (!_isVerifiedReferrer(referrer)) {
            rewardsShare += referralShare;
            referralShare = 0;
        }

        totalTokensClaimed += tokens;
        saleToken.safeTransfer(contributor, tokens);
        _payQuote(proceedsRecipient, accepted - fee);
        _payQuote(operationsRecipient, operationsShare);
        _payQuote(rewardsRecipient, rewardsShare);
        if (referralShare > 0) _payQuote(referrer, referralShare);
        if (refundAmount > 0) _payQuote(contributor, refundAmount);
        emit Claimed(contributor, tokens, accepted, refundAmount);
    }

    function refund() external nonReentrant {
        require(block.timestamp > endsAt, "sale open");
        require(isRefunding() || totalContributed < minimumRaise, "launch successful");
        require(!settled[msg.sender], "already settled");
        uint256 amount = contributed[msg.sender];
        require(amount > 0, "no contribution");
        settled[msg.sender] = true;
        totalSettledContribution += amount;
        _payQuote(msg.sender, amount);
        emit Refunded(msg.sender, amount);
    }

    function setPaused(bool value) external {
        require(msg.sender == securityCouncil, "not council");
        require(!cancelled && block.timestamp <= endsAt + INCIDENT_GRACE_PERIOD, "pause closed");
        paused = value;
        emit PauseChanged(value);
    }

    function cancelBeforeOpen() external {
        require(msg.sender == creator, "not creator");
        require(block.timestamp < startsAt && totalContributed == 0, "already open");
        cancelled = true;
        emit Cancelled();
    }

    function sweepUnsold() external nonReentrant {
        require(block.timestamp > claimDeadline, "claims active");
        require(totalSettledContribution == totalContributed, "unsettled contributions");
        uint256 balance = saleToken.balanceOf(address(this));
        require(balance > 0, "nothing to sweep");
        saleToken.safeTransfer(unsoldRecipient, balance);
        emit UnsoldSwept(balance, unsoldRecipient);
    }

    function preview(address contributor)
        external
        view
        returns (uint256 tokens, uint256 accepted, uint256 refundAmount)
    {
        uint256 contribution = contributed[contributor];
        uint256 denominator = totalContributed > maximumRaise ? totalContributed : maximumRaise;
        tokens = denominator == 0 ? 0 : saleAllocation * contribution / denominator;
        accepted = totalContributed > maximumRaise && totalContributed > 0
            ? maximumRaise * contribution / totalContributed
            : contribution;
        refundAmount = contribution - accepted;
    }

    function isRefunding() public view returns (bool) {
        return cancelled || (paused && block.timestamp > endsAt + INCIDENT_GRACE_PERIOD);
    }

    function _recordContribution(address contributor, uint256 amount, address referrer) internal {
        require(activated && !cancelled && !paused, "not accepting");
        require(block.timestamp >= startsAt && block.timestamp <= endsAt, "outside window");
        require(amount > 0 && contributed[contributor] + amount <= walletCap, "wallet cap");
        if (referrerOf[contributor] == address(0) && referrer != contributor) referrerOf[contributor] = referrer;
        contributed[contributor] += amount;
        totalContributed += amount;
        emit Contributed(contributor, amount, referrerOf[contributor]);
    }

    function _isVerifiedReferrer(address referrer) internal view returns (bool) {
        if (referrer == address(0) || referralRegistry == address(0)) return false;
        (bool ok, bytes memory data) =
            referralRegistry.staticcall(abi.encodeWithSignature("isVerified(address)", referrer));
        return ok && data.length == 32 && abi.decode(data, (bool));
    }

    function _payQuote(address recipient, uint256 amount) internal {
        if (amount == 0) return;
        if (address(quoteToken) == address(0)) {
            (bool ok,) = payable(recipient).call{value: amount}("");
            require(ok, "native transfer failed");
        } else {
            quoteToken.safeTransfer(recipient, amount);
        }
    }
}
