// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {ProRataFairLaunch} from "../src/ProRataFairLaunch.sol";

interface ForkVm {
    function envOr(string calldata name, bool defaultValue) external returns (bool value);
    function envOr(string calldata name, string calldata defaultValue) external returns (string memory value);
    function createSelectFork(string calldata urlOrAlias) external returns (uint256 forkId);
    function skip(bool skipTest) external;
}

/// @notice Opt-in mainnet-state rehearsal. It never broadcasts and costs no gas.
contract LaunchFactoryForkTest {
    ForkVm internal constant vm = ForkVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testRobinhoodMainnetForkOwnerCanaryWhenEnabled() public {
        if (!vm.envOr("RUN_MAINNET_FORK_TESTS", false)) {
            vm.skip(true);
            return;
        }
        string memory rpc = vm.envOr("RH_RPC_URL", string(""));
        require(bytes(rpc).length > 0, "RH_RPC_URL required");
        vm.createSelectFork(rpc);
        _rehearse();
    }

    function testBaseMainnetForkOwnerCanaryWhenEnabled() public {
        if (!vm.envOr("RUN_MAINNET_FORK_TESTS", false)) {
            vm.skip(true);
            return;
        }
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        require(bytes(rpc).length > 0, "BASE_RPC_URL required");
        vm.createSelectFork(rpc);
        _rehearse();
    }

    function _rehearse() private {
        LaunchFactory factory = new LaunchFactory(address(this));
        LaunchFactory.Allocation[] memory allocations = new LaunchFactory.Allocation[](1);
        allocations[0] = LaunchFactory.Allocation(address(0xBEEF), 600 ether);
        ProRataFairLaunch.Config memory sale = ProRataFairLaunch.Config({
            saleToken: address(0),
            quoteToken: address(0),
            saleAllocation: 400 ether,
            pricePerToken: 0.25 ether,
            minimumRaise: 1 ether,
            maximumRaise: 100 ether,
            walletCap: 10 ether,
            startsAt: uint64(block.timestamp + 1 days),
            endsAt: uint64(block.timestamp + 3 days),
            claimDeadline: uint64(block.timestamp + 33 days),
            saleFeeBps: 75,
            creator: address(0),
            securityCouncil: address(0xCAFE),
            proceedsRecipient: address(0xA11CE),
            liquidityRecipient: address(0),
            operationsRecipient: address(0xA12),
            rewardsRecipient: address(0xA13),
            referralRegistry: address(0),
            unsoldRecipient: address(0xA14),
            eligibilitySigner: address(0),
            liquidityShareBps: 0,
            burnUnsold: false
        });
        bytes32 manifestHash = keccak256("mainnet-fork-canary");
        LaunchFactory.TokenConfig memory tokenConfig =
            LaunchFactory.TokenConfig("Fork Canary", "FORK", 1_000 ether, manifestHash);
        (address predictedToken, address predictedSale) = factory.predictAddresses(tokenConfig, sale);
        (address token, address fairLaunch) = factory.createLaunch(tokenConfig, sale, allocations);
        assert(token == predictedToken && fairLaunch == predictedSale);
        assert(FixedSupplyLaunchToken(token).manifestHash() == manifestHash);
        assert(!ProRataFairLaunch(payable(fairLaunch)).activated());
    }
}
