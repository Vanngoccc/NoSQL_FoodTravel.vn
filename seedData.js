const mongoose = require('mongoose');
const Location = require('./models/Location');
const rawLocations = require('./locationsData');

mongoose.connect('mongodb://127.0.0.1:27017/nosql_locations_db')
  .then(() => console.log('✅ Đã kết nối thành công tới MongoDB!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Từ điển ảnh chuẩn hóa sát thực tế từng loại hình tại Việt Nam
const realisticImages = {
  Beach: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&auto=format&fit=crop'
  ],
  Landmark: [
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1528127269322-539801943592?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&auto=format&fit=crop'
  ],
  Pagoda: [
    'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&auto=format&fit=crop'
  ],
  Market: [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&auto=format&fit=crop'
  ],
  Museum: [
    'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800&auto=format&fit=crop'
  ],
  Attraction: [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop'
  ],
  Park: [
    'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop'
  ]
};

// Mảng đánh giá chân thực về ẩm thực và du lịch Việt Nam
const sampleReviewComments = [
  { text: 'Món ăn đậm đà chuẩn vị địa phương, nước dùng thanh ngọt, phục vụ rất nhanh nhẹn!', rate: 5 },
  { text: 'Không gian thoáng mát, cảnh quan đẹp tuyệt vời. Cuối tuần khá đông nên cần đi sớm một chút.', rate: 4 },
  { text: 'Trải nghiệm rất đáng tiền! Đồ ăn ngon, giá cả niêm yết rõ ràng không lo chặt chém.', rate: 5 },
  { text: 'Vị trí thuận tiện, dễ tìm kiếm. Rất thích hợp để dẫn gia đình hoặc bạn bè tới tụ họp cuối tuần.', rate: 5 },
  { text: 'Điểm check-in chụp hình cực kỳ đẹp, đồ uống và món ăn nhẹ giá cả rất hợp lý.', rate: 4 },
  { text: 'Hương vị truyền thống khó quên, phục vụ chu đáo, chắc chắn sẽ còn quay lại nhiều lần nữa.', rate: 5 },
  { text: 'Chất lượng phục vụ tốt, món ăn ra nóng hổi thơm phức. Đánh giá 5 sao không cần bàn cãi!', rate: 5 },
  { text: 'Địa điểm sạch sẽ, văn minh, khung cảnh về đêm lung linh ánh đèn rất lãng mạn.', rate: 4 },
  { text: 'Thực đơn phong phú với nhiều đặc sản ba miền, nguyên liệu tươi ngon.', rate: 5 },
  { text: 'Nhân viên thân thiện, nhiệt tình hướng dẫn khách du lịch các góc chụp ảnh đẹp.', rate: 4 }
];

const reviewerNames = [
  'Nguyễn Thành Nam', 'Trần Thu Trang', 'Lê Hoàng Long', 'Phạm Minh Tuấn', 
  'Vũ Mai Linh', 'Đỗ Gia Huy', 'Bùi Phương Thảo', 'Hoàng Bảo Ngọc',
  'Đặng Quốc Việt', 'Ngô Thanh Sơn', 'Dương Thúy Hằng', 'Phan Đức Anh'
];

const userAvatars = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100'
];

// Hàm sinh danh sách review chuẩn định mức barem: 5 - 15 reviews mỗi địa điểm
const generateReviewsForLocation = (locationName) => {
  // Sinh ngẫu nhiên từ 6 đến 12 reviews (đạt chuẩn định mức 5 - 15 theo barem)
  const count = Math.floor(Math.random() * 7) + 6;
  const reviews = [];

  for (let i = 0; i < count; i++) {
    const item = sampleReviewComments[i % sampleReviewComments.length];
    const authorName = reviewerNames[(i + Math.floor(Math.random() * 3)) % reviewerNames.length];
    const avatar = userAvatars[i % userAvatars.length];

    const replies = [];
    // Phản hồi phân cấp (Replies lồng nhau)
    if (i === 0) {
      replies.push({
        user_name: `Ban quản lý ${locationName}`,
        content: `Cảm ơn bạn ${authorName} đã ghé thăm và gửi đánh giá tích cực! Kính chúc bạn luôn có những chuyến trải nghiệm tuyệt vời.`,
        created_at: new Date(Date.now() - 3600000 * 3)
      });
    }

    reviews.push({
      user_name: authorName,
      avatar: avatar,
      rating: item.rate,
      content: item.text,
      created_at: new Date(Date.now() - Math.floor(Math.random() * 800000000)),
      replies: replies
    });
  }

  return reviews;
};

