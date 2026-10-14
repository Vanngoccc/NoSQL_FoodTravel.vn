const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const multer = require('multer');
const fs = require('fs');

const Location = require('./models/Location');
const User = require('./models/User');
const Story = require('./models/Story');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nosql_locations_db';

// Đảm bảo thư mục lưu trữ ảnh tồn tại
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình Multer lưu trữ file ảnh (PNG, JPG, JPEG, WEBP)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = 'upload-' + Date.now() + '-' + Math.round(Math.random() * 1E6) + ext;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Hệ thống chỉ chấp nhận file ảnh định dạng PNG, JPG, JPEG hoặc WEBP!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Tối đa 10MB
  fileFilter: fileFilter
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// API Tải file ảnh thực tế (PNG / JPG / WEBP)
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file ảnh hợp lệ (PNG, JPG, WEBP)' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      message: 'Tải file ảnh lên thành công',
      url: fileUrl,
      filename: req.file.filename
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải ảnh lên', details: err.message });
  }
});

// Kết nối MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Kết nối MongoDB thành công: ' + MONGO_URI))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// =====================================================================
// 1. API TRẠNG THÁI HỆ THỐNG
// =====================================================================
app.get('/api/status', async (req, res) => {
  try {
    const count = await Location.countDocuments();
    const userCount = await User.countDocuments();
    res.json({
      status: 'OK',
      database: 'nosql_locations_db',
      total_locations: count,
      total_users: userCount,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// =====================================================================
// 2. API THỐNG KÊ TỔNG QUAN THỰC TẾ ĐỒNG BỘ MONGODB (Hero Stats)
// =====================================================================
app.get('/api/stats/overview', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalLocations = await Location.countDocuments();
    const distinctCities = await Location.distinct('city');

    // Tính tổng tất cả đánh giá và điểm trung bình toàn hệ thống bằng Aggregation Pipeline
    const reviewStats = await Location.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: '$total_reviews' },
          avgRating: { $avg: '$rating_avg' }
        }
      }
    ]);
    const totalReviews = (reviewStats.length > 0) ? reviewStats[0].totalReviews : 854;
    const avgRating = (reviewStats.length > 0) ? parseFloat(reviewStats[0].avgRating.toFixed(1)) : 4.8;

    // Tính các hashtag xu hướng thịnh hành 100% dựa trên dữ liệu thật trong MongoDB
    const cityAgg = await Location.aggregate([
      {
        $group: {
          _id: '$city',
          locations_count: { $sum: 1 },
          reviews_count: { $sum: '$total_reviews' }
        }
      },
      { $sort: { reviews_count: -1 } }
    ]);

    const catAgg = await Location.aggregate([
      {
        $match: {
          category: { $in: ['Landmark', 'Market', 'Museum', 'Beach', 'Attraction', 'Pagoda', 'Park'] }
        }
      },
      {
        $group: {
          _id: '$category',
          locations_count: { $sum: 1 },
          reviews_count: { $sum: '$total_reviews' }
        }
      },
      { $sort: { reviews_count: -1 } },
      { $limit: 4 }
    ]);

    const tagCityMap = {
      'TP.HCM': { tag: '#SaiGonFood', label: 'TP. Hồ Chí Minh' },
      'Hà Nội': { tag: '#HaNoiPho', label: 'Hà Nội' },
      'Đà Nẵng': { tag: '#KhamPhaDaNang', label: 'Đà Nẵng' }
    };

    const tagCatMap = {
      'Landmark': { tag: '#CheckInVietNam', label: 'Địa danh nổi tiếng' },
      'Museum': { tag: '#BaoTangDiTich', label: 'Bảo tàng & Văn hóa' },
      'Market': { tag: '#ChoVaAmThuc', label: 'Ẩm thực & Chợ truyền thống' },
      'Beach': { tag: '#BienDaoVietNam', label: 'Bãi biển & Nghỉ dưỡng' },
      'Attraction': { tag: '#VuiChoiGiaiTri', label: 'Khu vui chơi giải trí' },
      'Pagoda': { tag: '#ChuaChienDiTich', label: 'Đền chùa tâm linh' },
      'Park': { tag: '#CongVienXanh', label: 'Công viên dạo mát' }
    };

    const trending_tags = [];

    cityAgg.forEach(c => {
      const info = tagCityMap[c._id] || { tag: `#${c._id}`, label: c._id };
      trending_tags.push({
        tag: info.tag,
        label: info.label,
        type: 'city',
        keyword: c._id,
        locations_count: c.locations_count,
        reviews_count: c.reviews_count,
        subtext: `${c.locations_count} địa điểm • ${c.reviews_count} đánh giá`
      });
    });

    catAgg.forEach(cat => {
      const info = tagCatMap[cat._id] || { tag: `#${cat._id}`, label: cat._id };
      trending_tags.push({
        tag: info.tag,
        label: info.label,
        type: 'category',
        keyword: cat._id,
        locations_count: cat.locations_count,
        reviews_count: cat.reviews_count,
        subtext: `${cat.locations_count} địa điểm • ${cat.reviews_count} đánh giá`
      });
    });

    res.json({
      total_users: totalUsers,
      total_locations: totalLocations,
      total_reviews: totalReviews,
      avg_rating: avgRating,
      total_cities: distinctCities.length,
      cities_list: distinctCities,
      trending_tags: trending_tags.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải thống kê tổng quan', details: err.message });
  }
});

