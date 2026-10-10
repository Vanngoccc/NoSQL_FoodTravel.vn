const mongoose = require('mongoose');

// 1. Schema cho phản hồi bình luận (Nested Replies)
const replySchema = new mongoose.Schema({
  user_name: { type: String, required: true },
  content: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

// 2. Schema cho đánh giá lồng nhau (Nested Reviews)
const reviewSchema = new mongoose.Schema({
  user_name: { type: String, required: true },
  avatar: { type: String, default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  content: { type: String, required: true },
  images: [{ type: String }],
  created_at: { type: Date, default: Date.now },
  replies: [replySchema]
});

// 3. Schema chính cho Địa điểm (Location)
const locationSchema = new mongoose.Schema({
  custom_id: { type: Number },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  city: { type: String, required: true },
  address: { type: String },
  description: { type: String },
  price_range: { type: String, enum: ['BUDGET', 'MODERATE', 'LUXURY'], default: 'MODERATE' },
  images: [{ type: String }],
  // Cấu trúc GeoJSON 2dsphere chuẩn MongoDB
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [Longitude, Latitude]
  },
  rating_avg: { type: Number, default: 0 },
  total_reviews: { type: Number, default: 0 },
  reviews: [reviewSchema]
}, { timestamps: true });

// Đánh Indexes phục vụ tìm kiếm nâng cao (SV2 Barem)
locationSchema.index({ location: '2dsphere' });
locationSchema.index({ name: 'text', description: 'text', category: 'text' });
locationSchema.index({ city: 1, category: 1 });
locationSchema.index({ rating_avg: -1 });

module.exports = mongoose.model('Location', locationSchema);