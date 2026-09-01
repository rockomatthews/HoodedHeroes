// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProductionLaunchFactory} from "../src/ProductionLaunchFactory.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";
import {RobinhoodLiquidityCoordinator, IRobinhoodLiquidityAdapter} from "../src/RobinhoodLiquidityCoordinator.sol";
import {PermanentPositionReceiver} from "../src/PermanentPositionReceiver.sol";
import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";

interface ProductionVm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address sender) external;
    function deal(address who, uint256 newBalance) external;
    function warp(uint256 timestamp) external;
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

    function mintPermanentPosition(address token, address, uint256 tokenAmount, address recipient)
        external
        payable
        returns (uint256 positionId)
    {
        require(IERC20(token).transferFrom(msg.sender, address(this), tokenAmount), "token transfer");
        positionId = manager.mint(recipient);
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
        ProductionLaunchFactory.Allocation[] memory allocations = new ProductionLaunchFactory.Allocation[](1);
        allocations[0] = ProductionLaunchFactory.Allocation(address(0xDA0), 450 ether);
        uint256 nonce = 1;
        uint256 deadline = 1_000;
        bytes memory signature = _approval(factory, manifestHash, nonce, deadline);
        vm.prank(CREATOR);
        (address tokenAddress, address saleAddress) =
            factory.createApprovedLaunch(tokenConfig, saleConfig, liquidity, allocations, nonce, deadline, signature);
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
        assert(manager.ownerOf(1) == address(lock));
        assert(FixedSupplyLaunchToken(tokenAddress).balanceOf(address(adapter)) == 150 ether);
    }

    function _approval(ProductionLaunchFactory factory, bytes32 manifestHash, uint256 nonce, uint256 deadline)
        private
        returns (bytes memory)
    {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("HOODED Launch Approval")),
                keccak256(bytes("1")),
                block.chainid,
                address(factory)
            )
        );
        bytes32 structHash = keccak256(abi.encode(factory.APPROVAL_TYPEHASH(), CREATOR, manifestHash, nonce, deadline));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(APPROVER_KEY, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }
}