// =====================================================================
// 3. API DANH SÁCH & TÌM KIẾM ĐỊA ĐIỂM (Hỗ trợ Text Search & Filter)
// =====================================================================
app.get('/api/locations', async (req, res) => {
  try {
    const { city, category, search, min_rating, sort } = req.query;
    let query = {};

    // Lọc theo Thành phố
    if (city && city !== 'ALL') {
      query.city = city;
    }

    // Lọc theo Phân loại
    if (category && category !== 'ALL') {
      query.category = category;
    }

    // Lọc theo Đánh giá tối thiểu
    if (min_rating) {
      query.rating_avg = { $gte: parseFloat(min_rating) };
    }

    // Tìm kiếm toàn văn (Text Search Index)
    if (search && search.trim() !== '') {
      query.$text = { $search: search.trim() };
    }

    let sortOption = { rating_avg: -1, total_reviews: -1 };
    if (sort === 'reviews') sortOption = { total_reviews: -1 };
    if (sort === 'likes') sortOption = { likes_count: -1 };
    if (sort === 'name') sortOption = { name: 1 };
    if (sort === 'newest') sortOption = { createdAt: -1 };

    const locations = await Location.find(query)
      .sort(sortOption)
      .limit(100);

    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải danh sách địa điểm', details: err.message });
  }
});

// =====================================================================
// 4. API TÌM KIẾM GẦN TÔI (Geospatial $near 2dsphere)
// =====================================================================
app.get('/api/locations/nearby', async (req, res) => {
  try {
    const { lng, lat, max_distance = 15000, category } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ error: 'Vui lòng cung cấp tọa độ lng và lat' });
    }

    let filter = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(max_distance)
        }
      }
    };

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    const locations = await Location.find(filter).limit(20);
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn Geospatial 2dsphere', details: err.message });
  }
});

// =====================================================================
// 5. API AGGREGATION PIPELINES (Phân tích cộng đồng)
// =====================================================================
app.get('/api/analytics/top-cities', async (req, res) => {
  try {
    const stats = await Location.aggregate([
      {
        $group: {
          _id: '$city',
          total_locations: { $sum: 1 },
          avg_city_rating: { $avg: '$rating_avg' },
          total_reviews: { $sum: '$total_reviews' }
        }
      },
      {
        $project: {
          city: '$_id',
          total_locations: 1,
          avg_city_rating: { $round: ['$avg_city_rating', 1] },
          total_reviews: 1,
          _id: 0
        }
      },
      { $sort: { total_locations: -1 } }
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi Aggregation Pipeline', details: err.message });
  }
});

app.get('/api/analytics/top-rated', async (req, res) => {
  try {
    const topRated = await Location.aggregate([
      { $sort: { rating_avg: -1, total_reviews: -1 } },
      {
        $group: {
          _id: '$city',
          best_places: {
            $push: {
              id: '$_id',
              name: '$name',
              category: '$category',
              rating_avg: '$rating_avg',
              total_reviews: '$total_reviews',
              likes_count: '$likes_count',
              image: { $arrayElemAt: ['$images', 0] }
            }
          }
        }
      },
      {
        $project: {
          city: '$_id',
          best_places: { $slice: ['$best_places', 4] },
          _id: 0
        }
      }
    ]);
    res.json(topRated);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi Aggregation Pipeline Top Rated', details: err.message });
  }
});

// =====================================================================
// 6. API CHI TIẾT ĐỊA ĐIỂM THEO ID
// =====================================================================
app.get('/api/locations/:id', async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Không tìm thấy địa điểm' });
    }
    res.json(location);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải chi tiết địa điểm', details: err.message });
  }
});

