// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Settles caller-authorized Arc USDC payments to a fixed recipient.
contract VextridePaymentRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant ARC_MAINNET_CHAIN_ID = 5042;
    // Keep the underlying amount representable in Arc's 18-decimal balance.
    uint256 private constant MAX_AMOUNT = type(uint256).max / 1e12;

    IERC20 public constant usdc = IERC20(0x3600000000000000000000000000000000000000);
    address public immutable recipient;

    mapping(address payer => mapping(bytes32 paymentReference => bool used)) private usedReferences;

    error WrongChain(uint256 actual);
    error InvalidRecipient(address recipient);
    error UnsupportedUSDC();
    error InvalidReference();
    error InvalidAmount(uint256 amount);
    error PayerIsRecipient();
    error ReferenceAlreadyUsed(address payer, bytes32 paymentReference);
    error UnexpectedRecipientCredit(uint256 expected, uint256 observed);

    event PaymentSettled(
        address indexed payer, address indexed recipient, bytes32 indexed paymentReference, uint256 amount
    );

    constructor(address paymentRecipient) {
        _checkChain();
        if (paymentRecipient == address(0) || paymentRecipient == address(this) || paymentRecipient == address(usdc)) {
            revert InvalidRecipient(paymentRecipient);
        }

        if (address(usdc).code.length == 0) revert UnsupportedUSDC();
        (bool ok, bytes memory decimalsData) = address(usdc).staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
        if (!ok || decimalsData.length != 32 || abi.decode(decimalsData, (uint256)) != 6) revert UnsupportedUSDC();

        recipient = paymentRecipient;
    }

    /// @notice Pays the recipient from the caller's existing USDC allowance.
    /// @param paymentReference A nonzero public identifier unique to this payer and router.
    /// @param amount The exact amount in six-decimal USDC units.
    function pay(bytes32 paymentReference, uint256 amount) external nonReentrant {
        _checkChain();
        if (paymentReference == bytes32(0)) revert InvalidReference();
        if (amount == 0 || amount > MAX_AMOUNT) revert InvalidAmount(amount);
        if (msg.sender == recipient) revert PayerIsRecipient();
        if (usedReferences[msg.sender][paymentReference]) revert ReferenceAlreadyUsed(msg.sender, paymentReference);

        // A transfer failure or unexpected credit also rolls back this reservation.
        usedReferences[msg.sender][paymentReference] = true;
        uint256 beforeBalance = usdc.balanceOf(recipient);
        usdc.safeTransferFrom(msg.sender, recipient, amount);
        uint256 afterBalance = usdc.balanceOf(recipient);
        uint256 credited = afterBalance >= beforeBalance ? afterBalance - beforeBalance : 0;
        if (credited != amount) revert UnexpectedRecipientCredit(amount, credited);

        emit PaymentSettled(msg.sender, recipient, paymentReference, amount);
    }

    function isReferenceUsed(address payer, bytes32 paymentReference) external view returns (bool) {
        return usedReferences[payer][paymentReference];
    }

    function _checkChain() private view {
        if (block.chainid != ARC_MAINNET_CHAIN_ID) revert WrongChain(block.chainid);
    }
}
