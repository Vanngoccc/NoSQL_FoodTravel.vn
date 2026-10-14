const mongoose = require('mongoose');
const Location = require('./models/Location');

const reviewerPool = [
  { name: 'Huỳnh Văn Ngọc', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
  { name: 'Thanh Trúc', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
  { name: 'Minh Tuấn', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100' },
  { name: 'Lan Anh Foodie', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
  { name: 'Hoàng Long Travel', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
  { name: 'Nguyễn Thành Nam', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
  { name: 'Trần Thu Trang', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' },
  { name: 'Vũ Mai Linh', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100' },
  { name: 'Đỗ Gia Huy', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100' },
  { name: 'Bùi Phương Thảo', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100' },
  { name: 'Đặng Quốc Việt', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100' },
  { name: 'Dương Thúy Hằng', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }
];

// Hàm sinh bộ review chuyên biệt theo từng địa điểm cụ thể
function getReviewsForLocation(loc) {
  const name = loc.name;
  const cat = loc.category;
  const city = loc.city;
  const reviews = [];

  // Helper để lấy ngẫu nhiên reviewer
  const getReviewer = (idx) => reviewerPool[idx % reviewerPool.length];

  // 1. CẦU RỒNG & CÁC CÂY CẦU (Bridges / Landmarks)
  if (name.includes('Cầu Rồng')) {
    reviews.push(
      {
        user_name: 'Huỳnh Văn Ngọc',
        rating: 5,
        content: 'Biểu tượng tự hào của Đà Nẵng! Tối thứ 7 và Chủ nhật đúng 21h rồng phun lửa rồi phun nước cực kỳ hoành tráng. Nên đến sớm tầm 20h30 để chọn chỗ đứng dưới chân cầu hoặc bờ kè đường Bạch Đằng hóng gió và quay video nhé.',
        reply: 'Đúng luôn bạn ơi, nhớ mang theo ô hoặc áo mưa mỏng đề phòng gió tạt nước lúc Rồng phun nước nha!'
      },
      {
        user_name: 'Thanh Trúc',
        rating: 5,
        content: 'Buổi tối cầu đổi màu đèn LED liên tục phản chiếu xuống sông Hàn lung linh huyền ảo. Đi dạo bộ dọc cầu gió mát rượi, không khí sôi động với nhiều bạn trẻ chơi nhạc đường phố.',
        reply: 'Bờ Đông cầu còn có bến du thuyền và tượng cá chép hóa rồng check-in cực đỉnh luôn đó chị!'
      },
      {
        user_name: 'Minh Tuấn',
        rating: 5,
        content: 'Góc chụp ảnh đẹp nhất là từ bến thuyền DHC Marina hoặc trên du thuyền sông Hàn nhìn sang. Kiến trúc mô phỏng rồng thời Lý vươn ra biển Đông rất độc đáo và giàu ý nghĩa.',
      },
      {
        user_name: 'Hoàng Long Travel',
        rating: 5,
        content: 'Khách du lịch nào đến Đà Nẵng cũng phải ghé Cầu Rồng ít nhất một lần. Xung quanh rất nhiều quán trà chanh, kem bơ và hải sản tươi ngon phục vụ đêm.',
      },
      {
        user_name: 'Lan Anh Foodie',
        rating: 4,
        content: 'Cuối tuần đông nghịt người luôn, nhưng không khí rất náo nhiệt và vui tươi. Thành phố cấm xe qua cầu lúc rồng phun lửa nên đi bộ xem rất an toàn.',
      }
    );
  } else if (name.includes('Cầu Sông Hàn')) {
    reviews.push(
      {
        user_name: 'Hoàng Long Travel',
        rating: 5,
        content: 'Cây cầu quay đầu tiên tại Việt Nam do chính kỹ sư và người dân Đà Nẵng chung sức xây dựng. Xem cầu quay lúc 23h cuối tuần là trải nghiệm cực kỳ thú vị và đậm chất hoài niệm.',
        reply: 'Ngồi uống cà phê dọc đường Bạch Đằng canh giờ cầu quay gió thổi lồng lộng chill hết nấc!'
      },
      {
        user_name: 'Nguyễn Thành Nam',
        rating: 5,
        content: 'Cầu quay nối đôi bờ sông Hàn, ban đêm hệ thống đèn chiếu sáng nghệ thuật rất đẹp. Rất thích hợp cho các buổi tản bộ hóng gió đêm mát lành.',
      },
      {
        user_name: 'Trần Thu Trang',
        rating: 4,
        content: 'Địa điểm check-in lâu năm nhưng vẫn giữ nguyên sức hút. Bạn nên đi bộ trên cầu vào hoàng hôn để ngắm trọn cảnh sắc yên bình của thành phố.',
      }
    );
  } else if (name.includes('Cầu Tình Yêu')) {
    reviews.push(
      {
        user_name: 'Thanh Trúc',
        rating: 5,
        content: 'Địa điểm siêu lãng mạn cho các cặp đôi! Cột đèn lồng hình trái tim đỏ rực rỡ và những ổ khóa tình yêu khắc tên hai người. Đứng đây ngắm trọn vẹn Cầu Rồng và sông Hàn.',
        reply: 'Ổ khóa ở đây có bán ngay đầu cầu, giá từ 70k - 150k được khắc tên miễn phí kỷ niệm nữa đó bạn.'
      },
      {
        user_name: 'Đặng Quốc Việt',
        rating: 5,
        content: 'Ngay cạnh tượng Cá Chép Hóa Rồng phun nước. Buổi tối lên đèn rực rỡ sắc màu, chụp hình sống ảo góc nào cũng xinh lung linh.',
      },
      {
        user_name: 'Vũ Mai Linh',
        rating: 4,
        content: 'Không gian rất thơ mộng, cuối tuần các bạn trẻ tụ họp đông vui. Ngồi nhâm nhi cà phê trên du thuyền DHC bên cạnh ngắm cảnh cũng rất tuyệt.',
      }
    );
  } else if (name.includes('Cầu Thuận Phước') || name.includes('Cầu Trần Thị Lý') || name.includes('Cầu Long Biên') || name.includes('Cầu Nhật Tân') || name.includes('Cầu Thủ Thiêm') || name.includes('Cầu Ba Son') || (cat === 'Landmark' && name.includes('Cầu'))) {
    reviews.push(
      {
        user_name: 'Minh Tuấn',
        rating: 5,
        content: `Kiến trúc hiện đại và hùng vĩ, vắt ngang dòng sông tuyệt đẹp. Buổi chiều tà ngắm hoàng hôn buông xuống hoặc ngắm cảnh thành phố lên đèn từ trên cầu đẹp đến nao lòng.`,
        reply: 'Gió sông thổi mát rượi, góc máy chụp bao quát toàn cảnh thành phố cực kỳ chất lượng.'
      },
      {
        user_name: 'Nguyễn Thành Nam',
        rating: 5,
        content: `Điểm ngắm cảnh và hóng mát lý tưởng của người dân địa phương. Đường đi thông thoáng, hệ thống đèn chiếu sáng về đêm hiện đại và ấn tượng.`,
      },
      {
        user_name: 'Dương Thúy Hằng',
        rating: 4,
        content: `Cây cầu mang tính biểu tượng nối liền các khu đô thị sầm uất. Không khí buổi tối rất dễ chịu, thích hợp dừng chân ngắm cảnh và chụp ảnh lưu niệm.`,
      }
    );
  }
  // 2. BÃI BIỂN (Beach)
  else if (cat === 'Beach' || name.includes('Bãi biển') || name.includes('Mỹ Khê') || name.includes('Phạm Văn Đồng')) {
    reviews.push(
      {
        user_name: 'Thanh Trúc',
        rating: 5,
        content: 'Bãi biển nằm trong top quyến rũ nhất hành tinh quả không sai! Bãi cát trắng mịn thoai thoải, nước biển trong vắt nhìn thấy cả đáy, sóng êm ả tắm rất an toàn.',
        reply: 'Lực lượng cứu hộ bãi biển túc trực liên tục từ sáng sớm đến chiều muộn nên tắm biển cực kỳ yên tâm!'
      },
      {
        user_name: 'Huỳnh Văn Ngọc',
        rating: 5,
        content: 'Trải nghiệm ngắm bình minh trên biển lúc 5h sáng tuyệt đẹp không gì sánh bằng. Không khí trong lành, có thể thuê ván chèo SUP hoặc tắm biển nước ấm áp sảng khoái.',
      },
      {
        user_name: 'Hoàng Long Travel',
        rating: 5,
        content: 'Bờ biển sạch sẽ, dịch vụ tắm tráng và gửi đồ rất quy củ với giá niêm yết rõ ràng. Dọc đường Võ Nguyên Giáp có rất nhiều nhà hàng hải sản tươi sống giá cả phải chăng.',
      },
      {
        user_name: 'Bùi Phương Thảo',
        rating: 4,
        content: 'Biển đẹp tuyệt trần, nước mát lạnh giải nhiệt mùa hè. Buổi chiều người dân và du khách tắm rất đông, không khí vui tươi rộn rã khắp bờ biển.',
      }
    );
  }
  // 3. CHÙA CHIỀN & TÂM LINH (Pagoda / Culture)
  else if (cat === 'Pagoda' || name.includes('Chùa') || name.includes('Đền') || name.includes('Linh Ứng')) {
    reviews.push(
      {
        user_name: 'Huỳnh Văn Ngọc',
        rating: 5,
        content: `Ngôi chùa tôn nghiêm và thanh tịnh. Cảnh quan thoáng đãng hòa quyện cùng thiên nhiên, hướng nhìn ra trời biển bao la giúp tâm hồn an nhiên, thanh thản.`,
        reply: 'Khuôn viên chùa giữ gìn rất trang nghiêm, du khách nhớ mặc trang phục lịch sự, kín đáo khi vào chiêm bái nhé.'
      },
      {
        user_name: 'Lan Anh Foodie',
        rating: 5,
        content: `Kiến trúc cổ kính đậm đà bản sắc tâm linh Việt Nam. Tượng Phật uy nghi, khuôn viên rợp bóng cây xanh và tiếng chuông chùa ngân vang trầm ấm xua tan mọi âu lo đời thường.`,
      },
      {
        user_name: 'Đặng Quốc Việt',
        rating: 5,
        content: `Nơi chiêm bái cầu bình an, may mắn cho gia đình và người thân. Không gian thanh tịnh, quang cảnh nhìn từ trên cao xuống thành phố rất ngoạn mục.`,
      },
      {
        user_name: 'Trần Thu Trang',
        rating: 4,
        content: `Chùa rất linh thiêng, cây cảnh và hoa tươi được chăm sóc chu đáo. Dịp lễ Tết hay rằm khá đông người hành hương nhưng trật tự và vệ sinh rất tốt.`,
      }
    );
  }
  // 4. CHỢ TRUYỀN THỐNG & ẨM THỰC ĐƯỜNG PHỐ (Market)
  else if (cat === 'Market' || name.includes('Chợ')) {
    reviews.push(
      {
        user_name: 'Lan Anh Foodie',
        rating: 5,
        content: `Thiên đường ẩm thực đường phố đích thực! Vô vàn món ngon đặc sản hấp dẫn như bánh bèo nậm lọc, bún mắm nêm, ram cuốn cải, ốc hút, bánh xèo giòn rụm với giá bình dân học sinh sinh viên.`,
        reply: 'Quầy bán đặc sản chả bò, tré và các loại hải sản khô đóng gói hút chân không làm quà mang về cũng rất uy tín nữa!'
      },
      {
        user_name: 'Huỳnh Văn Ngọc',
        rating: 5,
        content: `Chợ sầm uất, nhộn nhịp mang đậm nét văn hóa bản địa. Đi dạo quanh khu ẩm thực mùi thơm nức mũi, các cô bán hàng xởi lởi, hiếu khách đúng chất con người miền Trung/Việt Nam.`,
      },
      {
        user_name: 'Thanh Trúc',
        rating: 4,
        content: `Nhiều món ăn ngon khó cưỡng. Nên chuẩn bị chiếc bụng đói khi ghé chợ nhé! Giá cả đồ ăn uống niêm yết rõ ràng, nếu mua quần áo hay quà lưu niệm thì nhớ mặc cả chút xíu là được.`,
      },
      {
        user_name: 'Nguyễn Thành Nam',
        rating: 5,
        content: `Vị trí trung tâm dễ tìm. Ghé đây ăn chè sầu hoặc sinh tố bơ mát lạnh tráng miệng sau khi càn quét các món mặn là chuẩn bài combo du lịch.`,
      }
    );
  }
  // 5. BẢO TÀNG & DI TÍCH LỊCH SỬ (Museum / Culture)
  else if (cat === 'Museum' || name.includes('Bảo tàng') || name.includes('Hỏa Lò') || name.includes('Dinh Độc Lập')) {
    reviews.push(
      {
        user_name: 'Minh Tuấn',
        rating: 5,
        content: `Điểm đến lịch sử và văn hóa vô cùng giá trị! Nơi lưu giữ hàng ngàn hiện vật quý giá được bài trí khoa học, hệ thống bảng giới thiệu song ngữ rõ ràng và thuyết minh viên truyền cảm, sâu sắc.`,
        reply: 'Rất nên thuê thiết bị Audio Guide (thuyết minh tự động) hoặc đăng ký tour thuyết minh viên để hiểu sâu sắc từng câu chuyện lịch sử nhé bạn!'
      },
      {
        user_name: 'Vũ Mai Linh',
        rating: 5,
        content: `Mỗi góc trưng bày đều chứa đựng câu chuyện lịch sử hào hùng và xúc động của dân tộc. Không gian yên tĩnh, mát mẻ, giáo dục truyền thống rất tốt cho thế hệ trẻ.`,
      },
      {
        user_name: 'Hoàng Long Travel',
        rating: 5,
        content: `Kiến trúc tòa nhà cổ kính, khuôn viên rợp bóng mát. Vé vào cổng giá rất mềm, có nhiều góc chụp ảnh đậm nét hoài cổ và mang tính nghệ thuật cao.`,
      },
      {
        user_name: 'Đỗ Gia Huy',
        rating: 4,
        content: `Trải nghiệm mang lại nhiều cảm xúc và tri thức bổ ích. Bạn nên dành ít nhất 1.5 đến 2 tiếng để tham quan trọn vẹn các gian trưng bày.`,
      }
    );
  }
  // 6. TÒA NHÀ CAO TẦNG & TTTM (Building / Mall)
  else if (cat === 'Building' || cat === 'Mall' || name.includes('Landmark') || name.includes('Bitexco') || name.includes('Vincom') || name.includes('Mall') || name.includes('Lotte') || name.includes('Keangnam')) {
    reviews.push(
      {
        user_name: 'Đỗ Gia Huy',
        rating: 5,
        content: `Biểu tượng phát triển hiện đại và năng động của thành phố! Tầm nhìn từ trên đài quan sát ngắm toàn cảnh sông nước và phố thị trải dài tới tận chân trời cực kỳ choáng ngợp.`,
        reply: 'Nên lên đài quan sát vào khung giờ 17h30 để đón cả khoảnh khắc hoàng hôn rực rỡ lẫn cảnh thành phố rực sáng ánh đèn đêm!'
      },
      {
        user_name: 'Trần Thu Trang',
        rating: 5,
        content: `Khu trung tâm thương mại sang trọng, tích hợp đầy đủ mua sắm, ẩm thực quốc tế, rạp chiếu phim và sân trượt băng/thủy cung. Điều hòa mát rượi, dạo chơi cả ngày không chán.`,
      },
      {
        user_name: 'Lan Anh Foodie',
        rating: 4,
        content: `Tổ hợp vui chơi giải trí hiện đại, sạch sẽ và an ninh tốt. Rất nhiều nhà hàng cà phê view xịn sò để gặp gỡ bạn bè hoặc chụp ảnh kỷ niệm.`,
      }
    );
  }
  // 7. CÔNG VIÊN & KHU DU LỊCH SINH THÁI (Park / Attraction: Bà Nà, Sơn Trà, Ngũ Hành Sơn, Đầm Sen, Suối Tiên...)
  else if (cat === 'Park' || cat === 'Attraction' || name.includes('Công viên') || name.includes('Bà Nà') || name.includes('Sơn Trà') || name.includes('Ngũ Hành Sơn') || name.includes('Thảo Cầm Viên') || name.includes('Hồ Hoàn Kiếm') || name.includes('Phố đi bộ')) {
    reviews.push(
      {
        user_name: 'Huỳnh Văn Ngọc',
        rating: 5,
        content: `Cảnh quan thiên nhiên kỳ vĩ và không khí mát lành sảng khoái. Không gian rộng lớn với nhiều góc check-in tuyệt đẹp, rất thích hợp cho chuyến dã ngoại cuối tuần cùng bạn bè và gia đình.`,
        reply: 'Đi buổi sáng sớm không khí trong veo, trời nắng dịu chụp ảnh lên màu cực kỳ tươi tắn luôn bạn ơi!'
      },
      {
        user_name: 'Thanh Trúc',
        rating: 5,
        content: `Khung cảnh non nước hữu tình, cây xanh rợp bóng mát rượi. Trải nghiệm leo núi, khám phá hang động hoặc tản bộ hóng gió ngắm thành phố từ trên cao rất thư thái và sảng khoái.`,
      },
      {
        user_name: 'Hoàng Long Travel',
        rating: 5,
        content: `Dịch vụ chuyên nghiệp, nhân viên hướng dẫn thân thiện nhiệt tình. Điểm đến nổi tiếng không thể bỏ qua khi du lịch khám phá cảnh đẹp Việt Nam.`,
      },
      {
        user_name: 'Minh Tuấn',
        rating: 4,
        content: `Địa điểm vui chơi, thư giãn lý tưởng sau những ngày làm việc bận rộn. Cảnh quan được đầu tư chăm sóc sạch đẹp, nhiều tiểu cảnh hoa rực rỡ sắc màu.`,
      }
    );
  }
  // 8. BỆNH VIỆN (Hospital)
  else if (cat === 'Hospital' || name.includes('Bệnh viện')) {
    reviews.push(
      {
        user_name: 'Bùi Phương Thảo',
        rating: 5,
        content: `Cơ sở y tế đầu ngành với đội ngũ y bác sĩ chuyên môn cao, giàu kinh nghiệm và tận tâm với người bệnh. Trang thiết bị máy móc chẩn đoán hiện đại, phòng khám khang trang, sạch sẽ.`,
        reply: 'Bệnh viện hiện đã triển khai đăng ký khám bệnh online và thanh toán qua app/thẻ rất nhanh chóng, tiết kiệm thời gian chờ đợi.'
      },
      {
        user_name: 'Đặng Quốc Việt',
        rating: 5,
        content: `Quy trình khám chữa bệnh khoa học, nhân viên tiếp đón và điều dưỡng hướng dẫn bệnh nhân rất chu đáo, ân cần. Khuôn viên bệnh viện rộng rãi và vệ sinh đảm bảo.`,
      },
      {
        user_name: 'Vũ Mai Linh',
        rating: 4,
        content: `Bệnh viện tuyến trung ương nên lượng bệnh nhân đến khám đông, tuy nhiên các y bác sĩ làm việc rất khẩn trương và chuyên nghiệp. Thủ tục bảo hiểm y tế giải quyết nhanh gọn.`,
      }
    );
  }
  // 9. TRƯỜNG ĐẠI HỌC & GIÁO DỤC (Education)
  else if (cat === 'Education' || name.includes('Đại học') || name.includes('Trường')) {
    reviews.push(
      {
        user_name: 'Huỳnh Văn Ngọc',
        rating: 5,
        content: `Ngôi trường đại học danh tiếng với truyền thống đào tạo chất lượng cao. Khuôn viên trường rợp bóng cây xanh, thư viện hiện đại với hàng vạn đầu sách và không gian tự học máy lạnh tiện nghi.`,
        reply: 'Khu tự học và căng-tin sinh viên rất xịn sò, đồ ăn thức uống ngon bổ rẻ đầy đủ năng lượng cho mùa thi cử!'
      },
      {
        user_name: 'Minh Tuấn',
        rating: 5,
        content: `Môi trường học tập năng động, giảng viên nhiệt huyết và giàu chuyên môn thực tế. Các câu lạc bộ sinh viên hoạt động sôi nổi, nhiều sân chơi học thuật và thể thao bổ ích.`,
      },
      {
        user_name: 'Nguyễn Thành Nam',
        rating: 5,
        content: `Hệ thống phòng thí nghiệm và giảng đường trang bị hiện đại. Sinh viên trường năng động, đoàn kết và luôn giữ vững tinh thần đổi mới sáng tạo.`,
      }
    );
  }
  // 10. GIAO THÔNG VẬN TẢI (Transport: Sân bay, Ga tàu, Bến xe)
  else if (cat === 'Transport' || name.includes('Sân bay') || name.includes('Ga') || name.includes('Bến xe')) {
    reviews.push(
      {
        user_name: 'Hoàng Long Travel',
        rating: 5,
        content: `Đầu mối giao thông hiện đại, khang trang và văn minh. Quy trình làm thủ tục nhanh gọn, biển chỉ dẫn rõ ràng song ngữ Anh - Việt, nhân viên hỗ trợ nhiệt tình, lịch sự.`,
        reply: 'Khu vực đón xe taxi và xe công nghệ phân làn quy củ, không có tình trạng chèo kéo khách, trải nghiệm rất thoải mái.'
      },
      {
        user_name: 'Trần Thu Trang',
        rating: 5,
        content: `Nhà ga sạch sẽ, nhiều quầy tiện ích, nhà hàng và khu vực chờ máy lạnh thoáng mát. Wifi tốc độ cao và cổng sạc điện thoại bố trí thuận tiện cho hành khách.`,
      },
      {
        user_name: 'Đỗ Gia Huy',
        rating: 4,
        content: `Đi lại thuận tiện, kết nối giao thông với trung tâm thành phố rất nhanh chóng. Trải nghiệm di chuyển văn minh, an toàn và đúng giờ.`,
      }
    );
  }
  // 11. ĐỊA ĐIỂM VĂN HÓA / MẶC ĐỊNH KHÁC
  else {
    reviews.push(
      {
        user_name: 'Huỳnh Văn Ngọc',
        rating: 5,
        content: `Điểm đến nổi tiếng mang đậm bản sắc văn hóa đặc trưng của ${city}. Cảnh quan đẹp, không khí trong lành, rất đáng để ghé thăm và trải nghiệm khám phá.`,
        reply: 'Nên dành thời gian ghé thăm vào buổi sáng hoặc hoàng hôn để tận hưởng không gian trọn vẹn nhất!'
      },
      {
        user_name: 'Thanh Trúc',
        rating: 5,
        content: `Một trong những địa điểm yêu thích nhất khi du lịch đến ${city}. Dịch vụ chu đáo, con người thân thiện, chắc chắn sẽ còn quay trở lại!`,
      },
      {
        user_name: 'Minh Tuấn',
        rating: 4,
        content: `Không gian thoáng đãng, cảnh quan sạch đẹp và lưu giữ nhiều giá trị văn hóa độc đáo. Rất phù hợp cho các chuyến trải nghiệm cùng gia đình.`,
      }
    );
  }

  // Format các reviews thành schema chuẩn MongoDB
  return reviews.map((item, idx) => {
    const reviewer = getReviewer(idx);
    const replies = [];
    if (item.reply) {
      replies.push({
        user_name: 'FoodTravel Guide',
        content: item.reply,
        created_at: new Date(Date.now() - 3600000 * (idx + 1) * 6)
      });
    }

    return {
      user_name: item.user_name || reviewer.name,
      avatar: reviewer.avatar,
      rating: item.rating,
      content: item.content,
      created_at: new Date(Date.now() - 86400000 * (idx * 3 + 2)),
      replies: replies
    };
  });
}

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/nosql_locations_db');
    console.log('✅ Đã kết nối MongoDB thành công!');

    const locations = await Location.find({});
    console.log(`🔍 Tìm thấy ${locations.length} địa điểm cần cập nhật đánh giá...`);

    let updatedCount = 0;
    for (const loc of locations) {
      const newReviews = getReviewsForLocation(loc);
      const totalReviews = newReviews.length;
      const sumRating = newReviews.reduce((sum, r) => sum + r.rating, 0);
      const ratingAvg = parseFloat((sumRating / totalReviews).toFixed(1));

      loc.reviews = newReviews;
      loc.total_reviews = totalReviews;
      loc.rating_avg = ratingAvg;

      await loc.save();
      updatedCount++;
    }

    console.log(`🎉 ĐÃ CẬP NHẬT THÀNH CÔNG ${updatedCount} ĐỊA ĐIỂM TRONG COLLECTION "diadiem"!`);

    // Đồng bộ sang collection 'locations'
    const db = mongoose.connection.db;
    const allUpdated = await Location.find({}).lean();
    await db.collection('locations').deleteMany({});
    await db.collection('locations').insertMany(allUpdated);
    console.log(`✅ ĐÃ ĐỒNG BỘ ${allUpdated.length} ĐỊA ĐIỂM SANG COLLECTION "locations"!`);

    console.log('✨ Kiểm tra mẫu đánh giá của Cầu Rồng và Chợ Bến Thành:');
    const cauRong = await Location.findOne({ name: /Cầu Rồng/ });
    if (cauRong) {
      console.log(`\n🌉 [${cauRong.name}] (${cauRong.category}) - ${cauRong.total_reviews} reviews:`);
      cauRong.reviews.forEach(r => console.log(`   ⭐ ${r.rating}/5 [${r.user_name}]: ${r.content}`));
    }

    const benThanh = await Location.findOne({ name: /Chợ Bến Thành/ });
    if (benThanh) {
      console.log(`\n🏮 [${benThanh.name}] (${benThanh.category}) - ${benThanh.total_reviews} reviews:`);
      benThanh.reviews.forEach(r => console.log(`   ⭐ ${r.rating}/5 [${r.user_name}]: ${r.content}`));
    }

    const myKhe = await Location.findOne({ name: /Mỹ Khê/ });
    if (myKhe) {
      console.log(`\n🏖️ [${myKhe.name}] (${myKhe.category}) - ${myKhe.total_reviews} reviews:`);
      myKhe.reviews.forEach(r => console.log(`   ⭐ ${r.rating}/5 [${r.user_name}]: ${r.content}`));
    }

    const benhVien = await Location.findOne({ name: /Bệnh viện Bạch Mai/ });
    if (benhVien) {
      console.log(`\n🏥 [${benhVien.name}] (${benhVien.category}) - ${benhVien.total_reviews} reviews:`);
      benhVien.reviews.forEach(r => console.log(`   ⭐ ${r.rating}/5 [${r.user_name}]: ${r.content}`));
    }

    await mongoose.disconnect();
    console.log('\n✅ Hoàn tất toàn bộ quy trình cập nhật đánh giá chuẩn xác!');
  } catch (err) {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  }
if (require.main === module) {
  run();
}

module.exports = { getReviewsForLocation };