// =====================================================================
// 7. API THÊM ĐỊA ĐIỂM MỚI (Hỗ trợ kèm hình ảnh đa phương tiện)
// =====================================================================
app.post('/api/locations', async (req, res) => {
  try {
    const { name, category, city, address, description, price_range, lat, lng, images } = req.body;

    if (!name || !city || !lat || !lng) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ: Tên, Thành phố, Tọa độ Lat/Lng' });
    }

    const defaultImg = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
    const locationImages = (images && Array.isArray(images) && images.length > 0)
      ? images
      : [defaultImg];

    const newLocation = new Location({
      name,
      category: category || 'Attraction',
      city,
      address: address || `${name}, ${city}`,
      description: description || `Địa điểm du lịch và ẩm thực hấp dẫn tại ${city}`,
      price_range: price_range || 'MODERATE',
      images: locationImages,
      location: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
      },
      rating_avg: 5.0,
      total_reviews: 0,
      likes_count: 1,
      liked_by: [],
      reviews: []
    });

    const saved = await newLocation.save();
    res.status(201).json({ message: 'Tạo địa điểm thành công', data: saved });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo địa điểm mới', details: err.message });
  }
});

// =====================================================================
// 8. API ĐĂNG REVIEW MỚI (Thao tác nguyên tử $push & Aggregation)
// =====================================================================
app.post('/api/locations/:id/reviews', async (req, res) => {
  try {
    const { user_name, rating, content, images, avatar } = req.body;
    const locationId = req.params.id;

    if (!user_name || !rating || !content) {
      return res.status(400).json({ error: 'Vui lòng nhập họ tên, số sao đánh giá và nội dung review' });
    }

    const newReview = {
      user_name,
      avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      rating: Number(rating),
      content,
      images: images || [],
      created_at: new Date(),
      replies: []
    };

    // 1. Thao tác nguyên tử ($push) chuẩn MongoDB Document Store
    const loc = await Location.findByIdAndUpdate(
      locationId,
      {
        $push: {
          reviews: {
            $each: [newReview],
            $position: 0
          }
        }
      },
      { new: true }
    );

    if (!loc) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });

    // 2. Aggregation Pipeline thời gian thực tính lại rating_avg & total_reviews
    const aggResult = await Location.aggregate([
      { $match: { _id: loc._id } },
      { $unwind: '$reviews' },
      {
        $group: {
          _id: '$_id',
          calculated_avg: { $avg: '$reviews.rating' },
          calculated_total: { $sum: 1 }
        }
      }
    ]);

    let newAvg = loc.rating_avg;
    let newTotal = loc.reviews.length;
    if (aggResult && aggResult.length > 0) {
      newAvg = parseFloat(aggResult[0].calculated_avg.toFixed(1));
      newTotal = aggResult[0].calculated_total;
      await Location.findByIdAndUpdate(loc._id, {
        rating_avg: newAvg,
        total_reviews: newTotal
      });
    }

    res.status(201).json({
      message: 'Đăng đánh giá thành công',
      rating_avg: newAvg,
      total_reviews: newTotal,
      review: loc.reviews[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi gửi đánh giá', details: err.message });
  }
});

// =====================================================================
// 9. API PHẢN HỒI BÌNH LUẬN (Nested Replies)
// =====================================================================
app.post('/api/locations/:id/reviews/:reviewId/replies', async (req, res) => {
  try {
    const { user_name, content } = req.body;
    const { id, reviewId } = req.params;

    if (!user_name || !content) {
      return res.status(400).json({ error: 'Vui lòng nhập tên và nội dung phản hồi' });
    }

    const loc = await Location.findById(id);
    if (!loc) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });

    const review = loc.reviews.id(reviewId);
    if (!review) return res.status(404).json({ error: 'Không tìm thấy review' });

    const newReply = {
      user_name,
      content,
      created_at: new Date()
    };

    review.replies.push(newReply);
    await loc.save();

    res.status(201).json({ message: 'Phản hồi thành công', reply: newReply });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi gửi phản hồi', details: err.message });
  }
});

