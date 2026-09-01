// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProductionLaunchFactory} from "../src/ProductionLaunchFactory.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";
import {
    RobinhoodLiquidityCoordinator,
    IRobinhoodLiquidityAdapter,
    CanonicalPoolDescriptor,
    AdapterSecurityConfiguration
} from "../src/RobinhoodLiquidityCoordinator.sol";
import {PermanentPositionReceiver} from "../src/PermanentPositionReceiver.sol";
import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {TokenVestingVault} from "../src/TokenVestingVault.sol";

interface ProductionVm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address sender) external;
    function deal(address who, uint256 newBalance) external;
    function warp(uint256 timestamp) external;
    function expectRevert(bytes calldata reason) external;
}

contract MockPositionManager is ERC721 {
    uint256 public nextId = 1;
    constructor() ERC721("Position", "LP") {}

    function mint(address recipient) external returns (uint256 id) {
        id = nextId++;
        _safeMint(recipient, id);
    }
}

contract MockRobinhoodAdapter is IRobinhoodLiquidityAdapter {
    MockPositionManager public immutable manager;

    constructor(address manager_) {
        manager = MockPositionManager(manager_);
    }

    function mintPermanentPosition(address token, address wrappedNative, uint256 tokenAmount, address recipient)
        external
        payable
        returns (CanonicalPoolDescriptor memory descriptor)
    {
        require(IERC20(token).transferFrom(msg.sender, address(this), tokenAmount), "token transfer");
        uint256 positionId = manager.mint(recipient);
        descriptor = CanonicalPoolDescriptor({
            token: token,
            quoteToken: wrappedNative,
            venueId: keccak256("uniswap-v4"),
            poolId: keccak256(abi.encode(token, wrappedNative, uint24(3_000), int24(60), address(0))),
            fee: 3_000,
            tickSpacing: 60,
            hook: address(0),
            positionId: positionId,
            positionLock: recipient
        });
    }

    function securityConfiguration() external view returns (AdapterSecurityConfiguration memory configuration) {
        configuration = AdapterSecurityConfiguration({
            callbackAuthority: address(manager), enforcesInitialPrice: true, rejectsExistingPoolPriceMismatch: true
        });
    }
}

