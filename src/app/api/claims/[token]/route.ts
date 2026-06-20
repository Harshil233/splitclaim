import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";

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

    // Recalculate final splits for the entire expense
    const memberIds = group.members.map((m: any) => m.id);
    const splitsMap: { [memberId: string]: number } = {};
    
    memberIds.forEach((id: string) => {
      splitsMap[id] = 0;
    });

    let claimedTotal = 0;

    // Sum up claimed items
    updatedItems.forEach((item: any) => {
      const price = item.price;
      const claimants: string[] = item.claimedBy || [];

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

    // Handle unclaimed items
    const unclaimedAmount = expense.amount - claimedTotal;

    if (unclaimedAmount > 0.01) {
      if (expense.unclaimedSplitType === "payer") {
        if (splitsMap[expense.payerId] !== undefined) {
          splitsMap[expense.payerId] += unclaimedAmount;
        }
      } else {
        // split equally among all group members
        const share = unclaimedAmount / memberIds.length;
        memberIds.forEach((id: string) => {
          if (splitsMap[id] !== undefined) {
            splitsMap[id] += share;
          }
        });
      }
    }

    // Format splits list
    const finalSplits = Object.keys(splitsMap).map((mId) => ({
      memberId: mId,
      amount: parseFloat(splitsMap[mId].toFixed(2)),
    }));

    // Save back to DB
    expense.items = updatedItems;
    expense.splits = finalSplits;
    await expense.save();

    return NextResponse.json({ expense, group });
  } catch (error: any) {
    console.error("Update claim error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