// =====================================================================
// 10. API THẢ TIM / BỎ TIM (Lưu trữ đồng bộ trên MongoDB)
// =====================================================================
app.post('/api/locations/:id/like', async (req, res) => {
  try {
    const { user_email } = req.body;
    const locId = req.params.id;

    if (!user_email) {
      return res.status(400).json({ error: 'Vui lòng đăng nhập để thả tim bài viết' });
    }

    const loc = await Location.findById(locId);
    if (!loc) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });

    const isLiked = loc.liked_by && loc.liked_by.includes(user_email);
    let updated;

    if (isLiked) {
      updated = await Location.findByIdAndUpdate(
        locId,
        {
          $pull: { liked_by: user_email }
        },
        { new: true }
      );
    } else {
      updated = await Location.findByIdAndUpdate(
        locId,
        {
          $addToSet: { liked_by: user_email }
        },
        { new: true }
      );
    }

    updated.likes_count = (updated.liked_by || []).length;
    await updated.save();

    res.json({
      isLiked: !isLiked,
      likes_count: updated.likes_count
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật tim', details: err.message });
  }
});

// =====================================================================
// 11. API XÁC THỰC NGƯỜI DÙNG & TÀI KHOẢN MONGODB
// =====================================================================

// Đăng ký tài khoản mới (Lưu trực tiếp vào collection users)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, avatar, bio } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Vui lòng nhập họ tên và email' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng đăng nhập.' });
    }

    const defaultAvatars = [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150'
    ];
    const assignedAvatar = avatar || defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password || '123456',
      avatar: assignedAvatar,
      bio: bio || 'Thành viên cộng đồng ẩm thực & du lịch FoodTravel.vn'
    });

    const saved = await user.save();
    res.status(201).json({ message: 'Đăng ký tài khoản thành công', user: saved });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đăng ký tài khoản', details: err.message });
  }
});

// Đăng nhập tài khoản (Kiểm tra trong MongoDB)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Vui lòng nhập email đăng nhập' });
    }

    let user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Nếu chưa có, tự động tạo mới tài khoản thành viên trong MongoDB
      const defaultName = email.split('@')[0];
      user = new User({
        name: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
        email: email.toLowerCase().trim(),
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        bio: 'Thành viên mới của FoodTravel.vn'
      });
      await user.save();
    }

    res.json({ message: 'Đăng nhập thành công', user });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đăng nhập', details: err.message });
  }
});

// Lấy hồ sơ cá nhân và danh sách bài đánh giá đã viết
app.get('/api/auth/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('saved_locations');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    // Lấy tất cả đánh giá do người dùng viết bằng Aggregation
    const userReviews = await Location.aggregate([
      { $unwind: '$reviews' },
      { $match: { 'reviews.user_name': user.name } },
      {
        $project: {
          location_id: '$_id',
          location_name: '$name',
          location_city: '$city',
          rating: '$reviews.rating',
          content: '$reviews.content',
          created_at: '$reviews.created_at'
        }
      },
      { $sort: { created_at: -1 } }
    ]);

    res.json({ user, reviews: userReviews });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải trang cá nhân', details: err.message });
  }
});

// Cập nhật hồ sơ cá nhân (Avatar, Tên, Bio) trên MongoDB và tự động đồng bộ sang toàn bộ Story
app.put('/api/auth/profile/:id', async (req, res) => {
  try {
    const { name, avatar, bio } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;
    if (bio) updateData.bio = bio;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    // Đồng bộ ngay ảnh đại diện và tên vào các Story của người dùng
    if (user && (avatar || name)) {
      const storyUpdate = {};
      if (avatar) storyUpdate.user_avatar = avatar;
      if (name) storyUpdate.user_name = name;
      await Story.updateMany(
        { $or: [{ user_email: user.email }, { user_name: user.name }] },
        { $set: storyUpdate }
      );
    }

    res.json({ message: 'Cập nhật thành công', user });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật hồ sơ', details: err.message });
  }
});

