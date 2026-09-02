// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.26;

import {RobinhoodUniswapV4LiquidityAdapter} from "./RobinhoodUniswapV4LiquidityAdapter.sol";

/// @notice Ownerless CREATE2 deployer for the address-flagged HOODED v4 adapter.
/// @dev The adapter constructor rejects salts that do not produce exactly the required hook flags.
contract RobinhoodUniswapV4AdapterDeployer {
    event AdapterDeployed(address indexed adapter, bytes32 indexed salt, bytes32 runtimeCodeHash);

    function deploy(
        bytes32 salt,
        address poolManager,
        address positionManager,
        address permit2,
        address wrappedNative,
        uint24 fee,
        int24 tickSpacing,
        address coordinatorDeployer,
        address authorizedFactory
    ) external returns (address adapter) {
        adapter = address(
            new RobinhoodUniswapV4LiquidityAdapter{salt: salt}(
                poolManager, positionManager, permit2, wrappedNative, fee, tickSpacing, coordinatorDeployer, authorizedFactory
            )
        );
        emit AdapterDeployed(adapter, salt, adapter.codehash);
    }

    function predict(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}
