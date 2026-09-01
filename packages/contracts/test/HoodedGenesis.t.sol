// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {HoodedGenesis} from "../src/HoodedGenesis.sol";

interface GenesisVm {
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata reason) external;
}

contract GenesisPaymentToken is ERC20Burnable {
    constructor() ERC20("HOODED", "HOODED") {
        _mint(msg.sender, 1_000_000_000 ether);
    }
}

contract HoodedGenesisTest {
    GenesisVm internal constant vm = GenesisVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant FOUNDER = address(0xF0);
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    function testFounderReceivesExactlyTenFreeTransferableRecruits() public {
        GenesisPaymentToken token = new GenesisPaymentToken();
        HoodedGenesis heroes = new HoodedGenesis(
            address(token), address(0xA1), address(0xA2), FOUNDER, 100, keccak256("metadata"), "ipfs://heroes/"
        );
        assert(heroes.totalMinted() == 10);
        assert(heroes.tierMinted(0) == 10);
        assert(heroes.balanceOf(FOUNDER) == 10);
        assert(heroes.ownerOf(1) == FOUNDER && heroes.ownerOf(10) == FOUNDER);
        assert(heroes.usedPrimaryMint(FOUNDER));
        assert(keccak256(bytes(heroes.tokenURI(1))) == keccak256(bytes("ipfs://heroes/1")));
        vm.prank(FOUNDER);
        heroes.transferFrom(FOUNDER, BOB, 1);
        assert(heroes.ownerOf(1) == BOB);
    }

    function testFounderCannotAlsoUsePublicPrimaryMint() public {
        GenesisPaymentToken token = new GenesisPaymentToken();
        HoodedGenesis heroes = new HoodedGenesis(
            address(token), address(0xA1), address(0xA2), FOUNDER, 100, keccak256("metadata"), "ipfs://heroes/"
        );
        vm.warp(100);
        vm.expectRevert(bytes("one primary mint"));
        vm.prank(FOUNDER);
        heroes.mint(HoodedGenesis.Tier.Recruit);
    }

    function testPublicInventoryBeginsAfterFounderGrantAndUsesNormalSplit() public {
        GenesisPaymentToken token = new GenesisPaymentToken();
        HoodedGenesis heroes = new HoodedGenesis(
            address(token), address(0xA1), address(0xA2), FOUNDER, 100, keccak256("metadata"), "ipfs://heroes/"
        );
        token.transfer(ALICE, 100_000 ether);
        vm.prank(ALICE);
        token.approve(address(heroes), type(uint256).max);
        vm.warp(99);
        vm.expectRevert(bytes("public mint closed"));
        vm.prank(ALICE);
        heroes.mint(HoodedGenesis.Tier.Recruit);
        vm.warp(100);
        vm.prank(ALICE);
        uint256 tokenId = heroes.mint(HoodedGenesis.Tier.Recruit);
        assert(tokenId == 11 && heroes.ownerOf(11) == ALICE);
        assert(heroes.totalMinted() == 11 && heroes.tierMinted(0) == 11);
        assert(token.totalSupply() == 1_000_000_000 ether - 40_000 ether);
        assert(token.balanceOf(address(0xA1)) == 40_000 ether);
        assert(token.balanceOf(address(0xA2)) == 20_000 ether);
    }
}
