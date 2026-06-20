import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { friendName, friendEmail } = await req.json();
    if (!friendName) {
      return NextResponse.json({ message: "Friend name is required" }, { status: 400 });
    }

    await dbConnect();

    const userId = (session.user as any).id;
    const userEmail = session.user.email?.toLowerCase();
    const userName = session.user.name || "Host";

    // Find all groups with exactly 2 members
    const candidateGroups = await Group.find({
      members: { $size: 2 },
      $or: [
        { createdBy: userId },
        { "members.email": userEmail }
      ]
    });

    // Check if any candidate group contains both the user and the friend
    let existingGroup = null;
    for (const group of candidateGroups) {
      // Find the user member
      const userMember = group.members.find(
        (m: any) => m.id === userId || (m.email && m.email === userEmail)
      );
      if (!userMember) continue;

      // Find the other member
      const otherMember = group.members.find(
        (m: any) => m.id !== userMember.id
      );
      if (!otherMember) continue;

      // Match the other member to the friend
      if (friendEmail) {
        if (otherMember.email && otherMember.email.toLowerCase() === friendEmail.toLowerCase()) {
          existingGroup = group;
          break;
        }
      } else {
        if (otherMember.name.toLowerCase() === friendName.toLowerCase()) {
          existingGroup = group;
          break;
        }
      }
    }

    if (existingGroup) {
      return NextResponse.json({ groupId: existingGroup._id.toString() });
    }

    // Otherwise, create a new 1-on-1 group
    const processedMembers = [
      {
        id: userId,
        name: userName,
        email: userEmail,
        isGuest: false,
      },
      {
        id: crypto.randomUUID(),
        name: friendName,
        email: friendEmail ? friendEmail.toLowerCase() : undefined,
        isGuest: friendEmail ? false : true,
      }
    ];

    const group = await Group.create({
      name: `${friendName} & ${userName}`,
      description: `Direct split with ${friendName}`,
      currency: "INR",
      members: processedMembers,
      createdBy: userId,
      claimToken: crypto.randomUUID(),
    });

    return NextResponse.json({ groupId: group._id.toString() }, { status: 201 });
  } catch (error: any) {
    console.error("Create 1-on-1 group error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
