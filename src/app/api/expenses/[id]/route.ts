import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import { calculateItemizedSplits } from "@/lib/utils";
import { logActivity } from "@/lib/activity";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const {
      description,
      amount,
      payerId,
      splitType,
      splits,
      items,
      unclaimedSplitType,
      unclaimedMembers,
    } = await req.json();

    if (!description || !amount || !payerId || !splitType) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    await dbConnect();

    const expense = await Expense.findById(id);
    if (!expense) {
      return NextResponse.json({ message: "Expense not found" }, { status: 404 });
    }

    const group = await Group.findById(expense.groupId);
    if (!group) {
      return NextResponse.json({ message: "Associated group not found" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const isPayer = expense.payerId === userId;
    const isHost = group.createdBy.toString() === userId;

    if (!isPayer && !isHost) {
      return NextResponse.json(
        { message: "Forbidden: Only the payer or the group host can edit this expense" },
        { status: 403 }
      );
    }

    let finalSplits = splits || [];
    if (splitType === "itemized") {
      finalSplits = calculateItemizedSplits(
        amount,
        payerId,
        items || [],
        group.members.map((m: any) => m.id),
        unclaimedSplitType || "equal",
        unclaimedMembers || []
      );
    }

    expense.description = description.trim();
    expense.amount = amount;
    expense.payerId = payerId;
    expense.splitType = splitType;
    expense.splits = finalSplits;
    expense.items = items || [];
    expense.unclaimedSplitType = unclaimedSplitType || "equal";
    expense.unclaimedMembers = unclaimedMembers || [];
    await expense.save();

    // Log activity
    const userEmailOrId = session.user.email || (session.user as any).id;
    await logActivity({
      groupId: expense.groupId.toString(),
      performedByUserId: userEmailOrId,
      type: "update_expense",
      description: `updated "${description.trim()}" (₹${amount})`,
    });

    return NextResponse.json({ success: true, expense });
  } catch (error: any) {
    console.error("Update expense error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await dbConnect();

    const expense = await Expense.findById(id);
    if (!expense) {
      return NextResponse.json({ message: "Expense not found" }, { status: 404 });
    }

    const group = await Group.findById(expense.groupId);
    if (!group) {
      return NextResponse.json({ message: "Associated group not found" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const isPayer = expense.payerId === userId;
    const isHost = group.createdBy.toString() === userId;

    if (!isPayer && !isHost) {
      return NextResponse.json(
        { message: "Forbidden: Only the payer or the group host can delete this expense" },
        { status: 403 }
      );
    }

    await Expense.deleteOne({ _id: id });

    // Log activity
    const userEmailOrId = session.user.email || (session.user as any).id;
    await logActivity({
      groupId: expense.groupId.toString(),
      performedByUserId: userEmailOrId,
      type: "delete_expense",
      description: `deleted expense "${expense.description}"`,
    });

    return NextResponse.json({ success: true, message: "Expense deleted successfully" });
  } catch (error: any) {
    console.error("Delete expense error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
