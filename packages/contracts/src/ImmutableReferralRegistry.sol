// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.26;

/// @notice Launch-specific immutable allowlist. There is no post-deployment administrator.
contract ImmutableReferralRegistry {
    mapping(address => bool) public isVerified;

    constructor(address[] memory referrers) {
        for (uint256 i; i < referrers.length; ++i) {
            require(referrers[i] != address(0), "zero referrer");
            isVerified[referrers[i]] = true;
        }
    }
}
