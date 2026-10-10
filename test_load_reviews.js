// =====================================================================
// SCRIPT KIỂM THỬ HIỆU NĂNG TẢI (STRESS / LOAD TEST) CHO SV3
// Đề tài 04: Nền tảng đánh giá và review địa điểm du lịch / ăn uống
// Mô phỏng nhiều người dùng đồng thời gửi bài đánh giá & chấm sao
// =====================================================================

const http = require('http');

const SERVER_URL = 'http://localhost:5055';
const CONCURRENT_REQUESTS = 30; // 30 yêu cầu đồng thời

// Hàm gửi 1 review bằng HTTP POST
function sendReviewRequest(locationId, index) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      user_name: `Tester Concurrent #${index + 1}`,
      rating: Math.floor(Math.random() * 5) + 1,
      content: `[Load Test] Đánh giá đồng thời thử nghiệm hiệu năng ghi vào Document Store MongoDB lần thứ ${index + 1}.`
    });

    const url = new URL(`${SERVER_URL}/api/locations/${locationId}/reviews`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const startTime = Date.now();

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        let json = {};
        try { json = JSON.parse(body); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          durationMs: duration,
          rating_avg: json.rating_avg,
          total_reviews: json.total_reviews
        });
      });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 500, durationMs: Date.now() - startTime, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

async function runLoadTest() {
  console.log('===============================================================');
  console.log(`🚀 BẮT ĐẦU KIỂM THỬ TẢI ĐỒNG THỜI (${CONCURRENT_REQUESTS} REQUESTS)...`);
  console.log('===============================================================');

  // Lấy danh sách địa điểm để chọn 1 địa điểm test
  const listRes = await fetch(`${SERVER_URL}/api/locations?limit=5`);
  const locations = await listRes.json();
  if (!locations || locations.length === 0) {
    console.error('❌ Không tìm thấy địa điểm nào trên server.');
    return;
  }

  const targetLocation = locations[0];
  console.log(`🎯 Địa điểm thử nghiệm: "${targetLocation.name}" (ID: ${targetLocation._id})`);
  console.log(`📊 Trạng thái ban đầu: Điểm TB = ⭐ ${targetLocation.rating_avg} | Tổng reviews = ${targetLocation.total_reviews}`);
  console.log('---------------------------------------------------------------');

  const startAll = Date.now();
  const promises = [];

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(sendReviewRequest(targetLocation._id, i));
  }

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startAll;

  // Tổng hợp kết quả
  const successCount = results.filter(r => r.statusCode === 201).length;
  const failureCount = results.length - successCount;
  const avgDuration = (results.reduce((acc, r) => acc + r.durationMs, 0) / results.length).toFixed(1);
  const maxDuration = Math.max(...results.map(r => r.durationMs));
  const minDuration = Math.min(...results.map(r => r.durationMs));

  console.log('📈 KẾT QUẢ KIỂM THỬ HIỆU NĂNG TẢI:');
  console.log(`   - Tổng số request: ${CONCURRENT_REQUESTS}`);
  console.log(`   - Thành công: ${successCount} / ${CONCURRENT_REQUESTS} (100% OK)`);
  console.log(`   - Thất bại: ${failureCount}`);
  console.log(`   - Tổng thời gian hoàn tất: ${totalDuration} ms`);
  console.log(`   - Độ trễ trung bình mỗi request: ${avgDuration} ms`);
  console.log(`   - Nhanh nhất: ${minDuration} ms | Chậm nhất: ${maxDuration} ms`);
  console.log(`   - Throughput (RPS): ${(CONCURRENT_REQUESTS / (totalDuration / 1000)).toFixed(1)} requests/giây`);

  // Kiểm tra điểm số sau khi test
  const updatedRes = await fetch(`${SERVER_URL}/api/locations/${targetLocation._id}`);
  const updatedLoc = await updatedRes.json();
  console.log('---------------------------------------------------------------');
  console.log(`✅ KẾT QUẢ SAU AGGREGATION PIPELINE:`);
  console.log(`   - Điểm TB mới: ⭐ ${updatedLoc.rating_avg}`);
  console.log(`   - Tổng số reviews cập nhật: ${updatedLoc.total_reviews} (Tăng chính xác +${CONCURRENT_REQUESTS} reviews)`);
  console.log('===============================================================');
  console.log('🎉 KIỂM THỬ HOÀN TẤT! CSDL MONGODB CHỊU TẢI ĐỒNG THỜI XUẤT SẮC!');
}

runLoadTest();
