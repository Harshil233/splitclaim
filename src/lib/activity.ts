import dbConnect from "@/lib/db";
import Activity from "@/lib/models/Activity";
import Group from "@/lib/models/Group";

interface CreateActivityParams {
  groupId: string;
  performedByUserId: string; // The session user ID or email
  type: 'create_expense' | 'update_expense' | 'delete_expense' | 'settle' | 'update_group';
  description: string;
}

export async function logActivity({
  groupId,
  performedByUserId,
  type,
  description,
}: CreateActivityParams) {
  try {
    await dbConnect();

    // 1. Fetch group details to get group name and members list
    const group = await Group.findById(groupId);
    if (!group) return;

    // 2. Identify the member in the group who performed the action
    const performer = group.members.find(
      (m: any) => m.id === performedByUserId || (m.email && m.email.toLowerCase() === performedByUserId.toLowerCase())
    );

    const performerId = performer ? performer.id : performedByUserId;
    const performerName = performer ? performer.name : "Someone";

    // 3. Involved members are all members in the group
    const involvedMembers = group.members.map((m: any) => m.id);

    // 4. Create the activity
    await Activity.create({
      groupId: group._id,
      groupName: group.name,
      performedBy: {
        id: performerId,
        name: performerName,
      },
      type,
      description,
      involvedMembers,
      readBy: [performerId], // The performer has already read it
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
