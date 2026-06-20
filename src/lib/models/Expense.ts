import mongoose, { Schema } from 'mongoose';

const SplitSchema = new Schema({
  memberId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
});

const ExpenseItemSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
  },
  claimedBy: {
    type: [String], // Array of memberIds
    default: [],
  },
});

const ExpenseSchema = new Schema(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide an expense description.'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please provide an amount.'],
    },
    payerId: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    splitType: {
      type: String,
      enum: ['equal', 'unequal', 'percentage', 'itemized'],
      required: true,
    },
    splits: [SplitSchema],
    items: [ExpenseItemSchema],
    unclaimedSplitType: {
      type: String,
      enum: ['equal', 'payer'],
      default: 'payer',
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

export default mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
