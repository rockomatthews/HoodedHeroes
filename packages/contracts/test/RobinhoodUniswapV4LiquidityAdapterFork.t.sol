// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {PermanentPositionReceiver} from "../src/PermanentPositionReceiver.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";
import {RobinhoodLiquidityCoordinator} from "../src/RobinhoodLiquidityCoordinator.sol";
import {ProductionLaunchFactory} from "../src/ProductionLaunchFactory.sol";
import {
    ProductionTokenDeployer,
    ProductionSaleDeployer,
    ProductionLiquidityDeployer,
    ProductionVestingDeployer
} from "../src/ProductionComponentDeployers.sol";
import {RobinhoodUniswapV4LiquidityAdapter} from "../src/RobinhoodUniswapV4LiquidityAdapter.sol";
import {RobinhoodUniswapV4AdapterDeployer} from "../src/RobinhoodUniswapV4AdapterDeployer.sol";

contract ForkPositionSink {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

/// @notice Opt-in integration against the canonical Robinhood Chain v4 deployment. Never broadcasts.
contract RobinhoodUniswapV4LiquidityAdapterForkTest is Test {
    using StateLibrary for IPoolManager;

    address private constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address private constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address private constant POSITION_MANAGER = 0x58daec3116aae6D93017bAAea7749052E8a04fA7;
    address private constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    uint256 private constant APPROVER_KEY = 0xA770;
    address private constant CREATOR = address(0xC0FFEE);
    address private constant ATTACKER = address(0xBAD1);
    uint24 private constant FEE = 3_000;
    int24 private constant TICK_SPACING = 60;

    ProductionLiquidityDeployer private liquidityDeployer;
    ProductionLaunchFactory private factory;
    RobinhoodUniswapV4LiquidityAdapter private adapter;

    function testCanonicalBindingsAndFactoryProvenanceWhenEnabled() public {
        if (!_setUpForkCandidate()) return;
        assertEq(address(adapter.poolManager()), POOL_MANAGER);
        assertEq(address(adapter.positionManager()), POSITION_MANAGER);
        assertEq(address(adapter.permit2()), PERMIT2);
        assertEq(address(adapter.wrappedNative()), WETH);
        assertEq(adapter.coordinatorDeployer(), address(liquidityDeployer));
        assertEq(adapter.authorizedFactory(), address(factory));
        assertEq(adapter.coordinatorDeployerCodeHash(), address(liquidityDeployer).codehash);
    }

    function testUnboundHolderCannotInitializeButFactoryCoordinatorFinalizesWhenEnabled() public {
        if (!_setUpForkCandidate()) return;
        (FixedSupplyLaunchToken token, ProRataFairLaunch sale, RobinhoodLiquidityCoordinator coordinator) =
            _launch(keccak256("fork-h7"), 1);
        vm.prank(CREATOR);
        sale.activate();
        vm.deal(ATTACKER, 101 ether);
        vm.warp(sale.startsAt());
        vm.prank(ATTACKER);
        sale.contribute{value: 100 ether}(address(0));
        vm.warp(uint256(sale.endsAt()) + 1);
        sale.settleFor(ATTACKER);

        uint256 attackerTokens = token.balanceOf(ATTACKER);
        vm.startPrank(ATTACKER);
        ForkPositionSink sink = new ForkPositionSink();
        token.approve(address(adapter), attackerTokens);
        vm.expectRevert(bytes("not an approved coordinator"));
        adapter.mintPermanentPosition{value: 1 ether}(address(token), WETH, attackerTokens, address(sink), ATTACKER);
        vm.stopPrank();

        uint256 positionId = coordinator.finalize();
        assertEq(liquidityDeployer.coordinatorFactory(address(coordinator)), address(factory));
        assertEq(IERC721(POSITION_MANAGER).ownerOf(positionId), coordinator.positionLock());
        assertTrue(PermanentPositionReceiver(coordinator.positionLock()).locked());
        assertGt(coordinator.canonicalLiquidity(), 0);
        (,,, bytes32 poolId,,,,,) = coordinator.canonicalPool();
        (uint160 price,,,) = IPoolManager(POOL_MANAGER).getSlot0(PoolId.wrap(poolId));
        assertEq(price, coordinator.canonicalSqrtPriceX96());
        assertEq(token.balanceOf(address(adapter)), 0);
        assertEq(IERC20(WETH).balanceOf(address(adapter)), 0);
        assertEq(address(adapter).balance, 0);
    }

    function testConstructorRejectsWrongCanonicalBindingsWhenEnabled() public {
        if (!_selectRobinhoodFork()) return;
        _deployFactory();
        RobinhoodUniswapV4AdapterDeployer deployer = new RobinhoodUniswapV4AdapterDeployer();
        vm.expectRevert(bytes("wrong pool manager"));
        _mineAndDeploy(deployer, address(0x1111), POSITION_MANAGER, PERMIT2, WETH);
        vm.expectRevert(bytes("wrong permit2"));
        _mineAndDeploy(deployer, POOL_MANAGER, POSITION_MANAGER, address(0x2222), WETH);
    }

    function _setUpForkCandidate() private returns (bool) {
        if (!_selectRobinhoodFork()) return false;
        _deployFactory();
        adapter = _mineAndDeploy(new RobinhoodUniswapV4AdapterDeployer(), POOL_MANAGER, POSITION_MANAGER, PERMIT2, WETH);
        return true;
    }

    function _deployFactory() private {
        liquidityDeployer = new ProductionLiquidityDeployer();
        factory = new ProductionLaunchFactory(
            vm.addr(APPROVER_KEY),
            address(new ProductionTokenDeployer()),
            address(new ProductionSaleDeployer()),
            address(liquidityDeployer),
            address(new ProductionVestingDeployer())
        );
    }

    function _mineAndDeploy(RobinhoodUniswapV4AdapterDeployer deployer, address manager, address positions, address permit, address weth)
        private returns (RobinhoodUniswapV4LiquidityAdapter deployed)
    {
        bytes memory args = abi.encode(
            manager, positions, permit, weth, FEE, TICK_SPACING, address(liquidityDeployer), address(factory)
        );
        (, bytes32 salt) = HookMiner.find(
            address(deployer), Hooks.BEFORE_INITIALIZE_FLAG, type(RobinhoodUniswapV4LiquidityAdapter).creationCode, args
        );
        deployed = RobinhoodUniswapV4LiquidityAdapter(payable(deployer.deploy(
            salt, manager, positions, permit, weth, FEE, TICK_SPACING, address(liquidityDeployer), address(factory)
        )));
    }

    function _launch(bytes32 manifestHash, uint256 nonce)
        private returns (FixedSupplyLaunchToken token, ProRataFairLaunch sale, RobinhoodLiquidityCoordinator coordinator)
    {
        ProductionLaunchFactory.TokenConfig memory tokenConfig =
            ProductionLaunchFactory.TokenConfig("Fork Launch", "FORK", 1_000 ether, manifestHash);
        ProRataFairLaunch.Config memory saleConfig = ProRataFairLaunch.Config({
            saleToken: address(0), quoteToken: address(0), saleAllocation: 400 ether, pricePerToken: 0.25 ether,
            minimumRaise: 1 ether, maximumRaise: 100 ether, walletCap: 100 ether,
            startsAt: uint64(block.timestamp + 100), endsAt: uint64(block.timestamp + 200),
            claimDeadline: uint64(block.timestamp + 400), saleFeeBps: 0, creator: address(0),
            securityCouncil: address(0xC0), proceedsRecipient: address(0xD1), liquidityRecipient: address(0),
            operationsRecipient: address(0xD2), rewardsRecipient: address(0xD3), referralRegistry: address(0),
            unsoldRecipient: address(0), eligibilitySigner: address(0), liquidityShareBps: 3_750, burnUnsold: true
        });
        ProductionLaunchFactory.LiquidityConfig memory liquidity = ProductionLaunchFactory.LiquidityConfig({
            tokenAllocation: 150 ether, wrappedNative: WETH, wrappedNativeCodeHash: WETH.codehash,
            adapter: address(adapter), adapterCodeHash: address(adapter).codehash,
            poolManager: POOL_MANAGER, poolManagerCodeHash: POOL_MANAGER.codehash,
            positionManager: POSITION_MANAGER, positionManagerCodeHash: POSITION_MANAGER.codehash
        });
        ProductionLaunchFactory.Allocation[] memory direct = new ProductionLaunchFactory.Allocation[](1);
        direct[0] = ProductionLaunchFactory.Allocation(address(0xD5), 400 ether);
        ProductionLaunchFactory.VestedAllocation[] memory vested = new ProductionLaunchFactory.VestedAllocation[](1);
        vested[0] = ProductionLaunchFactory.VestedAllocation(address(0xDA0), 50 ether, 730 days);
        bytes32 configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        bytes memory signature = _approval(manifestHash, configHash, nonce);
        vm.prank(CREATOR);
        (address tokenAddress, address saleAddress) = factory.createApprovedLaunch(
            tokenConfig, saleConfig, liquidity, direct, vested, nonce, type(uint64).max, signature
        );
        token = FixedSupplyLaunchToken(tokenAddress);
        sale = ProRataFairLaunch(payable(saleAddress));
        coordinator = RobinhoodLiquidityCoordinator(payable(sale.liquidityRecipient()));
    }

    function _approval(bytes32 manifestHash, bytes32 configHash, uint256 nonce) private view returns (bytes memory) {
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("HOODED Launch Approval")), keccak256(bytes("1")), block.chainid, address(factory)
        ));
        bytes32 structHash = keccak256(abi.encode(
            factory.APPROVAL_TYPEHASH(), CREATOR, manifestHash, configHash, nonce, uint256(type(uint64).max)
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(APPROVER_KEY, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }

    function _selectRobinhoodFork() private returns (bool) {
        if (!vm.envOr("RUN_MAINNET_FORK_TESTS", false)) { vm.skip(true); return false; }
        string memory rpc = vm.envOr("RH_RPC_URL", string(""));
        require(bytes(rpc).length > 0, "RH_RPC_URL required");
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 4_663, "wrong fork chain");
        return true;
    }
}
