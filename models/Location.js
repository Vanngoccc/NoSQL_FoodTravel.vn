const mongoose = require('mongoose');

// 1. Schema cho phản hồi bình luận (Nested Replies - Phân cấp chuẩn mạng xã hội)
const replySchema = new mongoose.Schema({
  user_name: { type: String, required: true },
  content: { type: String, required: true },
  avatar: { type: String, default: '' },
  reply_to: { type: String, default: '' },
  parent_reply_id: { type: String, default: '' },
  likes_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

// 2. Schema cho đánh giá lồng nhau (Nested Reviews)
const reviewSchema = new mongoose.Schema({
  user_name: { type: String, required: true },
  avatar: { type: String, default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  content: { type: String, default: 'Đã đánh giá sao' },
  images: [{ type: String }],
  created_at: { type: Date, default: Date.now },
  replies: [replySchema]
});

// 3. Schema chính cho Địa điểm (Location) - Collection "diadiem"
const locationSchema = new mongoose.Schema({
  custom_id: { type: Number },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  city: { type: String, required: true },
  address: { type: String },
  description: { type: String },
  price_range: { type: String, enum: ['BUDGET', 'MODERATE', 'LUXURY'], default: 'MODERATE' },
  images: [{ type: String }],
  // Thông tin tác giả đăng bài
  author_name: { type: String, default: 'Thành viên FoodTravel' },
  author_email: { type: String, default: '' },
  author_avatar: { type: String, default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
  // Cấu trúc GeoJSON 2dsphere chuẩn MongoDB
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [Longitude, Latitude]
  },
  rating_avg: { type: Number, default: 0 },
  total_reviews: { type: Number, default: 0 },
  likes_count: { type: Number, default: 0 },
  liked_by: [{ type: String }],
  reviews: [reviewSchema]
}, { timestamps: true });

// Đánh Indexes phục vụ tìm kiếm nâng cao (SV2 Barem Đề tài 04)
locationSchema.index({ location: '2dsphere' });
locationSchema.index({ name: 'text', description: 'text', category: 'text' });
locationSchema.index({ city: 1, category: 1 });
locationSchema.index({ rating_avg: -1 });

// Khai báo rõ ràng Collection "diadiem" theo đúng barem yêu cầu
module.exports = mongoose.model('Location', locationSchema, 'diadiem');