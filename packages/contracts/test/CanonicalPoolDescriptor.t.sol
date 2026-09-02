// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PositionInfo} from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {PositionInfoLibrary} from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {ProductionLaunchFactory} from "../src/ProductionLaunchFactory.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";
import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {PermanentPositionReceiver} from "../src/PermanentPositionReceiver.sol";
import {
    ProductionTokenDeployer,
    ProductionSaleDeployer,
    ProductionLiquidityDeployer,
    ProductionVestingDeployer
} from "../src/ProductionComponentDeployers.sol";
import {
    RobinhoodLiquidityCoordinator,
    IRobinhoodLiquidityAdapter,
    CanonicalPoolDescriptor,
    AdapterSecurityConfiguration
} from "../src/RobinhoodLiquidityCoordinator.sol";

contract DescriptorPositionManager is ERC721 {
    using PoolIdLibrary for PoolKey;
    using PositionInfoLibrary for PositionInfo;

    uint256 public nextId = 1;
    PoolKey private configuredPoolKey;
    uint160 private configuredSqrtPriceX96;
    PositionInfo private configuredPositionInfo;
    uint128 private configuredLiquidity;

    constructor() ERC721("Descriptor Position", "DLP") {}

    function mint(address recipient) external returns (uint256 id) {
        id = nextId++;
        _safeMint(recipient, id);
    }

    function configure(PoolKey calldata key, uint160 sqrtPriceX96, uint128 liquidity, int24 lower, int24 upper)
        external
    {
        configuredPoolKey = key;
        configuredSqrtPriceX96 = sqrtPriceX96;
        configuredPositionInfo = PositionInfoLibrary.initialize(key, lower, upper);
        configuredLiquidity = liquidity;
    }

    function extsload(bytes32) external view returns (bytes32) {
        return bytes32(uint256(configuredSqrtPriceX96));
    }

    function getPoolAndPositionInfo(uint256) external view returns (PoolKey memory, PositionInfo) {
        return (configuredPoolKey, configuredPositionInfo);
    }

    function getPositionLiquidity(uint256) external view returns (uint128) {
        return configuredLiquidity;
    }
}

contract DescriptorAdapter is IRobinhoodLiquidityAdapter {
    using PoolIdLibrary for PoolKey;

    DescriptorPositionManager public immutable manager;
    uint8 public immutable mode;

    constructor(address manager_, uint8 mode_) {
        manager = DescriptorPositionManager(manager_);
        mode = mode_;
    }

    function securityConfiguration() external view returns (AdapterSecurityConfiguration memory configuration) {
        configuration = AdapterSecurityConfiguration({
            callbackAuthority: mode == 1 ? address(0xBAD) : address(0),
            enforcesInitialPrice: mode != 2,
            rejectsExistingPoolPriceMismatch: mode != 2
        });
    }

    function mintPermanentPosition(
        address token,
        address wrappedNative,
        uint256 tokenAmount,
        address recipient,
        address
    ) external payable returns (CanonicalPoolDescriptor memory descriptor) {
        require(IERC20(token).transferFrom(msg.sender, address(this), tokenAmount), "token transfer");
        bool tokenIsCurrency0 = token < wrappedNative;
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(tokenIsCurrency0 ? token : wrappedNative),
            currency1: Currency.wrap(tokenIsCurrency0 ? wrappedNative : token),
            fee: 3_000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        uint256 amount0 = tokenIsCurrency0 ? tokenAmount : msg.value;
        uint256 amount1 = tokenIsCurrency0 ? msg.value : tokenAmount;
        uint160 sqrtPriceX96 = uint160(Math.sqrt(Math.mulDiv(amount1, uint256(1) << 192, amount0)));
        int24 lower = (TickMath.MIN_TICK / int24(60)) * int24(60);
        int24 upper = (TickMath.MAX_TICK / int24(60)) * int24(60);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96, TickMath.getSqrtPriceAtTick(lower), TickMath.getSqrtPriceAtTick(upper), amount0, amount1
        );
        manager.configure(key, mode == 7 ? sqrtPriceX96 + 1 : sqrtPriceX96, mode == 6 ? 1 : liquidity, lower, upper);
        uint256 positionId = manager.mint(recipient);
        descriptor = CanonicalPoolDescriptor({
            token: mode == 3 ? address(0xBAD) : token,
            quoteToken: wrappedNative,
            venueId: keccak256("uniswap-v4"),
            poolId: mode == 4 ? bytes32(0) : PoolId.unwrap(key.toId()),
            fee: 3_000,
            tickSpacing: 60,
            hook: mode == 8 ? address(0x1234) : address(0),
            positionId: mode == 5 ? positionId + 1 : positionId,
            positionLock: recipient
        });
    }
}

contract DescriptorForceFeeder {
    constructor() payable {}

    function detonate(address payable target) external {
        selfdestruct(target);
    }
}

