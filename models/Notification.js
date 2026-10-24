const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient_email: { type: String, required: true, lowercase: true, trim: true },
  sender_name: { type: String, required: true },
  sender_avatar: { type: String, default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
  type: { type: String, enum: ['like', 'review', 'reply', 'story_reply'], required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  target_id: { type: String }, // location_id or story_id
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

notificationSchema.index({ recipient_email: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema, 'notifications');
