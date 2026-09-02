// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.26;

import {FixedSupplyLaunchToken} from "./FixedSupplyLaunchToken.sol";
import {ProRataFairLaunch} from "./ProRataFairLaunch.sol";
import {RobinhoodLiquidityCoordinator} from "./RobinhoodLiquidityCoordinator.sol";
import {PermanentPositionReceiver} from "./PermanentPositionReceiver.sol";
import {TokenVestingVault} from "./TokenVestingVault.sol";

/// @dev Public deterministic deployers use caller-namespaced salts. An outsider cannot consume a factory's address.
contract ProductionTokenDeployer {
    function deploy(
        bytes32 manifestHash,
        string calldata name,
        string calldata symbol,
        uint256 supply,
        address recipient
    ) external returns (address token) {
        bytes32 salt = keccak256(abi.encode(msg.sender, manifestHash, "TOKEN"));
        token = address(new FixedSupplyLaunchToken{salt: salt}(name, symbol, supply, recipient, manifestHash));
    }
}

contract ProductionSaleDeployer {
    function deploy(bytes32 manifestHash, ProRataFairLaunch.Config calldata config) external returns (address sale) {
        bytes32 salt = keccak256(abi.encode(msg.sender, manifestHash, "SALE"));
        sale = address(new ProRataFairLaunch{salt: salt}(config));
    }
}

contract ProductionLiquidityDeployer {
    mapping(address coordinator => address factory) public coordinatorFactory;

    function deploy(
        bytes32 manifestHash,
        address token,
        address wrappedNative,
        bytes32 wrappedNativeCodeHash,
        address adapter,
        bytes32 adapterCodeHash,
        address poolManager,
        bytes32 poolManagerCodeHash,
        address positionManager,
        bytes32 positionManagerCodeHash
    ) external returns (address coordinator, address positionLock) {
        positionLock = address(
            new PermanentPositionReceiver{salt: keccak256(abi.encode(msg.sender, manifestHash, "POSITION_LOCK"))}(
                positionManager, adapter
            )
        );
        coordinator = address(
            new RobinhoodLiquidityCoordinator{
                salt: keccak256(abi.encode(msg.sender, manifestHash, "LIQUIDITY_COORDINATOR"))
            }(
                manifestHash,
                token,
                wrappedNative,
                wrappedNativeCodeHash,
                adapter,
                adapterCodeHash,
                poolManager,
                poolManagerCodeHash,
                positionManager,
                positionManagerCodeHash,
                positionLock
            )
        );
        coordinatorFactory[coordinator] = msg.sender;
    }

    function bindSale(address coordinator, address sale) external {
        require(coordinatorFactory[coordinator] == msg.sender, "not coordinator factory");
        delete coordinatorFactory[coordinator];
        RobinhoodLiquidityCoordinator(payable(coordinator)).bindSale(sale);
    }
}

contract ProductionVestingDeployer {
    function deploy(
        bytes32 manifestHash,
        uint256 allocationIndex,
        address token,
        address beneficiary,
        uint64 startsAt,
        uint64 duration,
        uint256 amount
    ) external returns (address vault) {
        bytes32 salt = keccak256(abi.encode(msg.sender, manifestHash, "VESTING", allocationIndex));
        vault = address(new TokenVestingVault{salt: salt}(token, beneficiary, startsAt, duration, amount));
    }
}
