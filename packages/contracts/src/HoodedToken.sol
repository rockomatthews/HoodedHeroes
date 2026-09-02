// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @notice Fixed one-billion supply. There is intentionally no mint function or owner.
contract HoodedToken is ERC20, ERC20Burnable {
    uint256 public constant FIXED_SUPPLY = 1_000_000_000 ether;

    constructor(address initialHolder) ERC20("HOODED", "HOODED") {
        require(initialHolder != address(0), "zero holder");
        _mint(initialHolder, FIXED_SUPPLY);
    }
}
