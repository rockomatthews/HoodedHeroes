// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.26;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @notice Ownerless receiver that accepts exactly one position NFT from one pinned adapter.
contract PermanentPositionReceiver is IERC721Receiver {
    address public immutable positionManager;
    address public immutable adapter;
    bool public locked;
    uint256 public positionId;

    event PositionLocked(uint256 indexed positionId);

    constructor(address positionManager_, address adapter_) {
        require(positionManager_ != address(0) && adapter_ != address(0), "zero address");
        positionManager = positionManager_;
        adapter = adapter_;
    }

    /// @notice Registers a v4 position manager mint that does not invoke ERC721Receiver.
    function registerPosition(uint256 tokenId) external {
        require(msg.sender == adapter, "only adapter");
        require(!locked && IERC721(positionManager).ownerOf(tokenId) == address(this), "position not locked");
        _record(tokenId);
    }

    function onERC721Received(address operator, address, uint256 tokenId, bytes calldata) external returns (bytes4) {
        require(msg.sender == positionManager && operator == adapter, "unexpected position");
        require(!locked, "already locked");
        _record(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function _record(uint256 tokenId) private {
        locked = true;
        positionId = tokenId;
        emit PositionLocked(tokenId);
    }
}
