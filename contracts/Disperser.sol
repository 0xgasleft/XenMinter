// SPDX-License-Identifier: UNLICENSED

import "./ReentrancyGuard.sol";

pragma solidity ^0.8.17;

contract Disperser is ReentrancyGuard {

    function disperseMatic(address[] calldata receivers, uint256 amount) external payable nonReentrant {
        bool status = false;
        for(uint256 i = 0; i < receivers.length;)
        {
            (status, ) = receivers[i].call{value: amount}("");
            unchecked {
                ++i;
            }
        }
        require(status, "Last disperse failed");
        if(address(this).balance > 0)
        {
            (status, ) = msg.sender.call{value: address(this).balance}("");
            require(status, "Refunding source wallet with remaining balance has failed");
        }
    }
}