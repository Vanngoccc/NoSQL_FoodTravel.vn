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
const Notification = require('./models/Notification');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nosql_locations_db';

// Đảm bảo thư mục lưu trữ ảnh tồn tại
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình Multer Memory Storage để lưu ảnh vĩnh viễn dạng Base64 vào MongoDB
// (Tránh bị Render xóa mất file khi redeploy / push git trên ephemeral filesystem)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.jpe', '.jfif', '.webp', '.bmp', '.gif', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  const isImageMime = file.mimetype && file.mimetype.startsWith('image/');
  if (allowed.includes(ext) || isImageMime) {
    cb(null, true);
  } else {
    cb(new Error('Hệ thống chỉ chấp nhận file ảnh (PNG, JPG, JPEG, JPE, WEBP, GIF, BMP)!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Tối đa 10MB
  fileFilter: fileFilter
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// API Tải file ảnh thực tế đơn lẻ (Trả về Data URL Base64 để lưu vĩnh viễn trong MongoDB Atlas)
app.post('/api/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Lỗi tải file ảnh lên' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file ảnh hợp lệ' });
    }

    try {
      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      const uniqueName = 'upload-' + Date.now() + '-' + Math.round(Math.random() * 1E6) + ext;
      
      // Lưu bản sao lên đĩa cục bộ (nếu có thể)
      fs.writeFile(path.join(uploadDir, uniqueName), req.file.buffer, () => {});

      // Tạo Data URL Base64 bền vững, không bao giờ bị Render xóa mất khi restart
      const mime = req.file.mimetype || 'image/jpeg';
      const base64Url = `data:${mime};base64,${req.file.buffer.toString('base64')}`;

      res.json({
        message: 'Tải file ảnh lên thành công',
        url: base64Url,
        localPath: `/uploads/${uniqueName}`,
        filename: uniqueName
      });
    } catch (e) {
      res.status(500).json({ error: 'Lỗi mã hóa ảnh: ' + e.message });
    }
  });
});

// API Tải nhiều file ảnh cùng lúc (hỗ trợ đăng nhiều Story hoặc nhiều ảnh địa điểm)
app.post('/api/upload-multiple', (req, res) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Lỗi tải ảnh lên' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ít nhất một file ảnh' });
    }

    try {
      const urls = req.files.map(f => {
        const ext = path.extname(f.originalname).toLowerCase() || '.jpg';
        const uniqueName = 'upload-' + Date.now() + '-' + Math.round(Math.random() * 1E6) + ext;
        fs.writeFile(path.join(uploadDir, uniqueName), f.buffer, () => {});
        const mime = f.mimetype || 'image/jpeg';
        return `data:${mime};base64,${f.buffer.toString('base64')}`;
      });

      res.json({
        message: `Tải thành công ${req.files.length} ảnh`,
        urls: urls
      });
    } catch (e) {
      res.status(500).json({ error: 'Lỗi mã hóa hàng loạt ảnh: ' + e.message });
    }
  });
});

// Tự động gán tác giả và đồng bộ Avatar tác giả từ User sang Location
async function syncAuthorAvatars() {
  try {
    const users = await User.find({}, 'name email avatar').lean();
    if (!users || users.length === 0) return;

    // 1. Gán tác giả thực tế cho các bài viết chưa có tác giả
    const unassignedLocs = await Location.find({
      $or: [
        { author_name: { $exists: false } },
        { author_name: null },
        { author_name: '' },
        { author_name: 'Thành viên FoodTravel' },
        { author_name: 'Người khám phá' }
      ]
    });

    if (unassignedLocs.length > 0) {
      const hvnUser = users.find(u => u.name && u.name.includes('Huỳnh Văn Ngọc')) || users[0];
      const otherUsers = users.filter(u => u.email !== hvnUser.email);

      for (let i = 0; i < unassignedLocs.length; i++) {
        const loc = unassignedLocs[i];
        const assignedUser = (i % 3 === 0 || i < 15) ? hvnUser : (otherUsers[i % otherUsers.length] || hvnUser);
        loc.author_name = assignedUser.name;
        loc.author_email = assignedUser.email;
        loc.author_avatar = assignedUser.avatar || '';
        await loc.save();
      }
      console.log(`✅ Đã gán tác giả cho ${unassignedLocs.length} bài viết`);
    }

    // 2. Đồng bộ avatar mới nhất từ User vào Locations & Reviews
    for (const u of users) {
      if (u.avatar && !u.avatar.includes('default') && !u.avatar.includes('photo-1535713875002-d1d0cf377fde')) {
        await Location.updateMany(
          {
            $or: [
              { author_email: new RegExp(`^${u.email.trim()}$`, 'i') },
              { author_name: new RegExp(`^${u.name.trim()}$`, 'i') }
            ]
          },
          { $set: { author_avatar: u.avatar } }
        );

        await Location.updateMany(
          { 'reviews.user_name': new RegExp(`^${u.name.trim()}$`, 'i') },
          { $set: { 'reviews.$[elem].avatar': u.avatar } },
          { arrayFilters: [{ 'elem.user_name': new RegExp(`^${u.name.trim()}$`, 'i') }] }
        );
      }
    }
    console.log('✅ Đã đồng bộ toàn bộ avatar tác giả vào Locations');
  } catch (err) {
    console.warn('Lỗi syncAuthorAvatars:', err.message);
  }
}

