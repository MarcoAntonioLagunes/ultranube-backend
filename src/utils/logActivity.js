import Activity from '../models/Activity.js';

export default async function logActivity(userId, action, label, metadata = {}) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const exists = await Activity.exists({
      userId,
      action,
      label,
      createdAt: { $gte: fiveMinutesAgo },
    });
    if (exists) return;
    await Activity.create({ userId, action, label, metadata });
  } catch {
    // non-critical — never propagate errors
  }
}
