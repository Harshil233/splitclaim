import mongoose, { Schema } from 'mongoose';

const ActivitySchema = new Schema(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    groupName: {
      type: String,
      required: true,
    },
    performedBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    type: {
      type: String,
      enum: ['create_expense', 'update_expense', 'delete_expense', 'settle', 'update_group'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    involvedMembers: {
      type: [String], // Array of member IDs (from group.members)
      required: true,
      default: [],
    },
    readBy: {
      type: [String], // Array of member IDs who have read this activity
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
