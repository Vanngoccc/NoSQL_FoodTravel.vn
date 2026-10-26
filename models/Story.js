const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  user_name: { type: String, required: true },
  user_avatar: { type: String, default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
  user_email: { type: String, required: true },
  location_name: { type: String, required: true },
  location_city: { type: String, required: true },
  image: { type: String, required: true },
  caption: { type: String, default: '' },
  filter: { type: String, default: 'normal' },
  music: { type: String, default: 'Nhạc thịnh hành 🎵' },
  likes_count: { type: Number, default: 0 },
  liked_by: [{ type: String }],
  replies: [{
    user_name: { type: String, required: true },
    user_avatar: { type: String, default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
    user_email: { type: String, default: '' },
    message: { type: String, required: true },
    reply_back: { type: String, default: '' },
    reply_back_at: { type: Date },
    created_at: { type: Date, default: Date.now }
  }],
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Tự động hết hạn và dọn dẹp sau 24 giờ (TTL Index chuẩn MongoDB trên cả createdAt và created_at)
storySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
storySchema.index({ created_at: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('Story', storySchema, 'stories');