contract CanonicalPoolDescriptorTest is Test {
    uint256 private constant APPROVER_KEY = 0xA770;
    address private constant CREATOR = address(0xC0FFEE);
    bytes32 private constant EVENT_SIGNATURE = keccak256(
        "CanonicalPoolActivated(bytes32,address,address,bytes32,bytes32,uint24,int24,address,uint256,address)"
    );

    function testCanonicalPoolEventMatchesImmutableReadback() public {
        (
            RobinhoodLiquidityCoordinator coordinator,
            ProRataFairLaunch sale,
            address token,
            address quote,
            bytes32 manifestHash
        ) = _readyLaunch(0, 1);

        vm.recordLogs();
        uint256 finalizedPositionId = coordinator.finalize();
        Vm.Log[] memory logs = vm.getRecordedLogs();

        (
            address storedToken,
            address storedQuote,
            bytes32 venueId,
            bytes32 poolId,
            uint24 fee,
            int24 tickSpacing,
            address hook,
            uint256 positionId,
            address positionLock
        ) = coordinator.canonicalPool();
        assertEq(storedToken, token);
        assertEq(storedQuote, quote);
        assertEq(venueId, keccak256("uniswap-v4"));
        assertTrue(poolId != bytes32(0));
        assertEq(fee, 3_000);
        assertEq(tickSpacing, 60);
        assertEq(hook, address(0));
        assertEq(positionId, finalizedPositionId);
        assertEq(positionLock, coordinator.positionLock());
        assertEq(coordinator.manifestHash(), manifestHash);
        assertTrue(coordinator.finalized());
        assertEq(sale.totalSettledContribution(), sale.totalContributed());

        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(coordinator) || logs[i].topics[0] != EVENT_SIGNATURE) continue;
            found = true;
            assertEq(logs[i].topics[1], manifestHash);
            assertEq(address(uint160(uint256(logs[i].topics[2]))), token);
            assertEq(address(uint160(uint256(logs[i].topics[3]))), quote);
            (
                bytes32 eventVenue,
                bytes32 eventPoolId,
                uint24 eventFee,
                int24 eventTickSpacing,
                address eventHook,
                uint256 eventPositionId,
                address eventPositionLock
            ) = abi.decode(logs[i].data, (bytes32, bytes32, uint24, int24, address, uint256, address));
            assertEq(eventVenue, venueId);
            assertEq(eventPoolId, poolId);
            assertEq(eventFee, fee);
            assertEq(eventTickSpacing, tickSpacing);
            assertEq(eventHook, hook);
            assertEq(eventPositionId, positionId);
            assertEq(eventPositionLock, positionLock);
        }
        assertTrue(found, "canonical event missing");

        vm.expectRevert(bytes("closed"));
        coordinator.finalize();
        (,,,,,,, uint256 unchangedPositionId,) = coordinator.canonicalPool();
        assertEq(unchangedPositionId, positionId);
    }

    function testFinalizeRejectsWrongCallbackAuthority() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunch(1, 2);
        vm.expectRevert(bytes("unexpected callback surface"));
        coordinator.finalize();
        assertFalse(coordinator.finalized());
    }

    function testFinalizeRejectsDisabledPriceProtection() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunch(2, 3);
        vm.expectRevert(bytes("price protection disabled"));
        coordinator.finalize();
        assertFalse(coordinator.finalized());
    }

    function testFinalizeRejectsWrongPoolAssets() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunch(3, 4);
        vm.expectRevert(bytes("pool asset mismatch"));
        coordinator.finalize();
        assertFalse(coordinator.finalized());
    }

    function testFinalizeRejectsMissingPoolIdentity() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunch(4, 5);
        vm.expectRevert(bytes("missing pool identity"));
        coordinator.finalize();
        assertFalse(coordinator.finalized());
    }

    function testFinalizeRejectsPositionThatDoesNotMatchPermanentLock() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunch(5, 6);
        vm.expectRevert(bytes("position not locked"));
        coordinator.finalize();
        assertFalse(coordinator.finalized());
    }

    function testFinalizeRejectsAdapterThatMintsOnlyDustLiquidity() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunch(6, 61);
        vm.expectRevert(bytes("position liquidity mismatch"));
        coordinator.finalize();
        assertFalse(coordinator.finalized());
    }

    function testFinalizeRejectsAdapterWhosePoolPriceDoesNotMatchSale() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunch(7, 62);
        vm.expectRevert(bytes("pool price mismatch"));
        coordinator.finalize();
        assertFalse(coordinator.finalized());
    }

    function testFinalizeRejectsAnyHook() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunch(8, 63);
        vm.expectRevert(bytes("hook not allowed"));
        coordinator.finalize();
        assertFalse(coordinator.finalized());
    }

    function testFinalizeIgnoresForceFedNativeBalance() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunch(0, 7);
        vm.deal(address(this), 1);
        DescriptorForceFeeder feeder = new DescriptorForceFeeder{value: 1}();
        feeder.detonate(payable(address(coordinator)));
        assertEq(address(coordinator).balance, 1);

        assertEq(coordinator.finalize(), 1);
        assertTrue(coordinator.finalized());
        assertEq(address(coordinator).balance, 1, "donation was used to size liquidity");
    }

    function testFinalizeIgnoresNativeBalancePrefundedAtPredictedAddress() public {
        (RobinhoodLiquidityCoordinator coordinator,,,,) = _readyLaunchWithPrefund(0, 8, 1);
        assertEq(address(coordinator).balance, 1, "predicted address was not prefunded");

        assertEq(coordinator.finalize(), 1);
        assertEq(address(coordinator).balance, 1, "prefunding was used to size liquidity");
    }

    function testTerminalRetirementBurnsAllocationAndRedirectsAccountedQuote() public {
        (RobinhoodLiquidityCoordinator coordinator, ProRataFairLaunch sale, address token,,) = _readyLaunch(2, 9);
        vm.expectRevert(bytes("price protection disabled"));
        coordinator.finalize();
        assertEq(sale.claimableQuote(address(coordinator)), 37.5 ether);
        uint256 proceedsBefore = sale.claimableQuote(sale.proceedsRecipient());

        vm.warp(uint256(sale.claimDeadline()) + 1);
        uint256 supplyBefore = FixedSupplyLaunchToken(token).totalSupply();
        coordinator.retireFailedLaunch();

        assertTrue(coordinator.retired());
        assertEq(FixedSupplyLaunchToken(token).balanceOf(address(coordinator)), 0);
        assertEq(FixedSupplyLaunchToken(token).totalSupply(), supplyBefore - 150 ether);
        assertEq(sale.claimableQuote(address(coordinator)), 0);
        assertEq(sale.claimableQuote(sale.proceedsRecipient()), proceedsBefore + 37.5 ether);
    }

    function testFinalizationAndTerminalRetirementWindowsNeverOverlap() public {
        (RobinhoodLiquidityCoordinator coordinator, ProRataFairLaunch sale,,,) = _readyLaunch(0, 10);
        uint256 snapshot = vm.snapshotState();

        vm.warp(sale.claimDeadline());
        vm.expectRevert(bytes("sale succeeded"));
        coordinator.retireFailedLaunch();
        assertEq(coordinator.finalize(), 1, "finalization should remain open at the deadline");

        assertTrue(vm.revertToState(snapshot), "snapshot restore failed");
        vm.warp(uint256(sale.claimDeadline()) + 1);
        vm.expectRevert(bytes("finalization expired"));
        coordinator.finalize();
        coordinator.retireFailedLaunch();
        assertTrue(coordinator.retired(), "terminal retirement did not open after the deadline");
    }

    function _readyLaunch(uint8 adapterMode, uint256 nonce)
        private
        returns (
            RobinhoodLiquidityCoordinator coordinator,
            ProRataFairLaunch sale,
            address token,
            address quote,
            bytes32 manifestHash
        )
    {
        return _readyLaunchWithPrefund(adapterMode, nonce, 0);
    }

    function _readyLaunchWithPrefund(uint8 adapterMode, uint256 nonce, uint256 prefund)
        private
        returns (
            RobinhoodLiquidityCoordinator coordinator,
            ProRataFairLaunch sale,
            address token,
            address quote,
            bytes32 manifestHash
        )
    {
        ProductionLaunchFactory factory = _factory(vm.addr(APPROVER_KEY));
        DescriptorPositionManager manager = new DescriptorPositionManager();
        DescriptorAdapter adapter = new DescriptorAdapter(address(manager), adapterMode);
        manifestHash = keccak256(abi.encode("canonical-pool", adapterMode, nonce));
        ProductionLaunchFactory.TokenConfig memory tokenConfig =
            ProductionLaunchFactory.TokenConfig("Launch", "LCH", 1_000 ether, manifestHash);
        ProRataFairLaunch.Config memory saleConfig = _saleConfig();
        ProductionLaunchFactory.LiquidityConfig memory liquidity = ProductionLaunchFactory.LiquidityConfig({
            tokenAllocation: 150 ether,
            wrappedNative: address(manager),
            wrappedNativeCodeHash: address(manager).codehash,
            adapter: address(adapter),
            adapterCodeHash: address(adapter).codehash,
            poolManager: address(manager),
            poolManagerCodeHash: address(manager).codehash,
            positionManager: address(manager),
            positionManagerCodeHash: address(manager).codehash
        });
        ProductionLaunchFactory.Allocation[] memory direct = new ProductionLaunchFactory.Allocation[](1);
        direct[0] = ProductionLaunchFactory.Allocation(address(0xD5), 400 ether);
        ProductionLaunchFactory.VestedAllocation[] memory vested = new ProductionLaunchFactory.VestedAllocation[](1);
        vested[0] = ProductionLaunchFactory.VestedAllocation(address(0xDA0), 50 ether, 730 days);
        bytes32 configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        bytes memory signature = _approval(factory, manifestHash, configHash, nonce, 1_000);

        if (prefund > 0) {
            address predictedToken = vm.computeCreate2Address(
                keccak256(abi.encode(address(factory), manifestHash, "TOKEN")),
                keccak256(
                    abi.encodePacked(
                        type(FixedSupplyLaunchToken).creationCode,
                        abi.encode("Launch", "LCH", uint256(1_000 ether), address(factory), manifestHash)
                    )
                ),
                address(factory.tokenDeployer())
            );
            address predictedLock = vm.computeCreate2Address(
                keccak256(abi.encode(address(factory), manifestHash, "POSITION_LOCK")),
                keccak256(
                    abi.encodePacked(
                        type(PermanentPositionReceiver).creationCode, abi.encode(address(manager), address(adapter))
                    )
                ),
                address(factory.liquidityDeployer())
            );
            address predictedCoordinator = vm.computeCreate2Address(
                keccak256(abi.encode(address(factory), manifestHash, "LIQUIDITY_COORDINATOR")),
                keccak256(
                    abi.encodePacked(
                        type(RobinhoodLiquidityCoordinator).creationCode,
                        abi.encode(
                            manifestHash,
                            predictedToken,
                            address(manager),
                            address(manager).codehash,
                            address(adapter),
                            address(adapter).codehash,
                            address(manager),
                            address(manager).codehash,
                            address(manager),
                            address(manager).codehash,
                            predictedLock
                        )
                    )
                ),
                address(factory.liquidityDeployer())
            );
            assertEq(predictedCoordinator.code.length, 0);
            vm.deal(address(this), prefund);
            (bool sent,) = payable(predictedCoordinator).call{value: prefund}("");
            assertTrue(sent, "prefund failed");
        }

        vm.prank(CREATOR);
        (address tokenAddress, address saleAddress) =
            factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, direct, vested, nonce, 1_000, signature);
        token = tokenAddress;
        sale = ProRataFairLaunch(payable(saleAddress));
        coordinator = RobinhoodLiquidityCoordinator(payable(sale.liquidityRecipient()));
        quote = address(manager);
        vm.prank(CREATOR);
        sale.activate();
        vm.deal(CREATOR, 100 ether);
        vm.warp(100);
        vm.prank(CREATOR);
        sale.contribute{value: 100 ether}(address(0));
        vm.warp(201);
        sale.settleFor(CREATOR);
    }

    function _factory(address approver) private returns (ProductionLaunchFactory) {
        ProductionTokenDeployer tokenDeployer = new ProductionTokenDeployer();
        ProductionSaleDeployer saleDeployer = new ProductionSaleDeployer();
        ProductionLiquidityDeployer liquidityDeployer = new ProductionLiquidityDeployer();
        ProductionVestingDeployer vestingDeployer = new ProductionVestingDeployer();
        return new ProductionLaunchFactory(
            approver,
            address(tokenDeployer),
            address(saleDeployer),
            address(liquidityDeployer),
            address(vestingDeployer)
        );
    }

    function _saleConfig() private pure returns (ProRataFairLaunch.Config memory) {
        return ProRataFairLaunch.Config({
            saleToken: address(0),
            quoteToken: address(0),
            saleAllocation: 400 ether,
            pricePerToken: 0.25 ether,
            minimumRaise: 1 ether,
            maximumRaise: 100 ether,
            walletCap: 100 ether,
            startsAt: 100,
            endsAt: 200,
            claimDeadline: 400,
            saleFeeBps: 0,
            creator: address(0),
            securityCouncil: address(0xC0),
            proceedsRecipient: address(0xD1),
            liquidityRecipient: address(0),
            operationsRecipient: address(0xD2),
            rewardsRecipient: address(0xD3),
            referralRegistry: address(0),
            unsoldRecipient: address(0),
            eligibilitySigner: address(0),
            liquidityShareBps: 3_750,
            burnUnsold: true
        });
    }

    function _approval(
        ProductionLaunchFactory factory,
        bytes32 manifestHash,
        bytes32 configHash,
        uint256 nonce,
        uint256 deadline
    ) private view returns (bytes memory) {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("HOODED Launch Approval")),
                keccak256(bytes("1")),
                block.chainid,
                address(factory)
            )
        );
        bytes32 structHash =
            keccak256(abi.encode(factory.APPROVAL_TYPEHASH(), CREATOR, manifestHash, configHash, nonce, deadline));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(APPROVER_KEY, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }
}