// Cập nhật hồ sơ theo Email (hỗ trợ trường hợp phiên làm việc chưa tải _id)
app.put('/api/auth/profile-by-email', async (req, res) => {
  try {
    const { email, name, avatar, bio } = req.body;
    if (!email) return res.status(400).json({ error: 'Thiếu email' });

    const updateData = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;
    if (bio) updateData.bio = bio;

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $set: updateData },
      { new: true }
    );

    if (user && (avatar || name)) {
      const storyUpdate = {};
      if (avatar) storyUpdate.user_avatar = avatar;
      if (name) storyUpdate.user_name = name;
      await Story.updateMany(
        { $or: [{ user_email: user.email }, { user_name: user.name }] },
        { $set: storyUpdate }
      );
    }

    res.json({ message: 'Cập nhật thành công', user });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật hồ sơ', details: err.message });
  }
});

// Lấy thông tin user hiện tại theo email
app.get('/api/auth/me', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Thiếu email' });
    const user = await User.findOne({ email: email.toLowerCase().trim() }).populate('saved_locations');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tìm thông tin người dùng', details: err.message });
  }
});

// Lấy danh sách địa điểm đã lưu của người dùng
app.get('/api/auth/saved-locations', async (req, res) => {
  try {
    const { user_id, user_email } = req.query;
    let user;
    if (user_id) {
      user = await User.findById(user_id).populate('saved_locations');
    } else if (user_email) {
      user = await User.findOne({ email: user_email.toLowerCase().trim() }).populate('saved_locations');
    } else {
      user = await User.findOne({ email: 'vanngoc@foodtravel.vn' }).populate('saved_locations');
    }

    if (!user) return res.json({ saved_locations: [] });
    res.json({ saved_locations: user.saved_locations || [] });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy danh sách đã lưu', details: err.message });
  }
});

// Lưu / Bỏ lưu địa điểm (Bookmarks)
app.post('/api/auth/save-location/:id', async (req, res) => {
  try {
    const { user_id, user_email } = req.body;
    const locationId = req.params.id;

    let user;
    if (user_id) {
      user = await User.findById(user_id);
    } else if (user_email) {
      user = await User.findOne({ email: user_email.toLowerCase().trim() });
    } else {
      user = await User.findOne({ email: 'vanngoc@foodtravel.vn' });
    }

    if (!user) {
      user = await User.findOne({ email: 'vanngoc@foodtravel.vn' });
      if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const isSaved = user.saved_locations && user.saved_locations.some(locId => locId.toString() === locationId.toString());
    let updated;
    if (isSaved) {
      updated = await User.findByIdAndUpdate(
        user._id,
        { $pull: { saved_locations: locationId } },
        { new: true }
      ).populate('saved_locations');
    } else {
      updated = await User.findByIdAndUpdate(
        user._id,
        { $addToSet: { saved_locations: locationId } },
        { new: true }
      ).populate('saved_locations');
    }

    res.json({
      message: isSaved ? 'Đã bỏ lưu địa điểm' : 'Đã lưu địa điểm thành công',
      isSaved: !isSaved,
      saved_count: updated.saved_locations ? updated.saved_locations.length : 0,
      saved_locations: updated.saved_locations || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lưu địa điểm', details: err.message });
  }
});

// =====================================================================
// 12. API STORIES PHONG CÁCH MẠNG XÃ HỘI (LƯU TRỮ TRỰC TIẾP TRÊN MONGODB)
// =====================================================================

// Lấy danh sách Story mới nhất (Luôn đồng bộ avatar mới nhất từ User Profile)
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 }).limit(20).lean();

    // Tự động đồng bộ ảnh đại diện mới nhất của tác giả từ bảng User
    const emails = [...new Set(stories.map(s => s.user_email).filter(Boolean))];
    const users = await User.find({ email: { $in: emails } }).select('email avatar name').lean();
    const userMap = {};
    users.forEach(u => {
      if (u.email) userMap[u.email.toLowerCase()] = u;
    });

    const enrichedStories = stories.map(s => {
      const u = s.user_email ? userMap[s.user_email.toLowerCase()] : null;
      if (u) {
        if (u.avatar) s.user_avatar = u.avatar;
        if (u.name) s.user_name = u.name;
      }
      return s;
    });

    res.json(enrichedStories);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải danh sách story', details: err.message });
  }
});

