// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {FixedSupplyLaunchToken} from "../src/FixedSupplyLaunchToken.sol";
import {TokenVestingVault} from "../src/TokenVestingVault.sol";

interface Vm {
    function warp(uint256 timestamp) external;
}

contract TokenVestingVaultTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testLinearReleaseCannotExceedCommittedAllocation() public {
        FixedSupplyLaunchToken token = new FixedSupplyLaunchToken("Launch", "LCH", 1_000 ether, address(this));
        uint64 start = uint64(block.timestamp + 1 days);
        uint64 duration = 24 * 30 days;
        address beneficiary = address(0xBEEF);
        TokenVestingVault vault = new TokenVestingVault(address(token), beneficiary, start, duration, 400 ether);
        token.transfer(address(vault), 400 ether);

        vm.warp(start + duration / 2);
        uint256 firstRelease = vault.release();
        assert(firstRelease == 200 ether);
        assert(token.balanceOf(beneficiary) == 200 ether);

        vm.warp(start + duration);
        uint256 finalRelease = vault.release();
        assert(finalRelease == 200 ether);
        assert(token.balanceOf(beneficiary) == 400 ether);
        assert(vault.released() == vault.totalAllocation());
        assert(token.balanceOf(address(vault)) == 0);
    }

    function testFuzzVestedAmountIsBounded(uint64 elapsed) public {
        FixedSupplyLaunchToken token = new FixedSupplyLaunchToken("Launch", "LCH", 1_000 ether, address(this));
        uint64 start = uint64(block.timestamp + 1 days);
        uint64 duration = 365 days;
        TokenVestingVault vault = new TokenVestingVault(address(token), address(0xBEEF), start, duration, 100 ether);
        uint256 timestamp = uint256(start) + elapsed;
        uint256 vested = vault.vestedAt(timestamp);
        assert(vested <= 100 ether);
        if (elapsed >= duration) assert(vested == 100 ether);
    }
}