// Mô tả thực tế
const getRealisticDescription = (item) => {
  switch (item.category) {
    case 'Beach':
      return `Bãi biển tự nhiên tuyệt đẹp tại ${item.city} với bãi cát trắng mịn, nước trong xanh, là điểm đến nghỉ dưỡng và trải nghiệm hải sản tươi sống lý tưởng.`;
    case 'Landmark':
      return `Công trình kiến trúc biểu tượng mang dấu ấn văn hóa lịch sử tại ${item.city}, thu hút đông đảo du khách trong và ngoài nước ghé thăm check-in.`;
    case 'Pagoda':
      return `Ngôi chùa thanh tịnh cổ kính tại ${item.city}, nơi du khách chiêm bái cảnh quan tâm linh và thưởng thức không khí an lành.`;
    case 'Market':
      return `Khu chợ ẩm thực sầm uất mang đậm nét văn hóa vùng miền tại ${item.city}, quy tụ hàng trăm món ăn đường phố đặc sắc.`;
    case 'Museum':
      return `Bảo tàng lưu giữ hiện vật, tư liệu văn hóa nghệ thuật quý giá tại ${item.city}.`;
    case 'Park':
      return `Không gian sinh thái xanh mát lý tưởng cho các hoạt động vui chơi dã ngoại và thư giãn tại ${item.city}.`;
    default:
      return `Điểm đến nổi tiếng thu hút nhiều du khách với ẩm thực và cảnh sắc tuyệt đẹp tại ${item.city}.`;
  }
};

const seedDB = async () => {
  try {
    // 1. Dọn sạch collection diadiem
    await Location.deleteMany({});
    console.log('🗑️  Đã dọn sạch collection diadiem cũ.');

    const formattedLocations = rawLocations.map(item => {
      const reviews = generateReviewsForLocation(item.name);
      const totalReviews = reviews.length;
      const sumRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      const ratingAvg = parseFloat((sumRating / totalReviews).toFixed(1));

      const imgs = realisticImages[item.category] || realisticImages.Landmark;
      const imgSelected = imgs[Math.abs(item.custom_id) % imgs.length];

      return {
        custom_id: item.custom_id,
        name: item.name,
        category: item.category,
        city: item.city,
        address: `${item.name}, ${item.city}`,
        description: getRealisticDescription(item),
        price_range: (item.category === 'Beach' || item.category === 'Pagoda') ? 'BUDGET' : 'MODERATE',
        images: [imgSelected],
        location: {
          type: 'Point',
          coordinates: [parseFloat(item.lng), parseFloat(item.lat)]
        },
        rating_avg: ratingAvg,
        total_reviews: totalReviews,
        reviews: reviews
      };
    });

    // 2. Chèn vào collection diadiem
    await Location.insertMany(formattedLocations);
    console.log(`🎉 NẠP THÀNH CÔNG ${formattedLocations.length} ĐỊA ĐIỂM VÀO COLLECTION "diadiem"!`);

    // 3. Đồng bộ thêm collection "locations" để đảm bảo khả năng tương thích toàn diện
    const db = mongoose.connection.db;
    await db.collection('locations').deleteMany({});
    await db.collection('locations').insertMany(formattedLocations);
    console.log(`✅ ĐÃ ĐỒNG BỘ SONG SONG ${formattedLocations.length} ĐỊA ĐIỂM VÀO CẢ COLLECTION "locations" VÀ "diadiem"!`);

    // 4. Tạo Indexes chuẩn cho collection diadiem
    await db.collection('diadiem').createIndex({ location: '2dsphere' });
    await db.collection('diadiem').createIndex({ name: 'text', description: 'text', category: 'text' });
    await db.collection('diadiem').createIndex({ city: 1, category: 1 });
    await db.collection('diadiem').createIndex({ rating_avg: -1 });

    await db.collection('locations').createIndex({ location: '2dsphere' });
    await db.collection('locations').createIndex({ name: 'text', description: 'text', category: 'text' });
    await db.collection('locations').createIndex({ city: 1, category: 1 });
    await db.collection('locations').createIndex({ rating_avg: -1 });

    console.log('✅ ĐÃ THIẾT LẬP TOÀN BỘ INDEXES (2dsphere, Text Search, Compound, Rating) CHO COLLECTION!');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Lỗi Seed Data:', error);
    mongoose.connection.close();
  }
};

seedDB();