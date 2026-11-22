// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VextridePaymentRouter} from "../VextridePaymentRouter.sol";

contract MockUSDC is ERC20 {
    enum TransferMode {
        Exact,
        RevertTransfer,
        FalseAfterCredit,
        ShortCredit,
        NoMovement,
        NoReturn,
        Callback
    }

    error MockTransferFailed();

    TransferMode private mode;
    bytes32 private callbackReference;

    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address holder, uint256 amount) external {
        _mint(holder, amount);
    }

    function setMode(TransferMode next) external {
        mode = next;
    }

    function setCallback(bytes32 paymentReference) external {
        mode = TransferMode.Callback;
        callbackReference = paymentReference;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (mode == TransferMode.RevertTransfer) revert MockTransferFailed();
        if (mode == TransferMode.NoMovement) return true;
        if (mode == TransferMode.Callback) VextridePaymentRouter(msg.sender).pay(callbackReference, amount);
        if (mode == TransferMode.ShortCredit) {
            _spendAllowance(from, msg.sender, amount);
            _transfer(from, to, amount - 1);
            _burn(from, 1);
            return true;
        }

        super.transferFrom(from, to, amount);
        if (mode == TransferMode.NoReturn) {
            assembly ("memory-safe") {
                return(0, 0)
            }
        }
        return mode != TransferMode.FalseAfterCredit;
    }
}

contract WrongDecimalsUSDC {
    function decimals() external pure returns (uint256) {
        return 18;
    }
}

abstract contract RouterFixture is Test {
    address internal constant USDC = 0x3600000000000000000000000000000000000000;
    address internal constant RECIPIENT = address(0xC001);
    uint256 internal constant INITIAL_BALANCE = 100_000_000;
    bytes32 internal constant SETTLED_TOPIC = keccak256("PaymentSettled(address,address,bytes32,uint256)");

    MockUSDC internal token;
    VextridePaymentRouter internal router;

    function _deployFixture() internal {
        vm.chainId(5042);
        vm.etch(USDC, address(new MockUSDC()).code);
        token = MockUSDC(USDC);
        router = new VextridePaymentRouter(RECIPIENT);
    }

    function _approve(address payer, uint256 amount) internal {
        vm.prank(payer);
        token.approve(address(router), amount);
    }

    function _pay(address payer, bytes32 paymentReference, uint256 amount) internal {
        vm.prank(payer);
        router.pay(paymentReference, amount);
    }

    function _assertSettlements(address payer, bytes32 paymentReference, uint256 amount, uint256 expectedCount)
        internal
        view
    {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 count;
        for (uint256 i; i < logs.length; ++i) {
            Vm.Log memory log = logs[i];
            if (log.emitter != address(router)) continue;
            ++count;
            assertEq(log.topics.length, 4);
            assertEq(log.topics[0], SETTLED_TOPIC);
            assertEq(log.topics[1], bytes32(uint256(uint160(payer))));
            assertEq(log.topics[2], bytes32(uint256(uint160(RECIPIENT))));
            assertEq(log.topics[3], paymentReference);
            assertEq(log.data, abi.encode(amount));
        }
        assertEq(count, expectedCount);
    }
}

