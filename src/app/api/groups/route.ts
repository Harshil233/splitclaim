import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import crypto from "crypto";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const email = session.user.email?.toLowerCase();
    const userId = (session.user as any).id;

    // Find groups where user is a member or creator
    const groups = await Group.find({
      $or: [
        { createdBy: userId },
        { "members.email": email }
      ]
    }).sort({ createdAt: -1 });

    // Calculate user's net balance for each group
    const groupsWithBalances = await Promise.all(
      groups.map(async (group) => {
        const expenses = await Expense.find({ groupId: group._id });
        
        // Find the member record corresponding to the current user
        const member = group.members.find(
          (m: any) => m.id === userId || (m.email && m.email === email)
        );

        let userBalance = 0;
        if (member) {
          expenses.forEach((exp: any) => {
            if (exp.payerId === member.id) {
              userBalance += exp.amount;
            }
            const userSplit = exp.splits.find((s: any) => s.memberId === member.id);
            if (userSplit) {
              userBalance -= userSplit.amount;
            }
          });
        }

        return {
          ...group.toObject(),
          userBalance: parseFloat(userBalance.toFixed(2)),
        };
      })
    );

    return NextResponse.json({ groups: groupsWithBalances });
  } catch (error: any) {
    console.error("Fetch groups error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { name, description, currency, members } = await req.json();

    if (!name) {
      return NextResponse.json({ message: "Group name is required" }, { status: 400 });
    }

    await dbConnect();

    const userId = (session.user as any).id;
    const userEmail = session.user.email?.toLowerCase();
    const userName = session.user.name || "Host";

    const processedMembers = [];
    
    // Add the creator as the first member
    processedMembers.push({
      id: userId,
      name: userName,
      email: userEmail,
      isGuest: false,
    });

    if (Array.isArray(members)) {
      for (const m of members) {
        if (!m.name) continue;

        // Skip if duplicate name/email
        const isDuplicate = processedMembers.some(
          (existing) =>
            (m.email && existing.email === m.email.toLowerCase()) ||
            existing.name.toLowerCase() === m.name.toLowerCase()
        );
        if (isDuplicate) continue;

        processedMembers.push({
          id: m.isGuest === false && m.email ? m.id || crypto.randomUUID() : crypto.randomUUID(),
          name: m.name,
          email: m.email ? m.email.toLowerCase() : undefined,
          isGuest: m.email ? false : true,
        });
      }
    }

    const group = await Group.create({
      name,
      description,
      currency: currency || "INR",
      members: processedMembers,
      createdBy: userId,
      claimToken: crypto.randomUUID(),
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error: any) {
    console.error("Create group error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
