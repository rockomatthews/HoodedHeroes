// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Genesis membership contract. One primary mint per wallet; tier caps total exactly 3,000.
/// @dev Metadata reveal and mint activation should sit behind a deployment timelock in production.
contract HoodedGenesis is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant FOUNDER_GRANT = 10;
    enum Tier {
        Recruit,
        Specialist,
        Vanguard,
        Icon
    }

    uint16[4] public tierCaps = [2200, 600, 180, 20];
    uint16[4] public tierOffsets = [0, 2200, 2800, 2980];
    uint256[4] public tierPrices = [uint256(100_000 ether), 250_000 ether, 500_000 ether, 1_000_000 ether];
    uint16[4] public tierMinted;
    uint16 public totalMinted;
    IERC20 public immutable hoodedToken;
    address public immutable seasonalRewards;
    address public immutable daoTimelock;
    mapping(address => bool) public usedPrimaryMint;
    mapping(uint256 => Tier) public originTier;
    /// @notice Monotonic mint position, independent of tier-based token ID ranges.
    mapping(uint256 => uint16) public mintSequence;
    address public immutable founder;
    uint64 public immutable publicMintStartsAt;
    bytes32 public immutable metadataRoot;
    string private metadataBaseUri;

    event GenesisMinted(address indexed member, uint256 indexed tokenId, Tier tier, uint256 price);
    event ProgressionReset(uint256 indexed tokenId, address indexed from, address indexed to);
    event FounderGrantMinted(address indexed founder, uint256 firstTokenId, uint256 lastTokenId);

    constructor(
        address token,
        address rewards,
        address treasury,
        address founder_,
        uint64 publicMintStartsAt_,
        bytes32 metadataRoot_,
        string memory metadataBaseUri_
    ) ERC721("HOODED Genesis Heroes", "HEROES") {
        require(
            token != address(0) && rewards != address(0) && treasury != address(0) && founder_ != address(0),
            "zero address"
        );
        require(metadataRoot_ != bytes32(0) && bytes(metadataBaseUri_).length > 0, "invalid metadata");
        hoodedToken = IERC20(token);
        seasonalRewards = rewards;
        daoTimelock = treasury;
        founder = founder_;
        publicMintStartsAt = publicMintStartsAt_;
        metadataRoot = metadataRoot_;
        metadataBaseUri = metadataBaseUri_;
        usedPrimaryMint[founder_] = true;
        tierMinted[uint256(Tier.Recruit)] = FOUNDER_GRANT;
        totalMinted = FOUNDER_GRANT;
        for (uint256 tokenId = 1; tokenId <= FOUNDER_GRANT; ++tokenId) {
            originTier[tokenId] = Tier.Recruit;
            mintSequence[tokenId] = uint16(tokenId);
            _mint(founder_, tokenId);
        }
        emit FounderGrantMinted(founder_, 1, FOUNDER_GRANT);
    }

    function mint(Tier tier) external nonReentrant returns (uint256 tokenId) {
        require(block.timestamp >= publicMintStartsAt, "public mint closed");
        uint256 tierIndex = uint256(tier);
        require(!usedPrimaryMint[msg.sender], "one primary mint");
        require(tierMinted[tierIndex] < tierCaps[tierIndex], "tier sold out");
        uint256 price = tierPrices[tierIndex];

        usedPrimaryMint[msg.sender] = true;
        tierMinted[tierIndex] += 1;
        totalMinted += 1;
        tokenId = uint256(tierOffsets[tierIndex]) + tierMinted[tierIndex];
        originTier[tokenId] = tier;
        mintSequence[tokenId] = totalMinted;

        hoodedToken.safeTransferFrom(msg.sender, address(this), price);

        uint256 burnAmount = price * 40 / 100;
        ERC20Burnable(address(hoodedToken)).burn(burnAmount);
        hoodedToken.safeTransfer(seasonalRewards, price * 40 / 100);
        hoodedToken.safeTransfer(daoTimelock, price * 20 / 100);

        _safeMint(msg.sender, tokenId);
        emit GenesisMinted(msg.sender, tokenId, tier, price);
    }

    function _baseURI() internal view override returns (string memory) {
        return metadataBaseUri;
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0) && from != to) emit ProgressionReset(tokenId, from, to);
    }
}
