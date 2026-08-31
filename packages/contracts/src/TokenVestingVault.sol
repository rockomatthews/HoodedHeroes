// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Immutable linear token vesting with permissionless release and no owner or sweep path.
/// @dev The declared allocation must be transferred to this vault before a release is attempted.
contract TokenVestingVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable beneficiary;
    uint64 public immutable startsAt;
    uint64 public immutable duration;
    uint256 public immutable totalAllocation;
    uint256 public released;

    event TokensReleased(address indexed beneficiary, uint256 amount, uint256 totalReleased);

    constructor(address tokenAddress, address beneficiaryAddress, uint64 start, uint64 vestingDuration, uint256 allocation) {
        require(tokenAddress != address(0) && beneficiaryAddress != address(0), "zero address");
        require(vestingDuration > 0 && allocation > 0, "invalid vesting");
        token = IERC20(tokenAddress);
        beneficiary = beneficiaryAddress;
        startsAt = start;
        duration = vestingDuration;
        totalAllocation = allocation;
    }

    function vestedAt(uint256 timestamp) public view returns (uint256) {
        if (timestamp <= startsAt) return 0;
        if (timestamp >= uint256(startsAt) + duration) return totalAllocation;
        return totalAllocation * (timestamp - startsAt) / duration;
    }

    function releasable() public view returns (uint256) {
        return vestedAt(block.timestamp) - released;
    }

    function release() external nonReentrant returns (uint256 amount) {
        amount = releasable();
        require(amount > 0, "nothing releasable");
        released += amount;
        token.safeTransfer(beneficiary, amount);
        emit TokensReleased(beneficiary, amount, released);
    }
}

