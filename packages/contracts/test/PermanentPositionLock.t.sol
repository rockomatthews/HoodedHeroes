// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {PermanentPositionLock} from "../src/PermanentPositionLock.sol";

interface LockVm {
    function expectRevert(bytes calldata reason) external;
}

contract MockPositionManager is ERC721 {
    constructor() ERC721("Position", "LP") {}

    function mint(address recipient, uint256 tokenId) external {
        _mint(recipient, tokenId);
    }
}

contract PermanentPositionLockTest {
    LockVm internal constant vm = LockVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testLocksOnlyThePredeterminedPositionForever() public {
        MockPositionManager manager = new MockPositionManager();
        PermanentPositionLock lock = new PermanentPositionLock(address(manager), 7);
        manager.mint(address(this), 7);

        manager.safeTransferFrom(address(this), address(lock), 7);

        assert(manager.ownerOf(7) == address(lock));
        assert(lock.isPermanentlyLocked());
    }

    function testRejectsAnotherPositionFromTheApprovedCollection() public {
        MockPositionManager manager = new MockPositionManager();
        PermanentPositionLock lock = new PermanentPositionLock(address(manager), 7);
        manager.mint(address(this), 8);

        vm.expectRevert(bytes("unexpected position"));
        manager.safeTransferFrom(address(this), address(lock), 8);
        assert(manager.ownerOf(8) == address(this));
        assert(!lock.isPermanentlyLocked());
    }

    function testRejectsTheExpectedIdFromAnotherCollection() public {
        MockPositionManager approved = new MockPositionManager();
        MockPositionManager attacker = new MockPositionManager();
        PermanentPositionLock lock = new PermanentPositionLock(address(approved), 7);
        attacker.mint(address(this), 7);

        vm.expectRevert(bytes("unexpected collection"));
        attacker.safeTransferFrom(address(this), address(lock), 7);
        assert(attacker.ownerOf(7) == address(this));
    }
}