// Đăng Story mới (Lưu trực tiếp vào MongoDB)
app.post('/api/stories', async (req, res) => {
  try {
    const { user_name, user_avatar, user_email, location_name, location_city, image, caption, filter, music } = req.body;

    if (!user_name || !image || !location_name) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ hình ảnh và địa điểm check-in!' });
    }

    const newStory = new Story({
      user_name,
      user_avatar: user_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      user_email: user_email || 'guest@foodtravel.vn',
      location_name,
      location_city: location_city || 'Việt Nam',
      image,
      caption: caption || '',
      filter: filter || 'normal',
      music: music || 'Nhạc thịnh hành 🎵',
      likes_count: 1,
      liked_by: user_email ? [user_email] : []
    });

    const savedStory = await newStory.save();
    res.status(201).json({ message: 'Đăng story thành công!', story: savedStory });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo story mới', details: err.message });
  }
});

// Thả cảm xúc / Tim Story
app.post('/api/stories/:id/react', async (req, res) => {
  try {
    const storyId = req.params.id;
    const { user_email } = req.body;
    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: 'Không tìm thấy story' });

    const isLiked = story.liked_by && story.liked_by.includes(user_email);
    let updated;
    if (isLiked) {
      updated = await Story.findByIdAndUpdate(
        storyId,
        { $pull: { liked_by: user_email } },
        { new: true }
      );
    } else {
      updated = await Story.findByIdAndUpdate(
        storyId,
        { $addToSet: { liked_by: user_email } },
        { new: true }
      );
    }
    updated.likes_count = (updated.liked_by || []).length;
    await updated.save();

    res.json({ isLiked: !isLiked, likes_count: updated.likes_count });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thả cảm xúc story', details: err.message });
  }
});

// Gửi tin nhắn / phản hồi cho tác giả Story (Lưu trực tiếp vào Story trên MongoDB)
app.post('/api/stories/:id/reply', async (req, res) => {
  try {
    const storyId = req.params.id;
    const { user_name, user_avatar, user_email, message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: 'Không tìm thấy story' });

    if (!story.replies) story.replies = [];
    const newReply = {
      user_name: user_name || 'Khách trải nghiệm',
      user_avatar: user_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      user_email: user_email || '',
      message: message.trim(),
      created_at: new Date()
    };

    story.replies.push(newReply);
    await story.save();

    res.status(201).json({ message: 'Gửi tin nhắn thành công', reply: newReply, replies_count: story.replies.length });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi gửi tin nhắn cho tác giả story', details: err.message });
  }
});

// Lấy danh sách tin nhắn / phản hồi của Story
app.get('/api/stories/:id/replies', async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Không tìm thấy story' });
    res.json(story.replies || []);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy tin nhắn story', details: err.message });
  }
});

// Lấy tất cả tin nhắn phản hồi từ các story của một tác giả (Hộp thư người dùng)
app.get('/api/stories/my-replies/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const stories = await Story.find({
      user_email: email.toLowerCase().trim(),
      'replies.0': { $exists: true }
    }).sort({ updatedAt: -1 });

    const allReplies = [];
    stories.forEach(s => {
      (s.replies || []).forEach(r => {
        allReplies.push({
          story_id: s._id,
          story_caption: s.caption,
          location_name: s.location_name,
          location_city: s.location_city,
          user_name: r.user_name,
          user_avatar: r.user_avatar,
          message: r.message,
          created_at: r.created_at
        });
      });
    });

    res.json(allReplies);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy tin nhắn phản hồi story', details: err.message });
  }
});

// Khởi chạy máy chủ
app.listen(PORT, () => {
  console.log(`🚀 Travel Review Server đang chạy tại: http://localhost:${PORT}`);
});
