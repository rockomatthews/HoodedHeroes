// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Immutable season vault. It has claims, but deliberately has no owner or withdrawal path.
contract SeasonRewardVault is ReentrancyGuard {
    IERC20 public immutable rewardToken;
    bytes32 public immutable claimsRoot;
    uint64 public immutable claimDeadline;
    mapping(address => bool) public claimed;

    event Claimed(address indexed hero, uint256 amount);

    constructor(address token, bytes32 root, uint64 deadline) {
        require(token != address(0) && root != bytes32(0), "invalid config");
        require(deadline > block.timestamp, "invalid deadline");
        rewardToken = IERC20(token);
        claimsRoot = root;
        claimDeadline = deadline;
    }

    function claim(uint256 amount, bytes32[] calldata proof) external nonReentrant {
        require(block.timestamp <= claimDeadline, "season closed");
        require(!claimed[msg.sender], "already claimed");
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        require(MerkleProof.verify(proof, claimsRoot, leaf), "invalid proof");
        claimed[msg.sender] = true;
        require(rewardToken.transfer(msg.sender, amount), "transfer failed");
        emit Claimed(msg.sender, amount);
    }
}
