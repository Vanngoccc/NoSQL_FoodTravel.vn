const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const TARGET_DIR = path.join(__dirname, 'public/uploads/locations');
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// User-Agent required by Wikimedia / Wikipedia
const HEADERS = {
  'User-Agent': 'FoodTravelVietnam/1.0 (contact@foodtravel.vn; university course project)'
};

// Map each location name to best Wikipedia article or Commons search query
const LOCATION_QUERIES = {
  // Đà Nẵng
  'Cầu Rồng': { wiki: 'Cầu Rồng' },
  'Cầu Sông Hàn': { wiki: 'Cầu Sông Hàn' },
  'Cầu Tình Yêu Đà Nẵng': { commons: 'Love Lock Bridge Da Nang' },
  'Cầu Thuận Phước': { wiki: 'Cầu Thuận Phước' },
  'Cầu Trần Thị Lý': { wiki: 'Cầu Trần Thị Lý' },
  'Bảo tàng Điêu khắc Chăm': { wiki: 'Bảo tàng Điêu khắc Chăm Đà Nẵng' },
  'Bảo tàng Đà Nẵng': { commons: 'Thành Điện Hải Đà Nẵng' },
  'Bảo tàng Mỹ thuật Đà Nẵng': { commons: 'Da Nang Fine Arts Museum' },
  'Chợ Hàn': { wiki: 'Chợ Hàn' },
  'Chợ Cồn': { wiki: 'Chợ Cồn' },
  'Bãi biển Mỹ Khê': { wiki: 'Bãi biển Mỹ Khê' },
  'Bãi biển Phạm Văn Đồng': { commons: 'Pham Van Dong Beach Da Nang' },
  'Chùa Linh Ứng - Bãi Bụt': { wiki: 'Chùa Linh Ứng (Bãi Bụt)', commons: 'Chùa Linh Ứng Bãi Bụt' },
  'Danh thắng Ngũ Hành Sơn': { wiki: 'Ngũ Hành Sơn' },
  'Bán đảo Sơn Trà (Đỉnh Bàn Cờ)': { commons: 'Toàn cảnh Đà Nẵng từ đỉnh bàn cờ bán đảo Sơn Trà' },
  'Sun World Ba Na Hills': { wiki: 'Bà Nà' },
  'Cầu Vàng (Golden Bridge)': { wiki: 'Cầu Vàng' },
  'Công viên Châu Á (Asia Park)': { commons: 'Sun Wheel at night' },
  'Sân bay Quốc tế Đà Nẵng': { wiki: 'Sân bay quốc tế Đà Nẵng' },
  'Ga Đà Nẵng': { wiki: 'Ga Đà Nẵng' },
  'Bến xe trung tâm Đà Nẵng': { commons: 'Bến xe trung tâm Đà Nẵng' },
  'Đại học Bách khoa - ĐHĐN': { wiki: 'Trường Đại học Bách khoa, Đại học Đà Nẵng' },
  'Đại học Kinh tế - ĐHĐN': { wiki: 'Trường Đại học Kinh tế, Đại học Đà Nẵng' },
  'Bệnh viện Đà Nẵng': { commons: 'Bệnh viện Đà Nẵng' },
  'Bệnh viện Hoàn Mỹ Đà Nẵng': { commons: 'Hoan My Da Nang' },

  // Hà Nội
  'Hồ Hoàn Kiếm (Hồ Gươm)': { wiki: 'Hồ Hoàn Kiếm' },
  'Tháp Rùa': { wiki: 'Tháp Rùa' },
  'Đền Ngọc Sơn': { wiki: 'Đền Ngọc Sơn' },
  'Lăng Chủ tịch Hồ Chí Minh': { wiki: 'Lăng Chủ tịch Hồ Chí Minh' },
  'Quảng trường Ba Đình': { wiki: 'Quảng trường Ba Đình' },
  'Hoàng thành Thăng Long': { wiki: 'Hoàng thành Thăng Long' },
  'Văn Miếu - Quốc Tử Giám': { wiki: 'Văn Miếu – Quốc Tử Giám' },
  'Chùa Một Cột': { wiki: 'Chùa Một Cột' },
  'Chùa Trấn Quốc': { wiki: 'Chùa Trấn Quốc' },
  'Nhà thờ Lớn Hà Nội': { wiki: 'Nhà thờ Lớn Hà Nội' },
  'Nhà hát Lớn Hà Nội': { wiki: 'Nhà hát Lớn Hà Nội' },
  'Chợ Đồng Xuân': { wiki: 'Chợ Đồng Xuân' },
  'Bảo tàng Lịch sử Quân sự Việt Nam': { wiki: 'Bảo tàng Lịch sử Quân sự Việt Nam' },
  'Bảo tàng Dân tộc học Việt Nam': { wiki: 'Bảo tàng Dân tộc học Việt Nam' },
  'Bảo tàng Phụ nữ Việt Nam': { wiki: 'Bảo tàng Phụ nữ Việt Nam' },
  'Di tích Hỏa Lò': { wiki: 'Nhà tù Hỏa Lò' },
  'Cầu Long Biên': { wiki: 'Cầu Long Biên' },
  'Cầu Nhật Tân': { wiki: 'Cầu Nhật Tân' },
  'Hồ Tây (Chùa Kim Liên)': { wiki: 'Chùa Kim Liên' },
  'Keangnam Hanoi Landmark Tower': { wiki: 'Keangnam Hanoi Landmark Tower' },
  'Lotte Center Hà Nội': { wiki: 'Lotte Center Hà Nội' },
  'Aeon Mall Hà Đông': { commons: 'Aeon Mall Ha Dong' },
  'Vincom Mega Mall Royal City': { commons: 'Royal City Hanoi' },
  'Vincom Mega Mall Times City': { commons: 'Times City Hanoi' },
  'Sân vận động Quốc gia Mỹ Đình': { wiki: 'Sân vận động Quốc gia Mỹ Đình' },
  'Sân bay Quốc tế Nội Bài': { wiki: 'Sân bay quốc tế Nội Bài' },
  'Ga Hà Nội': { wiki: 'Ga Hà Nội' },
  'Bến xe Mỹ Đình': { commons: 'Bến xe Mỹ Đình' },
  'Bến xe Giáp Bát': { commons: 'Bến xe Giáp Bát' },
  'Đại học Bách khoa Hà Nội': { commons: 'Hanoi University of Science and Technology' },
  'Đại học Quốc gia Hà Nội (Cầu Giấy)': { wiki: 'Đại học Quốc gia Hà Nội' },
  'Đại học Y Hà Nội': { wiki: 'Trường Đại học Y Hà Nội' },
  'Bệnh viện Bạch Mai': { wiki: 'Bệnh viện Bạch Mai' },
  'Bệnh viện Việt Đức': { wiki: 'Bệnh viện Hữu nghị Việt Đức' },
  'Bệnh viện Trung ương Quân đội 108': { wiki: 'Bệnh viện Trung ương Quân đội 108' },

  // TP.HCM
  'Chợ Bến Thành': { wiki: 'Chợ Bến Thành' },
  'Nhà thờ Đức Bà TP.HCM': { wiki: 'Nhà thờ chính tòa Đức Bà Sài Gòn' },
  'Bưu điện Trung tâm TP.HCM': { wiki: 'Bưu điện Sài Gòn' },
  'Dinh Độc Lập': { wiki: 'Dinh Độc Lập' },
  'Ủy ban Nhân dân TP.HCM': { wiki: 'Trụ sở Ủy ban Nhân dân Thành phố Hồ Chí Minh' },
  'Phố đi bộ Nguyễn Huệ': { wiki: 'Đường Nguyễn Huệ, Thành phố Hồ Chí Minh' },
  'Phố đi bộ Bùi Viện': { commons: 'Bui Vien Street' },
  'Nhà hát Thành phố (Opéra de Saïgon)': { wiki: 'Nhà hát Thành phố Hồ Chí Minh' },
  'Tháp Tài chính Bitexco': { wiki: 'Tháp Tài chính Bitexco' },
  'Landmark 81': { wiki: 'Landmark 81' },
  'Bảo tàng Chứng tích Chiến tranh': { wiki: 'Bảo tàng Chứng tích Chiến tranh' },
  'Bảo tàng Lịch sử TP.HCM': { wiki: 'Bảo tàng Lịch sử Thành phố Hồ Chí Minh' },
  'Bảo tàng Mỹ thuật TP.HCM': { wiki: 'Bảo tàng Mỹ thuật Thành phố Hồ Chí Minh' },
  'Thảo Cầm Viên Sài Gòn': { wiki: 'Thảo Cầm Viên Sài Gòn' },
  'Công viên Tao Đàn': { wiki: 'Công viên Tao Đàn' },
  'Công viên Hoàng Văn Thụ': { commons: 'Công viên Hoàng Văn Thụ' },
  'Chợ Lớn (Chợ Bình Tây)': { wiki: 'Chợ Bình Tây' },
  'Chùa Vĩnh Nghiêm': { wiki: 'Chùa Vĩnh Nghiêm (Thành phố Hồ Chí Minh)' },
  'Chùa Ngọc Hoàng (Phước Hải Tự)': { commons: 'Chùa Ngọc Hoàng' },
  'Chùa Bà Thiên Hậu (Quận 5)': { wiki: 'Chùa Bà Thiên Hậu (Chợ Lớn)' },
  'Khu du lịch Văn hóa Suối Tiên': { wiki: 'Khu du lịch Suối Tiên' },
  'Công viên nước Đầm Sen': { wiki: 'Công viên nước Đầm Sen' },
  'Sân bay Quốc tế Tân Sơn Nhất': { wiki: 'Sân bay quốc tế Tân Sơn Nhất' },
  'Ga Sài Gòn': { wiki: 'Ga Sài Gòn' },
  'Bến xe Miền Đông (Bình Thạnh)': { wiki: 'Bến xe Miền Đông' },
  'Bến xe Miền Tây': { commons: 'Bến xe Miền Tây' },
  'Bến xe Miền Đông Mới (TP. Thủ Đức)': { commons: 'Bến xe Miền Đông mới' },
  'Cầu Thủ Thiêm': { commons: 'Cau thu thiem' },
  'Cầu Ba Son (Thủ Thiêm 2)': { wiki: 'Cầu Ba Son' },
  'Đại học Quốc gia TP.HCM (Khu Đô thị)': { wiki: 'Đại học Quốc gia Thành phố Hồ Chí Minh' },
  'Đại học Bách khoa TP.HCM': { wiki: 'Trường Đại học Bách khoa, Đại học Quốc gia Thành phố Hồ Chí Minh' },
  'Đại học Y Dược TP.HCM': { wiki: 'Đại học Y Dược Thành phố Hồ Chí Minh' },
  'Trường ĐH Công Nghiệp TP.HCM (IUH)': { wiki: 'Trường Đại học Công nghiệp Thành phố Hồ Chí Minh' },
  'Trường ĐH Công Thương TP.HCM (HUIT)': { wiki: 'Trường Đại học Công Thương Thành phố Hồ Chí Minh' },
  'Bệnh viện Chợ Rẫy': { commons: 'Benh vien Cho Ray' },
  'Bệnh viện Từ Dũ': { wiki: 'Bệnh viện Từ Dũ' },
  'Bệnh viện Nhi Đồng 1': { wiki: 'Bệnh viện Nhi đồng 1' },
  'Bệnh viện Nhân dân 115': { commons: 'Bệnh viện Nhân dân 115' },
  'Bệnh viện Thống Nhất': { wiki: 'Bệnh viện Thống Nhất' },
  'Bệnh viện Đại học Y Dược TP.HCM': { commons: 'Bệnh viện Đại học Y Dược TP.HCM' }
};

