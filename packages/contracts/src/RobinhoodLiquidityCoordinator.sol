// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {PositionInfo, PositionInfoLibrary} from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";
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
    function mintPermanentPosition(
        address token,
        address wrappedNative,
        uint256 tokenAmount,
        address positionRecipient,
        address refundRecipient
    ) external payable returns (CanonicalPoolDescriptor memory descriptor);

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
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using PositionInfoLibrary for PositionInfo;

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
    uint160 public canonicalSqrtPriceX96;
    uint128 public canonicalLiquidity;
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
        require(block.timestamp <= sale.claimDeadline(), "finalization expired");
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
        require(security.callbackAuthority == address(0), "unexpected callback surface");
        require(security.enforcesInitialPrice && security.rejectsExistingPoolPriceMismatch, "price protection disabled");
        token.forceApprove(address(adapter), tokenAmount);
        CanonicalPoolDescriptor memory descriptor = adapter.mintPermanentPosition{value: nativeAmount}(
            address(token), wrappedNative, tokenAmount, positionLock, sale.proceedsRecipient()
        );
        token.forceApprove(address(adapter), 0);
        (uint160 sqrtPriceX96, uint128 liquidity) = _validateDescriptor(descriptor, tokenAmount, nativeAmount);
        canonicalPool = descriptor;
        canonicalSqrtPriceX96 = sqrtPriceX96;
        canonicalLiquidity = liquidity;
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

    function _validateDescriptor(CanonicalPoolDescriptor memory descriptor, uint256 tokenAmount, uint256 nativeAmount)
        private
        view
        returns (uint160 sqrtPriceX96, uint128 liquidity)
    {
        require(descriptor.token == address(token) && descriptor.quoteToken == wrappedNative, "pool asset mismatch");
        require(descriptor.venueId != bytes32(0) && descriptor.poolId != bytes32(0), "missing pool identity");
        require(descriptor.fee > 0 && descriptor.tickSpacing > 0, "invalid pool parameters");
        require(descriptor.hook == address(0), "hook not allowed");
        require(descriptor.positionId > 0 && descriptor.positionLock == positionLock, "position mismatch");
        IPermanentPositionReadback lock = IPermanentPositionReadback(positionLock);
        require(lock.locked() && lock.positionId() == descriptor.positionId, "position not locked");

        bool tokenIsCurrency0 = address(token) < wrappedNative;
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(tokenIsCurrency0 ? address(token) : wrappedNative),
            currency1: Currency.wrap(tokenIsCurrency0 ? wrappedNative : address(token)),
            fee: descriptor.fee,
            tickSpacing: descriptor.tickSpacing,
            hooks: IHooks(address(0))
        });
        PoolId id = key.toId();
        require(PoolId.unwrap(id) == descriptor.poolId, "pool id mismatch");
        uint256 amount0 = tokenIsCurrency0 ? tokenAmount : nativeAmount;
        uint256 amount1 = tokenIsCurrency0 ? nativeAmount : tokenAmount;
        uint160 targetSqrtPriceX96 = _encodeSqrtRatioX96(amount1, amount0);
        (sqrtPriceX96,,,) = IPoolManager(poolManager).getSlot0(id);
        require(sqrtPriceX96 == targetSqrtPriceX96, "pool price mismatch");

        IPositionManager manager = IPositionManager(positionManager);
        (PoolKey memory positionKey, PositionInfo positionInfo) = manager.getPoolAndPositionInfo(descriptor.positionId);
        require(PoolId.unwrap(positionKey.toId()) == descriptor.poolId, "position pool mismatch");
        int24 expectedTickLower = (TickMath.MIN_TICK / descriptor.tickSpacing) * descriptor.tickSpacing;
        int24 expectedTickUpper = (TickMath.MAX_TICK / descriptor.tickSpacing) * descriptor.tickSpacing;
        require(
            positionInfo.tickLower() == expectedTickLower && positionInfo.tickUpper() == expectedTickUpper,
            "position range mismatch"
        );
        require(IERC721(positionManager).ownerOf(descriptor.positionId) == positionLock, "position owner mismatch");
        liquidity = manager.getPositionLiquidity(descriptor.positionId);
        uint128 expectedLiquidity = LiquidityAmounts.getLiquidityForAmounts(
            targetSqrtPriceX96,
            TickMath.getSqrtPriceAtTick(expectedTickLower),
            TickMath.getSqrtPriceAtTick(expectedTickUpper),
            amount0,
            amount1
        );
        require(expectedLiquidity > 0 && liquidity == expectedLiquidity, "position liquidity mismatch");
    }

    function _encodeSqrtRatioX96(uint256 amount1, uint256 amount0) private pure returns (uint160 sqrtPriceX96) {
        require(amount0 > 0 && amount1 > 0, "zero price amount");
        uint256 ratioX192 = Math.mulDiv(amount1, uint256(1) << 192, amount0);
        uint256 sqrtRatio = Math.sqrt(ratioX192);
        require(sqrtRatio >= TickMath.MIN_SQRT_PRICE && sqrtRatio <= TickMath.MAX_SQRT_PRICE, "price out of range");
        sqrtPriceX96 = uint160(sqrtRatio);
    }
}
