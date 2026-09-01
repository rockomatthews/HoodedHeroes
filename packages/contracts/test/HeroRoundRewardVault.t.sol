// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {HeroRoundRewardVault} from "../src/HeroRoundRewardVault.sol";

interface RoundVm {
    function prank(address sender) external;
    function expectRevert(bytes calldata reason) external;
}

contract MockRoundToken is ERC20 {
    constructor() ERC20("Round", "RND") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
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
        vault = new HeroRoundRewardVault(address(token), address(heroes));
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
    }

    function testCannotFundBeforeAnyHeroExists() public {
        vm.expectRevert(bytes("no heroes"));
        vault.fundRound(1 ether);
    }
}
