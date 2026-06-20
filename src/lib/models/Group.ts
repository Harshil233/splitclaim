import mongoose, { Schema } from 'mongoose';

const GroupMemberSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
  },
  isGuest: {
    type: Boolean,
    default: true,
  },
});

const GroupSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a group name.'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    members: [GroupMemberSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    claimToken: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Group || mongoose.model('Group', GroupSchema);
