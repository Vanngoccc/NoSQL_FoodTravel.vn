const mongoose = require('mongoose');
const Location = require('./models/Location'); // Import Model Location
const rawLocations = require('./locationsData'); // Import danh sách 100 địa điểm gốc

// Kết nối tới MongoDB local
mongoose.connect('mongodb://127.0.0.1:27017/nosql_locations_db')
  .then(() => console.log('✅ Đã kết nối thành công tới MongoDB!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Mẫu ảnh du lịch chất lượng cao theo từng category
const categoryImages = {
  Landmark: [
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1528127269322-539801943592?w=600&auto=format&fit=crop'
  ],
  Beach: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=600&auto=format&fit=crop'
  ],
  Museum: [
    'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=600&auto=format&fit=crop'
  ],
  Pagoda: [
    'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600&auto=format&fit=crop'
  ],
  Market: [
    'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=600&auto=format&fit=crop'
  ],
  Attraction: [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop'
  ],
  Default: [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&auto=format&fit=crop'
  ]
};

// Hàm sinh danh sách Review ngẫu nhiên kèm Replies
const generateRandomReviews = (locationName) => {
  const comments = [
    { text: 'Địa điểm rất đẹp, không khí trong lành, đáng để ghé thăm nhiều lần!', rate: 5 },
    { text: 'Phong cảnh tuyệt vời nhưng cuối tuần hơi đông đúc. Nên đi sáng sớm để chụp hình đẹp.', rate: 4 },
    { text: 'Trải nghiệm tuyệt vời, nhân viên thân thiện, check-in view siêu đỉnh.', rate: 5 },
    { text: 'Dịch vụ ở đây khá tốt, giá cả hợp lý, đáng để trải nghiệm cùng gia đình.', rate: 4 },
    { text: 'Không gian thoáng mát, cảnh vật được giữ gìn sạch sẽ. Rất hài lòng!', rate: 5 },
    { text: 'Điểm đến thú vị, đậm nét văn hóa địa phương.', rate: 4 }
  ];

  const userAvatars = [
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100'
  ];

  const reviewCount = Math.floor(Math.random() * 4) + 3; // Sinh từ 3 - 6 reviews
  const reviews = [];

  for (let i = 0; i < reviewCount; i++) {
    const item = comments[Math.floor(Math.random() * comments.length)];
    const randomUser = `Khách du lịch ${Math.floor(Math.random() * 500) + 100}`;
    const avatar = userAvatars[i % userAvatars.length];

    // Tạo replies phản hồi cho một số review
    const replies = [];
    if (i === 0) {
      replies.push({
        user_name: `BQL ${locationName}`,
        content: `Cảm ơn bạn đã ghé thăm và gửi đánh giá tích cực cho ${locationName}! Chúc bạn có những chuyến đi tuyệt vời.`,
        created_at: new Date(Date.now() - 3600000 * 2)
      });
    }

    reviews.push({
      user_name: randomUser,
      avatar: avatar,
      rating: item.rate,
      content: item.text,
      created_at: new Date(Date.now() - Math.floor(Math.random() * 1000000000)),
      replies: replies
    });
  }

  return reviews;
};

// Hàm nạp dữ liệu Seed
const seedDB = async () => {
  try {
    // 1. Dọn dẹp CSDL cũ
    await Location.deleteMany({});
    console.log('🗑️  Đã xóa sạch dữ liệu cũ trong Collection locations.');

    // 2. Chuẩn hóa dữ liệu sang chuẩn GeoJSON & tính Rating
    const formattedLocations = rawLocations.map(item => {
      const reviews = generateRandomReviews(item.name);
      const totalReviews = reviews.length;
      const sumRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      const ratingAvg = parseFloat((sumRating / totalReviews).toFixed(1));

      const imgs = categoryImages[item.category] || categoryImages.Default;

      return {
        custom_id: item.custom_id,
        name: item.name,
        category: item.category,
        city: item.city,
        address: `${item.name}, ${item.city}`,
        description: `Điểm đến du lịch hấp dẫn hàng đầu tại ${item.city}. Nơi lưu giữ nét đẹp văn hóa, cảnh quan ấn tượng thu hút đông đảo du khách trong và ngoài nước.`,
        price_range: item.category === 'Beach' || item.category === 'Pagoda' ? 'BUDGET' : (item.category === 'Landmark' ? 'MODERATE' : 'LUXURY'),
        images: imgs,
        location: {
          type: 'Point',
          coordinates: [parseFloat(item.lng), parseFloat(item.lat)] // [Longitude, Latitude]
        },
        rating_avg: ratingAvg,
        total_reviews: totalReviews,
        reviews: reviews
      };
    });

    // 3. Nạp vào MongoDB
    await Location.insertMany(formattedLocations);
    console.log(`🎉 NẠP THÀNH CÔNG ${formattedLocations.length} BẢN GHI CHUẨN GEOJSON & REVIEWS VÀO MONGODB!`);

    // 4. Ngắt kết nối DB
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Lỗi trong quá trình Seed Data:', error);
    mongoose.connection.close();
  }
};

// Chạy hàm seed
seedDB();