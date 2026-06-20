import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import crypto from "crypto";
import { calculateItemizedSplits } from "@/lib/utils";

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
      unclaimedMembers,
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
      finalSplits = calculateItemizedSplits(
        amount,
        payerId,
        items || [],
        group.members.map((m: any) => m.id),
        unclaimedSplitType || "equal",
        unclaimedMembers || []
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
      unclaimedMembers: unclaimedMembers || [],
      claimToken,
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: any) {
    console.error("Create expense error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

