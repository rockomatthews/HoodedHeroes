// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PositionManager} from "@uniswap/v4-periphery/src/PositionManager.sol";
import {IPositionDescriptor} from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";
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

contract LocalWETH9 {
    string public constant name = "Wrapped Native";
    string public constant symbol = "WNATIVE";
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    receive() external payable { deposit(); }
    function deposit() public payable { balanceOf[msg.sender] += msg.value; }
    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (from != msg.sender && allowance[from][msg.sender] != type(uint256).max) allowance[from][msg.sender] -= amount;
        return _transfer(from, to, amount);
    }
    function _transfer(address from, address to, uint256 amount) private returns (bool) {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract LocalForceFeeder {
    constructor() payable {}
    function detonate(address payable target) external { selfdestruct(target); }
}

contract LocalPositionSink {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

/// @notice Network-independent integration against the real v4 implementation and the production factory path.
contract RobinhoodUniswapV4LiquidityAdapterLocalTest is Test, DeployPermit2 {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    uint256 private constant APPROVER_KEY = 0xA770;
    address private constant CREATOR = address(0xC0FFEE);
    address private constant PROCEEDS = address(0xD1);
    address private constant COUNCIL = address(0xC0);
    address private constant ATTACKER = address(0xBAD1);
    uint24 private constant FEE = 3_000;
    int24 private constant TICK_SPACING = 60;

    PoolManager private poolManager;
    PositionManager private positionManager;
    IAllowanceTransfer private permit2;
    LocalWETH9 private weth;
    ProductionLiquidityDeployer private liquidityDeployer;
    ProductionLaunchFactory private factory;
    RobinhoodUniswapV4LiquidityAdapter private adapter;

    function setUp() public {
        vm.warp(1_000);
        poolManager = new PoolManager(address(0));
        permit2 = IAllowanceTransfer(deployPermit2());
        weth = new LocalWETH9();
        positionManager = new PositionManager(
            IPoolManager(address(poolManager)), permit2, 300_000, IPositionDescriptor(address(0)), IWETH9(address(weth))
        );
        ProductionTokenDeployer tokenDeployer = new ProductionTokenDeployer();
        ProductionSaleDeployer saleDeployer = new ProductionSaleDeployer();
        liquidityDeployer = new ProductionLiquidityDeployer();
        ProductionVestingDeployer vestingDeployer = new ProductionVestingDeployer();
        factory = new ProductionLaunchFactory(
            vm.addr(APPROVER_KEY), address(tokenDeployer), address(saleDeployer), address(liquidityDeployer), address(vestingDeployer)
        );
        adapter = _mineAndDeployAdapter();
    }

    function testProductionCoordinatorFinalizesAndProvenancePersists() public {
        (FixedSupplyLaunchToken token, ProRataFairLaunch sale, RobinhoodLiquidityCoordinator coordinator) =
            _launch(keccak256("local-finalize"), 1);
        assertEq(liquidityDeployer.coordinatorFactory(address(coordinator)), address(factory));
        assertEq(liquidityDeployer.pendingCoordinatorFactory(address(coordinator)), address(0));
        _subscribeAndSettle(sale, CREATOR, 100 ether);
        uint256 positionId = coordinator.finalize();
        assertGt(positionId, 0);
        assertTrue(PermanentPositionReceiver(coordinator.positionLock()).locked());
        assertEq(IERC20(address(token)).balanceOf(address(adapter)), 0);
        assertEq(IERC20(address(weth)).balanceOf(address(adapter)), 0);
    }

    function testAnyTokenHolderCannotInitializeCanonicalPoolThroughAdapter() public {
        (FixedSupplyLaunchToken token, ProRataFairLaunch sale, RobinhoodLiquidityCoordinator coordinator) =
            _launch(keccak256("holder-cannot-arm"), 2);
        _subscribeAndSettle(sale, ATTACKER, 100 ether);
        uint256 attackerTokens = token.balanceOf(ATTACKER);
        assertGt(attackerTokens, 0);
        vm.deal(ATTACKER, 10 ether);
        vm.startPrank(ATTACKER);
        LocalPositionSink sink = new LocalPositionSink();
        token.approve(address(adapter), attackerTokens);
        vm.expectRevert(bytes("not an approved coordinator"));
        adapter.mintPermanentPosition{value: 5 ether}(address(token), address(weth), attackerTokens, address(sink), ATTACKER);
        vm.stopPrank();
        (uint160 price,,,) = IPoolManager(address(poolManager)).getSlot0(_poolKey(address(token)).toId());
        assertEq(price, 0, "attacker initialized canonical pool");
        coordinator.finalize();
        assertTrue(PermanentPositionReceiver(coordinator.positionLock()).locked());
    }

    function testDirectAllocationHolderCannotArmPoolBeforeSale() public {
        (FixedSupplyLaunchToken token,,) = _launch(keccak256("allocation-cannot-arm"), 3);
        address holder = address(0xD5);
        assertEq(token.balanceOf(holder), 400 ether);
        vm.deal(holder, 10 ether);
        vm.startPrank(holder);
        LocalPositionSink sink = new LocalPositionSink();
        token.approve(address(adapter), 1 ether);
        vm.expectRevert(bytes("not an approved coordinator"));
        adapter.mintPermanentPosition{value: 7 ether}(address(token), address(weth), 1 ether, address(sink), holder);
        vm.stopPrank();
        (uint160 price,,,) = IPoolManager(address(poolManager)).getSlot0(_poolKey(address(token)).toId());
        assertEq(price, 0, "allocation holder initialized canonical pool");
    }

    function testPublicCoordinatorDeployerCannotForgeFactoryProvenance() public {
        FixedSupplyLaunchToken token = new FixedSupplyLaunchToken(
            "Forged Launch", "FORGE", 1_000 ether, address(this), keccak256("forged-coordinator")
        );
        (address forgedCoordinator, address forgedLock) = liquidityDeployer.deploy(
            keccak256("forged-coordinator"),
            address(token),
            address(weth),
            address(weth).codehash,
            address(adapter),
            address(adapter).codehash,
            address(poolManager),
            address(poolManager).codehash,
            address(positionManager),
            address(positionManager).codehash
        );
        assertEq(liquidityDeployer.coordinatorFactory(forgedCoordinator), address(this));
        token.transfer(forgedCoordinator, 150 ether);
        vm.deal(forgedCoordinator, 4 ether);
        vm.prank(forgedCoordinator);
        vm.expectRevert(bytes("not an approved coordinator"));
        adapter.mintPermanentPosition{value: 3.75 ether}(
            address(token), address(weth), 150 ether, forgedLock, PROCEEDS
        );
    }

    function testForceFedNativeCannotChangeCanonicalPriceOrLiquidity() public {
        (FixedSupplyLaunchToken cleanToken, ProRataFairLaunch cleanSale, RobinhoodLiquidityCoordinator cleanCoordinator) =
            _launch(keccak256("clean"), 4);
        (FixedSupplyLaunchToken fedToken, ProRataFairLaunch fedSale, RobinhoodLiquidityCoordinator fedCoordinator) =
            _launch(keccak256("force-fed"), 5);
        vm.startPrank(CREATOR);
        cleanSale.activate();
        fedSale.activate();
        vm.stopPrank();
        vm.deal(CREATOR, 200 ether);
        vm.warp(cleanSale.startsAt());
        vm.prank(CREATOR);
        cleanSale.contribute{value: 100 ether}(address(0));
        vm.prank(CREATOR);
        fedSale.contribute{value: 100 ether}(address(0));
        vm.warp(uint256(cleanSale.endsAt()) + 1);
        cleanSale.settleFor(CREATOR);
        fedSale.settleFor(CREATOR);
        cleanCoordinator.finalize();
        vm.deal(address(this), 1 ether);
        LocalForceFeeder feeder = new LocalForceFeeder{value: 1}();
        feeder.detonate(payable(address(adapter)));
        fedCoordinator.finalize();
        assertEq(
            fedCoordinator.canonicalSqrtPriceX96(),
            adapter.targetSqrtPriceX96(address(fedToken), 150 ether, 37.5 ether),
            "forced donation changed canonical price"
        );
        assertEq(fedCoordinator.canonicalLiquidity(), cleanCoordinator.canonicalLiquidity());
        assertEq(IERC20(address(cleanToken)).balanceOf(address(adapter)), 0);
        assertEq(IERC20(address(fedToken)).balanceOf(address(adapter)), 0);
        assertEq(address(adapter).balance, 0);
        assertGe(IERC20(address(weth)).balanceOf(PROCEEDS), 1);
    }

    function testHookRejectsDirectAndWrongManagerCalls() public {
        (FixedSupplyLaunchToken token,,) = _launch(keccak256("hook-guard"), 6);
        PoolKey memory key = _poolKey(address(token));
        vm.expectRevert(bytes("only pool manager"));
        adapter.beforeInitialize(address(adapter), key, TickMath.getSqrtPriceAtTick(0));
        vm.prank(ATTACKER);
        vm.expectRevert();
        poolManager.initialize(key, TickMath.getSqrtPriceAtTick(0));
    }

    function _mineAndDeployAdapter() private returns (RobinhoodUniswapV4LiquidityAdapter deployed) {
        bytes memory args = abi.encode(
            address(poolManager), address(positionManager), address(permit2), address(weth), FEE, TICK_SPACING,
            address(liquidityDeployer), address(factory)
        );
        RobinhoodUniswapV4AdapterDeployer deployer = new RobinhoodUniswapV4AdapterDeployer();
        (address predicted, bytes32 salt) = HookMiner.find(
            address(deployer), Hooks.BEFORE_INITIALIZE_FLAG, type(RobinhoodUniswapV4LiquidityAdapter).creationCode, args
        );
        deployed = RobinhoodUniswapV4LiquidityAdapter(payable(deployer.deploy(
            salt, address(poolManager), address(positionManager), address(permit2), address(weth), FEE, TICK_SPACING,
            address(liquidityDeployer), address(factory)
        )));
        assertEq(address(deployed), predicted);
    }

    function _launch(bytes32 manifestHash, uint256 nonce)
        private
        returns (FixedSupplyLaunchToken token, ProRataFairLaunch sale, RobinhoodLiquidityCoordinator coordinator)
    {
        ProductionLaunchFactory.TokenConfig memory tokenConfig =
            ProductionLaunchFactory.TokenConfig("Local Launch", "LOCAL", 1_000 ether, manifestHash);
        ProRataFairLaunch.Config memory saleConfig = _saleConfig();
        ProductionLaunchFactory.LiquidityConfig memory liquidity = ProductionLaunchFactory.LiquidityConfig({
            tokenAllocation: 150 ether, wrappedNative: address(weth), wrappedNativeCodeHash: address(weth).codehash,
            adapter: address(adapter), adapterCodeHash: address(adapter).codehash,
            poolManager: address(poolManager), poolManagerCodeHash: address(poolManager).codehash,
            positionManager: address(positionManager), positionManagerCodeHash: address(positionManager).codehash
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

    function _saleConfig() private view returns (ProRataFairLaunch.Config memory) {
        return ProRataFairLaunch.Config({
            saleToken: address(0), quoteToken: address(0), saleAllocation: 400 ether, pricePerToken: 0.25 ether,
            minimumRaise: 1 ether, maximumRaise: 100 ether, walletCap: 100 ether,
            startsAt: uint64(block.timestamp + 100), endsAt: uint64(block.timestamp + 200),
            claimDeadline: uint64(block.timestamp + 400), saleFeeBps: 0, creator: address(0),
            securityCouncil: COUNCIL, proceedsRecipient: PROCEEDS, liquidityRecipient: address(0),
            operationsRecipient: address(0xD2), rewardsRecipient: address(0xD3), referralRegistry: address(0),
            unsoldRecipient: address(0), eligibilitySigner: address(0), liquidityShareBps: 3_750, burnUnsold: true
        });
    }

    function _subscribeAndSettle(ProRataFairLaunch sale, address contributor, uint256 amount) private {
        vm.prank(CREATOR);
        sale.activate();
        vm.deal(contributor, amount);
        vm.warp(sale.startsAt());
        vm.prank(contributor);
        sale.contribute{value: amount}(address(0));
        vm.warp(uint256(sale.endsAt()) + 1);
        sale.settleFor(contributor);
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

    function _poolKey(address token) private view returns (PoolKey memory key) {
        bool tokenIsCurrency0 = token < address(weth);
        key = PoolKey({
            currency0: Currency.wrap(tokenIsCurrency0 ? token : address(weth)),
            currency1: Currency.wrap(tokenIsCurrency0 ? address(weth) : token),
            fee: FEE, tickSpacing: TICK_SPACING, hooks: IHooks(address(adapter))
        });
    }
}
