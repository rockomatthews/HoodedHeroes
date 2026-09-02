// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {PermanentPositionReceiver} from "../src/PermanentPositionReceiver.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";
import {CanonicalPoolDescriptor, RobinhoodLiquidityCoordinator} from "../src/RobinhoodLiquidityCoordinator.sol";
import {RobinhoodUniswapV4LiquidityAdapter} from "../src/RobinhoodUniswapV4LiquidityAdapter.sol";

/// @notice Opt-in integration against a local fork of the canonical Robinhood Chain v4 deployment.
/// @dev This never broadcasts. Enable with RUN_MAINNET_FORK_TESTS=true and RH_RPC_URL in `.env`.
contract RobinhoodUniswapV4LiquidityAdapterForkTest is Test {
    using StateLibrary for IPoolManager;

    address private constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address private constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address private constant POSITION_MANAGER = 0x58daec3116aae6D93017bAAea7749052E8a04fA7;
    address private constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    uint24 private constant FEE = 3_000;
    int24 private constant TICK_SPACING = 60;

    receive() external payable {}

    function testRobinhoodV4MintPriceLockAndAllowanceCleanupWhenEnabled() public {
        if (!_selectRobinhoodFork()) return;

        RobinhoodUniswapV4LiquidityAdapter adapter = _deployAdapter();
        PermanentPositionReceiver lock = new PermanentPositionReceiver(POSITION_MANAGER, address(adapter));
        FixedSupplyLaunchToken token = new FixedSupplyLaunchToken(
            "HOODED Adapter Fork", "HAF", 1_000_000_000 ether, address(this), keccak256("hooded-adapter-fork")
        );
        uint256 tokenAmount = 150_000_000 ether;
        uint256 nativeAmount = 3.75 ether;
        token.approve(address(adapter), tokenAmount);
        vm.deal(address(this), 10 ether);

        CanonicalPoolDescriptor memory descriptor = adapter.mintPermanentPosition{value: nativeAmount}(
            address(token), WETH, tokenAmount, address(lock), address(this)
        );

        assertEq(descriptor.token, address(token));
        assertEq(descriptor.quoteToken, WETH);
        assertEq(descriptor.venueId, adapter.VENUE_ID());
        assertEq(descriptor.fee, FEE);
        assertEq(descriptor.tickSpacing, TICK_SPACING);
        assertEq(descriptor.hook, address(0));
        assertEq(descriptor.positionLock, address(lock));
        assertTrue(lock.locked());
        assertEq(lock.positionId(), descriptor.positionId);
        assertEq(IERC721(POSITION_MANAGER).ownerOf(descriptor.positionId), address(lock));
        assertGt(adapter.positionManager().getPositionLiquidity(descriptor.positionId), 0);

        (uint160 actualSqrtPriceX96,,,) = IPoolManager(POOL_MANAGER).getSlot0(PoolId.wrap(descriptor.poolId));
        assertEq(actualSqrtPriceX96, adapter.targetSqrtPriceX96(address(token), tokenAmount, nativeAmount));
        assertEq(token.balanceOf(address(adapter)), 0);
        assertEq(IERC20(WETH).balanceOf(address(adapter)), 0);
        assertEq(address(adapter).balance, 0);
        (uint160 tokenPermit2Allowance,,) =
            IAllowanceTransfer(PERMIT2).allowance(address(adapter), address(token), POSITION_MANAGER);
        (uint160 wethPermit2Allowance,,) =
            IAllowanceTransfer(PERMIT2).allowance(address(adapter), WETH, POSITION_MANAGER);
        assertEq(tokenPermit2Allowance, 0);
        assertEq(wethPermit2Allowance, 0);
        assertEq(token.allowance(address(adapter), PERMIT2), 0);
        assertEq(IERC20(WETH).allowance(address(adapter), PERMIT2), 0);

        token.approve(address(adapter), tokenAmount);
        vm.expectRevert(bytes("existing pool price mismatch"));
        adapter.mintPermanentPosition{value: 3 ether}(address(token), WETH, tokenAmount, address(lock), address(this));

        (bool callbackSucceeded,) = address(adapter).call(abi.encodeWithSignature("unlockCallback(bytes)", bytes("")));
        assertFalse(callbackSucceeded, "adapter unexpectedly exposes a callback");
    }

    function testConstructorRejectsWrongCanonicalBindingsWhenEnabled() public {
        if (!_selectRobinhoodFork()) return;
        vm.expectRevert(bytes("wrong pool manager"));
        new RobinhoodUniswapV4LiquidityAdapter(address(0x1111), POSITION_MANAGER, PERMIT2, WETH, FEE, TICK_SPACING);
        vm.expectRevert(bytes("wrong permit2"));
        new RobinhoodUniswapV4LiquidityAdapter(POOL_MANAGER, POSITION_MANAGER, address(0x2222), WETH, FEE, TICK_SPACING);
    }

    function testRobinhoodSaleToCanonicalPoolEndToEndWhenEnabled() public {
        if (!_selectRobinhoodFork()) return;

        RobinhoodUniswapV4LiquidityAdapter adapter = _deployAdapter();
        PermanentPositionReceiver lock = new PermanentPositionReceiver(POSITION_MANAGER, address(adapter));
        bytes32 manifestHash = keccak256("hooded-sale-to-v4-fork");
        FixedSupplyLaunchToken token = new FixedSupplyLaunchToken(
            "HOODED End-to-End Fork", "HE2E", 1_000_000_000 ether, address(this), manifestHash
        );
        RobinhoodLiquidityCoordinator coordinator = new RobinhoodLiquidityCoordinator(
            manifestHash,
            address(token),
            WETH,
            WETH.codehash,
            address(adapter),
            address(adapter).codehash,
            POOL_MANAGER,
            POOL_MANAGER.codehash,
            POSITION_MANAGER,
            POSITION_MANAGER.codehash,
            address(lock)
        );
        ProRataFairLaunch.Config memory config = ProRataFairLaunch.Config({
            saleToken: address(token),
            quoteToken: address(0),
            saleAllocation: 400_000_000 ether,
            pricePerToken: 0.000000025 ether,
            minimumRaise: 0.25 ether,
            maximumRaise: 10 ether,
            walletCap: 10 ether,
            startsAt: uint64(block.timestamp + 10),
            endsAt: uint64(block.timestamp + 100),
            claimDeadline: uint64(block.timestamp + 30 days),
            saleFeeBps: 75,
            creator: address(this),
            securityCouncil: address(0xC0),
            proceedsRecipient: address(this),
            liquidityRecipient: address(coordinator),
            operationsRecipient: address(0xD2),
            rewardsRecipient: address(0xD3),
            referralRegistry: address(0),
            unsoldRecipient: address(0xD4),
            eligibilitySigner: address(0),
            liquidityShareBps: 3_750,
            burnUnsold: true
        });
        ProRataFairLaunch sale = new ProRataFairLaunch(config);
        coordinator.bindSale(address(sale));
        token.transfer(address(sale), 400_000_000 ether);
        token.transfer(address(coordinator), 150_000_000 ether);
        sale.activate();

        vm.deal(address(this), 11 ether);
        vm.warp(config.startsAt);
        sale.contribute{value: 10 ether}(address(0));
        vm.warp(uint256(config.endsAt) + 1);
        sale.settleFor(address(this));
        uint256 positionId = coordinator.finalize();

        assertTrue(coordinator.finalized());
        assertEq(coordinator.positionId(), positionId);
        assertEq(IERC721(POSITION_MANAGER).ownerOf(positionId), address(lock));
        assertGt(coordinator.canonicalLiquidity(), 0);
        (,,, bytes32 poolId,,,,,) = coordinator.canonicalPool();
        (uint160 poolPrice,,,) = IPoolManager(POOL_MANAGER).getSlot0(PoolId.wrap(poolId));
        assertEq(poolPrice, coordinator.canonicalSqrtPriceX96());
        assertEq(token.balanceOf(address(adapter)), 0);
        assertEq(IERC20(WETH).balanceOf(address(adapter)), 0);
        assertEq(address(adapter).balance, 0);
    }

    function _selectRobinhoodFork() private returns (bool) {
        if (!vm.envOr("RUN_MAINNET_FORK_TESTS", false)) return false;
        string memory rpc = vm.envOr("RH_RPC_URL", string(""));
        require(bytes(rpc).length > 0, "RH_RPC_URL required");
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 4_663, "wrong fork chain");
        return true;
    }

    function _deployAdapter() private returns (RobinhoodUniswapV4LiquidityAdapter) {
        return new RobinhoodUniswapV4LiquidityAdapter(POOL_MANAGER, POSITION_MANAGER, PERMIT2, WETH, FEE, TICK_SPACING);
    }
}
