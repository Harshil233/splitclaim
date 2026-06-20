import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import { calculateItemizedSplits } from "@/lib/utils";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    await dbConnect();

    const expense = await Expense.findOne({ claimToken: token });

    if (!expense) {
      return NextResponse.json({ message: "Expense not found" }, { status: 404 });
    }

    const group = await Group.findById(expense.groupId);
    if (!group) {
      return NextResponse.json({ message: "Associated group not found" }, { status: 404 });
    }

    return NextResponse.json({ expense, group });
  } catch (error: any) {
    console.error("Fetch claim details error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { memberId, itemIds } = await req.json(); // itemIds are the items claimed by this member

    if (!memberId || !Array.isArray(itemIds)) {
      return NextResponse.json(
        { message: "Missing required claim parameters" },
        { status: 400 }
      );
    }

    await dbConnect();

    const expense = await Expense.findOne({ claimToken: token });
    if (!expense) {
      return NextResponse.json({ message: "Expense not found" }, { status: 404 });
    }

    const group = await Group.findById(expense.groupId);
    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    const memberExists = group.members.some((m: any) => m.id === memberId);
    if (!memberExists) {
      return NextResponse.json({ message: "Member not in group" }, { status: 400 });
    }

    // Update items' claimedBy list
    const updatedItems = expense.items.map((item: any) => {
      const isClaimedNow = itemIds.includes(item.id);
      let claimants = [...(item.claimedBy || [])];

      if (isClaimedNow) {
        if (!claimants.includes(memberId)) {
          claimants.push(memberId);
        }
      } else {
        claimants = claimants.filter((id) => id !== memberId);
      }

      return {
        id: item.id,
        name: item.name,
        price: item.price,
        claimedBy: claimants,
      };
    });

    // Recalculate final splits for the entire expense using the helper
    const memberIds = group.members.map((m: any) => m.id);
    const finalSplits = calculateItemizedSplits(
      expense.amount,
      expense.payerId,
      updatedItems,
      memberIds,
      expense.unclaimedSplitType || "payer"
    );

    // Track submitted members
    const submitted = expense.submittedMembers || [];
    if (!submitted.includes(memberId)) {
      submitted.push(memberId);
    }

    // Save back to DB
    expense.items = updatedItems;
    expense.splits = finalSplits;
    expense.submittedMembers = submitted;
    await expense.save();

    return NextResponse.json({ expense, group });
  } catch (error: any) {
    console.error("Update claim error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
