// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
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
        if (from != msg.sender && allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] -= amount;
        }
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

/// @notice Network-independent integration against the pinned real v4 implementation.
contract RobinhoodUniswapV4LiquidityAdapterLocalTest is Test, DeployPermit2 {
    uint24 private constant FEE = 3_000;
    int24 private constant TICK_SPACING = 60;

    PoolManager private poolManager;
    PositionManager private positionManager;
    IAllowanceTransfer private permit2;
    LocalWETH9 private weth;
    RobinhoodUniswapV4LiquidityAdapter private adapter;
    FixedSupplyLaunchToken private token;
    PermanentPositionReceiver private lock;

    function setUp() public {
        poolManager = new PoolManager(address(0));
        permit2 = IAllowanceTransfer(deployPermit2());
        weth = new LocalWETH9();
        positionManager = new PositionManager(
            IPoolManager(address(poolManager)), permit2, 300_000, IPositionDescriptor(address(0)), IWETH9(address(weth))
        );
        bytes memory args = abi.encode(
            address(poolManager), address(positionManager), address(permit2), address(weth), FEE, TICK_SPACING
        );
        RobinhoodUniswapV4AdapterDeployer adapterDeployer = new RobinhoodUniswapV4AdapterDeployer();
        (address predicted, bytes32 salt) = HookMiner.find(
            address(adapterDeployer), Hooks.BEFORE_INITIALIZE_FLAG, type(RobinhoodUniswapV4LiquidityAdapter).creationCode, args
        );
        adapter = RobinhoodUniswapV4LiquidityAdapter(
            payable(adapterDeployer.deploy(
                salt, address(poolManager), address(positionManager), address(permit2), address(weth), FEE, TICK_SPACING
            ))
        );
        assertEq(address(adapter), predicted);
        token = new FixedSupplyLaunchToken("Local Launch", "LOCAL", 1_000 ether, address(this), keccak256("local"));
        lock = new PermanentPositionReceiver(address(positionManager), address(adapter));
    }

    function testForceFedNativeCannotBrickSharedAdapter() public {
        vm.deal(address(this), 10 ether);
        LocalForceFeeder feeder = new LocalForceFeeder{value: 1}();
        feeder.detonate(payable(address(adapter)));
        assertEq(address(adapter).balance, 1);

        uint256 refundBefore = IERC20(address(weth)).balanceOf(address(this));
        token.approve(address(adapter), 150 ether);
        adapter.mintPermanentPosition{value: 3.75 ether}(
            address(token), address(weth), 150 ether, address(lock), address(this)
        );
        assertEq(address(adapter).balance, 0);
        assertEq(IERC20(address(weth)).balanceOf(address(adapter)), 0);
        assertGe(IERC20(address(weth)).balanceOf(address(this)), refundBefore + 1);
        assertTrue(lock.locked());
    }

    function testOutsiderCannotInitializeCanonicalPoolAtWrongPrice() public {
        PoolKey memory key = _poolKey();
        vm.prank(address(0xBAD));
        vm.expectRevert();
        poolManager.initialize(key, TickMath.getSqrtPriceAtTick(0));

        vm.deal(address(this), 4 ether);
        token.approve(address(adapter), 150 ether);
        adapter.mintPermanentPosition{value: 3.75 ether}(
            address(token), address(weth), 150 ether, address(lock), address(this)
        );
        assertTrue(lock.locked());
    }

    function testHookRejectsDirectAndWrongManagerCalls() public {
        PoolKey memory key = _poolKey();
        vm.expectRevert(bytes("only pool manager"));
        adapter.beforeInitialize(address(adapter), key, TickMath.getSqrtPriceAtTick(0));
    }

    function _poolKey() private view returns (PoolKey memory key) {
        bool tokenIsCurrency0 = address(token) < address(weth);
        key = PoolKey({
            currency0: Currency.wrap(tokenIsCurrency0 ? address(token) : address(weth)),
            currency1: Currency.wrap(tokenIsCurrency0 ? address(weth) : address(token)),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(adapter))
        });
    }
}
