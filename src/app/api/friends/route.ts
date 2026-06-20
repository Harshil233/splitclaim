import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const email = session.user.email?.toLowerCase();
    const userId = (session.user as any).id;

    // Find all groups the user is in (either creator or member)
    const groups = await Group.find({
      $or: [
        { createdBy: userId },
        { "members.email": email }
      ]
    }).sort({ createdAt: -1 });

    const friendsMap = new Map<string, {
      name: string;
      email?: string;
      netBalance: number;
      sharedGroups: Array<{
        groupId: string;
        groupName: string;
        userMemberId: string;
        friendMemberId: string;
        balance: number;
      }>;
    }>();

    for (const group of groups) {
      // Find the member record corresponding to the current user
      const currentUserMember = group.members.find(
        (m: any) => m.id === userId || (m.email && m.email === email)
      );
      if (!currentUserMember) continue;

      const expenses = await Expense.find({ groupId: group._id });

      const otherMembers = group.members.filter((m: any) => m.id !== currentUserMember.id);

      for (const m of otherMembers) {
        // Unique key: match by email if available, otherwise by name
        const key = m.email ? `email:${m.email.toLowerCase().trim()}` : `name:${m.name.toLowerCase().trim()}`;

        // Calculate balance between current user and this member in this group
        let groupBalance = 0;
        expenses.forEach((exp: any) => {
          if (exp.payerId === currentUserMember.id) {
            const mSplit = exp.splits.find((s: any) => s.memberId === m.id);
            if (mSplit) {
              groupBalance += mSplit.amount;
            }
          }
          if (exp.payerId === m.id) {
            const uSplit = exp.splits.find((s: any) => s.memberId === currentUserMember.id);
            if (uSplit) {
              groupBalance -= uSplit.amount;
            }
          }
        });

        // Round to 2 decimals
        groupBalance = parseFloat(groupBalance.toFixed(2));

        let existingFriend = friendsMap.get(key);
        if (!existingFriend) {
          existingFriend = {
            name: m.name,
            email: m.email,
            netBalance: 0,
            sharedGroups: []
          };
          friendsMap.set(key, existingFriend);
        }

        existingFriend.netBalance += groupBalance;
        existingFriend.sharedGroups.push({
          groupId: group._id.toString(),
          groupName: group.name,
          userMemberId: currentUserMember.id,
          friendMemberId: m.id,
          balance: groupBalance
        });
      }
    }

    // Convert map to list and round netBalance
    const friends = Array.from(friendsMap.values()).map(f => ({
      ...f,
      netBalance: parseFloat(f.netBalance.toFixed(2))
    }));

    // Sort by absolute value of netBalance (largest debts first)
    friends.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

    return NextResponse.json({ success: true, friends });
  } catch (error: any) {
    console.error("Get friends error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
