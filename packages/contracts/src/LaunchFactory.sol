// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FixedSupplyLaunchToken} from "./FixedSupplyLaunchToken.sol";
import {ProRataFairLaunch} from "./ProRataFairLaunch.sol";

/// @notice Versioned factory that atomically deploys and fully distributes fixed supply. It has no owner or withdrawal path.
contract LaunchFactory {
    using SafeERC20 for FixedSupplyLaunchToken;

    string public constant TEMPLATE_VERSION = "1.0.0-testnet";

    event LaunchCreated(address indexed creator, address indexed token, address indexed fairLaunch, bytes32 manifestHash);

    struct TokenConfig {
        string name;
        string symbol;
        uint256 supply;
        bytes32 manifestHash;
    }

    struct Allocation {
        address recipient;
        uint256 amount;
    }

    function createLaunch(
        TokenConfig calldata tokenConfig,
        ProRataFairLaunch.Config calldata saleConfig,
        Allocation[] calldata otherAllocations
    ) external returns (address tokenAddress, address fairLaunchAddress) {
        require(tokenConfig.manifestHash != bytes32(0), "missing manifest");
        FixedSupplyLaunchToken token = new FixedSupplyLaunchToken(tokenConfig.name, tokenConfig.symbol, tokenConfig.supply, address(this));
        ProRataFairLaunch.Config memory config = saleConfig;
        config.saleToken = address(token);
        config.creator = msg.sender;
        ProRataFairLaunch fairLaunch = new ProRataFairLaunch(config);

        uint256 allocated = config.saleAllocation;
        token.safeTransfer(address(fairLaunch), config.saleAllocation);
        for (uint256 i; i < otherAllocations.length; ++i) {
            require(otherAllocations[i].recipient != address(0), "zero allocation recipient");
            allocated += otherAllocations[i].amount;
            token.safeTransfer(otherAllocations[i].recipient, otherAllocations[i].amount);
        }
        require(allocated == tokenConfig.supply && token.balanceOf(address(this)) == 0, "allocation mismatch");
        emit LaunchCreated(msg.sender, address(token), address(fairLaunch), tokenConfig.manifestHash);
        return (address(token), address(fairLaunch));
    }
}