contract ProductionLaunchFactoryTest {
    ProductionVm internal constant vm = ProductionVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant APPROVER_KEY = 0xA770;
    address internal constant CREATOR = address(0xC0FFEE);

    function testApprovedFactoryDistributesAndLocksPriceMatchedLiquidity() public {
        address approver = vm.addr(APPROVER_KEY);
        ProductionLaunchFactory factory = new ProductionLaunchFactory(approver);
        MockPositionManager manager = new MockPositionManager();
        MockRobinhoodAdapter adapter = new MockRobinhoodAdapter(address(manager));
        bytes32 manifestHash = keccak256("production-manifest");
        ProductionLaunchFactory.TokenConfig memory tokenConfig =
            ProductionLaunchFactory.TokenConfig("Launch", "LCH", 1_000 ether, manifestHash);
        ProRataFairLaunch.Config memory saleConfig = ProRataFairLaunch.Config({
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
        ProductionLaunchFactory.Allocation[] memory allocations = new ProductionLaunchFactory.Allocation[](2);
        allocations[0] = ProductionLaunchFactory.Allocation(address(0xD3), 300 ether);
        allocations[1] = ProductionLaunchFactory.Allocation(address(0xDA0), 100 ether);
        ProductionLaunchFactory.VestedAllocation[] memory vested = new ProductionLaunchFactory.VestedAllocation[](1);
        vested[0] = ProductionLaunchFactory.VestedAllocation(address(0xDA0), 50 ether, 730 days);
        uint256 nonce = 1;
        uint256 deadline = 1_000;
        bytes32 configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, allocations, vested);
        bytes memory signature = _approval(factory, manifestHash, configHash, nonce, deadline);
        vm.prank(CREATOR);
        (address tokenAddress, address saleAddress) = factory.createApprovedLaunch(
            tokenConfig, saleConfig, liquidity, allocations, vested, nonce, deadline, signature
        );
        ProRataFairLaunch sale = ProRataFairLaunch(payable(saleAddress));
        RobinhoodLiquidityCoordinator coordinator = RobinhoodLiquidityCoordinator(payable(sale.liquidityRecipient()));
        assert(FixedSupplyLaunchToken(tokenAddress).balanceOf(address(coordinator)) == 150 ether);
        vm.prank(CREATOR);
        sale.activate();
        vm.deal(CREATOR, 100 ether);
        vm.warp(100);
        vm.prank(CREATOR);
        sale.contribute{value: 100 ether}(address(0));
        vm.warp(201);
        sale.settleFor(CREATOR);
        uint256 positionId = coordinator.finalize();
        PermanentPositionReceiver lock = PermanentPositionReceiver(coordinator.positionLock());
        assert(positionId == 1 && lock.locked() && lock.positionId() == 1);
        (
            address poolToken,
            address poolQuote,
            bytes32 venueId,
            bytes32 poolId,
            uint24 fee,
            int24 tickSpacing,
            address hook,
            uint256 storedPositionId,
            address storedPositionLock
        ) = coordinator.canonicalPool();
        assert(poolToken == tokenAddress && poolQuote == address(manager));
        assert(venueId == keccak256("uniswap-v4") && poolId != bytes32(0));
        assert(fee == 3_000 && tickSpacing == 60 && hook == address(0));
        assert(storedPositionId == positionId && storedPositionLock == address(lock));
        assert(coordinator.manifestHash() == manifestHash);
        assert(manager.ownerOf(1) == address(lock));
        assert(FixedSupplyLaunchToken(tokenAddress).balanceOf(address(adapter)) == 150 ether);
        TokenVestingVault vesting = TokenVestingVault(factory.vestingVaultFor(manifestHash, 0));
        assert(address(vesting.token()) == tokenAddress);
        assert(vesting.beneficiary() == address(0xDA0));
        assert(vesting.duration() == 730 days);
        assert(vesting.startsAt() == saleConfig.endsAt);
        assert(FixedSupplyLaunchToken(tokenAddress).balanceOf(address(vesting)) == 50 ether);
    }

    function testApprovalBindsEveryConfigurationField() public {
        address approver = vm.addr(APPROVER_KEY);
        ProductionLaunchFactory factory = new ProductionLaunchFactory(approver);
        MockPositionManager manager = new MockPositionManager();
        MockRobinhoodAdapter adapter = new MockRobinhoodAdapter(address(manager));
        bytes32 manifestHash = keccak256("bound-manifest");
        ProductionLaunchFactory.TokenConfig memory tokenConfig =
            ProductionLaunchFactory.TokenConfig("Launch", "LCH", 1_000 ether, manifestHash);
        ProRataFairLaunch.Config memory saleConfig = _saleConfig();
        ProductionLaunchFactory.LiquidityConfig memory liquidity = _liquidity(manager, adapter);
        ProductionLaunchFactory.Allocation[] memory direct = new ProductionLaunchFactory.Allocation[](1);
        direct[0] = ProductionLaunchFactory.Allocation(address(0xD1), 400 ether);
        ProductionLaunchFactory.VestedAllocation[] memory vested = new ProductionLaunchFactory.VestedAllocation[](1);
        vested[0] = ProductionLaunchFactory.VestedAllocation(address(0xD2), 50 ether, 730 days);
        bytes32 configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        bytes memory signature = _approval(factory, manifestHash, configHash, 7, 1_000);
        saleConfig.saleFeeBps = 100;
        vm.prank(CREATOR);
        vm.expectRevert(bytes("invalid approval"));
        factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, direct, vested, 7, 1_000, signature);
    }

    function testFactoryRejectsNonNativeQuoteZeroLiquidityShareAndShortVesting() public {
        address approver = vm.addr(APPROVER_KEY);
        ProductionLaunchFactory factory = new ProductionLaunchFactory(approver);
        MockPositionManager manager = new MockPositionManager();
        MockRobinhoodAdapter adapter = new MockRobinhoodAdapter(address(manager));
        ProductionLaunchFactory.LiquidityConfig memory liquidity = _liquidity(manager, adapter);
        ProductionLaunchFactory.Allocation[] memory direct = new ProductionLaunchFactory.Allocation[](1);
        direct[0] = ProductionLaunchFactory.Allocation(address(0xD1), 400 ether);
        ProductionLaunchFactory.VestedAllocation[] memory vested = new ProductionLaunchFactory.VestedAllocation[](1);
        vested[0] = ProductionLaunchFactory.VestedAllocation(address(0xD2), 50 ether, 730 days);

        ProductionLaunchFactory.TokenConfig memory tokenConfig =
            ProductionLaunchFactory.TokenConfig("Launch", "LCH", 1_000 ether, keccak256("erc20-quote"));
        ProRataFairLaunch.Config memory saleConfig = _saleConfig();
        saleConfig.quoteToken = address(manager);
        bytes32 configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        bytes memory signature = _approval(factory, tokenConfig.manifestHash, configHash, 8, 1_000);
        vm.expectRevert(bytes("native quote only"));
        vm.prank(CREATOR);
        factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, direct, vested, 8, 1_000, signature);

        tokenConfig.manifestHash = keccak256("zero-share");
        saleConfig = _saleConfig();
        saleConfig.liquidityShareBps = 0;
        configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        signature = _approval(factory, tokenConfig.manifestHash, configHash, 9, 1_000);
        vm.expectRevert(bytes("zero liquidity share"));
        vm.prank(CREATOR);
        factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, direct, vested, 9, 1_000, signature);

        tokenConfig.manifestHash = keccak256("short-vesting");
        saleConfig = _saleConfig();
        vested[0].duration = 729 days;
        configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        signature = _approval(factory, tokenConfig.manifestHash, configHash, 10, 1_000);
        vm.expectRevert(bytes("vesting below minimum"));
        vm.prank(CREATOR);
        factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, direct, vested, 10, 1_000, signature);
    }

    function testFactoryRejectsUndersizedLiquidityAndVestingOutsideFiveToTenPercent() public {
        address approver = vm.addr(APPROVER_KEY);
        ProductionLaunchFactory factory = new ProductionLaunchFactory(approver);
        MockPositionManager manager = new MockPositionManager();
        MockRobinhoodAdapter adapter = new MockRobinhoodAdapter(address(manager));
        ProductionLaunchFactory.TokenConfig memory tokenConfig =
            ProductionLaunchFactory.TokenConfig("Launch", "LCH", 1_000 ether, keccak256("undersized-liquidity"));
        ProRataFairLaunch.Config memory saleConfig = _saleConfig();
        ProductionLaunchFactory.LiquidityConfig memory liquidity = _liquidity(manager, adapter);
        ProductionLaunchFactory.Allocation[] memory direct = new ProductionLaunchFactory.Allocation[](1);
        direct[0] = ProductionLaunchFactory.Allocation(address(0xD1), 400 ether);
        ProductionLaunchFactory.VestedAllocation[] memory vested = new ProductionLaunchFactory.VestedAllocation[](1);
        vested[0] = ProductionLaunchFactory.VestedAllocation(address(0xD2), 50 ether, 730 days);

        liquidity.tokenAllocation = 149 ether;
        bytes32 configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        bytes memory signature = _approval(factory, tokenConfig.manifestHash, configHash, 11, 1_000);
        vm.expectRevert(bytes("liquidity allocation too small"));
        vm.prank(CREATOR);
        factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, direct, vested, 11, 1_000, signature);

        liquidity.tokenAllocation = 150 ether;
        tokenConfig.manifestHash = keccak256("vesting-too-small");
        direct[0].amount = 450 ether - 1;
        vested[0].amount = 1;
        configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        signature = _approval(factory, tokenConfig.manifestHash, configHash, 12, 1_000);
        vm.expectRevert(bytes("vested allocation too small"));
        vm.prank(CREATOR);
        factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, direct, vested, 12, 1_000, signature);

        tokenConfig.manifestHash = keccak256("vesting-too-large");
        direct[0].amount = 349 ether;
        vested[0].amount = 101 ether;
        configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        signature = _approval(factory, tokenConfig.manifestHash, configHash, 13, 1_000);
        vm.expectRevert(bytes("vested allocation too large"));
        vm.prank(CREATOR);
        factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, direct, vested, 13, 1_000, signature);
    }

    function testFactoryRejectsPastSaleEndBeforeDeployingVesting() public {
        vm.warp(1_000);
        ProductionLaunchFactory factory = new ProductionLaunchFactory(vm.addr(APPROVER_KEY));
        MockPositionManager manager = new MockPositionManager();
        MockRobinhoodAdapter adapter = new MockRobinhoodAdapter(address(manager));
        ProductionLaunchFactory.TokenConfig memory tokenConfig =
            ProductionLaunchFactory.TokenConfig("Launch", "LCH", 1_000 ether, keccak256("past-sale-window"));
        ProRataFairLaunch.Config memory saleConfig = _saleConfig();
        ProductionLaunchFactory.LiquidityConfig memory liquidity = _liquidity(manager, adapter);
        ProductionLaunchFactory.Allocation[] memory direct = new ProductionLaunchFactory.Allocation[](1);
        direct[0] = ProductionLaunchFactory.Allocation(address(0xD1), 400 ether);
        ProductionLaunchFactory.VestedAllocation[] memory vested = new ProductionLaunchFactory.VestedAllocation[](1);
        vested[0] = ProductionLaunchFactory.VestedAllocation(address(0xD2), 50 ether, 730 days);
        bytes32 configHash = factory.hashLaunchConfiguration(tokenConfig, saleConfig, liquidity, direct, vested);
        bytes memory signature = _approval(factory, tokenConfig.manifestHash, configHash, 14, 2_000);

        vm.expectRevert(bytes("sale window in the past"));
        vm.prank(CREATOR);
        factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, direct, vested, 14, 2_000, signature);
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

    function _liquidity(MockPositionManager manager, MockRobinhoodAdapter adapter)
        private
        view
        returns (ProductionLaunchFactory.LiquidityConfig memory)
    {
        return ProductionLaunchFactory.LiquidityConfig({
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
    }

    function _approval(
        ProductionLaunchFactory factory,
        bytes32 manifestHash,
        bytes32 configHash,
        uint256 nonce,
        uint256 deadline
    ) private returns (bytes memory) {
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