// Phục hồi các Story bị mất ảnh do Render xóa file tạm
async function repairMissingStoryImages() {
  try {
    const fallbackImages = [
      'https://images.unsplash.com/photo-1528127269322-539801943592?w=800',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800'
    ];
    const stories = await Story.find({});
    for (let i = 0; i < stories.length; i++) {
      const s = stories[i];
      if (s.image && s.image.startsWith('/uploads/')) {
        const localPath = path.join(__dirname, 'public', s.image);
        if (!fs.existsSync(localPath)) {
          s.image = fallbackImages[i % fallbackImages.length];
          await s.save();
        }
      }
    }
  } catch (e) {
    console.warn('Lỗi repairMissingStoryImages:', e.message);
  }
}

// Tự động dọn dẹp các Story quá 24h khỏi MongoDB
async function cleanupExpiredStories() {
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await Story.deleteMany({
      $and: [
        { $or: [{ createdAt: { $lt: cutoff24h } }, { createdAt: { $exists: false } }] },
        { $or: [{ created_at: { $lt: cutoff24h } }, { created_at: { $exists: false } }] }
      ]
    });
    if (result.deletedCount > 0) {
      console.log(`🧹 Đã dọn dẹp ${result.deletedCount} story quá 24 giờ khỏi MongoDB`);
    }
  } catch (e) {
    console.warn('Lỗi cleanupExpiredStories:', e.message);
  }
}

