// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Genesis membership contract. One primary mint per wallet; tier caps total exactly 3,000.
/// @dev Metadata reveal and mint activation should sit behind a deployment timelock in production.
contract HoodedGenesis is ERC721, ReentrancyGuard {
    enum Tier {
        Recruit,
        Specialist,
        Vanguard,
        Icon
    }

    uint16[4] public tierCaps = [2200, 600, 180, 20];
    uint256[4] public tierPrices = [uint256(100_000 ether), 250_000 ether, 500_000 ether, 1_000_000 ether];
    uint16[4] public tierMinted;
    uint16 public totalMinted;
    IERC20 public immutable hoodedToken;
    address public immutable seasonalRewards;
    address public immutable daoTimelock;
    mapping(address => bool) public usedPrimaryMint;
    mapping(uint256 => Tier) public originTier;

    event GenesisMinted(address indexed member, uint256 indexed tokenId, Tier tier, uint256 price);
    event ProgressionReset(uint256 indexed tokenId, address indexed from, address indexed to);

    constructor(address token, address rewards, address treasury) ERC721("HOODED Genesis Heroes", "HEROES") {
        require(token != address(0) && rewards != address(0) && treasury != address(0), "zero address");
        hoodedToken = IERC20(token);
        seasonalRewards = rewards;
        daoTimelock = treasury;
    }

    function mint(Tier tier) external nonReentrant returns (uint256 tokenId) {
        uint256 tierIndex = uint256(tier);
        require(!usedPrimaryMint[msg.sender], "one primary mint");
        require(tierMinted[tierIndex] < tierCaps[tierIndex], "tier sold out");
        uint256 price = tierPrices[tierIndex];

        usedPrimaryMint[msg.sender] = true;
        tierMinted[tierIndex] += 1;
        totalMinted += 1;
        tokenId = totalMinted;
        originTier[tokenId] = tier;

        require(hoodedToken.transferFrom(msg.sender, address(this), price), "payment failed");

        uint256 burnAmount = price * 40 / 100;
        ERC20Burnable(address(hoodedToken)).burn(burnAmount);
        require(hoodedToken.transfer(seasonalRewards, price * 40 / 100), "reward transfer failed");
        require(hoodedToken.transfer(daoTimelock, price * 20 / 100), "treasury transfer failed");

        _safeMint(msg.sender, tokenId);
        emit GenesisMinted(msg.sender, tokenId, tier, price);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0) && from != to) emit ProgressionReset(tokenId, from, to);
    }
}
