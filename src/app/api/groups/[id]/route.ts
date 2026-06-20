import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import crypto from "crypto";

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

    // Generate claimToken if missing (data migration/fallback)
    if (!group.claimToken || group.claimToken === "undefined") {
      group.claimToken = crypto.randomUUID();
      await group.save();
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
    const { name, description, currency, members } = await req.json();

    if (!name) {
      return NextResponse.json({ message: "Group name is required" }, { status: 400 });
    }

    await dbConnect();

    const group = await Group.findById(id);
    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    const email = session.user.email?.toLowerCase();
    const userId = (session.user as any).id;
    const isMember = group.members.some(
      (m: any) => m.id === userId || (m.email && m.email === email)
    );
    const isCreator = group.createdBy.toString() === userId;

    if (!isMember && !isCreator) {
      return NextResponse.json(
        { message: "Forbidden: Only group members can edit details" },
        { status: 403 }
      );
    }

    // Process members if provided in payload
    if (members && Array.isArray(members)) {
      const expenses = await Expense.find({ groupId: id });

      // Verify that no removed members have active balances/splits/claims
      for (const existingMember of group.members) {
        const stillExists = members.some((m: any) => m.id === existingMember.id);
        if (!stillExists) {
          // Member is being removed. Check involvement:
          const isPayer = expenses.some((e: any) => e.payerId === existingMember.id);
          const isSplitMember = expenses.some((e: any) => 
            e.splits.some((s: any) => s.memberId === existingMember.id && s.amount > 0.01)
          );
          const isClaimant = expenses.some((e: any) => 
            e.items && e.items.some((item: any) => item.claimedBy && item.claimedBy.includes(existingMember.id))
          );

          if (isPayer || isSplitMember || isClaimant) {
            return NextResponse.json(
              { message: `Cannot remove member "${existingMember.name}" because they have active expenses or claims in this group.` },
              { status: 400 }
            );
          }
        }
      }

      // Build updated members list
      const updatedMembers = [];
      const userEmailsSeen = new Set<string>();
      const userNamesSeen = new Set<string>();

      for (const m of members) {
        if (!m.name || !m.name.trim()) continue;
        const normalizedName = m.name.trim().toLowerCase();
        const normalizedEmail = m.email ? m.email.trim().toLowerCase() : "";

        // Prevent duplicate names or emails inside members array
        if (userNamesSeen.has(normalizedName)) continue;
        if (normalizedEmail && userEmailsSeen.has(normalizedEmail)) continue;

        userNamesSeen.add(normalizedName);
        if (normalizedEmail) userEmailsSeen.add(normalizedEmail);

        if (m.id) {
          // Keep existing member, but allow modifying guest properties
          const existing = group.members.find((member: any) => member.id === m.id);
          if (existing) {
            updatedMembers.push({
              id: existing.id,
              name: m.name.trim(),
              email: m.email ? m.email.trim().toLowerCase() : existing.email,
              isGuest: existing.isGuest
            });
          } else {
            // New member with provided id
            updatedMembers.push({
              id: m.id,
              name: m.name.trim(),
              email: m.email ? m.email.trim().toLowerCase() : undefined,
              isGuest: m.email ? false : true
            });
          }
        } else {
          // Brand new member
          updatedMembers.push({
            id: crypto.randomUUID(),
            name: m.name.trim(),
            email: m.email ? m.email.trim().toLowerCase() : undefined,
            isGuest: m.email ? false : true
          });
        }
      }

      group.members = updatedMembers;
    }

    group.name = name.trim();
    group.description = description ? description.trim() : undefined;
    group.currency = currency || "INR";
    await group.save();

    return NextResponse.json({ success: true, group });
  } catch (error: any) {
    console.error("Update group details error:", error);
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

    const group = await Group.findById(id);
    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    if (group.createdBy.toString() !== userId) {
      return NextResponse.json(
        { message: "Forbidden: Only the group creator can delete this group" },
        { status: 403 }
      );
    }

    // Delete all expenses in the group
    await Expense.deleteMany({ groupId: id });

    // Delete the group itself
    await Group.deleteOne({ _id: id });

    return NextResponse.json({ success: true, message: "Group deleted successfully" });
  } catch (error: any) {
    console.error("Delete group error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
