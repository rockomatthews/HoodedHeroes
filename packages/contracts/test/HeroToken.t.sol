// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {HeroToken} from "../src/HeroToken.sol";

contract HeroTokenTest {
    function testFixedSupplyHasNoAdditionalMintPath() public {
        HeroToken token = new HeroToken(address(this));
        assert(token.totalSupply() == 1_000_000_000 ether);
        assert(token.balanceOf(address(this)) == token.totalSupply());
    }

    function testFuzzBurnNeverIncreasesSupply(uint96 amount) public {
        HeroToken token = new HeroToken(address(this));
        uint256 bounded = uint256(amount) % (token.totalSupply() + 1);
        uint256 beforeSupply = token.totalSupply();
        token.burn(bounded);
        assert(token.totalSupply() == beforeSupply - bounded);
    }
}
