// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";

contract LaunchFactoryTest {
    function testFactoryDistributesEntireFixedSupplyAtomically() public {
        LaunchFactory factory = new LaunchFactory();
        address rewards = address(0x1111);
        address treasury = address(0x2222);
        LaunchFactory.Allocation[] memory allocations = new LaunchFactory.Allocation[](2);
        allocations[0] = LaunchFactory.Allocation(rewards, 300 ether);
        allocations[1] = LaunchFactory.Allocation(treasury, 200 ether);
        ProRataFairLaunch.Config memory sale = ProRataFairLaunch.Config({
            saleToken: address(0), quoteToken: address(0), saleAllocation: 500 ether,
            minimumRaise: 1 ether, maximumRaise: 100 ether, walletCap: 10 ether,
            startsAt: uint64(block.timestamp + 1), endsAt: uint64(block.timestamp + 2 days),
            claimDeadline: uint64(block.timestamp + 30 days), saleFeeBps: 75,
            creator: address(0), securityCouncil: address(0x3333), proceedsRecipient: address(0x4444),
            operationsRecipient: address(0x5555), rewardsRecipient: rewards, referralRegistry: address(0),
            unsoldRecipient: treasury
        });
        LaunchFactory.TokenConfig memory tokenConfig = LaunchFactory.TokenConfig("Launch", "LCH", 1_000 ether, keccak256("manifest"));
        (address tokenAddress, address fairLaunchAddress) = factory.createLaunch(tokenConfig, sale, allocations);
        FixedSupplyLaunchToken token = FixedSupplyLaunchToken(tokenAddress);
        assert(token.totalSupply() == 1_000 ether);
        assert(token.balanceOf(address(factory)) == 0);
        assert(token.balanceOf(fairLaunchAddress) == 500 ether);
        assert(token.balanceOf(rewards) == 300 ether);
        assert(token.balanceOf(treasury) == 200 ether);
        assert(ProRataFairLaunch(payable(fairLaunchAddress)).creator() == address(this));
    }
}
