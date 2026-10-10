// =====================================================================
// KỊCH BẢN TRUY VẤN NÂNG CAO CHO SV2 - ADVANCED QUERY SPECIALIST
// Đề tài 04: Nền tảng đánh giá và review địa điểm du lịch / ăn uống
// Sử dụng trong MongoDB Compass hoặc mongosh: use nosql_locations_db
// =====================================================================

// ---------------------------------------------------------------------
// 1. THIẾT LẬP VÀ KIỂM TRA INDEXES (Barem 3: Text Index & Compound Index)
// ---------------------------------------------------------------------

// Tạo Text Index trên name, description, category
db.diadiem.createIndex(
  { name: "text", description: "text", category: "text" },
  { default_language: "none" }
);

// Tạo Geospatial 2dsphere Index trên tọa độ vị trí
db.diadiem.createIndex({ location: "2dsphere" });

// Tạo Compound Index kết hợp city và category để tăng tốc lọc kép
db.diadiem.createIndex({ city: 1, category: 1 });

// Tạo Single Field Index trên rating_avg để sắp xếp điểm cao
db.diadiem.createIndex({ rating_avg: -1 });

// Lệnh kiểm tra danh sách Index đã kích hoạt:
db.diadiem.getIndexes();


// ---------------------------------------------------------------------
// 2. TRUY VẤN TÌM KIẾM TOÀN VĂN (TEXT SEARCH) - SV2
// ---------------------------------------------------------------------

// Truy vấn 1: Tìm kiếm các địa điểm liên quan đến "phở" hoặc "bún chả"
db.diadiem.find(
  { $text: { $search: "phở bún" } },
  { score: { $meta: "textScore" }, name: 1, city: 1, category: 1, rating_avg: 1 }
).sort({ score: { $meta: "textScore" } }).limit(5);

// Truy vấn 2: Tìm kiếm theo cụm từ chính xác "Cầu Rồng"
db.diadiem.find(
  { $text: { $search: "\"Cầu Rồng\"" } },
  { name: 1, city: 1, address: 1, rating_avg: 1 }
);


// ---------------------------------------------------------------------
// 3. TRUY VẤN KHÔNG GIAN ĐỊA LÝ (GEOSPATIAL $near 2dsphere) - SV2
// ---------------------------------------------------------------------

// Tìm các địa điểm trong bán kính 10km quanh Cầu Rồng Đà Nẵng [108.2272, 16.0611]
db.diadiem.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [108.2272, 16.0611]
      },
      $maxDistance: 10000 // 10,000 mét = 10km
    }
  }
}, { name: 1, city: 1, category: 1, rating_avg: 1 }).limit(10);


// ---------------------------------------------------------------------
// 4. AGGREGATION PIPELINE: TỰ ĐỘNG TÍNH LẠI RATING TRUNG BÌNH THỜI GIAN THỰC
// (Được gọi trực tiếp trong backend khi người dùng gửi đánh giá mới)
// ---------------------------------------------------------------------

// Pipeline tính rating_avg và total_reviews của 1 địa điểm cụ thể:
db.diadiem.aggregate([
  // Bước 1: Lọc đúng địa điểm có tương tác mới
  { $match: { name: "Cầu Rồng" } },
  // Bước 2: Tách mảng reviews lồng nhau thành từng document phẳng
  { $unwind: "$reviews" },
  // Bước 3: Gom nhóm và tính điểm trung bình, tổng số lượt đánh giá
  {
    $group: {
      _id: "$_id",
      ten_dia_diem: { $first: "$name" },
      thanh_pho: { $first: "$city" },
      diem_trung_binh: { $avg: "$reviews.rating" },
      tong_luot_danh_gia: { $sum: 1 }
    }
  },
  // Bước 4: Làm tròn số thập phân 1 chữ số
  {
    $project: {
      ten_dia_diem: 1,
      thanh_pho: 1,
      diem_trung_binh: { $round: ["$diem_trung_binh", 1] },
      tong_luot_danh_gia: 1
    }
  }
]);


// ---------------------------------------------------------------------
// 5. AGGREGATION PIPELINE: TOP 10 ĐỊA ĐIỂM NỔI BẬT NHẤT TOÀN QUỐC
// ---------------------------------------------------------------------

db.diadiem.aggregate([
  {
    $project: {
      name: 1,
      city: 1,
      category: 1,
      rating_avg: 1,
      total_reviews: 1,
      so_luong_replies: {
        $sum: {
          $map: {
            input: "$reviews",
            as: "r",
            in: { $size: { $ifNull: ["$$r.replies", []] } }
          }
        }
      }
    }
  },
  { $sort: { rating_avg: -1, total_reviews: -1 } },
  { $limit: 10 }
]);


// ---------------------------------------------------------------------
// 6. AGGREGATION PIPELINE: PHÂN TÍCH ĐÁNH GIÁ THEO THÀNH PHỐ
// ---------------------------------------------------------------------

db.diadiem.aggregate([
  {
    $group: {
      _id: "$city",
      so_luong_dia_diem: { $sum: 1 },
      diem_tb_thanh_pho: { $avg: "$rating_avg" },
      tong_tat_ca_reviews: { $sum: "$total_reviews" }
    }
  },
  {
    $project: {
      thanh_pho: "$_id",
      so_luong_dia_diem: 1,
      diem_tb_thanh_pho: { $round: ["$diem_tb_thanh_pho", 2] },
      tong_tat_ca_reviews: 1,
      _id: 0
    }
  },
  { $sort: { so_luong_dia_diem: -1 } }
]);