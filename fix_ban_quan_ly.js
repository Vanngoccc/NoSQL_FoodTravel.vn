const mongoose = require('mongoose');

const communityRepliers = [
  { name: 'Minh Quân Foodie', comment: 'Mình cũng vừa ghé đây tuần rồi, công nhận đồ ăn và cảnh sắc ở đây chụp ảnh siêu đẹp luôn!' },
  { name: 'Ngọc Hân Travel', comment: 'Review chuẩn quá bạn ơi, cho mình hỏi thêm buổi tối ở đây có đông lắm không bạn?' },
  { name: 'Hoàng Long', comment: 'Địa điểm này đúng là điểm dừng chân lý tưởng, đồ ăn hợp khẩu vị mà giá cả cũng hợp lý nữa.' },
  { name: 'Thu Thảo', comment: 'Cảm ơn bài review rất chi tiết của bạn nhé, mình sẽ lưu lại để đi cùng gia đình vào cuối tuần này!' },
  { name: 'Gia Huy', comment: 'Góc chụp này đỉnh quá bạn ơi, nhìn ảnh là muốn xách balo lên và đi ngay!' }
];

async function fix() {
  await mongoose.connect('mongodb://127.0.0.1:27017/nosql_locations_db');
  console.log('Connected to MongoDB');

  const locationsCol = mongoose.connection.collection('locations');
  const diadiemCol = mongoose.connection.collection('diadiem');

  for (const col of [locationsCol, diadiemCol]) {
    const cursor = col.find({ 'reviews.replies.user_name': { $regex: 'Ban qu' } });
    let count = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      let modified = false;
      if (doc.reviews && Array.isArray(doc.reviews)) {
        doc.reviews.forEach((rev, rIdx) => {
          if (rev.replies && Array.isArray(rev.replies)) {
            rev.replies.forEach((rep, repIdx) => {
              if (rep.user_name && rep.user_name.includes('Ban qu')) {
                const pick = communityRepliers[(rIdx + repIdx) % communityRepliers.length];
                rep.user_name = pick.name;
                rep.content = pick.comment;
                modified = true;
              }
            });
          }
        });
      }
      if (modified) {
        await col.updateOne({ _id: doc._id }, { $set: { reviews: doc.reviews } });
        count++;
      }
    }
    console.log(`Updated ${count} docs in collection ${col.collectionName}`);
  }

  await mongoose.disconnect();
  console.log('Done fixing Ban quan ly!');
}

fix().catch(console.error);
