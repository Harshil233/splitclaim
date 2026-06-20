import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const {
      groupId,
      description,
      amount,
      payerId,
      splitType,
      splits,
      items,
      unclaimedSplitType,
    } = await req.json();

    if (!groupId || !description || !amount || !payerId || !splitType) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    let finalSplits = splits || [];
    let claimToken = undefined;

    if (splitType === "itemized") {
      claimToken = crypto.randomUUID();
      // Calculate initial splits based on claims (which might be empty initially)
      finalSplits = calculateInitialItemizedSplits(
        amount,
        payerId,
        items || [],
        group.members.map((m: any) => m.id),
        unclaimedSplitType || "equal"
      );
    }

    const expense = await Expense.create({
      groupId,
      description,
      amount,
      payerId,
      splitType,
      splits: finalSplits,
      items: items || [],
      unclaimedSplitType: unclaimedSplitType || "equal",
      claimToken,
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: any) {
    console.error("Create expense error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

function calculateInitialItemizedSplits(
  totalAmount: number,
  payerId: string,
  items: any[],
  memberIds: string[],
  unclaimedSplitType: string
) {
  const splitsMap: { [memberId: string]: number } = {};
  memberIds.forEach((id) => {
    splitsMap[id] = 0;
  });

  let claimedTotal = 0;

  // Process items
  items.forEach((item) => {
    const price = item.price;
    const claimants = item.claimedBy || [];

    if (claimants.length > 0) {
      claimedTotal += price;
      const share = price / claimants.length;
      claimants.forEach((cId: string) => {
        if (splitsMap[cId] !== undefined) {
          splitsMap[cId] += share;
        }
      });
    }
  });

  const unclaimedAmount = totalAmount - claimedTotal;

  if (unclaimedAmount > 0.01) {
    if (unclaimedSplitType === "payer") {
      if (splitsMap[payerId] !== undefined) {
        splitsMap[payerId] += unclaimedAmount;
      }
    } else {
      // Split equally among all members
      const share = unclaimedAmount / memberIds.length;
      memberIds.forEach((id) => {
        if (splitsMap[id] !== undefined) {
          splitsMap[id] += share;
        }
      });
    }
  }

  return Object.keys(splitsMap).map((memberId) => ({
    memberId,
    amount: parseFloat(splitsMap[memberId].toFixed(2)),
  }));
}
