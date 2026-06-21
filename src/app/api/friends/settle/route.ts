import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import { logActivity } from "@/lib/activity";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { friendEmail, friendName, amount, direction } = await req.json();

    if (!friendName || !amount || amount <= 0 || !direction) {
      return NextResponse.json(
        { message: "Missing or invalid payment parameters" },
        { status: 400 }
      );
    }

    if (direction !== "user_to_friend" && direction !== "friend_to_user") {
      return NextResponse.json(
        { message: "Invalid payment direction" },
        { status: 400 }
      );
    }

    await dbConnect();

    const email = session.user.email?.toLowerCase();
    const userId = (session.user as any).id;
    const userName = session.user.name || "Host";

    // Find all groups the user is in
    const groups = await Group.find({
      $or: [
        { createdBy: userId },
        { "members.email": email }
      ]
    });

    const eligibleDebts: Array<{
      groupId: string;
      groupName: string;
      userMemberId: string;
      friendMemberId: string;
      friendMemberName: string;
      debtAmount: number;
    }> = [];

    // Calculate debts in each group
    for (const group of groups) {
      const currentUserMember = group.members.find(
        (m: any) => m.id === userId || (m.email && m.email === email)
      );
      if (!currentUserMember) continue;

      // Find the matching friend in this group
      const friendMember = group.members.find((m: any) => {
        if (m.id === currentUserMember.id) return false;
        if (friendEmail && m.email && m.email.toLowerCase() === friendEmail.toLowerCase()) return true;
        return m.name.toLowerCase().trim() === friendName.toLowerCase().trim();
      });

      if (!friendMember) continue;

      const expenses = await Expense.find({ groupId: group._id });

      // Calculate direct balance between user and friend in this group
      let groupBalance = 0;
      expenses.forEach((exp: any) => {
        if (exp.payerId === currentUserMember.id) {
          const mSplit = exp.splits.find((s: any) => s.memberId === friendMember.id);
          if (mSplit) {
            groupBalance += mSplit.amount;
          }
        }
        if (exp.payerId === friendMember.id) {
          const uSplit = exp.splits.find((s: any) => s.memberId === currentUserMember.id);
          if (uSplit) {
            groupBalance -= uSplit.amount;
          }
        }
      });

      groupBalance = parseFloat(groupBalance.toFixed(2));

      // Filter by payment direction
      if (direction === "user_to_friend" && groupBalance < -0.01) {
        // User owes friend. User is paying.
        eligibleDebts.push({
          groupId: group._id.toString(),
          groupName: group.name,
          userMemberId: currentUserMember.id,
          friendMemberId: friendMember.id,
          friendMemberName: friendMember.name,
          debtAmount: Math.abs(groupBalance)
        });
      } else if (direction === "friend_to_user" && groupBalance > 0.01) {
        // Friend owes user. Friend is paying.
        eligibleDebts.push({
          groupId: group._id.toString(),
          groupName: group.name,
          userMemberId: currentUserMember.id,
          friendMemberId: friendMember.id,
          friendMemberName: friendMember.name,
          debtAmount: groupBalance
        });
      }
    }

    if (eligibleDebts.length === 0) {
      return NextResponse.json(
        { message: "No outstanding balances found in this direction with this friend" },
        { status: 400 }
      );
    }

    // Sort debts largest first to settle major ones first
    eligibleDebts.sort((a, b) => b.debtAmount - a.debtAmount);

    let amountRemaining = amount;
    const recordedSettlements = [];

    for (const debt of eligibleDebts) {
      if (amountRemaining <= 0.005) break;

      const settleAmount = parseFloat(Math.min(amountRemaining, debt.debtAmount).toFixed(2));
      if (settleAmount < 0.01) continue;

      // Determine payer and receiver name for the settlement expense description
      const payerName = direction === "user_to_friend" ? userName : debt.friendMemberName;
      const receiverName = direction === "user_to_friend" ? debt.friendMemberName : userName;
      const payerId = direction === "user_to_friend" ? debt.userMemberId : debt.friendMemberId;
      const receiverId = direction === "user_to_friend" ? debt.friendMemberId : debt.userMemberId;

      // Create settlement expense inside the group
      const settlementExpense = await Expense.create({
        groupId: debt.groupId,
        description: `Settlement: ${payerName} to ${receiverName}`,
        amount: settleAmount,
        payerId: payerId,
        splitType: "unequal",
        splits: [
          {
            memberId: receiverId,
            amount: settleAmount
          }
        ]
      });

      recordedSettlements.push({
        groupName: debt.groupName,
        amount: settleAmount,
        expenseId: settlementExpense._id
      });

      // Log activity
      const userEmailOrId = session.user.email || (session.user as any).id;
      await logActivity({
        groupId: debt.groupId,
        performedByUserId: userEmailOrId,
        type: "settle",
        description: `recorded settlement of ₹${settleAmount} (${payerName} to ${receiverName})`,
      });

      amountRemaining -= settleAmount;
    }

    return NextResponse.json({
      success: true,
      message: "Combined settlement recorded successfully",
      settlements: recordedSettlements,
      changeReturned: parseFloat(amountRemaining.toFixed(2))
    });
  } catch (error: any) {
    console.error("Combined settlement error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
