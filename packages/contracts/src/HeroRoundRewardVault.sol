// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISequentialGenesisHeroes {
    function totalMinted() external view returns (uint16);
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @notice Equal-share universal rewards whose unclaimed balance follows each Genesis Hero NFT.
/// @dev One global counter makes funding O(1); the first claim derives a token's entry counter from monotonic mint supply.
contract HeroRoundRewardVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Checkpoint {
        uint16 eligibleSupply;
        uint240 indexBefore;
    }

    IERC20 public immutable rewardToken;
    ISequentialGenesisHeroes public immutable genesisHeroes;
    uint256 public cumulativeRewardPerHero;
    uint256 public carry;
    uint256 public claimLiability;
    uint256 public totalFunded;
    uint256 public totalDelivered;
    mapping(uint256 => uint256) public heroStamp;
    mapping(uint256 => bool) public initialized;
    Checkpoint[] private checkpoints;

    event RoundFunded(
        uint256 indexed round, uint256 received, uint16 eligibleHeroes, uint256 rewardPerHero, uint256 carry
    );
    event HeroInitialized(uint256 indexed tokenId, uint256 entryIndex);
    event RewardDelivered(uint256 indexed tokenId, address indexed owner, uint256 amount);

    constructor(address rewardToken_, address genesisHeroes_) {
        require(rewardToken_ != address(0) && genesisHeroes_ != address(0), "zero address");
        rewardToken = IERC20(rewardToken_);
        genesisHeroes = ISequentialGenesisHeroes(genesisHeroes_);
    }

    function fundRound(uint256 amount) external nonReentrant returns (uint256 rewardPerHero) {
        require(amount > 0, "zero funding");
        uint16 eligible = genesisHeroes.totalMinted();
        require(eligible > 0, "no heroes");

        uint256 beforeBalance = rewardToken.balanceOf(address(this));
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = rewardToken.balanceOf(address(this)) - beforeBalance;
        require(received > 0, "nothing received");

        uint256 pool = received + carry;
        rewardPerHero = pool / eligible;
        require(rewardPerHero > 0, "round below one unit");
        require(cumulativeRewardPerHero <= type(uint240).max - rewardPerHero, "index overflow");
        uint256 nextCarry = pool % eligible;
        uint256 distributable = pool - nextCarry;
        checkpoints.push(Checkpoint({eligibleSupply: eligible, indexBefore: uint240(cumulativeRewardPerHero)}));
        cumulativeRewardPerHero += rewardPerHero;
        carry = nextCarry;
        claimLiability += distributable;
        totalFunded += received;
        emit RoundFunded(checkpoints.length - 1, received, eligible, rewardPerHero, carry);
    }

    function claim(uint256 tokenId) external nonReentrant returns (uint256 amount) {
        address owner = genesisHeroes.ownerOf(tokenId);
        uint256 stamp = _initialize(tokenId);
        amount = cumulativeRewardPerHero - stamp;
        require(amount > 0, "nothing claimable");
        heroStamp[tokenId] = cumulativeRewardPerHero;
        claimLiability -= amount;
        totalDelivered += amount;
        rewardToken.safeTransfer(owner, amount);
        emit RewardDelivered(tokenId, owner, amount);
    }

    function preview(uint256 tokenId) external view returns (uint256) {
        require(genesisHeroes.ownerOf(tokenId) != address(0), "invalid owner");
        uint256 stamp = initialized[tokenId] ? heroStamp[tokenId] : _entryIndex(tokenId);
        return cumulativeRewardPerHero - stamp;
    }

    function checkpointCount() external view returns (uint256) {
        return checkpoints.length;
    }

    function checkpoint(uint256 index) external view returns (Checkpoint memory) {
        return checkpoints[index];
    }

    function _initialize(uint256 tokenId) private returns (uint256 stamp) {
        if (initialized[tokenId]) return heroStamp[tokenId];
        stamp = _entryIndex(tokenId);
        initialized[tokenId] = true;
        heroStamp[tokenId] = stamp;
        emit HeroInitialized(tokenId, stamp);
    }

    function _entryIndex(uint256 tokenId) private view returns (uint256) {
        uint256 low = 0;
        uint256 high = checkpoints.length;
        while (low < high) {
            uint256 middle = (low + high) / 2;
            if (checkpoints[middle].eligibleSupply >= tokenId) high = middle;
            else low = middle + 1;
        }
        return low < checkpoints.length ? checkpoints[low].indexBefore : cumulativeRewardPerHero;
    }
}
