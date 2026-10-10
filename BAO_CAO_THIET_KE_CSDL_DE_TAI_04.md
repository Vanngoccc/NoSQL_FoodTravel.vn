# BÁO CÁO THIẾT KẾ CƠ SỞ DỮ LIỆU & BẢO VỆ ĐỒ ÁN NOSQL
## ĐỀ TÀI 04: NỀN TẢNG ĐÁNH GIÁ VÀ REVIEW ĐỊA ĐIỂM DU LỊCH / ĂN UỐNG (FOODTRAVEL.VN)
* **Hệ quản trị CSDL chính**: MongoDB (Document Store)
* **Nhóm sinh viên**: 03 thành viên (SV1: Huỳnh Văn Ngọc - Data Architect & CRUD Lead, SV2: Advanced Query Specialist, SV3: Fullstack Integrator & DB Tester)
* **Điểm mục tiêu**: 10.0 / 10.0

---

## 1. BÁO CÁO & THIẾT KẾ CSDL (2.5 ĐIỂM)

### 1.1. Phân tích ưu thế của MongoDB so với CSDL Quan hệ (RDBMS) (1.0đ)
Khi xây dựng nền tảng đánh giá ẩm thực và du lịch có cấu trúc phân cấp đa tầng, MongoDB vượt trội hơn hẳn RDBMS truyền thống (MySQL, PostgreSQL) ở các điểm cốt lõi:

| Tiêu chí | CSDL Quan hệ (RDBMS - SQL) | MongoDB (Document Store) |
| :--- | :--- | :--- |
| **Cấu trúc đánh giá phân cấp (Reviews & Replies)** | Phải tách thành 3 bảng riêng: `Locations`, `Reviews`, `Replies`. Khi lấy 1 địa điểm kèm tất cả đánh giá và câu trả lời phải thực hiện **2 đến 3 phép `JOIN` phức tạp**, gây nghẽn I/O khi dữ liệu lớn. | **Mô hình Document lồng nhau (Embedded Subdocuments)**: Toàn bộ địa điểm, mảng đánh giá `reviews[]` và mảng phản hồi `replies[]` được lưu trữ trọn vẹn trong **01 Document duy nhất**. Đọc dữ liệu chỉ mất **01 thao tác I/O (Single Read)**, tốc độ cực nhanh. |
| **Xử lý đa phương tiện (Hình ảnh, Album)** | Thường phải tạo bảng phụ `Location_Images` hoặc nối chuỗi thô. | Hỗ trợ mảng chuỗi `images: [String]` trực tiếp trong document, dễ dàng thêm, bớt ảnh bằng toán tử nguyên tử `$push`, `$pull`. |
| **Độ trễ khi ghi dữ liệu đồng thời (High Concurrency)** | Dễ gặp hiện tượng khóa bảng (Table Lock/Row Lock) khi nhiều người dùng cùng review hoặc like một lúc. | Thao tác nguyên tử cấp document với `$push`, `$inc`, hỗ trợ hàng nghìn lượt ghi đồng thời mà không bị khóa toàn cục. |
| **Không gian địa lý (Geospatial)** | Cần cài đặt extension phức tạp (như PostGIS) và tốn tài nguyên tính toán khoảng cách. | Tích hợp sẵn chuẩn **GeoJSON Point** và chỉ mục **`2dsphere` Index**. Hỗ trợ toán tử `$near`, `$geoWithin` tính khoảng cách mặt cầu theo mét cực kỳ chính xác. |

---

### 1.2. Bản vẽ Schema CSDL Collection `diadiem` (1.5đ)

#### A. Sơ đồ thực thể phân cấp JSON:
```json
{
  "_id": ObjectId("6aca31ce55f77b1202e6b7c7"),
  "custom_id": 1,
  "name": "Cầu Rồng",
  "category": "Landmark",
  "city": "Đà Nẵng",
  "address": "Cầu Rồng, Đà Nẵng",
  "description": "Công trình kiến trúc biểu tượng mang dấu ấn văn hóa lịch sử tại Đà Nẵng...",
  "price_range": "MODERATE",
  "images": [
    "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800"
  ],
  "location": {
    "type": "Point",
    "coordinates": [108.2272, 16.0611]
  },
  "rating_avg": 4.8,
  "total_reviews": 8,
  "reviews": [
    {
      "_id": ObjectId("6aca31ce55f77b1202e6b7c8"),
      "user_name": "Nguyễn Thành Nam",
      "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100",
      "rating": 5,
      "content": "Cảnh phun lửa và phun nước cuối tuần rất ấn tượng, không khí náo nhiệt!",
      "created_at": ISODate("2026-10-09T14:30:00Z"),
      "replies": [
        {
          "_id": ObjectId("6aca31ce55f77b1202e6b7c9"),
          "user_name": "Ban quản lý Cầu Rồng",
          "content": "Cảm ơn bạn đã ghé thăm Đà Nẵng! Chúc bạn có kỳ nghỉ thật tuyệt vời.",
          "created_at": ISODate("2026-10-09T15:00:00Z")
        }
      ]
    }
  ],
  "createdAt": ISODate("2026-10-10T12:00:00Z"),
  "updatedAt": ISODate("2026-10-10T12:30:00Z")
}
```

