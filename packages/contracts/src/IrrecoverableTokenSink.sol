// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

/// @notice An intentionally inert address for retiring lab-token balances.
/// @dev It has no call, approval, transfer, rescue, or destruction path.
contract IrrecoverableTokenSink {}
