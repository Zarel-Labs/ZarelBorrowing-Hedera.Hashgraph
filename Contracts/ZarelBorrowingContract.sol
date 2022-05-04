// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

import "./hip-206/HederaTokenService.sol";
import "./hip-206/HederaResponseCodes.sol";

interface IERC20 {
    function transfer(address _to, uint256 _amount) external returns (bool);

    function balanceOf(address account) external view returns (uint256);
}

interface IERC721 {
    function balanceOf(address owner) external view returns (uint256 balance);

    function ownerOf(uint256 _tokenId) external view returns (address);
}

contract ZarelBorrow is HederaTokenService {
    IERC20 public immutable ZarelToken;
    IERC721 public immutable ZarelNFT;

    int64 public floorPrice;
    // fee to experiment with, when there is a default in payment
    int16 constant fee = 100;
    //// an array of NFTs
    uint64[] Nfts;

    address admin;
    address NftToken;
    address ZToken;

    struct Borrower {
        uint40 time;
        int64 serialNumber;
        int64 balance;
        bool isActive;
        address lender;
    }
    mapping(address => Borrower) public BorrowerDetails;

    constructor(
        address _admin,
        address _tokenAddr,
        address _NFTAddr,
        address _NFTToken,
        address _ZToken
    ) {
        admin = _admin;
        ZarelToken = IERC20(_tokenAddr);
        ZarelNFT = IERC721(_NFTAddr);
        NftToken = _NFTToken;
        ZToken = _ZToken;
    }

    modifier onlyAdmin() {
        admin == msg.sender;
        _;
    }

    modifier IsMember(address sender) {
        require(ZarelNFT.balanceOf(sender) > 0, "not a Zarel member");
        _;
    }

    function Borrow(address sender, int64 _serialNumber)
        public
        IsMember(sender)
        returns (bool)
    {
        Borrower storage b = BorrowerDetails[sender];
        uint256 Id = uint64(_serialNumber);
        require(sender == ZarelNFT.ownerOf(Id), "Not owner of this NFT");
        require(!b.isActive, "You have an active loan");

        // receive zarel Nft as collateral for token
        int256 response = HederaTokenService.transferNFT(
            NftToken,
            sender,
            address(this),
            _serialNumber
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("NFT Transfer Failed");
        }
        // transfer zarel token to user
        require(
            ZarelToken.transfer(sender, uint64(floorPrice)),
            "Token transfer failed"
        );
        // update lender details
        b.balance = floorPrice;
        b.time = uint40(block.timestamp);
        b.serialNumber = _serialNumber;
        b.lender = sender;
        b.isActive = true;

        return true;
    }

    function payBack(address receiver, int64 _amount) public {
        Borrower storage b = BorrowerDetails[receiver];
        require(b.isActive == true, "You do not have a loan");
        // checks diff between  present time and borrowing start time;
        // if greater than 30 days, a fee is attached to the loan repayable;
        if ((block.timestamp - b.time) / 86400 > 30) {
            require(_amount >= (b.balance + fee), "Pay up total debt");
            int256 res = HederaTokenService.transferToken(
                ZToken,
                receiver,
                address(this),
                _amount
            );

            if (res != HederaResponseCodes.SUCCESS) {
                revert("Token Transfer Failed");
            }

            int256 res1 = HederaTokenService.transferNFT(
                NftToken,
                address(this),
                receiver,
                b.serialNumber
            );

            if (res1 != HederaResponseCodes.SUCCESS) {
                revert("NFT Transfer Failed");
            }

            b.isActive = false;
        }

        int256 res2 = HederaTokenService.transferToken(
            ZToken,
            receiver,
            address(this),
            _amount
        );

        if (res2 != HederaResponseCodes.SUCCESS) {
            revert("Token Transfer Failed");
        }

        int256 res3 = HederaTokenService.transferNFT(
            NftToken,
            address(this),
            receiver,
            b.serialNumber
        );

        if (res3 != HederaResponseCodes.SUCCESS) {
            revert("NFT Transfer Failed");
        }

        b.isActive = false;
    }

    ////////////////////////////////////////////////////
    //=================== onlyAdmin =================//

    function setFloorPrice(int64 _floorPrice) public onlyAdmin returns (int64) {
        floorPrice = _floorPrice;
        return floorPrice;
    }

    function TokenBalance() public view onlyAdmin {
        ZarelToken.balanceOf(address(this));
    }

    function NFTBalance() public view onlyAdmin returns (uint256) {
        uint256 balance = ZarelNFT.balanceOf(address(this));

        return balance;
    }

    function getNFts(int64 serialNumber) public onlyAdmin {
        int256 response2 = HederaTokenService.transferNFT(
            NftToken,
            address(this),
            admin,
            serialNumber
        );

        if (response2 != HederaResponseCodes.SUCCESS) {
            revert("NFT Transfer Failed");
        }
    }

    function tokenAssociate(address _address) external onlyAdmin {
        int256 response = HederaTokenService.associateToken(
            address(this),
            _address
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Associate Failed");
        }
    }

    // Fix the lending time calc
}
