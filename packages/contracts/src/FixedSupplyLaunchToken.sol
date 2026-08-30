// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice One-time fixed-supply token. It deliberately has no owner, mint, freeze, blacklist, or tax path.
contract FixedSupplyLaunchToken is ERC20 {
    uint256 public immutable fixedSupply;

    constructor(string memory name_, string memory symbol_, uint256 supply_, address initialHolder)
        ERC20(name_, symbol_)
    {
        require(supply_ > 0, "zero supply");
        require(initialHolder != address(0), "zero holder");
        fixedSupply = supply_;
        _mint(initialHolder, supply_);
    }
}
