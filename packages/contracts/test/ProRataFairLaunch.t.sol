// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";

interface Vm {
    function deal(address who, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata reason) external;
}

contract ProRataFairLaunchTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant COUNCIL = address(0xC0);
    address internal constant PROCEEDS = address(0xD1);
    address internal constant OPERATIONS = address(0xD2);
    address internal constant REWARDS = address(0xD3);
    address internal constant UNSOLD = address(0xD4);

    function testOversubscriptionIsProRataAndRefundsRemainder() public {
        (FixedSupplyLaunchToken token, ProRataFairLaunch sale) = _nativeSale(20 ether, 100 ether, 100 ether, 0);
        vm.deal(ALICE, 100 ether);
        vm.deal(BOB, 100 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 80 ether}(address(0));
        vm.prank(BOB);
        sale.contribute{value: 80 ether}(address(0));

        (uint256 aliceTokens, uint256 aliceAccepted, uint256 aliceRefund) = sale.preview(ALICE);
        assert(aliceTokens == 500 ether);
        assert(aliceAccepted == 50 ether);
        assert(aliceRefund == 30 ether);

        vm.warp(201);
        vm.prank(ALICE);
        sale.claim();
        vm.prank(BOB);
        sale.claim();
        assert(token.balanceOf(ALICE) == 500 ether);
        assert(token.balanceOf(BOB) == 500 ether);
        assert(PROCEEDS.balance == 100 ether);
        assert(ALICE.balance == 50 ether);
        assert(BOB.balance == 50 ether);
        assert(address(sale).balance == 0);
    }

    function testMissedMinimumIsPermissionlesslyRefundable() public {
        (, ProRataFairLaunch sale) = _nativeSale(50 ether, 100 ether, 25 ether, 0);
        vm.deal(ALICE, 10 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 10 ether}(address(0));
        vm.warp(201);
        vm.prank(ALICE);
        sale.refund();
        assert(ALICE.balance == 10 ether);
    }

    function testCouncilPauseExpiresIntoRefundMode() public {
        (, ProRataFairLaunch sale) = _nativeSale(1 ether, 100 ether, 25 ether, 0);
        vm.deal(ALICE, 25 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 25 ether}(address(0));
        vm.prank(COUNCIL);
        sale.setPaused(true);
        vm.warp(201 + 7 days);
        vm.prank(ALICE);
        sale.refund();
        assert(ALICE.balance == 25 ether);
    }

    function testFeeCannotExceedOnePercent() public {
        FixedSupplyLaunchToken token = new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this));
        ProRataFairLaunch.Config memory config = _config(address(token), 1 ether, 100 ether, 25 ether, 101);
        vm.expectRevert(bytes("fee cap"));
        new ProRataFairLaunch(config);
    }

    function testFuzzPreviewNeverAllocatesMoreThanSale(uint96 a, uint96 b) public {
        uint256 aliceAmount = 1 ether + uint256(a) % 99 ether;
        uint256 bobAmount = 1 ether + uint256(b) % 99 ether;
        (FixedSupplyLaunchToken token, ProRataFairLaunch sale) = _nativeSale(1 ether, 100 ether, 100 ether, 0);
        vm.deal(ALICE, aliceAmount);
        vm.deal(BOB, bobAmount);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: aliceAmount}(address(0));
        vm.prank(BOB);
        sale.contribute{value: bobAmount}(address(0));
        (uint256 aliceTokens,,) = sale.preview(ALICE);
        (uint256 bobTokens,,) = sale.preview(BOB);
        assert(aliceTokens + bobTokens <= sale.saleAllocation());
        assert(token.balanceOf(address(sale)) == sale.saleAllocation());
    }

    function _nativeSale(uint256 minRaise, uint256 maxRaise, uint256 cap, uint16 feeBps)
        internal
        returns (FixedSupplyLaunchToken token, ProRataFairLaunch sale)
    {
        token = new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this));
        sale = new ProRataFairLaunch(_config(address(token), minRaise, maxRaise, cap, feeBps));
        token.transfer(address(sale), 1_000 ether);
    }

    function _config(address token, uint256 minRaise, uint256 maxRaise, uint256 cap, uint16 feeBps)
        internal
        view
        returns (ProRataFairLaunch.Config memory)
    {
        return ProRataFairLaunch.Config({
            saleToken: token,
            quoteToken: address(0),
            saleAllocation: 1_000 ether,
            minimumRaise: minRaise,
            maximumRaise: maxRaise,
            walletCap: cap,
            startsAt: 100,
            endsAt: 200,
            claimDeadline: 400,
            saleFeeBps: feeBps,
            creator: address(this),
            securityCouncil: COUNCIL,
            proceedsRecipient: PROCEEDS,
            operationsRecipient: OPERATIONS,
            rewardsRecipient: REWARDS,
            referralRegistry: address(0),
            unsoldRecipient: UNSOLD
        });
    }
}
