const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Location = require('./models/Location');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nosql_locations_db';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    res.json({
      status: 'OK',
      database: 'nosql_locations_db',
      total_locations: count,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// =====================================================================
// 2. API DANH SÁCH & TÌM KIẾM ĐỊA ĐIỂM (Hỗ trợ Text Search & Filter)
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

    // Tìm kiếm toàn văn (Text Search Index của SV2)
    if (search && search.trim() !== '') {
      query.$text = { $search: search.trim() };
    }

    let sortOption = { rating_avg: -1 };
    if (sort === 'reviews') sortOption = { total_reviews: -1 };
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
// 3. API TÌM KIẾM GẦN TÔI (Geospatial $near 2dsphere của SV2)
// =====================================================================
app.get('/api/locations/nearby', async (req, res) => {
  try {
    const { lng, lat, max_distance = 10000, category } = req.query;

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
          $maxDistance: parseInt(max_distance) // mét (mặc định 10km)
        }
      }
    };

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    const nearbyLocations = await Location.find(filter).limit(30);
    res.json(nearbyLocations);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn Geospatial $near', details: err.message });
  }
});

// =====================================================================
// 4. API THỐNG KÊ AGGREGATION PIPELINE (Chức năng đặc trưng SV2)
// =====================================================================
app.get('/api/analytics/top-cities', async (req, res) => {
  try {
    // Pipeline: Thống kê số lượng địa điểm và Rating trung bình theo thành phố
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
          avg_city_rating: { $round: ['$avg_city_rating', 2] },
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
    // Pipeline: Lấy Top 5 địa điểm cao nhất mỗi thành phố
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
              total_reviews: '$total_reviews'
            }
          }
        }
      },
      {
        $project: {
          city: '$_id',
          best_places: { $slice: ['$best_places', 3] },
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
// 5. API CHI TIẾT ĐỊA ĐIỂM THEO ID (Kèm toàn bộ Reviews & Replies)
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
// 6. API THÊM ĐỊA ĐIỂM MỚI (CRUD - SV1)
// =====================================================================
app.post('/api/locations', async (req, res) => {
  try {
    const { name, category, city, address, description, price_range, lat, lng, images } = req.body;

    if (!name || !city || !lat || !lng) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ: Tên, Thành phố, Tọa độ Lat/Lng' });
    }

    const newLocation = new Location({
      name,
      category: category || 'Attraction',
      city,
      address: address || `${name}, ${city}`,
      description: description || `Địa điểm du lịch nổi tiếng tại ${city}`,
      price_range: price_range || 'MODERATE',
      images: images && images.length ? images : ['https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600'],
      location: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
      },
      rating_avg: 5.0,
      total_reviews: 0,
      reviews: []
    });

    const saved = await newLocation.save();
    res.status(201).json({ message: 'Tạo địa điểm thành công', data: saved });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo địa điểm mới', details: err.message });
  }
});

// =====================================================================
// 7. API ĐĂNG REVIEW MỚI (Tự động cập nhật Real-time Rating)
// =====================================================================
app.post('/api/locations/:id/reviews', async (req, res) => {
  try {
    const { user_name, rating, content, images } = req.body;
    const locationId = req.params.id;

    if (!user_name || !rating || !content) {
      return res.status(400).json({ error: 'Vui lòng nhập tên, số sao đánh giá và nội dung review' });
    }

    const newReview = {
      user_name,
      rating: Number(rating),
      content,
      images: images || [],
      created_at: new Date(),
      replies: []
    };

    // 1. Thao tác nguyên tử ($push) chuẩn MongoDB Document Store hỗ trợ ghi đồng thời cao
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

    // 2. Aggregation Pipeline thời gian thực (Barem SV2 Đề tài 04):
    // Tự động tính toán lại Rating Average và Total Reviews của địa điểm từ mảng reviews
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
// 8. API PHẢN HỒI BÌNH LUẬN (Nested Replies)
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

// Chạy server
app.listen(PORT, () => {
  console.log(`🚀 Travel Review Server đang chạy tại: http://localhost:${PORT}`);
});
