import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";

export async function GET(
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

    const group = await Group.findById(id);

    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    const email = session.user.email?.toLowerCase();
    const userId = (session.user as any).id;

    // Verify user is in the group (either creator or member)
    const isMember = group.members.some(
      (m: any) => m.id === userId || (m.email && m.email === email)
    );
    const isCreator = group.createdBy.toString() === userId;

    if (!isMember && !isCreator) {
      return NextResponse.json(
        { message: "Forbidden: You are not a member of this group" },
        { status: 403 }
      );
    }

    // Fetch all expenses for this group
    const expenses = await Expense.find({ groupId: id }).sort({ date: -1 });

    return NextResponse.json({ group, expenses });
  } catch (error: any) {
    console.error("Fetch group details error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