// Kết nối MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Kết nối MongoDB thành công: ' + MONGO_URI);
    syncAuthorAvatars();
    cleanupExpiredStories();
    repairMissingStoryImages();
  })
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// API Lấy danh mục Avatar tất cả người dùng (Để đồng bộ tuyệt đối trên toàn giao diện)
app.get('/api/auth/all-avatars', async (req, res) => {
  try {
    const users = await User.find({}, 'name email avatar').lean();
    const avatarMap = {};
    users.forEach(u => {
      if (u.name && u.avatar) avatarMap[u.name.toLowerCase().trim()] = u.avatar;
      if (u.email && u.avatar) avatarMap[u.email.toLowerCase().trim()] = u.avatar;
    });
    res.json(avatarMap);
  } catch (err) {
    res.json({});
  }
});

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
// 3. API DANH SÁCH & TÌM KIẾM ĐỊA ĐIỂM (Hỗ trợ Text Search & Filter & Lọc thời gian)
// =====================================================================
app.get('/api/locations', async (req, res) => {
  try {
    const { city, category, search, min_rating, sort, time, author_email } = req.query;
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

    // Lọc theo Tác giả đăng bài
    if (author_email && author_email.trim() !== '') {
      query.author_email = author_email.toLowerCase().trim();
    }

    // Lọc bài theo thời gian (Hôm nay, Tuần này, Tháng này)
    if (time) {
      const now = new Date();
      if (time === 'today') {
        const todayCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: todayCutoff };
      } else if (time === 'week') {
        const weekCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: weekCutoff };
      } else if (time === 'month') {
        const monthCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: monthCutoff };
      }
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
    if (sort === 'oldest') sortOption = { createdAt: 1 };

    const locations = await Location.find(query)
      .sort(sortOption)
      .limit(100);

    // Đồng bộ Avatar tác giả mới nhất từ bảng User
    try {
      const users = await User.find({}, 'name email avatar').lean();
      const userMapByEmail = new Map();
      const userMapByName = new Map();
      users.forEach(u => {
        if (u.email && u.avatar) userMapByEmail.set(u.email.toLowerCase().trim(), u.avatar);
        if (u.name && u.avatar) userMapByName.set(u.name.toLowerCase().trim(), u.avatar);
      });

      const syncedLocations = locations.map(loc => {
        const obj = loc.toObject();
        const emailKey = (obj.author_email || '').toLowerCase().trim();
        const nameKey = (obj.author_name || '').toLowerCase().trim();
        const matchedAvatar = userMapByEmail.get(emailKey) || userMapByName.get(nameKey);
        if (matchedAvatar) {
          obj.author_avatar = matchedAvatar;
        }
        return obj;
      });

      res.json(syncedLocations);
    } catch (syncErr) {
      res.json(locations);
    }
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
// 7. API THÊM ĐỊA ĐIỂM MỚI (Hỗ trợ kèm hình ảnh đa phương tiện & thông tin tác giả)
// =====================================================================
app.post('/api/locations', async (req, res) => {
  try {
    const { 
      name, category, city, address, description, price_range, lat, lng, images,
      author_name, author_email, author_avatar 
    } = req.body;

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
      address: (address && address.trim()) ? address.trim() : city,
      description: description || `Địa điểm du lịch và ẩm thực hấp dẫn tại ${city}`,
      price_range: price_range || 'MODERATE',
      images: locationImages,
      author_name: (author_name && author_name.trim()) ? author_name.trim() : 'Thành viên FoodTravel',
      author_email: author_email ? author_email.toLowerCase().trim() : '',
      author_avatar: author_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      location: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
      },
      rating_avg: 0,
      total_reviews: 0,
      likes_count: 0,
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
// 7.1 API CẬP NHẬT ĐỊA ĐIỂM / BÀI VIẾT (Chỉ tác giả sở hữu bài viết)
// =====================================================================
app.put('/api/locations/:id', async (req, res) => {
  try {
    const locationId = req.params.id;
    const { user_email, name, category, city, address, description, price_range, images } = req.body;

    const loc = await Location.findById(locationId);
    if (!loc) {
      return res.status(404).json({ error: 'Không tìm thấy địa điểm / bài viết' });
    }

    // Kiểm tra quyền tác giả: chỉ người tạo mới có quyền chỉnh sửa bài viết
    if (loc.author_email && loc.author_email.trim() !== '') {
      if (!user_email || loc.author_email.toLowerCase() !== user_email.toLowerCase()) {
        return res.status(403).json({ error: 'Bạn chỉ có quyền chỉnh sửa bài viết do chính mình đăng tải!' });
      }
    }

    const updateFields = {};
    if (name) updateFields.name = name;
    if (category) updateFields.category = category;
    if (city) updateFields.city = city;
    if (address) updateFields.address = address;
    if (description) updateFields.description = description;
    if (price_range) updateFields.price_range = price_range;
    if (images && Array.isArray(images)) updateFields.images = images;

    const updatedLoc = await Location.findByIdAndUpdate(
      locationId,
      { $set: updateFields },
      { new: true }
    );
    res.json({ message: 'Đã cập nhật bài viết thành công!', location: updatedLoc });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật địa điểm', details: err.message });
  }
});

// =====================================================================
// 7.2 API XÓA ĐỊA ĐIỂM / BÀI VIẾT (Chỉ tác giả sở hữu bài viết)
// =====================================================================
app.delete('/api/locations/:id', async (req, res) => {
  try {
    const locationId = req.params.id;
    const { user_email } = req.body;

    const loc = await Location.findById(locationId);
    if (!loc) {
      return res.status(404).json({ error: 'Không tìm thấy địa điểm / bài viết' });
    }

    // Kiểm tra quyền tác giả: chỉ người tạo mới có quyền xóa bài viết
    if (loc.author_email && loc.author_email.trim() !== '') {
      if (!user_email || loc.author_email.toLowerCase() !== user_email.toLowerCase()) {
        return res.status(403).json({ error: 'Bạn chỉ có quyền xóa bài viết do chính mình đăng tải!' });
      }
    }

    await Location.findByIdAndDelete(locationId);
    res.json({ message: 'Đã xóa bài viết thành công!', id: locationId });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa địa điểm', details: err.message });
  }
});

// =====================================================================
// HELPER: TẠO THÔNG BÁO THỜI GIAN THỰC (MONGODB NOTIFICATIONS)
// =====================================================================
async function createNotification({ recipient_email, recipient_name, sender_name, sender_avatar, type, title, content, target_id }) {
  try {
    let targetEmail = recipient_email ? recipient_email.toLowerCase().trim() : '';
    if (!targetEmail && recipient_name) {
      const u = await User.findOne({ name: new RegExp(`^${recipient_name.trim()}$`, 'i') });
      if (u) targetEmail = u.email;
    }
    if (!targetEmail || !sender_name) return;
    await Notification.create({
      recipient_email: targetEmail,
      sender_name: sender_name.trim(),
      sender_avatar: sender_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      type,
      title,
      content: content ? content.trim() : '',
      target_id: target_id ? target_id.toString() : ''
    });
  } catch (e) {
    console.warn('Lỗi ghi thông báo vào MongoDB:', e.message);
  }
}

// Helper tính tổng tất cả bình luận (Đánh giá gốc Level 1 + Phản hồi Level 2 + Phản hồi con Level 3/4/5)
function calculateTotalComments(location) {
  if (!location) return 0;
  let count = 0;
  if (Array.isArray(location.reviews)) {
    for (const rev of location.reviews) {
      count += 1;
      if (Array.isArray(rev.replies)) {
        for (const rep of rev.replies) {
          count += 1;
          if (Array.isArray(rep.replies)) {
            count += rep.replies.length;
          }
        }
      }
    }
  }
  return count;
}

// =====================================================================
// 8. API ĐĂNG REVIEW MỚI (Thao tác nguyên tử $push & Aggregation, cho phép chỉ chấm sao không bắt buộc comment)
// =====================================================================
app.post('/api/locations/:id/reviews', async (req, res) => {
  try {
    const { user_name, rating, content, images, avatar, user_email } = req.body;
    const locationId = req.params.id;

    if (!user_name || !rating) {
      return res.status(400).json({ error: 'Vui lòng cung cấp họ tên và số sao đánh giá' });
    }

    const reviewRating = Number(rating);
    const reviewContent = (content && content.trim() !== '') 
      ? content.trim() 
      : (reviewRating >= 4 ? 'Trải nghiệm rất tuyệt vời!' : 'Đã chấm ' + reviewRating + ' sao cho địa điểm.');

    const newReview = {
      user_name,
      avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      rating: reviewRating,
      content: reviewContent,
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
    if (aggResult && aggResult.length > 0) {
      newAvg = parseFloat(aggResult[0].calculated_avg.toFixed(1));
    }
    const freshLoc = await Location.findById(loc._id);
    const newTotal = calculateTotalComments(freshLoc);
    await Location.findByIdAndUpdate(loc._id, {
      rating_avg: newAvg,
      total_reviews: newTotal
    });

    // 3. Tự động tạo Thông báo cho tác giả bài viết nếu người đánh giá khác tác giả
    if (loc.author_email && (!user_email || loc.author_email.toLowerCase() !== user_email.toLowerCase())) {
      await createNotification({
        recipient_email: loc.author_email,
        sender_name: user_name,
        sender_avatar: avatar,
        type: 'review',
        title: `${user_name} đã đánh giá ${reviewRating} sao cho bài viết "${loc.name}"`,
        content: reviewContent,
        target_id: loc._id
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
    const { user_name, content, user_avatar, user_email, reply_to: incomingReplyTo, parent_reply_id } = req.body;
    const { id, reviewId } = req.params;

    if (!user_name || !content) {
      return res.status(400).json({ error: 'Vui lòng nhập tên và nội dung phản hồi' });
    }

    const loc = await Location.findById(id);
    if (!loc) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });

    const review = loc.reviews.id(reviewId);
    if (!review) return res.status(404).json({ error: 'Không tìm thấy review' });

    // Trích xuất @Tên người được phản hồi (nếu có)
    let reply_to = incomingReplyTo || '';
    const mentionMatch = content.match(/^@([^\s,:]+(?:\s+[^\s,:]+)?)/);
    if (!reply_to && mentionMatch) {
      reply_to = mentionMatch[1].trim();
    }

    const newReply = {
      user_name,
      content,
      avatar: user_avatar || '',
      reply_to: reply_to,
      likes_count: 0,
      liked_by: [],
      created_at: new Date()
    };

    // Kiểm tra xem có cha không để nhúng trực tiếp vào mảng replies của reply cha
    let targetParentReply = null;
    if (parent_reply_id) {
      targetParentReply = review.replies.id(parent_reply_id);
      if (!targetParentReply) {
        // Tìm xem parent_reply_id có phải là ID của một reply con cấp 3/4/5 hay không
        for (const r of (review.replies || [])) {
          if (r.replies && r.replies.id && r.replies.id(parent_reply_id)) {
            targetParentReply = r;
            break;
          }
        }
      }
      if (!targetParentReply) {
        targetParentReply = (review.replies || []).find(r => r.user_name && r.user_name.toLowerCase() === parent_reply_id.toLowerCase());
      }
    }

    if (targetParentReply) {
      // Nhúng thẳng vào biến "replies" BÊN TRONG CỦA PHẢN HỒI CHA
      if (!Array.isArray(targetParentReply.replies)) {
        targetParentReply.replies = [];
      }
      targetParentReply.replies.push(newReply);
    } else {
      // Là phản hồi Level 2 gốc
      newReply.parent_reply_id = '';
      newReply.replies = [];
      review.replies.push(newReply);
    }

    loc.total_reviews = calculateTotalComments(loc);
    await loc.save();

    // 1. Thông báo cho tác giả bài viết
    if (loc.author_email && (!user_email || loc.author_email.toLowerCase() !== user_email.toLowerCase())) {
      await createNotification({
        recipient_email: loc.author_email,
        sender_name: user_name,
        sender_avatar: user_avatar,
        type: 'reply',
        title: `${user_name} đã phản hồi bình luận trong bài viết "${loc.name}"`,
        content: content,
        target_id: loc._id
      });
    }

    // 2. Thông báo cho người được tag @ (nếu có)
    if (reply_to && reply_to.toLowerCase() !== user_name.toLowerCase()) {
      try {
        const taggedUser = await User.findOne({ name: new RegExp(`^${reply_to}$`, 'i') });
        if (taggedUser && taggedUser.email) {
          await createNotification({
            recipient_email: taggedUser.email,
            sender_name: user_name,
            sender_avatar: user_avatar,
            type: 'reply',
            title: `${user_name} đã nhắc đến bạn trong một bình luận`,
            content: content,
            target_id: loc._id
          });
        }
      } catch (notifErr) {
        console.warn('Lỗi gửi thông báo tag:', notifErr.message);
      }
    }

    res.status(201).json({ message: 'Phản hồi thành công', reply: newReply });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi gửi phản hồi', details: err.message });
  }
});

// =====================================================================
// 9.1. API THẢ TIM / BỎ TIM BÌNH LUẬN (Review Like)
// =====================================================================
app.post('/api/locations/:id/reviews/:reviewId/like', async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const { user_email, user_name, user_avatar } = req.body;
    const userKey = (user_email || user_name || '').trim();

    if (!userKey) {
      return res.status(400).json({ error: 'Vui lòng đăng nhập để thích bình luận' });
    }

    const loc = await Location.findById(id);
    if (!loc) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });

    const review = loc.reviews.id(reviewId);
    if (!review) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

    if (!Array.isArray(review.liked_by)) review.liked_by = [];

    const existingIdx = review.liked_by.findIndex(
      k => k.toLowerCase() === userKey.toLowerCase()
    );

    let is_liked = false;
    if (existingIdx !== -1) {
      review.liked_by.splice(existingIdx, 1);
      is_liked = false;
    } else {
      review.liked_by.push(userKey);
      is_liked = true;

      if (review.user_name && review.user_name.toLowerCase() !== (user_name || '').toLowerCase()) {
        try {
          const revOwner = await User.findOne({ name: new RegExp(`^${review.user_name}$`, 'i') });
          if (revOwner && revOwner.email) {
            await createNotification({
              recipient_email: revOwner.email,
              sender_name: user_name || 'Một thành viên',
              sender_avatar: user_avatar,
              type: 'like',
              title: `${user_name || 'Một thành viên'} đã thích bình luận của bạn`,
              content: review.content && review.content.length > 50 ? review.content.substring(0, 50) + '...' : (review.content || ''),
              target_id: loc._id
            });
          }
        } catch (notifErr) {
          console.warn('Lỗi gửi thông báo like review:', notifErr.message);
        }
      }
    }

    review.likes_count = review.liked_by.length;
    loc.total_reviews = calculateTotalComments(loc);
    await loc.save();

    res.json({
      success: true,
      is_liked,
      likes_count: review.likes_count,
      liked_by: review.liked_by
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xử lý thích bình luận', details: err.message });
  }
});

// =====================================================================
// 9.2. API THẢ TIM / BỎ TIM PHẢN HỒI (Reply Like)
// =====================================================================
app.post('/api/locations/:id/reviews/:reviewId/replies/:replyId/like', async (req, res) => {
  try {
    const { id, reviewId, replyId } = req.params;
    const { user_email, user_name, user_avatar } = req.body;
    const userKey = (user_email || user_name || '').trim();

    if (!userKey) {
      return res.status(400).json({ error: 'Vui lòng đăng nhập để thích phản hồi' });
    }

    const loc = await Location.findById(id);
    if (!loc) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });

    const review = loc.reviews.id(reviewId);
    if (!review) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

    let reply = review.replies.id(replyId);
    if (!reply) {
      // Tìm kiếm trong các sub-replies lồng nhau bên trong replies của Level 2
      for (const r of (review.replies || [])) {
        if (r.replies && r.replies.id) {
          const foundSub = r.replies.id(replyId);
          if (foundSub) {
            reply = foundSub;
            break;
          }
        }
      }
    }
    if (!reply) return res.status(404).json({ error: 'Không tìm thấy phản hồi' });

    if (!Array.isArray(reply.liked_by)) reply.liked_by = [];

    const existingIdx = reply.liked_by.findIndex(
      k => k.toLowerCase() === userKey.toLowerCase()
    );

    let is_liked = false;
    if (existingIdx !== -1) {
      reply.liked_by.splice(existingIdx, 1);
      is_liked = false;
    } else {
      reply.liked_by.push(userKey);
      is_liked = true;

      if (reply.user_name && reply.user_name.toLowerCase() !== (user_name || '').toLowerCase()) {
        try {
          const repOwner = await User.findOne({ name: new RegExp(`^${reply.user_name}$`, 'i') });
          if (repOwner && repOwner.email) {
            await createNotification({
              recipient_email: repOwner.email,
              sender_name: user_name || 'Một thành viên',
              sender_avatar: user_avatar,
              type: 'like',
              title: `${user_name || 'Một thành viên'} đã thích phản hồi của bạn`,
              content: reply.content && reply.content.length > 50 ? reply.content.substring(0, 50) + '...' : (reply.content || ''),
              target_id: loc._id
            });
          }
        } catch (notifErr) {
          console.warn('Lỗi gửi thông báo like reply:', notifErr.message);
        }
      }
    }

    reply.likes_count = reply.liked_by.length;
    loc.total_reviews = calculateTotalComments(loc);
    await loc.save();

    res.json({
      success: true,
      is_liked,
      likes_count: reply.likes_count,
      liked_by: reply.liked_by
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xử lý thích phản hồi', details: err.message });
  }
});

// =====================================================================
// 10. API THẢ TIM / BỎ TIM (Lưu trữ đồng bộ trên MongoDB)
// =====================================================================
app.post('/api/locations/:id/like', async (req, res) => {
  try {
    const { user_email, user_name, user_avatar } = req.body;
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

      // Tạo thông báo khi có người thả tim bài viết
      if (loc.author_email && loc.author_email.toLowerCase() !== user_email.toLowerCase()) {
        await createNotification({
          recipient_email: loc.author_email,
          sender_name: user_name || 'Một thành viên',
          sender_avatar: user_avatar,
          type: 'like',
          title: `${user_name || 'Một thành viên'} đã thích bài viết "${loc.name}" của bạn`,
          content: loc.name,
          target_id: loc._id
        });
      }
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
// 11. API XÁC THỰC NGƯỜI DÙNG & TÀI KHOẢN MONGODB (Hỗ trợ mật khẩu thực tế)
// =====================================================================

// Đăng ký tài khoản mới (Lưu trực tiếp vào collection users)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, avatar, bio } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên và email!' });
    }

    if (!password || password.trim().length < 4) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu tối thiểu 4 ký tự!' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng chuyển sang Đăng nhập.' });
    }

    const defaultAvatars = [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    ];
    const assignedAvatar = avatar || defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      avatar: assignedAvatar,
      bio: bio || 'Thành viên cộng đồng ẩm thực & du lịch FoodTravel.vn'
    });

    const saved = await user.save();
    res.status(201).json({ message: 'Đăng ký tài khoản thành công', user: saved });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đăng ký tài khoản', details: err.message });
  }
});