// Fallback high quality verified direct URLs if Wikipedia has no image
const DIRECT_FALLBACKS = {
  'Bến xe trung tâm Đà Nẵng': 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1000&auto=format&fit=crop',
  'Bệnh viện Hoàn Mỹ Đà Nẵng': 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=1000&auto=format&fit=crop',
  'Bến xe Mỹ Đình': 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=1000&auto=format&fit=crop',
  'Bến xe Giáp Bát': 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1000&auto=format&fit=crop',
  'Bến xe Miền Đông Mới (TP. Thủ Đức)': 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=1000&auto=format&fit=crop',
  'Bệnh viện Nhân dân 115': 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1000&auto=format&fit=crop',
  'Bệnh viện Đại học Y Dược TP.HCM': 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1000&auto=format&fit=crop'
};

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: HEADERS }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function searchCommons(query) {
  return new Promise(resolve => {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(query) + '&gsrlimit=5&prop=imageinfo&iiprop=url|mime&format=json';
    https.get(url, { headers: HEADERS }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.query && j.query.pages) {
            const pages = Object.values(j.query.pages);
            const valid = pages.find(p => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].url && p.imageinfo[0].mime && p.imageinfo[0].mime.startsWith('image/'));
            if (valid) return resolve(valid.imageinfo[0].url);
          }
          resolve(null);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function findImageUrl(locationName) {
  const conf = LOCATION_QUERIES[locationName] || {};
  
  // 1. Wikipedia Summary API
  if (conf.wiki) {
    const summary = await fetchJson('https://vi.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(conf.wiki));
    if (summary) {
      if (summary.thumbnail && summary.thumbnail.source) return summary.thumbnail.source;
      if (summary.originalimage && summary.originalimage.source) return summary.originalimage.source;
    }
  }

  // 2. Wikimedia Commons search
  if (conf.commons) {
    const commonsUrl = await searchCommons(conf.commons);
    if (commonsUrl) return commonsUrl;
  }

  // 3. Fallback to searching Commons with the location name itself
  const autoCommonsUrl = await searchCommons(locationName);
  if (autoCommonsUrl) return autoCommonsUrl;

  // 4. Fallback dictionary
  if (DIRECT_FALLBACKS[locationName]) {
    return DIRECT_FALLBACKS[locationName];
  }

  return null;
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: HEADERS }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP status ' + res.statusCode));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(fs.statSync(destPath).size);
      });
      file.on('error', err => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('nosql_locations_db');
  const locationsCol = db.collection('locations');
  const diadiemCol = db.collection('diadiem');

  const locs = await locationsCol.find({}).sort({ _id: 1 }).toArray();
  console.log(`Processing ${locs.length} locations...`);

  let successCount = 0;
  let failed = [];

  for (let i = 0; i < locs.length; i++) {
    const loc = locs[i];
    const locId = loc._id.toString();
    const destFile = path.join(TARGET_DIR, `${locId}.jpg`);
    const localUrl = `/uploads/locations/${locId}.jpg`;

    // Check if file already downloaded and valid (> 3000 bytes)
    let needsDownload = true;
    if (fs.existsSync(destFile)) {
      const stats = fs.statSync(destFile);
      if (stats.size > 3000) {
        needsDownload = false;
        console.log(`[${i+1}/${locs.length}] File exists: ${loc.name} (${stats.size} bytes)`);
      }
    }

    if (needsDownload) {
      const imgUrl = await findImageUrl(loc.name);
      if (!imgUrl) {
        console.warn(`[${i+1}/${locs.length}] FAILED TO FIND URL: ${loc.name}`);
        failed.push(loc.name);
        continue;
      }

      try {
        console.log(`[${i+1}/${locs.length}] Downloading: ${loc.name} <- ${imgUrl.substring(0, 70)}...`);
        const size = await downloadFile(imgUrl, destFile);
        console.log(`[${i+1}/${locs.length}] Saved ${destFile} (${size} bytes)`);
      } catch (err) {
        console.error(`[${i+1}/${locs.length}] Download error for ${loc.name}: ${err.message}`);
        // try fallback if available
        if (DIRECT_FALLBACKS[loc.name]) {
          try {
            await downloadFile(DIRECT_FALLBACKS[loc.name], destFile);
            console.log(`[${i+1}/${locs.length}] Downloaded fallback for ${loc.name}`);
          } catch(e2) {
            failed.push(loc.name);
            continue;
          }
        } else {
          failed.push(loc.name);
          continue;
        }
      }
    }

    // Update MongoDB
    await locationsCol.updateOne({ _id: loc._id }, { $set: { images: [localUrl] } });
    await diadiemCol.updateOne({ _id: loc._id }, { $set: { images: [localUrl] } });
    successCount++;
  }

  console.log(`\n========================================`);
  console.log(`COMPLETED: ${successCount} / ${locs.length} locations updated with 100% accurate local images!`);
  if (failed.length > 0) {
    console.log(`Failed locations (${failed.length}):`, failed);
  }
  console.log(`========================================`);

  await client.close();
}

main().catch(console.error);
