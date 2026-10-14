# 🇻🇳 FoodTravel.vn - Nền Tảng Đánh Giá & Review Địa Điểm Du Lịch / Ăn Uống

> **ĐỒ ÁN MÔN HỌC: CƠ SỞ DỮ LIỆU NOSQL (ĐỀ TÀI 04)**  
> **Hệ quản trị CSDL chính**: MongoDB (Document Store)  
> **Nhóm thực hiện**: 03 sinh viên (Trưởng nhóm: Huỳnh Văn Ngọc)  
> 🌐 **Website Demo Online**: [https://nosql-foodtravel-vn.onrender.com](https://nosql-foodtravel-vn.onrender.com)  
> 📦 **GitHub Repository**: [https://github.com/Vanngoccc/NoSQL_FoodTravel.vn](https://github.com/Vanngoccc/NoSQL_FoodTravel.vn)

---

## 📌 1. Giới thiệu Dự án
**FoodTravel.vn** là nền tảng mạng xã hội chuyên biệt cho cộng đồng đam mê ẩm thực và du lịch tại Việt Nam. Ứng dụng khai thác tối đa sức mạnh của **MongoDB** để xử lý cấu trúc dữ liệu phân cấp phức tạp, dữ liệu đa phương tiện, lập chỉ mục tìm kiếm toàn văn và không gian địa lý thời gian thực.

### ✨ Các Tính Năng Cốt Lõi:
1. **Khám phá 100 địa danh & ẩm thực Việt Nam**: Dữ liệu thực tế phân bổ tại 3 miền (Đà Nẵng, Hà Nội, TP. Hồ Chí Minh).
2. **Đánh giá & Bình luận lồng nhau đa cấp (Nested Reviews & Replies)**: Độc giả chấm điểm sao (1 - 5⭐) theo chuẩn Google Play, viết bình luận và gửi phản hồi lồng nhau được nhúng trực tiếp trong cùng một Document.
3. **Lưu địa điểm yêu thích (Bookmarks)**: Nút lưu nhanh trên thẻ địa điểm, modal chi tiết và tab quản lý riêng biệt trong Trang cá nhân (`User Profile`).
4. **Stories mạng xã hội 24h**: Xem khoảnh khắc dọc chuẩn 9:16, tự động đồng bộ ảnh đại diện người dùng và gửi tin nhắn phản hồi trực tiếp tới tác giả.
5. **Chia sẻ địa điểm mới phong cách Facebook**: Hỗ trợ định vị GPS tự động từ trình duyệt, upload ảnh từ máy tính hoặc chọn ảnh mẫu chuẩn Việt Nam.
6. **Bản đồ không gian địa lý (Leaflet Map & GPS)**: Tọa độ thực `[Longitude, Latitude]`, ghim vị trí người dùng với hiệu ứng sóng xanh phát sáng, hiển thị toàn vẹn lãnh thổ Việt Nam.
7. **Tìm kiếm toàn văn (Text Index)**: Tìm kiếm nhanh không dấu/có dấu theo tên, mô tả và phân loại với tốc độ vượt trội.
8. **Aggregation Pipeline thời gian thực**: Tự động tính lại điểm trung bình (`rating_avg`) và tổng số đánh giá (`total_reviews`) ngay khi có tương tác mới.

---

## 🛠️ 2. Công nghệ Sử dụng (Tech Stack)
* **Backend**: Node.js, Express.js, Mongoose ODM, Multer (xử lý file ảnh), Cors, Dotenv.
* **Database**: 
  * **MongoDB Atlas Cloud** (Deploy production trên đám mây).
  * **MongoDB Local** (`127.0.0.1:27017` phục vụ lập trình & kiểm thử tải).
* **Frontend**: HTML5 Semantic, TailwindCSS (CDN), FontAwesome 6, Leaflet.js (Bản đồ số).
* **Cloud Platform**: Render.com (Web Service Hosting).

---

## 🗂️ 3. Cấu trúc Thư mục Dự án
```text
NoSQL_FoodTravel.vn/
├── models/
│   ├── Location.js             # Schema địa điểm nhúng reviews & replies (Collection "diadiem")
│   ├── User.js                 # Schema người dùng & mảng saved_locations
│   └── Story.js                # Schema Story khoảnh khắc mạng xã hội & tin nhắn phản hồi
├── public/
│   ├── index.html              # Giao diện chính Responsive chuẩn Figma
│   ├── app.js                  # Frontend Controller xử lý toàn bộ tương tác & API
│   └── uploads/                # Thư mục lưu trữ hình ảnh upload & ảnh mẫu chuẩn
│       └── locations/          # Ảnh mẫu các địa danh và ẩm thực đặc sản
├── .env                        # File cấu hình biến môi trường (PORT, MONGO_URI)
├── .gitignore                  # Bỏ qua node_modules, .env, *.log
├── BAO_CAO_THIET_KE_CSDL_DE_TAI_04.md  # Đề cương & nội dung báo cáo thiết kế CSDL
├── ke_hoach_3_tuan_de_tai_04.md        # Kế hoạch chi tiết phân công đồ án
├── locationsData.js            # Dữ liệu nguồn 100 địa điểm chuẩn hóa
├── package.json                # Danh sách thư viện phụ thuộc
├── seedData.js                 # Script nạp khởi tạo dữ liệu mẫu
├── test_load_reviews.js        # Script kiểm thử hiệu năng gửi review đồng thời
├── update_all_location_reviews.js # Migration script chuẩn hóa bình luận sát thực tế
└── server.js                   # RESTful API Server chính (ExpressJS + MongoDB)
```

---

## 🚀 4. Hướng dẫn Cài đặt & Chạy trên máy cá nhân (Local)

### Bước 1: Clone Repository
```bash
git clone https://github.com/Vanngoccc/NoSQL_FoodTravel.vn.git
cd NoSQL_FoodTravel.vn
```

### Bước 2: Cài đặt các thư viện cần thiết
```bash
npm install
```

### Bước 3: Cấu hình file biến môi trường (`.env`)
Tạo file `.env` ở thư mục gốc của dự án với nội dung:
```env
PORT=5055

# Tùy chọn 1: Sử dụng MongoDB Local trên máy
MONGO_URI=mongodb://127.0.0.1:27017/nosql_locations_db

# Tùy chọn 2: Sử dụng MongoDB Atlas Cloud của nhóm
# MONGO_URI=mongodb+srv://mim879584_db_user:tlMdp2CfSIgcgXwA@cluster0.1djgrg3.mongodb.net/nosql_locations_db?retryWrites=true&w=majority&appName=Cluster0
```

### Bước 4: Khởi tạo và nạp dữ liệu mẫu (100 địa điểm & reviews chuẩn)
```bash
node seedData.js
```
*(Hoặc chạy `node update_all_location_reviews.js` để cập nhật lại toàn bộ nội dung bình luận chuyên biệt theo từng danh lam thắng cảnh).*

### Bước 5: Khởi động Server
```bash
node server.js
```
Truy cập trình duyệt tại địa chỉ: **`http://localhost:5055`**

---

## 🌐 5. Hướng dẫn Deploy lên Render.com

1. Truy cập [dashboard.render.com](https://dashboard.render.com/) $\rightarrow$ Chọn **New** $\rightarrow$ **Web Service**.
2. Kết nối với GitHub Repository: **`Vanngoccc/NoSQL_FoodTravel.vn`**.
3. Điền các thông số cấu hình:
   * **Name**: `foodtravel-vn` (hoặc tùy chọn).
   * **Language**: `Node`.
   * **Branch**: `main`.
   * **Build Command**: `npm install`.
   * **Start Command**: `node server.js`.
   * **Plan**: `Free ($0/month)`.
4. Thiết lập **Environment Variables**:
   * **Key**: `MONGO_URI`
   * **Value**:
     ```text
     mongodb+srv://mim879584_db_user:tlMdp2CfSIgcgXwA@cluster0.1djgrg3.mongodb.net/nosql_locations_db?retryWrites=true&w=majority&appName=Cluster0
     ```
5. Bấm **Deploy Web Service** và chờ Render kích hoạt dịch vụ thành công!

> [!IMPORTANT]
> **Lưu ý Network Access trên MongoDB Atlas**:  
> Đảm bảo đã thêm IP `0.0.0.0/0` (Allow Access from Anywhere) trong mục **Network Access** của MongoDB Atlas để máy chủ Render có quyền truy vấn dữ liệu.

---

## 📊 6. Thiết kế Cơ Sở Dữ Liệu MongoDB (Barem Đề Tài 04)

### 6.1. Schema Collection `diadiem` (Mô hình Embedded Documents)
```json
{
  "_id": ObjectId("6aca31ce55f77b1202e6b7c7"),
  "custom_id": 1,
  "name": "Cầu Rồng",
  "category": "Landmark",
  "city": "Đà Nẵng",
  "address": "Cầu Rồng, Đà Nẵng",
  "description": "Biểu tượng tự hào của thành phố Đà Nẵng với kiến trúc rồng thép vươn ra biển Đông...",
  "price_range": "MODERATE",
  "images": [
    "/uploads/locations/sample_dragon.jpg"
  ],
  "location": {
    "type": "Point",
    "coordinates": [108.2272, 16.0611]
  },
  "rating_avg": 4.8,
  "total_reviews": 5,
  "likes_count": 142,
  "liked_by": ["vanngoc@foodtravel.vn"],
  "reviews": [
    {
      "_id": ObjectId("6aca31ce55f77b1202e6b7c8"),
      "user_name": "Huỳnh Văn Ngọc",
      "avatar": "/uploads/upload-1791643118362-205632.jpg",
      "rating": 5,
      "content": "Tối thứ 7 và Chủ nhật đúng 21h rồng phun lửa rồi phun nước cực kỳ hoành tráng...",
      "created_at": ISODate("2026-10-14T14:30:00Z"),
      "replies": [
        {
          "user_name": "FoodTravel Guide",
          "content": "Nhớ mang theo ô hoặc áo mưa mỏng đề phòng gió tạt nước lúc Rồng phun nước nha bạn!",
          "created_at": ISODate("2026-10-14T15:00:00Z")
        }
      ]
    }
  ]
}
```

### 6.2. Các Chỉ mục Tối ưu hóa (Indexes)
```javascript
// 1. Chỉ mục không gian địa lý phục vụ truy vấn bán kính $near
db.diadiem.createIndex({ location: "2dsphere" });

// 2. Chỉ mục tìm kiếm toàn văn theo từ khóa
db.diadiem.createIndex({ name: "text", description: "text", category: "text" });

// 3. Chỉ mục kết hợp tăng tốc độ lọc
db.diadiem.createIndex({ city: 1, category: 1 });
db.diadiem.createIndex({ rating_avg: -1 });
```

### 6.3. Aggregation Pipeline Tính Điểm Trung Bình Thời Gian Thực
```javascript
const aggResult = await Location.aggregate([
  { $match: { _id: new mongoose.Types.ObjectId(locationId) } },
  { $unwind: '$reviews' },
  {
    $group: {
      _id: '$_id',
      rating_avg: { $avg: '$reviews.rating' },
      total_reviews: { $sum: 1 }
    }
  }
]);
```

---

## 👥 7. Phân công Công việc Nhóm 3 Sinh viên
* **SV1 (Huỳnh Văn Ngọc - Nhóm trưởng / Data Architect & CRUD Lead)**:
  * Phân tích ưu thế của MongoDB so với CSDL Quan hệ (RDBMS).
  * Thiết kế kiến trúc Schema Collection `diadiem` nhúng `reviews` và `replies` đa cấp.
  * Xây dựng toàn bộ hệ thống RESTful API CRUD địa điểm, gửi đánh giá, phản hồi bình luận và lưu địa điểm.
* **SV2 (Advanced Query Specialist)**:
  * Thiết lập và tối ưu hóa hệ thống Indexes (Text Index, Compound Index, 2dsphere Geospatial Index).
  * Xây dựng các Aggregation Pipeline tự động tính lại điểm `rating_avg` và tổng hợp Top điểm đến được đánh giá cao nhất.
  * Phân tích hiệu năng truy vấn qua `explain("executionStats")`.
* **SV3 (Fullstack Integrator & DB Tester)**:
  * Khởi tạo bộ dữ liệu mẫu định mức đạt 100 Document và hơn 900 reviews phong phú.
  * Viết script giả lập kiểm thử tải gửi nhiều đánh giá đồng thời (`test_load_reviews.js`).
  * Hoàn thiện giao diện người dùng Responsive, tích hợp bản đồ số Leaflet và điều phối kịch bản Demo sống bảo vệ trước Hội đồng.

---

## 📝 8. Giấy phép (License)
Dự án được phát triển phục vụ mục đích học tập và bảo vệ đồ án môn học Cơ sở dữ liệu NoSQL. Toàn bộ bản quyền thuộc về nhóm tác giả © 2026 FoodTravel.vn.
