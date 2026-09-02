// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @notice Irreversibly holds one predetermined liquidity-position NFT.
/// @dev There is deliberately no owner, approval, transfer, rescue, or arbitrary-call function.
contract PermanentPositionLock is IERC721Receiver {
    IERC721 public immutable positionManager;
    uint256 public immutable positionTokenId;

    event PositionPermanentlyLocked(address indexed positionManager, uint256 indexed positionTokenId);

    constructor(address positionManager_, uint256 positionTokenId_) {
        require(positionManager_ != address(0), "zero position manager");
        positionManager = IERC721(positionManager_);
        positionTokenId = positionTokenId_;
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external returns (bytes4) {
        require(msg.sender == address(positionManager), "unexpected collection");
        require(tokenId == positionTokenId, "unexpected position");
        emit PositionPermanentlyLocked(msg.sender, tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function isPermanentlyLocked() external view returns (bool) {
        try positionManager.ownerOf(positionTokenId) returns (address holder) {
            return holder == address(this);
        } catch {
            return false;
        }
    }
}
