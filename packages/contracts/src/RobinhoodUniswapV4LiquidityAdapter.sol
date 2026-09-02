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
import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {
    AdapterSecurityConfiguration,
    CanonicalPoolDescriptor,
    IRobinhoodLiquidityAdapter
} from "./RobinhoodLiquidityCoordinator.sol";

interface IHoodedPositionManager is IPositionManager {
    function permit2() external view returns (IAllowanceTransfer);
}

interface IPermanentPositionRegistrar {
    function registerPosition(uint256 tokenId) external;
}

/// @notice Auditable, no-hook Uniswap v4 liquidity adapter for Robinhood Chain.
/// @dev The immutable constructor configuration is embedded in the runtime bytecode pinned by the coordinator.
///      This contract has no owner, callbacks, arbitrary-call surface, fee collection, or rescue function.
contract RobinhoodUniswapV4LiquidityAdapter is IRobinhoodLiquidityAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    bytes32 public constant VENUE_ID = keccak256("HOODED_UNISWAP_V4_ROBINHOOD");

    IPoolManager public immutable poolManager;
    IHoodedPositionManager public immutable positionManager;
    IAllowanceTransfer public immutable permit2;
    IWETH9 public immutable wrappedNative;
    uint24 public immutable fee;
    int24 public immutable tickSpacing;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;

    event V4PositionMinted(
        bytes32 indexed poolId,
        uint256 indexed positionId,
        address indexed positionRecipient,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        uint256 tokenAmount,
        uint256 nativeAmount,
        uint256 tokenRefund,
        uint256 wrappedNativeRefund
    );

    constructor(
        address poolManager_,
        address positionManager_,
        address permit2_,
        address wrappedNative_,
        uint24 fee_,
        int24 tickSpacing_
    ) {
        require(
            poolManager_ != address(0) && positionManager_ != address(0) && permit2_ != address(0)
                && wrappedNative_ != address(0),
            "zero address"
        );
        require(fee_ > 0 && fee_ < 1_000_000, "invalid fee");
        require(tickSpacing_ > 0 && tickSpacing_ <= TickMath.MAX_TICK_SPACING, "invalid tick spacing");
        poolManager = IPoolManager(poolManager_);
        positionManager = IHoodedPositionManager(positionManager_);
        permit2 = IAllowanceTransfer(permit2_);
        wrappedNative = IWETH9(wrappedNative_);
        fee = fee_;
        tickSpacing = tickSpacing_;
        tickLower = (TickMath.MIN_TICK / tickSpacing_) * tickSpacing_;
        tickUpper = (TickMath.MAX_TICK / tickSpacing_) * tickSpacing_;
        require(address(positionManager.poolManager()) == poolManager_, "wrong pool manager");
        require(address(positionManager.permit2()) == permit2_, "wrong permit2");
    }

    receive() external payable {
        require(msg.sender == address(wrappedNative), "only wrapped native");
    }

    function securityConfiguration() external pure returns (AdapterSecurityConfiguration memory configuration) {
        configuration = AdapterSecurityConfiguration({
            callbackAuthority: address(0), enforcesInitialPrice: true, rejectsExistingPoolPriceMismatch: true
        });
    }

    function mintPermanentPosition(
        address token,
        address wrappedNative_,
        uint256 tokenAmount,
        address positionRecipient,
        address refundRecipient
    ) external payable nonReentrant returns (CanonicalPoolDescriptor memory descriptor) {
        require(
            token != address(0) && token != wrappedNative_ && wrappedNative_ == address(wrappedNative)
                && positionRecipient != address(0) && refundRecipient != address(0),
            "invalid request"
        );
        require(tokenAmount > 0 && msg.value > 0, "zero liquidity");
        require(tokenAmount <= type(uint128).max && msg.value <= type(uint128).max, "amount overflow");

        IERC20 launchToken = IERC20(token);
        launchToken.safeTransferFrom(msg.sender, address(this), tokenAmount);
        wrappedNative.deposit{value: msg.value}();

        (PoolKey memory key, uint256 amount0, uint256 amount1) = _poolKeyAndAmounts(token, tokenAmount, msg.value);
        PoolId id = key.toId();
        uint160 targetPriceX96 = _encodeSqrtRatioX96(amount1, amount0);
        (uint160 existingSqrtPriceX96,,,) = poolManager.getSlot0(id);
        if (existingSqrtPriceX96 == 0) {
            poolManager.initialize(key, targetPriceX96);
        } else {
            require(existingSqrtPriceX96 == targetPriceX96, "existing pool price mismatch");
        }
        (uint160 initializedSqrtPriceX96,,,) = poolManager.getSlot0(id);
        require(initializedSqrtPriceX96 == targetPriceX96, "initial price mismatch");

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            targetPriceX96,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            amount0,
            amount1
        );
        require(liquidity > 0, "zero position liquidity");

        _approveForPositionManager(launchToken, tokenAmount);
        _approveForPositionManager(IERC20(address(wrappedNative)), msg.value);

        uint256 expectedPositionId = positionManager.nextTokenId();
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory parameters = new bytes[](2);
        parameters[0] = abi.encode(
            key, tickLower, tickUpper, liquidity, uint128(amount0), uint128(amount1), positionRecipient, bytes("")
        );
        parameters[1] = abi.encode(key.currency0, key.currency1);
        positionManager.modifyLiquidities(abi.encode(actions, parameters), block.timestamp);

        _clearPositionManagerApproval(launchToken);
        _clearPositionManagerApproval(IERC20(address(wrappedNative)));

        require(
            IERC721(address(positionManager)).ownerOf(expectedPositionId) == positionRecipient,
            "position owner mismatch"
        );
        require(positionManager.getPositionLiquidity(expectedPositionId) == liquidity, "position liquidity mismatch");
        IPermanentPositionRegistrar(positionRecipient).registerPosition(expectedPositionId);

        uint256 tokenRefund = launchToken.balanceOf(address(this));
        if (tokenRefund > 0) launchToken.safeTransfer(msg.sender, tokenRefund);
        uint256 wrappedNativeRefund = IERC20(address(wrappedNative)).balanceOf(address(this));
        if (wrappedNativeRefund > 0) IERC20(address(wrappedNative)).safeTransfer(refundRecipient, wrappedNativeRefund);
        require(address(this).balance == 0, "native residue");
        require(launchToken.balanceOf(address(this)) == 0, "token residue");
        require(IERC20(address(wrappedNative)).balanceOf(address(this)) == 0, "wrapped residue");

        descriptor = CanonicalPoolDescriptor({
            token: token,
            quoteToken: wrappedNative_,
            venueId: VENUE_ID,
            poolId: PoolId.unwrap(id),
            fee: fee,
            tickSpacing: tickSpacing,
            hook: address(0),
            positionId: expectedPositionId,
            positionLock: positionRecipient
        });
        emit V4PositionMinted(
            descriptor.poolId,
            expectedPositionId,
            positionRecipient,
            targetPriceX96,
            liquidity,
            tokenAmount,
            msg.value,
            tokenRefund,
            wrappedNativeRefund
        );
    }

    function targetSqrtPriceX96(address token, uint256 tokenAmount, uint256 nativeAmount)
        external
        view
        returns (uint160)
    {
        (, uint256 amount0, uint256 amount1) = _poolKeyAndAmounts(token, tokenAmount, nativeAmount);
        return _encodeSqrtRatioX96(amount1, amount0);
    }

    function _poolKeyAndAmounts(address token, uint256 tokenAmount, uint256 nativeAmount)
        private
        view
        returns (PoolKey memory key, uint256 amount0, uint256 amount1)
    {
        bool tokenIsCurrency0 = token < address(wrappedNative);
        address currency0 = tokenIsCurrency0 ? token : address(wrappedNative);
        address currency1 = tokenIsCurrency0 ? address(wrappedNative) : token;
        amount0 = tokenIsCurrency0 ? tokenAmount : nativeAmount;
        amount1 = tokenIsCurrency0 ? nativeAmount : tokenAmount;
        key = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });
    }

    function _encodeSqrtRatioX96(uint256 amount1, uint256 amount0) private pure returns (uint160 sqrtPriceX96) {
        require(amount0 > 0 && amount1 > 0, "zero price amount");
        uint256 ratioX192 = Math.mulDiv(amount1, uint256(1) << 192, amount0);
        uint256 sqrtRatio = Math.sqrt(ratioX192);
        require(sqrtRatio >= TickMath.MIN_SQRT_PRICE && sqrtRatio <= TickMath.MAX_SQRT_PRICE, "price out of range");
        sqrtPriceX96 = uint160(sqrtRatio);
    }

    function _approveForPositionManager(IERC20 asset, uint256 amount) private {
        require(amount <= type(uint160).max, "permit2 amount overflow");
        asset.forceApprove(address(permit2), amount);
        permit2.approve(address(asset), address(positionManager), uint160(amount), uint48(block.timestamp));
    }

    function _clearPositionManagerApproval(IERC20 asset) private {
        permit2.approve(address(asset), address(positionManager), 0, 0);
        asset.forceApprove(address(permit2), 0);
        (uint160 remaining,,) = permit2.allowance(address(this), address(asset), address(positionManager));
        require(remaining == 0 && asset.allowance(address(this), address(permit2)) == 0, "allowance not cleared");
    }
}
