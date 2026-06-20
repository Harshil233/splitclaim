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

    const group = await Group.findOne({ claimToken: token });

    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    // Fetch all itemized expenses for this group
    const expenses = await Expense.find({ groupId: group._id, splitType: "itemized" }).sort({ date: -1 });

    return NextResponse.json({ group, expenses });
  } catch (error: any) {
    console.error("Fetch group claims details error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { memberId, claims } = await req.json(); // claims is { [expenseId]: string[] }

    if (!memberId || !claims || typeof claims !== "object") {
      return NextResponse.json(
        { message: "Missing required claim parameters" },
        { status: 400 }
      );
    }

    await dbConnect();

    const group = await Group.findOne({ claimToken: token });
    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    const memberExists = group.members.some((m: any) => m.id === memberId);
    if (!memberExists) {
      return NextResponse.json({ message: "Member not in group" }, { status: 400 });
    }

    const memberIds = group.members.map((m: any) => m.id);

    // Update each expense's claims
    for (const [expenseId, itemIds] of Object.entries(claims)) {
      if (!Array.isArray(itemIds)) continue;

      const expense = await Expense.findOne({ _id: expenseId, groupId: group._id });
      if (!expense) continue;

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

      // Recalculate splits for the entire expense
      const finalSplits = calculateItemizedSplits(
        expense.amount,
        expense.payerId,
        updatedItems,
        memberIds,
        expense.unclaimedSplitType || "equal"
      );

      // Track submitted members
      const submitted = expense.submittedMembers || [];
      if (!submitted.includes(memberId)) {
        submitted.push(memberId);
      }

      expense.items = updatedItems;
      expense.splits = finalSplits;
      expense.submittedMembers = submitted;
      await expense.save();
    }

    // Return the updated group and itemized expenses
    const updatedExpenses = await Expense.find({ groupId: group._id, splitType: "itemized" }).sort({ date: -1 });

    return NextResponse.json({ group, expenses: updatedExpenses });
  } catch (error: any) {
    console.error("Update group claims error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
