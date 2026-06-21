import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Activity from "@/lib/models/Activity";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const userId = (session.user as any).id;
    const userEmail = session.user.email?.toLowerCase();

    // 1. Find all groups user belongs to
    const groups = await Group.find({
      $or: [
        { createdBy: userId },
        { "members.email": userEmail }
      ]
    });

    // 2. Collect all member IDs representing the current user
    const userMemberIds = new Set<string>();
    userMemberIds.add(userId);
    groups.forEach((group: any) => {
      const match = group.members.find(
        (m: any) => m.id === userId || (m.email && m.email === userEmail)
      );
      if (match) {
        userMemberIds.add(match.id);
      }
    });
    const userMemberIdsArray = Array.from(userMemberIds);

    // 3. Query activities involving these member IDs
    const activities = await Activity.find({
      involvedMembers: { $in: userMemberIdsArray }
    }).sort({ createdAt: -1 }).limit(50);

    // 4. Calculate unreadCount
    let unreadCount = 0;
    activities.forEach((act: any) => {
      const isPerformer = userMemberIds.has(act.performedBy.id);
      const isRead = act.readBy.some((id: string) => userMemberIds.has(id));
      if (!isPerformer && !isRead) {
        unreadCount++;
      }
    });

    return NextResponse.json({ activities, unreadCount });
  } catch (error: any) {
    console.error("Fetch activities error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const userId = (session.user as any).id;
    const userEmail = session.user.email?.toLowerCase();

    // 1. Find all groups user belongs to
    const groups = await Group.find({
      $or: [
        { createdBy: userId },
        { "members.email": userEmail }
      ]
    });

    // 2. Collect all member IDs representing the current user
    const userMemberIds = new Set<string>();
    userMemberIds.add(userId);
    groups.forEach((group: any) => {
      const match = group.members.find(
        (m: any) => m.id === userId || (m.email && m.email === userEmail)
      );
      if (match) {
        userMemberIds.add(match.id);
      }
    });
    const userMemberIdsArray = Array.from(userMemberIds);

    // 3. Mark all activities involving the user as read
    await Activity.updateMany(
      {
        involvedMembers: { $in: userMemberIdsArray },
        readBy: { $nin: userMemberIdsArray }
      },
      {
        $addToSet: { readBy: { $each: userMemberIdsArray } }
      }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Mark activities read error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
