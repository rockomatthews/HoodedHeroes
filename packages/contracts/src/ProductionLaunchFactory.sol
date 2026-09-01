// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {FixedSupplyLaunchToken} from "./FixedSupplyLaunchToken.sol";
import {ProRataFairLaunch} from "./ProRataFairLaunch.sol";
import {RobinhoodLiquidityCoordinator} from "./RobinhoodLiquidityCoordinator.sol";
import {PermanentPositionReceiver} from "./PermanentPositionReceiver.sol";
import {TokenVestingVault} from "./TokenVestingVault.sol";

/// @notice Immutable production factory. Creators require a manifest-bound approval from the review Safe.
contract ProductionLaunchFactory is EIP712 {
    using SafeERC20 for FixedSupplyLaunchToken;

    string public constant TEMPLATE_VERSION = "1.4.0";
    uint64 public constant MIN_COMMUNITY_VESTING_DURATION = 730 days;
    uint256 public constant MIN_VESTED_SUPPLY_BPS = 500;
    uint256 public constant MAX_VESTED_SUPPLY_BPS = 1_000;
    uint256 private constant BPS = 10_000;
    bytes32 public constant APPROVAL_TYPEHASH = keccak256(
        "LaunchApproval(address creator,bytes32 manifestHash,bytes32 configHash,uint256 nonce,uint256 deadline)"
    );
    address public immutable approvalSigner;
    mapping(bytes32 => bool) public usedManifestHash;
    mapping(address => mapping(uint256 => bool)) public usedApprovalNonce;
    mapping(bytes32 => mapping(uint256 => address)) public vestingVaultFor;

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

    struct VestedAllocation {
        address beneficiary;
        uint256 amount;
        uint64 duration;
    }

    struct LiquidityConfig {
        uint256 tokenAllocation;
        address wrappedNative;
        bytes32 wrappedNativeCodeHash;
        address adapter;
        bytes32 adapterCodeHash;
        address poolManager;
        bytes32 poolManagerCodeHash;
        address positionManager;
        bytes32 positionManagerCodeHash;
    }

    event LaunchCreated(
        address indexed creator,
        address indexed token,
        address indexed fairLaunch,
        address liquidityCoordinator,
        address positionLock,
        bytes32 manifestHash
    );
    event VestingVaultCreated(
        bytes32 indexed manifestHash,
        uint256 indexed allocationIndex,
        address indexed vault,
        address beneficiary,
        uint256 amount,
        uint64 duration
    );

    constructor(address approvalSigner_) EIP712("HOODED Launch Approval", "1") {
        require(approvalSigner_ != address(0), "zero approval signer");
        approvalSigner = approvalSigner_;
    }

    function createApprovedLaunch(
        TokenConfig calldata tokenConfig,
        ProRataFairLaunch.Config calldata saleConfig,
        LiquidityConfig calldata liquidityConfig,
        Allocation[] calldata otherAllocations,
        VestedAllocation[] calldata vestedAllocations,
        uint256 approvalNonce,
        uint256 approvalDeadline,
        bytes calldata approvalSignature
    ) external returns (address tokenAddress, address fairLaunchAddress) {
        require(block.timestamp <= approvalDeadline, "approval expired");
        require(!usedApprovalNonce[msg.sender][approvalNonce], "approval replay");
        bytes32 configHash =
            hashLaunchConfiguration(tokenConfig, saleConfig, liquidityConfig, otherAllocations, vestedAllocations);
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    APPROVAL_TYPEHASH, msg.sender, tokenConfig.manifestHash, configHash, approvalNonce, approvalDeadline
                )
            )
        );
        require(SignatureChecker.isValidSignatureNow(approvalSigner, digest, approvalSignature), "invalid approval");
        usedApprovalNonce[msg.sender][approvalNonce] = true;
        return _create(tokenConfig, saleConfig, liquidityConfig, otherAllocations, vestedAllocations);
    }

    function hashLaunchConfiguration(
        TokenConfig calldata tokenConfig,
        ProRataFairLaunch.Config calldata saleConfig,
        LiquidityConfig calldata liquidityConfig,
        Allocation[] calldata otherAllocations,
        VestedAllocation[] calldata vestedAllocations
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(tokenConfig, saleConfig, liquidityConfig, otherAllocations, vestedAllocations));
    }

    function _create(
        TokenConfig calldata tokenConfig,
        ProRataFairLaunch.Config calldata saleConfig,
        LiquidityConfig calldata liquidityConfig,
        Allocation[] calldata otherAllocations,
        VestedAllocation[] calldata vestedAllocations
    ) private returns (address tokenAddress, address fairLaunchAddress) {
        require(tokenConfig.manifestHash != bytes32(0), "missing manifest");
        require(!usedManifestHash[tokenConfig.manifestHash], "manifest already used");
        usedManifestHash[tokenConfig.manifestHash] = true;
        require(saleConfig.quoteToken == address(0), "native quote only");
        require(saleConfig.liquidityShareBps > 0, "zero liquidity share");
        require(vestedAllocations.length > 0, "missing vested allocation");
        require(saleConfig.pricePerToken > 0, "zero price");
        require(saleConfig.endsAt > block.timestamp, "sale window in the past");
        uint256 maximumLiquidityQuote = Math.mulDiv(saleConfig.maximumRaise, saleConfig.liquidityShareBps, BPS);
        uint256 requiredLiquidityTokens = Math.mulDiv(maximumLiquidityQuote, 1 ether, saleConfig.pricePerToken);
        require(liquidityConfig.tokenAllocation >= requiredLiquidityTokens, "liquidity allocation too small");
        bytes32 tokenSalt = keccak256(abi.encode(tokenConfig.manifestHash, "TOKEN"));
        FixedSupplyLaunchToken token = new FixedSupplyLaunchToken{salt: tokenSalt}(
            tokenConfig.name, tokenConfig.symbol, tokenConfig.supply, address(this), tokenConfig.manifestHash
        );
        require(liquidityConfig.tokenAllocation > 0, "zero liquidity allocation");
        (RobinhoodLiquidityCoordinator coordinator, PermanentPositionReceiver positionLock) =
            _deployLiquidity(address(token), tokenConfig.manifestHash, liquidityConfig);
        ProRataFairLaunch.Config memory config = saleConfig;
        config.saleToken = address(token);
        config.creator = msg.sender;
        config.liquidityRecipient = address(coordinator);
        bytes32 saleSalt = keccak256(abi.encode(tokenConfig.manifestHash, "SALE"));
        ProRataFairLaunch fairLaunch = new ProRataFairLaunch{salt: saleSalt}(config);
        coordinator.bindSale(address(fairLaunch));
        uint256 allocated = config.saleAllocation + liquidityConfig.tokenAllocation;
        token.safeTransfer(address(fairLaunch), config.saleAllocation);
        token.safeTransfer(address(coordinator), liquidityConfig.tokenAllocation);
        for (uint256 i; i < otherAllocations.length; ++i) {
            require(otherAllocations[i].recipient != address(0), "zero allocation recipient");
            allocated += otherAllocations[i].amount;
            token.safeTransfer(otherAllocations[i].recipient, otherAllocations[i].amount);
        }
        uint256 totalVested = 0;
        for (uint256 i; i < vestedAllocations.length; ++i) {
            VestedAllocation calldata allocation = vestedAllocations[i];
            require(allocation.beneficiary != address(0) && allocation.amount > 0, "invalid vested allocation");
            require(allocation.duration >= MIN_COMMUNITY_VESTING_DURATION, "vesting below minimum");
            TokenVestingVault vault = new TokenVestingVault{
                salt: keccak256(abi.encode(tokenConfig.manifestHash, "VESTING", i))
            }(
                address(token), allocation.beneficiary, saleConfig.endsAt, allocation.duration, allocation.amount
            );
            vestingVaultFor[tokenConfig.manifestHash][i] = address(vault);
            allocated += allocation.amount;
            totalVested += allocation.amount;
            token.safeTransfer(address(vault), allocation.amount);
            emit VestingVaultCreated(
                tokenConfig.manifestHash,
                i,
                address(vault),
                allocation.beneficiary,
                allocation.amount,
                allocation.duration
            );
        }
        require(
            totalVested >= Math.mulDiv(tokenConfig.supply, MIN_VESTED_SUPPLY_BPS, BPS, Math.Rounding.Ceil),
            "vested allocation too small"
        );
        require(
            totalVested <= Math.mulDiv(tokenConfig.supply, MAX_VESTED_SUPPLY_BPS, BPS), "vested allocation too large"
        );
        require(allocated == tokenConfig.supply && token.balanceOf(address(this)) == 0, "allocation mismatch");
        _emitLaunch(
            address(token), address(fairLaunch), address(coordinator), address(positionLock), tokenConfig.manifestHash
        );
        return (address(token), address(fairLaunch));
    }

    function _emitLaunch(
        address token,
        address fairLaunch,
        address coordinator,
        address positionLock,
        bytes32 manifestHash
    ) private {
        emit LaunchCreated(msg.sender, token, fairLaunch, coordinator, positionLock, manifestHash);
    }

    function _deployLiquidity(address token, bytes32 manifestHash, LiquidityConfig calldata config)
        private
        returns (RobinhoodLiquidityCoordinator coordinator, PermanentPositionReceiver positionLock)
    {
        positionLock = new PermanentPositionReceiver{salt: keccak256(abi.encode(manifestHash, "POSITION_LOCK"))}(
            config.positionManager, config.adapter
        );
        coordinator = new RobinhoodLiquidityCoordinator{
            salt: keccak256(abi.encode(manifestHash, "LIQUIDITY_COORDINATOR"))
        }(
            manifestHash,
            token,
            config.wrappedNative,
            config.wrappedNativeCodeHash,
            config.adapter,
            config.adapterCodeHash,
            config.poolManager,
            config.poolManagerCodeHash,
            config.positionManager,
            config.positionManagerCodeHash,
            address(positionLock)
        );
    }
}
