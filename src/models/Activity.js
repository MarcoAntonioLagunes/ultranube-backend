import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      // upload | download | delete_file | move | create_folder | delete_folder | rename | translate | analyze | present | organize
    },
    label: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

activitySchema.index({ userId: 1, createdAt: -1 });
// MongoDB TTL: auto-delete records older than 7 days
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;
