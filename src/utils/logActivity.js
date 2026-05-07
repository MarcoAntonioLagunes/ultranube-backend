import Activity from '../models/Activity.js';

export default async function logActivity(userId, action, label, metadata = {}) {
  try {
    await Activity.create({ userId, action, label, metadata });
  } catch {
    // non-critical — never propagate errors
  }
}
