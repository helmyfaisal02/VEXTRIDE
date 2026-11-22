// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {VextridePaymentRouter} from "../VextridePaymentRouter.sol";

contract VextrideArcForkTest is Test {
    IERC20Metadata constant TOKEN = IERC20Metadata(0x3600000000000000000000000000000000000000);

    address constant PAYER = address(0xA11CE);
    address constant RECIPIENT = address(0xB0B);
    address constant OTHER_PAYER = address(0xCAFE);
    uint256 constant PINNED_BLOCK = 32527875;

    function setUp() public {
        if (!vm.envOr("VEXTRIDE_ARC_FORK_TEST", false)) {
            vm.skip(true);
        }
        assertEq(block.number, PINNED_BLOCK, "Run on the reviewed Arc Mainnet fork block");
    }

    function testRealTokenInterface() public view {
        assertEq(block.chainid, 5042);
        assertGt(address(TOKEN).code.length, 0);
        assertEq(TOKEN.decimals(), 6);
    }

    function testSyntheticBalanceAndPayment() public {
        // Local fork state only. No real funds or private keys.
        vm.deal(PAYER, 10 ether + 17);
        vm.deal(RECIPIENT, 31);

        assertEq(TOKEN.balanceOf(PAYER), 10_000_000, "Native/ERC20 balance mismatch in fork simulator");

        uint256 beforeBalance = TOKEN.balanceOf(RECIPIENT);
        VextridePaymentRouter router = new VextridePaymentRouter(RECIPIENT);
        assertEq(router.recipient(), RECIPIENT);
        assertEq(address(router.usdc()), address(TOKEN));
        uint256 routerNativeBefore = address(router).balance;
        uint256 routerTokenBefore = TOKEN.balanceOf(address(router));

        uint256 amount = 1_234_567;
        bytes32 paymentRef = bytes32(uint256(1));
        vm.prank(PAYER);
        assertTrue(TOKEN.approve(address(router), amount));
        assertEq(TOKEN.allowance(PAYER, address(router)), amount);

        vm.recordLogs();
        vm.prank(PAYER);
        router.pay(paymentRef, amount);

        _assertPaymentLogs(router, paymentRef, amount);
        assertEq(TOKEN.balanceOf(RECIPIENT), beforeBalance + amount);
        assertEq(TOKEN.balanceOf(PAYER), 10_000_000 - amount);
        assertEq(RECIPIENT.balance, amount * 1e12 + 31);
        assertEq(PAYER.balance, 10 ether + 17 - amount * 1e12);
        assertEq(TOKEN.allowance(PAYER, address(router)), 0);
        assertEq(TOKEN.balanceOf(address(router)), routerTokenBefore);
        assertEq(address(router).balance, routerNativeBefore);
        assertTrue(router.isReferenceUsed(PAYER, paymentRef));
    }

    function testMissingAllowanceRollsBackOnRealArcUSDC() public {
        vm.deal(PAYER, 3 ether);

        VextridePaymentRouter router = new VextridePaymentRouter(RECIPIENT);

        bytes32 paymentRef = keccak256("arc-allowance-retry");
        uint256 beforeBalance = TOKEN.balanceOf(RECIPIENT);
        assertEq(TOKEN.allowance(PAYER, address(router)), 0);

        vm.recordLogs();
        vm.prank(PAYER);
        (bool success,) = address(router).call(abi.encodeCall(router.pay, (paymentRef, 1_000_000)));

        assertFalse(success);
        assertEq(vm.getRecordedLogs().length, 0, "Missing allowance must emit no logs");
        assertFalse(router.isReferenceUsed(PAYER, paymentRef));
        assertEq(TOKEN.balanceOf(RECIPIENT), beforeBalance);
        assertEq(TOKEN.balanceOf(PAYER), 3_000_000);
        assertEq(TOKEN.allowance(PAYER, address(router)), 0);

        vm.prank(PAYER);
        assertTrue(TOKEN.approve(address(router), 1_000_000));

        vm.prank(PAYER);
        router.pay(paymentRef, 1_000_000);

        assertEq(TOKEN.balanceOf(RECIPIENT), beforeBalance + 1_000_000);
        assertEq(TOKEN.allowance(PAYER, address(router)), 0);
        assertTrue(router.isReferenceUsed(PAYER, paymentRef));
    }

    function testDuplicateReferenceRejectedOnRealArcUSDC() public {
        vm.deal(PAYER, 4 ether);

        VextridePaymentRouter router = new VextridePaymentRouter(RECIPIENT);

        bytes32 paymentRef = keccak256("arc-replay-test");

        vm.prank(PAYER);
        assertTrue(TOKEN.approve(address(router), 2_000_000));

        vm.prank(PAYER);
        router.pay(paymentRef, 1_000_000);

        uint256 afterFirstPayment = TOKEN.balanceOf(RECIPIENT);

        vm.prank(PAYER);
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.ReferenceAlreadyUsed.selector, PAYER, paymentRef));
        router.pay(paymentRef, 1_000_000);

        assertEq(TOKEN.balanceOf(RECIPIENT), afterFirstPayment);
        assertEq(TOKEN.balanceOf(PAYER), 3_000_000);
        assertEq(TOKEN.allowance(PAYER, address(router)), 1_000_000);
        assertTrue(router.isReferenceUsed(PAYER, paymentRef));
    }

    function testDistinctReferencesAndPayersSettleIndependently() public {
        vm.deal(PAYER, 4 ether);
        vm.deal(OTHER_PAYER, 4 ether);
        VextridePaymentRouter router = new VextridePaymentRouter(RECIPIENT);
        uint256 beforeBalance = TOKEN.balanceOf(RECIPIENT);
        bytes32 first = bytes32(uint256(1));
        bytes32 second = bytes32(uint256(2));

        vm.startPrank(PAYER);
        assertTrue(TOKEN.approve(address(router), 3));
        router.pay(first, 1);
        router.pay(second, 2);
        vm.stopPrank();
        assertFalse(router.isReferenceUsed(OTHER_PAYER, first));

        vm.startPrank(OTHER_PAYER);
        assertTrue(TOKEN.approve(address(router), 3));
        router.pay(first, 3);
        vm.stopPrank();

        assertTrue(router.isReferenceUsed(PAYER, first));
        assertTrue(router.isReferenceUsed(PAYER, second));
        assertTrue(router.isReferenceUsed(OTHER_PAYER, first));
        assertFalse(router.isReferenceUsed(OTHER_PAYER, second));
        assertEq(TOKEN.balanceOf(RECIPIENT), beforeBalance + 6);
        assertEq(TOKEN.balanceOf(PAYER), 4_000_000 - 3);
        assertEq(TOKEN.balanceOf(OTHER_PAYER), 4_000_000 - 3);
    }

    function testZeroReferenceAndAmountRevertWithoutConsumingAllowance() public {
        vm.deal(PAYER, 2 ether);
        VextridePaymentRouter router = new VextridePaymentRouter(RECIPIENT);
        bytes32 paymentRef = bytes32(uint256(1));
        uint256 beforeBalance = TOKEN.balanceOf(RECIPIENT);

        vm.startPrank(PAYER);
        assertTrue(TOKEN.approve(address(router), 1));
        vm.expectRevert(VextridePaymentRouter.InvalidReference.selector);
        router.pay(bytes32(0), 1);
        vm.expectRevert(abi.encodeWithSelector(VextridePaymentRouter.InvalidAmount.selector, 0));
        router.pay(paymentRef, 0);
        vm.stopPrank();

        assertFalse(router.isReferenceUsed(PAYER, bytes32(0)));
        assertFalse(router.isReferenceUsed(PAYER, paymentRef));
        assertEq(TOKEN.allowance(PAYER, address(router)), 1);
        assertEq(TOKEN.balanceOf(RECIPIENT), beforeBalance);
    }

    function testWrongChainGuardWithLocalChainOverride() public {
        VextridePaymentRouter router = new VextridePaymentRouter(RECIPIENT);
        bytes32 paymentRef = bytes32(uint256(1));
        vm.chainId(5042002);
        bytes memory reason = abi.encodeWithSelector(VextridePaymentRouter.WrongChain.selector, 5042002);
        vm.expectRevert(reason);
        new VextridePaymentRouter(RECIPIENT);

        vm.prank(PAYER);
        vm.expectRevert(reason);
        router.pay(paymentRef, 1);
        assertFalse(router.isReferenceUsed(PAYER, paymentRef));
    }

    function _assertPaymentLogs(VextridePaymentRouter router, bytes32 paymentRef, uint256 amount) private view {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 settlements;
        uint256 tokenTransfers;
        for (uint256 i; i < logs.length; ++i) {
            Vm.Log memory entry = logs[i];
            if (entry.emitter == address(router)) {
                assertEq(entry.topics.length, 4);
                assertEq(entry.topics[0], VextridePaymentRouter.PaymentSettled.selector);
                assertEq(entry.topics[1], bytes32(uint256(uint160(PAYER))));
                assertEq(entry.topics[2], bytes32(uint256(uint160(RECIPIENT))));
                assertEq(entry.topics[3], paymentRef);
                assertEq(entry.data, abi.encode(amount));
                ++settlements;
            } else if (
                entry.emitter == address(TOKEN) && entry.topics.length > 0
                    && entry.topics[0] == IERC20.Transfer.selector
            ) {
                assertEq(entry.topics.length, 3);
                assertEq(entry.topics[1], bytes32(uint256(uint160(PAYER))));
                assertEq(entry.topics[2], bytes32(uint256(uint160(RECIPIENT))));
                assertEq(entry.data, abi.encode(amount));
                ++tokenTransfers;
            }
        }
        assertEq(settlements, 1);
        assertEq(tokenTransfers, 1);
    }
}