contract VextridePaymentRouterTest is RouterFixture {
    address private constant PAYER = address(0xA11CE);
    address private constant OTHER_PAYER = address(0xB0B);
    uint256 private constant AMOUNT = 1_234_567;
    bytes32 private constant REF = bytes32(uint256(1));

    function setUp() public {
        _deployFixture();
        token.mint(PAYER, INITIAL_BALANCE);
        token.mint(OTHER_PAYER, INITIAL_BALANCE);
    }

    function testConstructorBindsRecipientAndCanonicalUSDC() public view {
        assertEq(router.recipient(), RECIPIENT);
        assertEq(address(router.usdc()), USDC);
        assertEq(token.decimals(), 6);
    }

    function testConstructorRejectsZeroRecipient() public {
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.InvalidRecipient.selector, address(0)));
        new VextridePaymentRouter(address(0));
    }

    function testConstructorRejectsTokenAsRecipient() public {
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.InvalidRecipient.selector, USDC));
        new VextridePaymentRouter(USDC);
    }

    function testConstructorRejectsOwnAddressAsRecipient() public {
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.InvalidRecipient.selector, predicted));
        new VextridePaymentRouter(predicted);
    }

    function testConstructorRejectsWrongChain() public {
        vm.chainId(5042002);
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.WrongChain.selector, 5042002));
        new VextridePaymentRouter(RECIPIENT);
    }

    function testConstructorRejectsMissingTokenCode() public {
        vm.etch(USDC, "");
        vm.expectRevert(VextridePaymentRouter.UnsupportedUSDC.selector);
        new VextridePaymentRouter(RECIPIENT);
    }

    function testConstructorRejectsWrongTokenDecimals() public {
        vm.etch(USDC, address(new WrongDecimalsUSDC()).code);
        vm.expectRevert(VextridePaymentRouter.UnsupportedUSDC.selector);
        new VextridePaymentRouter(RECIPIENT);
    }

    function testPaymentSettlesExactAmountAndEvent() public {
        token.mint(RECIPIENT, 17);
        _approve(PAYER, AMOUNT);
        vm.recordLogs();
        _pay(PAYER, REF, AMOUNT);

        _assertSettlements(PAYER, REF, AMOUNT, 1);
        assertEq(token.balanceOf(PAYER), INITIAL_BALANCE - AMOUNT);
        assertEq(token.balanceOf(RECIPIENT), 17 + AMOUNT);
        assertEq(token.balanceOf(address(router)), 0);
        assertEq(token.allowance(PAYER, address(router)), 0);
        assertTrue(router.isReferenceUsed(PAYER, REF));
    }

    function testSmallestAtomicUnitSettlesWithoutScaling() public {
        _approve(PAYER, 1);
        _pay(PAYER, REF, 1);
        assertEq(token.balanceOf(RECIPIENT), 1);
    }

    function testPaymentRejectsWrongChain() public {
        vm.chainId(5042002);
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.WrongChain.selector, 5042002));
        _pay(PAYER, REF, AMOUNT);
    }

    function testPaymentRejectsZeroAmount() public {
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.InvalidAmount.selector, 0));
        _pay(PAYER, REF, 0);
    }

    function testPaymentRejectsAmountOutsideNativeRepresentation() public {
        uint256 amount = type(uint256).max / 1e12 + 1;
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.InvalidAmount.selector, amount));
        _pay(PAYER, REF, amount);
    }

    function testPaymentRejectsZeroReference() public {
        vm.expectRevert(VextridePaymentRouter.InvalidReference.selector);
        _pay(PAYER, bytes32(0), AMOUNT);
    }

    function testPaymentRejectsPayerAsRecipient() public {
        vm.expectRevert(VextridePaymentRouter.PayerIsRecipient.selector);
        _pay(RECIPIENT, REF, AMOUNT);
    }

    function testDuplicateReferenceDoesNotMoveFundsOrEmitSettlement() public {
        _approve(PAYER, AMOUNT * 2);
        _pay(PAYER, REF, AMOUNT);
        vm.recordLogs();
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.ReferenceAlreadyUsed.selector, PAYER, REF));
        _pay(PAYER, REF, AMOUNT);

        _assertSettlements(PAYER, REF, AMOUNT, 0);
        assertEq(token.balanceOf(RECIPIENT), AMOUNT);
        assertEq(token.allowance(PAYER, address(router)), AMOUNT);
    }

    function testDistinctPayersCanSettleTheSameReference() public {
        _approve(PAYER, AMOUNT);
        _approve(OTHER_PAYER, AMOUNT);
        _pay(PAYER, REF, AMOUNT);
        assertFalse(router.isReferenceUsed(OTHER_PAYER, REF));

        vm.recordLogs();
        _pay(OTHER_PAYER, REF, AMOUNT);
        _assertSettlements(OTHER_PAYER, REF, AMOUNT, 1);
        assertTrue(router.isReferenceUsed(PAYER, REF));
        assertTrue(router.isReferenceUsed(OTHER_PAYER, REF));
        assertEq(token.balanceOf(RECIPIENT), AMOUNT * 2);
    }

    function testReferenceNamespaceIsSeparateForAnotherRouter() public {
        VextridePaymentRouter another = new VextridePaymentRouter(RECIPIENT);
        _approve(PAYER, AMOUNT);
        _pay(PAYER, REF, AMOUNT);
        assertFalse(another.isReferenceUsed(PAYER, REF));

        vm.startPrank(PAYER);
        token.approve(address(another), AMOUNT);
        another.pay(REF, AMOUNT);
        vm.stopPrank();
        assertTrue(another.isReferenceUsed(PAYER, REF));
        assertEq(token.balanceOf(RECIPIENT), 2 * AMOUNT);
    }

    function testMissingAllowanceBubblesTokenErrorAndCanRetry() public {
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(router), 0, AMOUNT)
        );
        _pay(PAYER, REF, AMOUNT);
        assertFalse(router.isReferenceUsed(PAYER, REF));

        _approve(PAYER, AMOUNT);
        _pay(PAYER, REF, AMOUNT);
        assertTrue(router.isReferenceUsed(PAYER, REF));
    }

    function testInsufficientBalanceBubblesTokenErrorAndPreservesAllowance() public {
        uint256 amount = INITIAL_BALANCE + 1;
        _approve(PAYER, amount);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, PAYER, INITIAL_BALANCE, amount)
        );
        _pay(PAYER, REF, amount);

        assertFalse(router.isReferenceUsed(PAYER, REF));
        assertEq(token.allowance(PAYER, address(router)), amount);
        assertEq(token.balanceOf(RECIPIENT), 0);
    }

    function testTransferRevertPreservesReferenceAndEmitsNoSettlement() public {
        token.setMode(MockUSDC.TransferMode.RevertTransfer);
        _assertPaymentRollsBack(abi.encodeWithSelector(MockUSDC.MockTransferFailed.selector));
    }

    function testFalseReturnRollsBackTokenCreditAndReference() public {
        token.setMode(MockUSDC.TransferMode.FalseAfterCredit);
        _assertPaymentRollsBack(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, USDC));
    }

    function testFeeOnTransferRollsBackUnderCreditAndBurn() public {
        token.setMode(MockUSDC.TransferMode.ShortCredit);
        _assertPaymentRollsBack(
            abi.encodeWithSelector(VextridePaymentRouter.UnexpectedRecipientCredit.selector, AMOUNT, AMOUNT - 1)
        );
    }

    function testTrueReturnWithoutMovementEmitsNoSettlement() public {
        token.setMode(MockUSDC.TransferMode.NoMovement);
        _assertPaymentRollsBack(
            abi.encodeWithSelector(VextridePaymentRouter.UnexpectedRecipientCredit.selector, AMOUNT, 0)
        );
    }

    function testNoReturnTokenWithExactCreditSettles() public {
        token.setMode(MockUSDC.TransferMode.NoReturn);
        _approve(PAYER, AMOUNT);
        vm.recordLogs();
        _pay(PAYER, REF, AMOUNT);

        _assertSettlements(PAYER, REF, AMOUNT, 1);
        assertEq(token.balanceOf(RECIPIENT), AMOUNT);
    }

    function testReentrantTokenCallbackRollsBackForSameOrDifferentReference() public {
        token.setCallback(REF);
        _assertPaymentRollsBack(abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
        token.setCallback(bytes32(uint256(2)));
        _assertPaymentRollsBack(abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
    }

    function testDirectTokenTransferDoesNotSettleAndLaterPaymentLeavesStrayBalance() public {
        vm.recordLogs();
        vm.prank(PAYER);
        bool transferred = token.transfer(address(router), 7);
        assertTrue(transferred);
        _assertSettlements(PAYER, REF, AMOUNT, 0);
        assertFalse(router.isReferenceUsed(PAYER, REF));

        _approve(PAYER, AMOUNT);
        _pay(PAYER, REF, AMOUNT);
        assertEq(token.balanceOf(address(router)), 7);
        assertEq(token.balanceOf(RECIPIENT), AMOUNT);
    }

    function testPayAndPlainSendRejectNativeValue() public {
        vm.deal(PAYER, 2);
        _approve(PAYER, AMOUNT);
        vm.prank(PAYER);
        (bool paid,) = address(router).call{value: 1}(abi.encodeCall(router.pay, (REF, AMOUNT)));
        vm.prank(PAYER);
        (bool sent,) = address(router).call{value: 1}("");

        assertFalse(paid);
        assertFalse(sent);
        assertFalse(router.isReferenceUsed(PAYER, REF));
        assertEq(address(router).balance, 0);
        assertEq(PAYER.balance, 2);
        assertEq(token.balanceOf(RECIPIENT), 0);
    }

    function testAdminAndWithdrawalSelectorsAreUnavailable() public {
        vm.deal(address(router), 11);
        token.mint(address(router), 7);
        bytes[] memory calls = new bytes[](5);
        calls[0] = abi.encodeWithSignature("setRecipient(address)", PAYER);
        calls[1] = abi.encodeWithSignature("withdraw(address,uint256)", PAYER, 7);
        calls[2] = abi.encodeWithSignature("sweep(address,address)", USDC, PAYER);
        calls[3] = abi.encodeWithSignature("pause()");
        calls[4] = abi.encodeWithSignature("upgradeToAndCall(address,bytes)", PAYER, "");

        for (uint256 i; i < calls.length; ++i) {
            vm.prank(PAYER);
            (bool ok,) = address(router).call(calls[i]);
            assertFalse(ok);
        }
        assertEq(router.recipient(), RECIPIENT);
        assertEq(token.balanceOf(address(router)), 7);
        assertEq(address(router).balance, 11);
    }

    function testFuzzPositiveAmountCreditsExactly(uint128 rawAmount, bytes32 paymentReference) public {
        vm.assume(paymentReference != bytes32(0));
        uint256 amount = uint256(rawAmount) + 1;
        token.mint(PAYER, amount);
        _approve(PAYER, amount);

        vm.recordLogs();
        _pay(PAYER, paymentReference, amount);
        _assertSettlements(PAYER, paymentReference, amount, 1);
        assertEq(token.balanceOf(PAYER), INITIAL_BALANCE);
        assertEq(token.balanceOf(RECIPIENT), amount);
        assertEq(token.balanceOf(address(router)), 0);
    }

    function testFuzzDistinctReferencesSettleIndependently(bytes32 first, bytes32 second, uint64 seed) public {
        vm.assume(first != bytes32(0) && second != bytes32(0) && first != second);
        uint256 amount = uint256(seed) % (INITIAL_BALANCE / 2) + 1;
        _approve(PAYER, amount * 2);
        _pay(PAYER, first, amount);
        _pay(PAYER, second, amount);

        assertTrue(router.isReferenceUsed(PAYER, first));
        assertTrue(router.isReferenceUsed(PAYER, second));
        assertEq(token.balanceOf(RECIPIENT), amount * 2);
    }

    function testFuzzRepeatedReferenceOnlyBlocksOriginalPayer(bytes32 paymentReference, uint64 seed) public {
        vm.assume(paymentReference != bytes32(0));
        uint256 amount = uint256(seed) % INITIAL_BALANCE + 1;
        _approve(PAYER, amount);
        _approve(OTHER_PAYER, amount);
        _pay(PAYER, paymentReference, amount);
        _pay(OTHER_PAYER, paymentReference, amount);

        vm.expectRevert(
            abi.encodeWithSelector(VextridePaymentRouter.ReferenceAlreadyUsed.selector, PAYER, paymentReference)
        );
        _pay(PAYER, paymentReference, amount);
        assertEq(token.balanceOf(RECIPIENT), amount * 2);
    }

    function testFuzzFailedCreditRollsBackThenCanRetry(bytes32 paymentReference, uint64 seed) public {
        vm.assume(paymentReference != bytes32(0));
        uint256 amount = uint256(seed) % INITIAL_BALANCE + 1;
        _approve(PAYER, amount);
        token.setMode(MockUSDC.TransferMode.ShortCredit);
        vm.recordLogs();
        vm.expectRevert(
            abi.encodeWithSelector(VextridePaymentRouter.UnexpectedRecipientCredit.selector, amount, amount - 1)
        );
        _pay(PAYER, paymentReference, amount);
        _assertSettlements(PAYER, paymentReference, amount, 0);
        assertFalse(router.isReferenceUsed(PAYER, paymentReference));
        assertEq(token.balanceOf(PAYER), INITIAL_BALANCE);
        assertEq(token.allowance(PAYER, address(router)), amount);

        token.setMode(MockUSDC.TransferMode.Exact);
        _pay(PAYER, paymentReference, amount);
        assertEq(token.balanceOf(RECIPIENT), amount);
        assertTrue(router.isReferenceUsed(PAYER, paymentReference));
    }

    function _assertPaymentRollsBack(bytes memory expectedError) private {
        _approve(PAYER, AMOUNT);
        uint256 supply = token.totalSupply();
        vm.recordLogs();
        vm.expectRevert(expectedError);
        _pay(PAYER, REF, AMOUNT);

        _assertSettlements(PAYER, REF, AMOUNT, 0);
        assertFalse(router.isReferenceUsed(PAYER, REF));
        assertFalse(router.isReferenceUsed(USDC, REF));
        assertFalse(router.isReferenceUsed(USDC, bytes32(uint256(2))));
        assertEq(token.balanceOf(PAYER), INITIAL_BALANCE);
        assertEq(token.balanceOf(RECIPIENT), 0);
        assertEq(token.balanceOf(address(router)), 0);
        assertEq(token.allowance(PAYER, address(router)), AMOUNT);
        assertEq(token.totalSupply(), supply);
    }
}

/// @dev A bounded model uses independent balances and reference state for every attempted payment.
contract PaymentSequence is RouterFixture {
    uint256 public constant PAYER_COUNT = 4;
    uint256 public constant REFERENCE_COUNT = 8;

    mapping(address => mapping(bytes32 => bool)) public consumed;
    uint256 public attempts;
    uint256 public successful;
    uint256 public failedPayments;
    uint256 public totalSettled;
    uint256 public redirectAttempts;

    constructor(VextridePaymentRouter subject, MockUSDC mock) {
        router = subject;
        token = mock;
        for (uint256 i; i < PAYER_COUNT; ++i) {
            token.mint(payerAt(i), INITIAL_BALANCE);
        }
    }

    function payerAt(uint256 index) public pure returns (address) {
        address[4] memory payers = [address(0xD000), address(0xD001), address(0xD002), address(0xD003)];
        return payers[index];
    }

    function attemptPayment(uint8 payerSeed, uint8 referenceSeed, uint96 amountSeed, bool approveAmount, uint8 modeSeed)
        external
    {
        address payer = payerAt(payerSeed % PAYER_COUNT);
        bytes32 paymentReference = bytes32(uint256(referenceSeed) % REFERENCE_COUNT);
        uint256 amount = uint256(amountSeed) % (INITIAL_BALANCE / 2 + 1);
        uint256 payerBefore = token.balanceOf(payer);
        uint256 recipientBefore = token.balanceOf(RECIPIENT);
        uint256 allowanceBefore = approveAmount ? amount : 0;
        bool wasUsed = consumed[payer][paymentReference];
        bool shortCredit = modeSeed % 5 == 0;
        bool expectedSuccess = amount > 0 && paymentReference != bytes32(0) && !wasUsed && approveAmount
            && payerBefore >= amount && !shortCredit;

        token.setMode(shortCredit ? MockUSDC.TransferMode.ShortCredit : MockUSDC.TransferMode.Exact);
        _approve(payer, allowanceBefore);
        ++attempts;
        vm.recordLogs();
        vm.prank(payer);
        (bool ok,) = address(router).call(abi.encodeCall(router.pay, (paymentReference, amount)));

        assertEq(ok, expectedSuccess, "payment outcome disagrees with model");
        _assertSettlements(payer, paymentReference, amount, ok ? 1 : 0);
        if (ok) {
            consumed[payer][paymentReference] = true;
            ++successful;
            totalSettled += amount;
            assertEq(token.balanceOf(payer), payerBefore - amount);
            assertEq(token.balanceOf(RECIPIENT), recipientBefore + amount);
            assertEq(token.allowance(payer, address(router)), allowanceBefore - amount);
        } else {
            ++failedPayments;
            assertEq(token.balanceOf(payer), payerBefore);
            assertEq(token.balanceOf(RECIPIENT), recipientBefore);
            assertEq(token.allowance(payer, address(router)), allowanceBefore);
        }
        assertEq(router.isReferenceUsed(payer, paymentReference), wasUsed || ok);
    }

    function attemptRecipientChange(uint8 payerSeed, address proposedRecipient) external {
        ++redirectAttempts;
        vm.prank(payerAt(payerSeed % PAYER_COUNT));
        (bool ok,) = address(router).call(abi.encodeWithSignature("setRecipient(address)", proposedRecipient));
        assertFalse(ok);
    }
}

/// forge-config: default.invariant.runs = 128
/// forge-config: default.invariant.depth = 64
/// forge-config: default.invariant.fail-on-revert = true
contract VextridePaymentRouterInvariantTest is RouterFixture {
    PaymentSequence private sequence;

    function setUp() public {
        _deployFixture();
        sequence = new PaymentSequence(router, token);
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = PaymentSequence.attemptPayment.selector;
        selectors[1] = PaymentSequence.attemptRecipientChange.selector;
        targetContract(address(sequence));
        targetSelector(FuzzSelector({addr: address(sequence), selectors: selectors}));
    }

    function invariant_ReferencesMatchPayerScopedModel() public view {
        for (uint256 i; i < sequence.PAYER_COUNT(); ++i) {
            address payer = sequence.payerAt(i);
            for (uint256 j; j < sequence.REFERENCE_COUNT(); ++j) {
                bytes32 paymentReference = bytes32(j);
                assertEq(router.isReferenceUsed(payer, paymentReference), sequence.consumed(payer, paymentReference));
            }
        }
    }

    function invariant_RecipientCreditMatchesAllVerifiedSettlements() public view {
        assertEq(token.balanceOf(RECIPIENT), sequence.totalSettled());
    }

    function invariant_TotalTokenSupplyAndAttemptsAreAccountedFor() public view {
        assertEq(token.totalSupply(), sequence.PAYER_COUNT() * INITIAL_BALANCE);
        assertEq(sequence.attempts(), sequence.successful() + sequence.failedPayments());
    }

    function invariant_RouterDoesNotAccumulateIntendedPaymentFunds() public view {
        assertEq(token.balanceOf(address(router)), 0);
        assertEq(address(router).balance, 0);
    }

    function invariant_ConfigurationCannotBeRedirected() public view {
        assertEq(router.recipient(), RECIPIENT);
        assertEq(address(router.usdc()), USDC);
    }
}
