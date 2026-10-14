const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, default: '123456' },
  avatar: { 
    type: String, 
    default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' 
  },
  bio: { type: String, default: 'Thành viên cộng đồng ẩm thực & du lịch FoodTravel.vn' },
  saved_locations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema, 'users');
