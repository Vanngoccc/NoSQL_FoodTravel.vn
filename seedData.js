const mongoose = require('mongoose');
const Location = require('./models/Location');
const rawLocations = require('./locationsData');

mongoose.connect('mongodb://127.0.0.1:27017/nosql_locations_db')
  .then(() => console.log('✅ Đã kết nối thành công tới MongoDB!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Từ điển ảnh chuẩn hóa sát thực tế từng loại hình tại Việt Nam
const realisticImages = {
  // Bãi biển
  Beach: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&auto=format&fit=crop'
  ],
  // Di tích, Cầu, Biểu tượng đô thị
  Landmark: [
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&auto=format&fit=crop', // Cầu Vàng / Đà Nẵng
    'https://images.unsplash.com/photo-1528127269322-539801943592?w=800&auto=format&fit=crop', // Việt Nam phong cảnh
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&auto=format&fit=crop'
  ],
  // Đền, Chùa, Di tích tâm linh
  Pagoda: [
    'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&auto=format&fit=crop'
  ],
  // Chợ & Mua sắm
  Market: [
    'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop'
  ],
  // Bảo tàng & Văn hóa
  Museum: [
    'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800&auto=format&fit=crop'
  ],
  // Khu vui chơi giải trí & Điểm tham quan
  Attraction: [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop'
  ],
  // Công viên cây xanh
  Park: [
    'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop'
  ],
  // Trường Đại học & Giáo dục
  Education: [
    'https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop'
  ],
  // Bệnh viện & Y tế
  Hospital: [
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&auto=format&fit=crop'
  ],
  // Sân bay, Nhà ga, Bến xe
  Transport: [
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop'
  ],
  // Tòa nhà cao ốc & Trung tâm thương mại
  Mall: [
    'https://images.unsplash.com/photo-1567449303078-57ad995bd301?w=800&auto=format&fit=crop'
  ],
  Building: [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop'
  ],
  Culture: [
    'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800&auto=format&fit=crop'
  ],
  Stadium: [
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop'
  ]
};

// Hàm sinh danh sách review
const generateRandomReviews = (locationName) => {
  const comments = [
    { text: 'Địa điểm rất đẹp, không khí trong lành, đáng để ghé thăm trải nghiệm!', rate: 5 },
    { text: 'Phong cảnh tuyệt vời nhưng cuối tuần khá đông. Nên ghé sớm để thuận tiện tham quan.', rate: 4 },
    { text: 'Trải nghiệm rất tốt, không gian sạch sẽ, vị trí dễ tìm.', rate: 5 },
    { text: 'Dịch vụ chu đáo, chi phí hợp lý, phù hợp đi cùng gia đình và bạn bè.', rate: 4 },
    { text: 'Không gian thoáng đãng, cảnh quan được gìn giữ cẩn thận. Rất hài lòng!', rate: 5 }
  ];

  const userAvatars = [
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100'
  ];

  const reviewCount = Math.floor(Math.random() * 4) + 3;
  const reviews = [];

  for (let i = 0; i < reviewCount; i++) {
    const item = comments[Math.floor(Math.random() * comments.length)];
    const randomUser = `Thành viên ${Math.floor(Math.random() * 500) + 100}`;
    const avatar = userAvatars[i % userAvatars.length];

    const replies = [];
    if (i === 0) {
      replies.push({
        user_name: `Ban quản lý ${locationName}`,
        content: `Cảm ơn bạn đã ghé thăm và gửi đánh giá tích cực cho ${locationName}! Chúc bạn luôn có những chuyến đi ý nghĩa.`,
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

// Mô tả phù hợp từng loại hình
const getRealisticDescription = (item) => {
  switch (item.category) {
    case 'Beach':
      return `Bãi biển tự nhiên tuyệt đẹp tại ${item.city} với bãi cát trải dài và làn nước trong xanh, là điểm đến lý tưởng để nghỉ mát và tắm biển.`;
    case 'Landmark':
      return `Công trình kiến trúc biểu tượng mang dấu ấn lịch sử và hiện đại tại ${item.city}, thu hút đông đảo du khách ghé thăm check-in.`;
    case 'Pagoda':
      return `Ngôi chùa thanh tịnh và cổ kính tại ${item.city}, nơi du khách và người dân tìm về chiêm bái, cầu an lành.`;
    case 'Market':
      return `Khu chợ sầm uất mang đậm nét văn hóa mua sắm và ẩm thực truyền thống địa phương tại ${item.city}.`;
    case 'Museum':
      return `Bảo tàng lưu giữ nhiều hiện vật và tư liệu lịch sử, nghệ thuật quý giá tại ${item.city}.`;
    case 'Park':
      return `Không gian xanh mát lý tưởng cho các hoạt động vui chơi dã ngoại, thể dục và thư giãn tại ${item.city}.`;
    case 'Education':
      return `Cơ sở giáo dục đại học danh tiếng tại ${item.city} với khuôn viên rộng rãi và bề dày truyền thống đào tạo.`;
    case 'Hospital':
      return `Cơ sở y tế chất lượng cao hàng đầu tại ${item.city}, phục vụ khám chữa bệnh cho người dân địa phương và các khu vực lân cận.`;
    case 'Transport':
      return `Đầu mối giao thông vận tải quan trọng kết nối ${item.city} với các tỉnh thành trên cả nước và quốc tế.`;
    default:
      return `Điểm đến nổi tiếng thu hút nhiều du khách trong và ngoài nước khi ghé thăm ${item.city}.`;
  }
};

const seedDB = async () => {
  try {
    await Location.deleteMany({});
    console.log('🗑️  Đã dọn sạch CSDL cũ.');

    const formattedLocations = rawLocations.map(item => {
      const reviews = generateRandomReviews(item.name);
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

    await Location.insertMany(formattedLocations);
    console.log(`🎉 CHUẨN HÓA THÀNH CÔNG ${formattedLocations.length} ĐỊA ĐIỂM KÈM ẢNH THỰC TẾ VÀO MONGODB!`);
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Lỗi Seed Data:', error);
    mongoose.connection.close();
  }
};

seedDB();