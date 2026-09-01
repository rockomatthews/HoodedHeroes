// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";

interface Vm {
    function deal(address who, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata reason) external;
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract RejectEther {
    receive() external payable {
        revert("reject ether");
    }

    function withdraw(ProRataFairLaunch sale) external {
        sale.withdrawQuote();
    }
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
    address internal constant LIQUIDITY = address(0xD5);
    uint256 internal constant SIGNER_KEY = 0xBEEF;

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
        assert(sale.claimableQuote(PROCEEDS) == 100 ether);
        vm.prank(PROCEEDS);
        sale.withdrawQuote();
        vm.prank(ALICE);
        sale.withdrawQuote();
        vm.prank(BOB);
        sale.withdrawQuote();
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
        assert(sale.claimableQuote(ALICE) == 10 ether);
        vm.prank(ALICE);
        sale.withdrawQuote();
        assert(ALICE.balance == 10 ether);
    }

    function testAnyoneCanSettleFailedSaleRefundThenBurnUnsold() public {
        FixedSupplyLaunchToken token =
            new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this), keccak256("failed-burn"));
        ProRataFairLaunch.Config memory config = _config(address(token), 50 ether, 100 ether, 50 ether, 0);
        config.burnUnsold = true;
        config.unsoldRecipient = address(0);
        ProRataFairLaunch sale = new ProRataFairLaunch(config);
        token.transfer(address(sale), 1_000 ether);
        sale.activate();
        vm.deal(ALICE, 20 ether);
        vm.deal(BOB, 10 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 20 ether}(address(0));
        vm.prank(BOB);
        sale.contribute{value: 10 ether}(address(0));
        vm.warp(401);
        sale.refundFor(ALICE);
        sale.refundFor(BOB);
        assert(sale.claimableQuote(ALICE) == 20 ether);
        assert(sale.claimableQuote(BOB) == 10 ether);
        sale.sweepUnsold();
        assert(token.balanceOf(address(sale)) == 0);
        assert(token.totalSupply() == 0);
    }

    function testSuccessfulContributionCanBeSettledPermissionlessly() public {
        (FixedSupplyLaunchToken token, ProRataFairLaunch sale) = _nativeSale(20 ether, 100 ether, 100 ether, 0);
        vm.deal(ALICE, 20 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 20 ether}(address(0));
        vm.warp(201);
        vm.prank(BOB);
        sale.settleFor(ALICE);
        assert(token.balanceOf(ALICE) == 200 ether);
        assert(sale.totalSettledContribution() == 20 ether);
    }

    function testRejectingRecipientCannotBlockContributorSettlement() public {
        RejectEther rejectingRecipient = new RejectEther();
        FixedSupplyLaunchToken token =
            new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this), keccak256("pull-payments"));
        ProRataFairLaunch.Config memory config = _config(address(token), 20 ether, 100 ether, 100 ether, 100);
        config.proceedsRecipient = address(rejectingRecipient);
        ProRataFairLaunch sale = new ProRataFairLaunch(config);
        token.transfer(address(sale), 1_000 ether);
        sale.activate();

        vm.deal(ALICE, 20 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 20 ether}(address(0));
        vm.warp(201);
        sale.settleFor(ALICE);

        assert(token.balanceOf(ALICE) == 200 ether);
        assert(sale.claimableQuote(address(rejectingRecipient)) == 19.8 ether);
        assert(sale.quoteLiability() == 20 ether);
        vm.expectRevert(bytes("native transfer failed"));
        rejectingRecipient.withdraw(sale);
        assert(sale.claimableQuote(address(rejectingRecipient)) == 19.8 ether);
        assert(sale.quoteLiability() == 20 ether);
    }

    function testUnsoldTokensCannotMoveBeforeEveryContributionSettles() public {
        (, ProRataFairLaunch sale) = _nativeSale(20 ether, 100 ether, 100 ether, 0);
        vm.deal(ALICE, 20 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 20 ether}(address(0));
        vm.warp(401);
        vm.expectRevert(bytes("unsettled contributions"));
        sale.sweepUnsold();
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
        vm.prank(ALICE);
        sale.withdrawQuote();
        assert(ALICE.balance == 25 ether);
    }

    function testFeeCannotExceedOnePercent() public {
        FixedSupplyLaunchToken token =
            new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this), keccak256("manifest"));
        ProRataFairLaunch.Config memory config = _config(address(token), 1 ether, 100 ether, 25 ether, 101);
        vm.expectRevert(bytes("fee cap"));
        new ProRataFairLaunch(config);
    }

    function testEligibilityPermitIsLaunchBoundAndCannotReplay() public {
        uint256 contributorKey = 0xA11CE;
        address signer = vm.addr(SIGNER_KEY);
        address contributor = vm.addr(contributorKey);
        FixedSupplyLaunchToken token =
            new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this), keccak256("eligible"));
        ProRataFairLaunch.Config memory config = _config(address(token), 1 ether, 100 ether, 100 ether, 0);
        config.eligibilitySigner = signer;
        ProRataFairLaunch sale = new ProRataFairLaunch(config);
        token.transfer(address(sale), 1_000 ether);
        sale.activate();
        vm.deal(contributor, 10 ether);
        vm.warp(100);
        vm.expectRevert(bytes("eligibility allowance"));
        vm.prank(contributor);
        sale.contribute{value: 1 ether}(address(0));

        uint256 allowance = 10 ether;
        uint256 nonce = 7;
        uint256 deadline = 150;
        bytes memory signature = _eligibilitySignature(sale, contributor, allowance, nonce, deadline);
        vm.prank(contributor);
        sale.contributeWithEligibility{value: 1 ether}(address(0), allowance, nonce, deadline, signature);
        vm.expectRevert(bytes("eligibility replay"));
        vm.prank(contributor);
        sale.contributeWithEligibility{value: 1 ether}(address(0), allowance, nonce, deadline, signature);
    }

    function testLiquidityAndDaoProceedsAreSeparatedBeforeWithdrawal() public {
        FixedSupplyLaunchToken token =
            new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this), keccak256("split"));
        ProRataFairLaunch.Config memory config = _config(address(token), 100 ether, 100 ether, 100 ether, 75);
        config.liquidityRecipient = LIQUIDITY;
        config.liquidityShareBps = 3_750;
        ProRataFairLaunch sale = new ProRataFairLaunch(config);
        token.transfer(address(sale), 1_000 ether);
        sale.activate();
        vm.deal(ALICE, 100 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 100 ether}(address(0));
        vm.warp(201);
        sale.settleFor(ALICE);
        assert(sale.claimableQuote(LIQUIDITY) == 37.5 ether);
        assert(sale.claimableQuote(PROCEEDS) == 61.75 ether);
        assert(sale.claimableQuote(OPERATIONS) == 0.375 ether);
        assert(sale.claimableQuote(REWARDS) == 0.375 ether);
    }

    function testUnsoldSupplyCanBePermanentlyBurned() public {
        FixedSupplyLaunchToken token =
            new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this), keccak256("burn-unsold"));
        ProRataFairLaunch.Config memory config = _config(address(token), 1 ether, 100 ether, 100 ether, 0);
        config.burnUnsold = true;
        config.unsoldRecipient = address(0);
        ProRataFairLaunch sale = new ProRataFairLaunch(config);
        token.transfer(address(sale), 1_000 ether);
        sale.activate();
        vm.deal(ALICE, 20 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 20 ether}(address(0));
        vm.warp(201);
        sale.settleFor(ALICE);
        vm.warp(401);
        sale.sweepUnsold();
        assert(token.totalSupply() == 200 ether);
        assert(token.balanceOf(address(sale)) == 0);
    }

    function testSaleStartsSealedAndOnlyCreatorCanActivate() public {
        FixedSupplyLaunchToken token =
            new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this), keccak256("sealed-manifest"));
        ProRataFairLaunch sale = new ProRataFairLaunch(_config(address(token), 20 ether, 100 ether, 100 ether, 0));
        token.transfer(address(sale), 1_000 ether);
        assert(!sale.activated());
        vm.expectRevert(bytes("not creator"));
        vm.prank(ALICE);
        sale.activate();
        sale.activate();
        assert(sale.activated());
    }

    function testUnfundedSaleCannotActivate() public {
        FixedSupplyLaunchToken token =
            new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this), keccak256("unfunded"));
        ProRataFairLaunch sale = new ProRataFairLaunch(_config(address(token), 20 ether, 100 ether, 100 ether, 0));
        vm.expectRevert(bytes("sale unfunded"));
        sale.activate();
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
        token = new FixedSupplyLaunchToken("Test", "TEST", 1_000 ether, address(this), keccak256("manifest"));
        sale = new ProRataFairLaunch(_config(address(token), minRaise, maxRaise, cap, feeBps));
        token.transfer(address(sale), 1_000 ether);
        sale.activate();
    }

    function _eligibilitySignature(
        ProRataFairLaunch sale,
        address contributor,
        uint256 allowance,
        uint256 nonce,
        uint256 deadline
    ) private returns (bytes memory) {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("HOODED Launch Eligibility")),
                keccak256(bytes("1")),
                block.chainid,
                address(sale)
            )
        );
        bytes32 structHash =
            keccak256(abi.encode(sale.ELIGIBILITY_TYPEHASH(), contributor, address(sale), allowance, nonce, deadline));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(SIGNER_KEY, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return abi.encodePacked(r, s, v);
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
            pricePerToken: maxRaise / 1_000,
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
            liquidityRecipient: address(0),
            operationsRecipient: OPERATIONS,
            rewardsRecipient: REWARDS,
            referralRegistry: address(0),
            unsoldRecipient: UNSOLD,
            eligibilitySigner: address(0),
            liquidityShareBps: 0,
            burnUnsold: false
        });
    }
}