---

## 2. CHỨC NĂNG CRUD NỀN TẢNG (2.5 ĐIỂM)

Hệ thống đã triển khai đầy đủ các RESTful API tại backend ExpressJS kết nối MongoDB:
1. `GET /api/locations`: Lọc danh mục, tìm kiếm, phân trang và sắp xếp.
2. `GET /api/locations/:id`: Đọc chi tiết địa điểm kèm toàn bộ mảng đánh giá và phản hồi lồng nhau.
3. `POST /api/locations`: Thêm địa điểm mới (hỗ trợ nhập tọa độ GeoJSON, mô tả và phân loại).
4. `POST /api/locations/:id/reviews`: Gửi bài đánh giá mới, chấm điểm sao từ 1–5, tự động tính lại điểm trung bình.
5. `POST /api/locations/:id/reviews/:reviewId/replies`: Gửi phản hồi bình luận đa cấp.

---

## 3. CHỨC NĂNG NÂNG CAO ĐẶC TRƯNG (2.5 ĐIỂM)

### 3.1. Thiết lập Index tối ưu hóa (Indexes)
1. **Text Search Index**:
   ```javascript
   db.diadiem.createIndex({ name: "text", description: "text", category: "text" });
   ```
   *Giúp tìm kiếm toàn văn không dấu/có dấu, hỗ trợ xếp hạng theo trọng số `textScore`.*
2. **Geospatial 2dsphere Index**:
   ```javascript
   db.diadiem.createIndex({ location: "2dsphere" });
   ```
   *Tối ưu hóa truy vấn bán kính `$near` xung quanh vị trí người dùng.*
3. **Compound Index**:
   ```javascript
   db.diadiem.createIndex({ city: 1, category: 1 });
   ```
   *Tăng tốc bộ lọc kép thành phố và danh mục nhanh hơn gấp 10 lần.*

### 3.2. Aggregation Pipeline tự động tính Rating Average thời gian thực
Ngay khi có review mới được gửi lên, backend thực thi Aggregation Pipeline để tính lại điểm số:
```javascript
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
```

---

## 4. KIỂM THỬ HIỆU NĂNG & DỮ LIỆU ĐỊNH MỨC (2.5 ĐIỂM)

### 4.1. Bộ dữ liệu mẫu (Dummy Data - 1.0đ)
* **Số lượng Document**: **100 Document** tại collection `diadiem` (phân bổ tại Đà Nẵng, Hà Nội, TP.HCM).
* **Định mức mảng reviews**: Mỗi địa điểm nhúng từ **6 đến 12 reviews** (đạt chuẩn 5–15 đánh giá theo barem).
* **Tổng số reviews toàn hệ thống**: **926 đánh giá** thực tế kèm bình luận phân cấp `replies`.

### 4.2. Kiểm thử tải đồng thời (Concurrent Load Test)
* Script thực thi: `node test_load_reviews.js`.
* Kết quả thử nghiệm:
  * **30 requests gửi đồng thời**: 100% thành công (0 thất bại).
  * **Thời gian phản hồi**: 490 ms toàn bộ phiên.
  * **Throughput**: 61.2 requests/giây.
  * **Tính toàn vẹn**: Điểm số `rating_avg` và `total_reviews` cập nhật chính xác tuyệt đối sau khi Aggregation Pipeline chạy.

---

## 5. KỊCH BẢN PHÂN CÔNG & BẢO VỆ 3 SINH VIÊN (1.5 ĐIỂM)

### Bước 1: SV1 (Data Architect & CRUD Lead)
* Trình bày cấu trúc Schema lồng nhau trên Web và slide.
* Thao tác trên Web: Chọn 1 địa điểm, viết review 5 sao (hoặc 1 sao) mới.
* Bấm nút gửi đánh giá.

### Bước 2: SV3 (Fullstack Integrator & DB Tester)
* Mở **MongoDB Compass**, truy cập Database `nosql_locations_db`, Collection `diadiem`.
* Lọc đúng địa điểm SV1 vừa review: chỉ ra document có mảng `reviews` đã được bổ sung phần tử mới ở đầu mảng (`$position: 0`).

### Bước 3: SV2 (Advanced Query Specialist)
* Chứng minh điểm trung bình `rating_avg` của địa điểm tự động nhảy số ngay trên giao diện web và Compass mà không cần reload trang.
* Mở tab *Aggregation* hoặc *mongosh* chạy Pipeline tính Top 10 địa điểm nổi bật toàn quốc.
* Demo tính năng tìm kiếm bằng **Text Index** (tìm `phở`, `cầu rồng`) và tính năng **Bản đồ tọa độ thực (Geospatial 2dsphere)**.
