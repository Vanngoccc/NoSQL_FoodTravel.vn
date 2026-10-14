const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nosql_locations_db';

const reviewers = [
  { name: 'Huỳnh Văn Ngọc', email: 'vanngoc@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', bio: 'Trưởng nhóm đồ án NoSQL Đề tài 04 - Đam mê khám phá ẩm thực ba miền và du lịch phượt.' },
  { name: 'Lê Hoàng Long', email: 'hoanglong.le@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', bio: 'Food reviewer kỳ cựu với hơn 100 bài đánh giá ẩm thực Đà Nẵng và miền Trung.' },
  { name: 'Phạm Minh Tuấn', email: 'minhtuan.pham@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150', bio: 'Nhiếp ảnh gia đường phố và reviewer ẩm thực Hà Nội xưa.' },
  { name: 'Vũ Mai Linh', email: 'mailinh.vu@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'Yêu thích du lịch trải nghiệm, khám phá các quán cafe view đẹp và di tích lịch sử.' },
  { name: 'Bùi Phương Thảo', email: 'phuongthao.bui@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', bio: 'Travel blogger chuyên review resort, bãi biển và các danh lam thắng cảnh Việt Nam.' },
  { name: 'Hoàng Bảo Ngọc', email: 'baongoc.hoang@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', bio: 'Khám phá ẩm thực Sài Gòn và các hẻm ăn vặt nổi tiếng.' },
  { name: 'Ngô Thanh Sơn', email: 'thanhson.ngo@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', bio: 'Phượt thủ đam mê những cung đường đèo hiểm trở và cắm trại thiên nhiên.' },
  { name: 'Nguyễn Thành Nam', email: 'thanhnam.nguyen@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', bio: 'Reviewer công tâm, chuyên chấm điểm vệ sinh và chất lượng dịch vụ nhà hàng.' },
  { name: 'Trần Thu Trang', email: 'thutrang.tran@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', bio: 'Tín đồ ẩm thực truyền thống, thích săn lùng các món ngon gia truyền.' },
  { name: 'Đỗ Gia Huy', email: 'giahuy.do@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150', bio: 'Hướng dẫn viên du lịch tự do, chia sẻ các địa điểm check-in không mất phí.' },
  { name: 'Đặng Quốc Việt', email: 'quocviet.dang@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', bio: 'Đam mê khám phá các hang động, núi non hùng vĩ và bãi biển nguyên sơ.' },
  { name: 'Dương Thúy Hằng', email: 'thuyhang.duong@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', bio: 'Yêu thích nghệ thuật, bảo tàng và các không gian văn hóa di sản.' },
  { name: 'Thanh Trúc', email: 'thanhtruc@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', bio: 'Blogger du lịch tự do, yêu thích các bãi biển miền Trung và quán cafe view biển.' },
  { name: 'Minh Tuấn', email: 'minhtuan@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150', bio: 'Nhiếp ảnh gia phong cảnh và reviewer ẩm thực đường phố.' },
  { name: 'Lan Anh Foodie', email: 'lananh@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', bio: 'Chuyên gia săn lùng các quán ăn ngon - bổ - rẻ trên khắp mọi nẻo đường.' },
  { name: 'Hoàng Long Travel', email: 'hoanglong@foodtravel.vn', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', bio: 'Hướng dẫn viên du lịch chuyên nghiệp, chia sẻ kinh nghiệm check-in thực tế.' }
];

// Tạo thêm các thành viên cộng đồng khác để quy mô cộng đồng đạt 50+ thành viên thực tế trong MongoDB
const hoList = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const demList = ['Văn', 'Thị', 'Đức', 'Quốc', 'Thanh', 'Hữu', 'Ngọc', 'Minh', 'Thành', 'Hải', 'Gia', 'Xuân'];
const tenList = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hà', 'Hải', 'Hậu', 'Hiếu', 'Hoà', 'Huy', 'Khoa', 'Linh', 'Long', 'Mai', 'Nam', 'Nghĩa', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Thảo', 'Thịnh', 'Trang', 'Trí', 'Trung', 'Tú', 'Tuấn', 'Uyên', 'Việt', 'Vinh', 'Yến'];
const bios = [
  'Đam mê du lịch bụi và khám phá ẩm thực đường phố.',
  'Thích chụp ảnh phong cảnh và thưởng thức cafe ngắm phố phường.',
  'Thành viên tích cực cộng đồng FoodTravel.vn.',
  'Chuyên săn lùng quán ăn ngon theo tiêu chí ngon bổ rẻ.',
  'Yêu biển đảo Việt Nam và những cung đường phượt Tây Bắc.',
  'Luôn tìm kiếm những địa điểm check-in độc lạ ít người biết.'
];
const avatars = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150'
];

async function seedUsers() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB...');

  // Upsert danh sách reviewers chính
  for (const r of reviewers) {
    await User.findOneAndUpdate(
      { email: r.email },
      {
        $set: {
          name: r.name,
          email: r.email,
          avatar: r.avatar,
          bio: r.bio,
          password: 'password123'
        }
      },
      { upsert: true, new: true }
    );
  }
  console.log('Synchronized all 16 reviewer accounts!');

  // Bổ sung thêm thành viên cộng đồng để đạt tổng cộng 60 thành viên trong MongoDB
  let currentCount = await User.countDocuments();
  let idx = 1;
  while (currentCount < 60) {
    const ho = hoList[Math.floor(Math.random() * hoList.length)];
    const dem = demList[Math.floor(Math.random() * demList.length)];
    const ten = tenList[Math.floor(Math.random() * tenList.length)];
    const fullName = `${ho} ${dem} ${ten}`;
    const email = `member_${idx}@foodtravel.vn`;
    const avatar = avatars[idx % avatars.length];
    const bio = bios[idx % bios.length];

    try {
      await User.create({
        name: fullName,
        email: email,
        password: 'password123',
        avatar: avatar,
        bio: bio
      });
      currentCount++;
    } catch (e) {
      // trùng email bỏ qua
    }
    idx++;
  }

  const finalCount = await User.countDocuments();
  console.log(`Hoàn tất! Tổng số thành viên hiện có trong MongoDB: ${finalCount}`);
  process.exit(0);
}

seedUsers();
