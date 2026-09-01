// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {HeroRoundRewardVault} from "../src/HeroRoundRewardVault.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";

interface RoundVm {
    function deal(address who, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata reason) external;
}

contract MockRoundToken is ERC20 {
    constructor() ERC20("Round", "RND") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }
}

contract MockWrappedNative is ERC20 {
    constructor() ERC20("Wrapped Native", "WNATIVE") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }
}

contract MockSequentialHeroes is ERC721 {
    uint16 public totalMinted;

    constructor() ERC721("Heroes", "HERO") {}

    function mint(address recipient) external returns (uint256 tokenId) {
        totalMinted += 1;
        tokenId = totalMinted;
        _mint(recipient, tokenId);
    }
}

contract HeroRoundRewardVaultTest {
    RoundVm internal constant vm = RoundVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA201);

    MockRoundToken internal token;
    MockSequentialHeroes internal heroes;
    HeroRoundRewardVault internal vault;

    function setUp() public {
        token = new MockRoundToken();
        heroes = new MockSequentialHeroes();
        vault = new HeroRoundRewardVault(address(token), address(heroes), address(0));
        token.mint(address(this), 1_000 ether);
        token.approve(address(vault), type(uint256).max);
    }

    function testLateHeroDoesNotReceiveEarlierRounds() public {
        heroes.mint(ALICE);
        heroes.mint(BOB);
        vault.fundRound(100 ether);
        heroes.mint(CAROL);
        vault.fundRound(90 ether);

        assert(vault.preview(1) == 80 ether);
        assert(vault.preview(2) == 80 ether);
        assert(vault.preview(3) == 30 ether);
        vault.claim(1);
        vault.claim(2);
        vault.claim(3);
        assert(token.balanceOf(ALICE) == 80 ether);
        assert(token.balanceOf(BOB) == 80 ether);
        assert(token.balanceOf(CAROL) == 30 ether);
        assert(vault.claimLiability() == 0);
    }

    function testUnclaimedRewardsFollowTheHeroOnTransfer() public {
        heroes.mint(ALICE);
        vault.fundRound(25 ether);
        vm.prank(ALICE);
        heroes.transferFrom(ALICE, BOB, 1);

        vault.claim(1);
        assert(token.balanceOf(ALICE) == 0);
        assert(token.balanceOf(BOB) == 25 ether);
    }

    function testAnyoneCanSettleButOnlyCurrentOwnerIsPaid() public {
        heroes.mint(ALICE);
        vault.fundRound(12 ether);
        vm.prank(CAROL);
        vault.claim(1);
        assert(token.balanceOf(ALICE) == 12 ether);
        assert(token.balanceOf(CAROL) == 0);
        vm.expectRevert(bytes("nothing claimable"));
        vault.claim(1);
    }

    function testRoundingCarryRollsIntoTheNextRound() public {
        heroes.mint(ALICE);
        heroes.mint(BOB);
        vault.fundRound(5);
        assert(vault.carry() == 1);
        vault.fundRound(1);
        assert(vault.carry() == 0);
        assert(vault.preview(1) == 3);
        assert(vault.preview(2) == 3);
    }

    function testFuzzFundedValueIsConserved(uint96 rawAmount, uint8 rawHeroCount) public {
        uint256 heroCount = uint256(rawHeroCount) % 64 + 1;
        uint256 amount = uint256(rawAmount) % (1_000_000 ether) + heroCount;
        for (uint256 tokenId = 0; tokenId < heroCount; tokenId++) {
            heroes.mint(ALICE);
        }
        token.mint(address(this), amount);

        vault.fundRound(amount);

        assert(vault.totalFunded() == amount);
        assert(vault.claimLiability() + vault.carry() == amount);
        assert(vault.cumulativeRewardPerHero() * heroCount + vault.carry() == amount);
        assert(vault.accountedBalance() == amount);
        assert(vault.isReconciled());
    }

    function testNativeLaunchFeesBecomeWrappedHeroRound() public {
        heroes.mint(ALICE);
        heroes.mint(BOB);
        MockWrappedNative wrapped = new MockWrappedNative();
        HeroRoundRewardVault nativeVault = new HeroRoundRewardVault(address(wrapped), address(heroes), address(wrapped));
        FixedSupplyLaunchToken saleToken =
            new FixedSupplyLaunchToken("Launch", "LCH", 1_000 ether, address(this), keccak256("reward-round"));
        ProRataFairLaunch.Config memory config = ProRataFairLaunch.Config({
            saleToken: address(saleToken),
            quoteToken: address(0),
            saleAllocation: 1_000 ether,
            pricePerToken: 0.1 ether,
            minimumRaise: 100 ether,
            maximumRaise: 100 ether,
            walletCap: 100 ether,
            startsAt: 100,
            endsAt: 200,
            claimDeadline: 400,
            saleFeeBps: 100,
            creator: address(this),
            securityCouncil: address(0xC0),
            proceedsRecipient: address(0xD1),
            operationsRecipient: address(0xD2),
            rewardsRecipient: address(nativeVault),
            referralRegistry: address(0),
            unsoldRecipient: address(0xD4)
        });
        ProRataFairLaunch sale = new ProRataFairLaunch(config);
        saleToken.transfer(address(sale), 1_000 ether);
        sale.activate();
        vm.deal(ALICE, 100 ether);
        vm.warp(100);
        vm.prank(ALICE);
        sale.contribute{value: 100 ether}(address(0));
        vm.warp(201);
        sale.settleFor(ALICE);

        assert(sale.claimableQuote(address(nativeVault)) == 0.5 ether);
        vm.prank(CAROL);
        nativeVault.harvestLaunchFees(address(sale));
        assert(wrapped.balanceOf(address(nativeVault)) == 0.5 ether);
        assert(nativeVault.preview(1) == 0.25 ether);
        assert(nativeVault.preview(2) == 0.25 ether);
        assert(nativeVault.isReconciled());
    }

    function testCannotFundBeforeAnyHeroExists() public {
        vm.expectRevert(bytes("no heroes"));
        vault.fundRound(1 ether);
    }
}
