// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ProRataFairLaunch} from "./ProRataFairLaunch.sol";

struct CanonicalPoolDescriptor {
    address token;
    address quoteToken;
    bytes32 venueId;
    bytes32 poolId;
    uint24 fee;
    int24 tickSpacing;
    address hook;
    uint256 positionId;
    address positionLock;
}

struct AdapterSecurityConfiguration {
    address callbackAuthority;
    bool enforcesInitialPrice;
    bool rejectsExistingPoolPriceMismatch;
}

interface IRobinhoodLiquidityAdapter {
    function mintPermanentPosition(address token, address wrappedNative, uint256 tokenAmount, address positionRecipient)
        external
        payable
        returns (CanonicalPoolDescriptor memory descriptor);

    function securityConfiguration() external view returns (AdapterSecurityConfiguration memory configuration);
}

interface IBurnableLiquidityToken is IERC20 {
    function burn(uint256 amount) external;
}

interface IPermanentPositionReadback {
    function locked() external view returns (bool);
    function positionId() external view returns (uint256);
}

/// @notice Converts the manifest-bound quote share into a price-matched, permanently locked LP position.
/// @dev The adapter and position manager are pinned by runtime bytecode hash. There is no rescue or owner path.
contract RobinhoodLiquidityCoordinator is ReentrancyGuard {
    using SafeERC20 for IERC20;

    ProRataFairLaunch public sale;
    address public immutable binder;
    bytes32 public immutable manifestHash;
    IERC20 public immutable token;
    address public immutable wrappedNative;
    IRobinhoodLiquidityAdapter public immutable adapter;
    address public immutable poolManager;
    address public immutable positionManager;
    address public immutable positionLock;
    bytes32 public immutable adapterCodeHash;
    bytes32 public immutable wrappedNativeCodeHash;
    bytes32 public immutable poolManagerCodeHash;
    bytes32 public immutable positionManagerCodeHash;
    bool public finalized;
    bool public retired;
    uint256 public positionId;
    CanonicalPoolDescriptor public canonicalPool;

    event LiquidityFinalized(uint256 indexed positionId, uint256 tokenAmount, uint256 nativeAmount);
    event CanonicalPoolActivated(
        bytes32 indexed manifestHash,
        address indexed token,
        address indexed quoteToken,
        bytes32 venueId,
        bytes32 poolId,
        uint24 fee,
        int24 tickSpacing,
        address hook,
        uint256 positionId,
        address positionLock
    );
    event FailedLiquidityAllocationBurned(uint256 tokenAmount);
    event UnfinalizedLiquidityRetired(uint256 tokenAmount, uint256 redirectedQuote);

    constructor(
        bytes32 manifestHash_,
        address token_,
        address wrappedNative_,
        bytes32 wrappedNativeCodeHash_,
        address adapter_,
        bytes32 adapterCodeHash_,
        address poolManager_,
        bytes32 poolManagerCodeHash_,
        address positionManager_,
        bytes32 positionManagerCodeHash_,
        address positionLock_
    ) {
        require(
            manifestHash_ != bytes32(0) && token_ != address(0) && wrappedNative_ != address(0)
                && adapter_ != address(0) && poolManager_ != address(0) && positionManager_ != address(0)
                && positionLock_ != address(0),
            "zero address"
        );
        require(
            wrappedNative_.codehash == wrappedNativeCodeHash_ && adapter_.codehash == adapterCodeHash_
                && poolManager_.codehash == poolManagerCodeHash_
                && positionManager_.codehash == positionManagerCodeHash_,
            "code hash mismatch"
        );
        binder = msg.sender;
        manifestHash = manifestHash_;
        token = IERC20(token_);
        wrappedNative = wrappedNative_;
        wrappedNativeCodeHash = wrappedNativeCodeHash_;
        adapter = IRobinhoodLiquidityAdapter(adapter_);
        poolManager = poolManager_;
        positionManager = positionManager_;
        positionLock = positionLock_;
        adapterCodeHash = adapterCodeHash_;
        poolManagerCodeHash = poolManagerCodeHash_;
        positionManagerCodeHash = positionManagerCodeHash_;
    }

    function bindSale(address sale_) external {
        require(msg.sender == binder && address(sale) == address(0), "binding closed");
        require(
            sale_ != address(0) && address(ProRataFairLaunch(payable(sale_)).saleToken()) == address(token),
            "invalid sale"
        );
        require(ProRataFairLaunch(payable(sale_)).liquidityRecipient() == address(this), "wrong recipient");
        require(address(ProRataFairLaunch(payable(sale_)).quoteToken()) == address(0), "native quote only");
        require(ProRataFairLaunch(payable(sale_)).liquidityShareBps() > 0, "zero liquidity share");
        sale = ProRataFairLaunch(payable(sale_));
    }

    receive() external payable {
        require(address(sale) != address(0) && msg.sender == address(sale), "only sale");
    }

    function finalize() external nonReentrant returns (uint256 mintedPositionId) {
        require(!finalized && !retired, "closed");
        require(block.timestamp > sale.endsAt(), "sale open");
        require(!sale.isRefunding() && sale.totalContributed() >= sale.minimumRaise(), "sale failed");
        require(sale.totalSettledContribution() == sale.totalContributed(), "unsettled contributions");
        finalized = true;
        uint256 nativeAmount = sale.claimableQuote(address(this));
        require(nativeAmount > 0, "no liquidity quote");
        uint256 balanceBefore = address(this).balance;
        uint256 withdrawn = sale.withdrawQuote();
        require(withdrawn == nativeAmount && address(this).balance == balanceBefore + nativeAmount, "quote mismatch");
        uint256 tokenAmount = Math.mulDiv(nativeAmount, 1 ether, sale.pricePerToken());
        require(tokenAmount > 0 && tokenAmount <= token.balanceOf(address(this)), "liquidity allocation");
        require(
            wrappedNative.codehash == wrappedNativeCodeHash && address(adapter).codehash == adapterCodeHash
                && poolManager.codehash == poolManagerCodeHash && positionManager.codehash == positionManagerCodeHash,
            "code hash changed"
        );
        AdapterSecurityConfiguration memory security = adapter.securityConfiguration();
        require(security.callbackAuthority == poolManager, "invalid callback authority");
        require(security.enforcesInitialPrice && security.rejectsExistingPoolPriceMismatch, "price protection disabled");
        token.forceApprove(address(adapter), tokenAmount);
        CanonicalPoolDescriptor memory descriptor = adapter.mintPermanentPosition{value: nativeAmount}(
            address(token), wrappedNative, tokenAmount, positionLock
        );
        token.forceApprove(address(adapter), 0);
        _validateDescriptor(descriptor);
        canonicalPool = descriptor;
        mintedPositionId = descriptor.positionId;
        positionId = descriptor.positionId;
        uint256 unused = token.balanceOf(address(this));
        if (unused > 0) {
            _burnAndVerify(unused);
        }
        emit LiquidityFinalized(mintedPositionId, tokenAmount, nativeAmount);
        emit CanonicalPoolActivated(
            manifestHash,
            descriptor.token,
            descriptor.quoteToken,
            descriptor.venueId,
            descriptor.poolId,
            descriptor.fee,
            descriptor.tickSpacing,
            descriptor.hook,
            descriptor.positionId,
            descriptor.positionLock
        );
    }

    function retireFailedLaunch() external nonReentrant {
        require(!finalized && !retired, "closed");
        require(block.timestamp > sale.endsAt(), "sale open");
        bool terminal = block.timestamp > sale.claimDeadline();
        require(terminal || sale.isRefunding() || sale.totalContributed() < sale.minimumRaise(), "sale succeeded");
        require(sale.totalSettledContribution() == sale.totalContributed(), "unsettled contributions");
        retired = true;
        uint256 redirectedQuote = terminal ? sale.redirectExpiredLiquidityQuoteToProceeds() : 0;
        uint256 balance = token.balanceOf(address(this));
        _burnAndVerify(balance);
        if (terminal) emit UnfinalizedLiquidityRetired(balance, redirectedQuote);
        else emit FailedLiquidityAllocationBurned(balance);
    }

    function _burnAndVerify(uint256 amount) private {
        uint256 supplyBefore = token.totalSupply();
        IBurnableLiquidityToken(address(token)).burn(amount);
        require(token.totalSupply() == supplyBefore - amount, "burn ineffective");
    }

    function _validateDescriptor(CanonicalPoolDescriptor memory descriptor) private view {
        require(descriptor.token == address(token) && descriptor.quoteToken == wrappedNative, "pool asset mismatch");
        require(descriptor.venueId != bytes32(0) && descriptor.poolId != bytes32(0), "missing pool identity");
        require(descriptor.fee > 0 && descriptor.tickSpacing > 0, "invalid pool parameters");
        require(descriptor.positionId > 0 && descriptor.positionLock == positionLock, "position mismatch");
        IPermanentPositionReadback lock = IPermanentPositionReadback(positionLock);
        require(lock.locked() && lock.positionId() == descriptor.positionId, "position not locked");
    }
}