// Đăng nhập tài khoản (Kiểm tra Email và Mật khẩu trong MongoDB)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Vui lòng nhập email đăng nhập' });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ error: 'Tài khoản chưa tồn tại. Vui lòng chuyển sang tab Đăng ký.' });
    }

    // Nếu người dùng có đặt mật khẩu, kiểm tra mật khẩu
    if (user.password && password) {
      if (user.password !== password.trim()) {
        return res.status(401).json({ error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại.' });
      }
    } else if (user.password && !password) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu tài khoản!' });
    }

    res.json({ message: 'Đăng nhập thành công', user });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đăng nhập', details: err.message });
  }
});

// Lấy hồ sơ cá nhân của bất kỳ thành viên nào (Xem Profile công khai theo ID, Email hoặc Tên)
app.get('/api/auth/user-profile', async (req, res) => {
  try {
    const { name, email, id } = req.query;
    let query = {};
    if (id && mongoose.Types.ObjectId.isValid(id)) query._id = id;
    else if (email && email.trim() !== '') query.email = email.toLowerCase().trim();
    else if (name && name.trim() !== '') query.name = new RegExp(`^${name.trim()}$`, 'i');
    else return res.status(400).json({ error: 'Vui lòng cung cấp tên hoặc email' });

    let user = await User.findOne(query).populate('saved_locations');
    const searchName = user ? user.name : (name ? name.trim() : '');
    const searchEmail = user ? user.email.toLowerCase() : (email ? email.toLowerCase().trim() : '');

    if (!user) {
      user = {
        name: searchName,
        email: searchEmail,
        avatar: '',
        bio: 'Thành viên cộng đồng ẩm thực & du lịch FoodTravel.vn',
        saved_locations: []
      };
    }

    // 1. Lấy tất cả đánh giá do người này viết
    const reviewConditions = [];
    if (searchName) reviewConditions.push({ 'reviews.user_name': new RegExp(`^${searchName.trim()}$`, 'i') });
    if (searchEmail) reviewConditions.push({ 'reviews.user_email': new RegExp(`^${searchEmail.trim()}$`, 'i') });

    const userReviews = await Location.aggregate([
      { $unwind: '$reviews' },
      { $match: { $or: reviewConditions.length > 0 ? reviewConditions : [{ 'reviews.user_name': searchName }] } },
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

    // 2. Lấy tất cả bài viết do người này đăng tải (Khớp regex mềm dẻo không phân biệt hoa thường)
    const postConditions = [];
    if (searchEmail) {
      postConditions.push({ author_email: new RegExp(`^${searchEmail.trim()}$`, 'i') });
    }
    if (searchName) {
      postConditions.push({ author_name: new RegExp(`^${searchName.trim()}$`, 'i') });
      if (searchName.toLowerCase().includes('ngọc')) {
        postConditions.push({ author_name: /Ngọc/i });
        postConditions.push({ author_email: /ngoc/i });
      }
    }

    const userPosts = postConditions.length > 0 
      ? await Location.find({ $or: postConditions }).sort({ createdAt: -1 })
      : [];

    res.json({
      user,
      reviews: userReviews,
      posts: userPosts,
      total_posts: userPosts.length,
      total_reviews: userReviews.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải trang cá nhân thành viên', details: err.message });
  }
});

// GET /api/auth/profile/:id (Hỗ trợ lấy bài viết và đánh giá theo ID người dùng)
app.get('/api/auth/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('saved_locations');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const userReviews = await Location.aggregate([
      { $unwind: '$reviews' },
      { $match: { 'reviews.user_name': new RegExp(`^${user.name}$`, 'i') } },
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

    const postConditions = [
      { author_email: new RegExp(`^${user.email}$`, 'i') },
      { author_name: new RegExp(`^${user.name}$`, 'i') }
    ];
    if (user.name && user.name.toLowerCase().includes('ngọc')) {
      postConditions.push({ author_name: /Ngọc/i });
      postConditions.push({ author_email: /ngoc/i });
    }

    const userPosts = await Location.find({ $or: postConditions }).sort({ createdAt: -1 });

    res.json({
      user,
      posts: userPosts,
      reviews: userReviews,
      total_posts: userPosts.length,
      total_reviews: userReviews.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải profile', details: err.message });
  }
});

// Cập nhật hồ sơ cá nhân (Avatar, Tên, Bio) trên MongoDB và tự động đồng bộ sang toàn bộ Story & Bài viết
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

    // Đồng bộ ngay ảnh đại diện và tên vào Story và Bài viết của người dùng
    if (user && (avatar || name)) {
      const syncUpdate = {};
      if (avatar) syncUpdate.user_avatar = avatar;
      if (name) syncUpdate.user_name = name;
      await Story.updateMany(
        { $or: [{ user_email: user.email }, { user_name: user.name }] },
        { $set: syncUpdate }
      );

      const locUpdate = {};
      if (avatar) locUpdate.author_avatar = avatar;
      if (name) locUpdate.author_name = name;
      await Location.updateMany(
        { $or: [{ author_email: user.email }, { author_name: user.name }] },
        { $set: locUpdate }
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
      const syncUpdate = {};
      if (avatar) syncUpdate.user_avatar = avatar;
      if (name) syncUpdate.user_name = name;
      await Story.updateMany(
        { $or: [{ user_email: user.email }, { user_name: user.name }] },
        { $set: syncUpdate }
      );

      const locUpdate = {};
      if (avatar) locUpdate.author_avatar = avatar;
      if (name) locUpdate.author_name = name;
      await Location.updateMany(
        { $or: [{ author_email: user.email }, { author_name: user.name }] },
        { $set: locUpdate }
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
// 12. API STORIES PHONG CÁCH MẠNG XÃ HỘI (LƯU TRỮ TRỰC TIẾP TRÊN MONGODB - 24H)
// =====================================================================

// Lấy danh sách Story trong vòng 24 giờ qua (Đảm bảo Story quá 24h bị xóa hoàn toàn khỏi MongoDB)
app.get('/api/stories', async (req, res) => {
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Tự động xóa vĩnh viễn toàn bộ các Story đã quá 24 giờ khỏi MongoDB
    await Story.deleteMany({
      $and: [
        { $or: [{ createdAt: { $lt: cutoff24h } }, { createdAt: { $exists: false } }] },
        { $or: [{ created_at: { $lt: cutoff24h } }, { created_at: { $exists: false } }] }
      ]
    });

    // 2. Chỉ truy vấn các Story còn trong vòng 24 giờ
    const timeFilter = {
      $or: [
        { createdAt: { $gte: cutoff24h } },
        { created_at: { $gte: cutoff24h } }
      ]
    };

    let stories = await Story.find(timeFilter)
      .sort({ createdAt: -1, created_at: -1 })
      .limit(30)
      .lean();

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

    const now = new Date();
    const newStory = new Story({
      user_name,
      user_avatar: user_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      user_email: user_email ? user_email.toLowerCase().trim() : 'guest@foodtravel.vn',
      location_name,
      location_city: location_city || 'Việt Nam',
      image,
      caption: caption || '',
      filter: filter || 'normal',
      music: music || 'Nhạc thịnh hành 🎵',
      likes_count: 1,
      liked_by: user_email ? [user_email.toLowerCase().trim()] : [],
      created_at: now,
      createdAt: now
    });

    const savedStory = await newStory.save();
    res.status(201).json({ message: 'Đăng story thành công!', story: savedStory });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo story mới', details: err.message });
  }
});

// Xóa Story (Chỉ tác giả hoặc Quản trị viên)
app.delete('/api/stories/:id', async (req, res) => {
  try {
    const storyId = req.params.id;
    const { user_email } = req.body;

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Không tìm thấy khoảnh khắc Story' });
    }

    const isAdmin = user_email && (user_email.toLowerCase().includes('admin') || user_email.toLowerCase() === 'vanngoc@foodtravel.vn');
    if (story.user_email && story.user_email.trim() !== '') {
      if (!user_email || (story.user_email.toLowerCase() !== user_email.toLowerCase() && !isAdmin)) {
        return res.status(403).json({ error: 'Bạn chỉ có thể xóa Story do chính bạn đăng!' });
      }
    }

    await Story.findByIdAndDelete(storyId);
    res.json({ message: 'Đã xóa story thành công!', id: storyId });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa story', details: err.message });
  }
});

// Thả cảm xúc / Tim Story
app.post('/api/stories/:id/react', async (req, res) => {
  try {
    const storyId = req.params.id;
    const { user_email } = req.body;
    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: 'Không tìm thấy story' });

    const cleanEmail = user_email ? user_email.toLowerCase().trim() : '';
    const isLiked = story.liked_by && story.liked_by.includes(cleanEmail);
    let updated;
    if (isLiked) {
      updated = await Story.findByIdAndUpdate(
        storyId,
        { $pull: { liked_by: cleanEmail } },
        { new: true }
      );
    } else {
      updated = await Story.findByIdAndUpdate(
        storyId,
        { $addToSet: { liked_by: cleanEmail } },
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
      user_email: user_email ? user_email.toLowerCase().trim() : '',
      message: message.trim(),
      created_at: new Date()
    };

    story.replies.push(newReply);
    await story.save();

    // Tạo thông báo cho tác giả Story
    if (story.user_email && story.user_email.toLowerCase() !== (user_email || '').toLowerCase()) {
      await createNotification({
        recipient_email: story.user_email,
        sender_name: user_name || 'Một người dùng',
        sender_avatar: user_avatar,
        type: 'story_reply',
        title: `${user_name || 'Một người dùng'} đã gửi tin nhắn về Story "${story.location_name}"`,
        content: message.trim(),
        target_id: story._id
      });
    }

    res.status(201).json({ message: 'Gửi tin nhắn thành công', reply: newReply, replies_count: story.replies.length });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi gửi tin nhắn cho tác giả story', details: err.message });
  }
});

// Tác giả trả lời lại tin nhắn của bạn bè (Reply-Back)
app.post('/api/stories/:id/reply-back', async (req, res) => {
  try {
    const storyId = req.params.id;
    const { reply_index, reply_text } = req.body;

    if (!reply_text || !reply_text.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung trả lời!' });
    }

    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: 'Không tìm thấy Story' });

    const idx = parseInt(reply_index);
    if (isNaN(idx) || !story.replies || !story.replies[idx]) {
      return res.status(400).json({ error: 'Không tìm thấy tin nhắn cần trả lời' });
    }

    story.replies[idx].reply_back = reply_text.trim();
    story.replies[idx].reply_back_at = new Date();

    story.markModified('replies');
    await story.save();

    // Tạo thông báo gửi cho người đã đặt câu hỏi trước đó
    const targetMsg = story.replies[idx];
    if (targetMsg && targetMsg.user_email) {
      await createNotification({
        recipient_email: targetMsg.user_email,
        sender_name: story.user_name,
        sender_avatar: story.user_avatar,
        type: 'story_reply',
        title: `${story.user_name} đã phản hồi tin nhắn của bạn về Story "${story.location_name}"`,
        content: reply_text.trim(),
        target_id: story._id
      });
    }

    res.json({ 
      message: 'Đã gửi câu trả lời thành công!', 
      reply: story.replies[idx] 
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi gửi phản hồi lại', details: err.message });
  }
});

// Xóa tin nhắn trong Story (Theo story_id và reply_index)
app.delete('/api/stories/:id/replies/:replyIndex', async (req, res) => {
  try {
    const storyId = req.params.id;
    const replyIdx = parseInt(req.params.replyIndex);
    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: 'Không tìm thấy Story' });

    if (!story.replies || isNaN(replyIdx) || !story.replies[replyIdx]) {
      return res.status(404).json({ error: 'Không tìm thấy tin nhắn cần xóa' });
    }

    story.replies.splice(replyIdx, 1);
    story.markModified('replies');
    await story.save();

    res.json({ message: 'Đã xóa tin nhắn thành công!' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa tin nhắn', details: err.message });
  }
});

// =====================================================================
// API THÔNG BÁO THỜI GIAN THỰC (MONGODB NOTIFICATIONS)
// =====================================================================
app.get('/api/notifications', async (req, res) => {
  try {
    const { email, name } = req.query;
    if (!email && !name) return res.json([]);

    const orConditions = [];
    if (email && email.trim() !== '') {
      orConditions.push({ recipient_email: new RegExp(`^${email.toLowerCase().trim()}$`, 'i') });
    }
    if (name && name.trim() !== '') {
      orConditions.push({ recipient_email: new RegExp(`^${name.trim()}$`, 'i') });
    }
    orConditions.push({ recipient_email: 'all' });

    const notifs = await Notification.find({ $or: orConditions })
      .sort({ created_at: -1 })
      .limit(30);

    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy danh sách thông báo', details: err.message });
  }
});

app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const { email } = req.body;
    if (email) {
      await Notification.updateMany(
        { recipient_email: email.toLowerCase().trim(), is_read: false },
        { is_read: true }
      );
    }
    res.json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật thông báo', details: err.message });
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

// Lấy tất cả tin nhắn trong hộp thư của người dùng (Bao gồm tin nhắn NHẬN ĐƯỢC từ story của mình và tin nhắn ĐÃ GỬI cho story của người khác - phong cách Messenger)
app.get('/api/stories/my-replies/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const cleanEmail = email.toLowerCase().trim();

    // 1. Tin nhắn người khác gửi vào Story của tôi (Incoming)
    const myStories = await Story.find({
      user_email: cleanEmail,
      'replies.0': { $exists: true }
    }).sort({ updatedAt: -1 });

    const receivedReplies = [];
    myStories.forEach(s => {
      (s.replies || []).forEach((r, idx) => {
        receivedReplies.push({
          type: 'received',
          story_id: s._id,
          reply_index: idx,
          story_caption: s.caption,
          story_image: s.image,
          location_name: s.location_name,
          location_city: s.location_city,
          user_name: r.user_name,
          user_avatar: r.user_avatar,
          user_email: r.user_email,
          message: r.message,
          reply_back: r.reply_back || '',
          reply_back_at: r.reply_back_at || null,
          created_at: r.created_at
        });
      });
    });

    // 2. Tin nhắn TÔI ĐÃ GỬI vào Story của người khác (Outgoing)
    const othersStories = await Story.find({
      user_email: { $ne: cleanEmail },
      'replies.user_email': cleanEmail
    }).sort({ updatedAt: -1 });

    const sentReplies = [];
    othersStories.forEach(s => {
      (s.replies || []).forEach((r, idx) => {
        if (r.user_email && r.user_email.toLowerCase() === cleanEmail) {
          sentReplies.push({
            type: 'sent',
            story_id: s._id,
            reply_index: idx,
            story_caption: s.caption,
            story_image: s.image,
            story_owner_name: s.user_name,
            story_owner_avatar: s.user_avatar,
            location_name: s.location_name,
            location_city: s.location_city,
            user_name: r.user_name,
            user_avatar: r.user_avatar,
            message: r.message,
            reply_back: r.reply_back || '',
            reply_back_at: r.reply_back_at || null,
            created_at: r.created_at
          });
        }
      });
    });

    res.json({
      received: receivedReplies,
      sent: sentReplies,
      all: [...receivedReplies, ...sentReplies].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy tin nhắn phản hồi story', details: err.message });
  }
});

// Khởi chạy máy chủ
app.listen(PORT, () => {
  console.log(`🚀 Travel Review Server đang chạy tại: http://localhost:${PORT}`);
});
