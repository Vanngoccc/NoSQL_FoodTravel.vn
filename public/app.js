// =====================================================================
// TravelVibe Frontend Application Logic
// Đồ án NoSQL Đề tài 04 - MongoDB & ExpressJS
// =====================================================================

let allLocations = [];
let currentCityFilter = 'ALL';
let currentCategoryFilter = 'ALL';
let currentSort = 'rating';
let mapInstance = null;
let mapMarkers = [];
let activeLocationId = null;

// Khởi chạy khi load trang
document.addEventListener('DOMContentLoaded', () => {
  fetchLocations();
  fetchSystemStatus();
});

// 1. TẢI DANH SÁCH ĐỊA ĐIỂM TỪ BACKEND
async function fetchLocations() {
  try {
    const searchVal = document.getElementById('searchInput').value.trim();
    const cityVal = document.getElementById('filterCity').value;
    const sortVal = document.getElementById('sortBy').value;

    let url = `/api/locations?city=${cityVal}&category=${currentCategoryFilter}&sort=${sortVal}`;
    if (searchVal) {
      url += `&search=${encodeURIComponent(searchVal)}`;
    }

    const res = await fetch(url);
    allLocations = await res.json();

    renderLocationsGrid(allLocations);
    if (mapInstance) {
      renderMapMarkers(allLocations);
    }
  } catch (err) {
    console.error('Lỗi tải danh sách địa điểm:', err);
  }
}

// 2. HIỂN THỊ DANH SÁCH CARDS (FIGMA TRAVEL STYLE)
function renderLocationsGrid(locations) {
  const container = document.getElementById('locationsGrid');
  const countLabel = document.getElementById('locationsCountLabel');
  if (!container) return;

  if (countLabel) countLabel.textContent = `${locations.length} kết quả`;

  if (locations.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400 space-y-2">
        <i class="fa-solid fa-map-location-dot text-4xl text-slate-300"></i>
        <p class="text-sm font-semibold">Không tìm thấy địa điểm nào khớp với tiêu chí tìm kiếm</p>
        <button onclick="resetFilters()" class="px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100">Đặt lại bộ lọc</button>
      </div>
    `;
    return;
  }

  container.innerHTML = locations.map(loc => {
    const imgUrl = (loc.images && loc.images.length > 0) ? loc.images[0] : 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600';
    return `
      <div onclick="openLocationModal('${loc._id}')" class="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between group">
        <div>
          <!-- Thumbnail Image -->
          <div class="relative h-48 w-full overflow-hidden bg-slate-100">
            <img src="${imgUrl}" alt="${loc.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-md text-emerald-800 shadow-xs">
              ${loc.category || 'Địa điểm'}
            </span>
            <span class="absolute top-3 right-3 px-2 py-1 rounded-full text-[11px] font-extrabold bg-slate-900/75 backdrop-blur-md text-amber-400 flex items-center space-x-1 shadow-xs">
              <span>⭐</span>
              <span>${loc.rating_avg ? loc.rating_avg.toFixed(1) : '5.0'}</span>
            </span>
          </div>

          <!-- Content Info -->
          <div class="p-4 space-y-2">
            <div class="flex items-center text-[11px] text-slate-400 space-x-1">
              <i class="fa-solid fa-location-dot text-emerald-500"></i>
              <span>${loc.city}</span>
              <span>•</span>
              <span class="font-mono">${loc.location.coordinates[0].toFixed(2)}, ${loc.location.coordinates[1].toFixed(2)}</span>
            </div>
            
            <h3 class="text-base font-bold text-slate-800 group-hover:text-emerald-600 transition-colors line-clamp-1">
              ${loc.name}
            </h3>

            <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              ${loc.description || 'Địa điểm du lịch hấp dẫn không thể bỏ lỡ khi ghé thăm ' + loc.city}
            </p>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="p-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <span class="flex items-center space-x-1">
            <i class="fa-regular fa-comment-dots text-slate-400"></i>
            <span class="font-semibold text-slate-700">${loc.total_reviews || 0}</span>
            <span>đánh giá</span>
          </span>
          <span class="text-emerald-600 font-bold group-hover:translate-x-1 transition-transform flex items-center space-x-1">
            <span>Chi tiết</span>
            <i class="fa-solid fa-arrow-right text-[10px]"></i>
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// 3. TÌM KIẾM TOÀN VĂN (TEXT SEARCH INDEX)
function handleSearch() {
  fetchLocations();
}

function applyFilters() {
  fetchLocations();
}

function filterCategory(cat) {
  currentCategoryFilter = cat;
  
  // Highlight chip
  document.querySelectorAll('.category-chip').forEach(btn => {
    btn.className = 'category-chip px-4 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100';
  });
  event.target.className = 'category-chip active px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs';

  fetchLocations();
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCity').value = 'ALL';
  currentCategoryFilter = 'ALL';
  switchView('explore');
  fetchLocations();
}

// 4. CHUYỂN TAB XEM (EXPLORE / MAP / STATS)
function switchView(viewName) {
  const vExplore = document.getElementById('viewExplore');
  const vMap = document.getElementById('viewMap');
  const vStats = document.getElementById('viewStats');

  const btnExplore = document.getElementById('btnNavExplore');
  const btnMap = document.getElementById('btnNavMap');
  const btnStats = document.getElementById('btnNavStats');

  vExplore.classList.add('hidden');
  vMap.classList.add('hidden');
  vStats.classList.add('hidden');

  btnExplore.className = 'px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1.5';
  btnMap.className = 'px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1.5';
  btnStats.className = 'px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1.5';

  if (viewName === 'explore') {
    vExplore.classList.remove('hidden');
    btnExplore.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-white text-emerald-600 shadow-xs flex items-center space-x-1.5';
  } else if (viewName === 'map') {
    vMap.classList.remove('hidden');
    btnMap.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-white text-emerald-600 shadow-xs flex items-center space-x-1.5';
    initLeafletMap();
  } else if (viewName === 'stats') {
    vStats.classList.remove('hidden');
    btnStats.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-white text-emerald-600 shadow-xs flex items-center space-x-1.5';
    fetchAggregationStats();
  }
}

// 5. KHỞI TẠO BẢN ĐỒ LEAFLET TRỰC QUAN (GEOSPATIAL 2DSPHERE)
function initLeafletMap() {
  if (!mapInstance) {
    // Tọa độ mặc định: Trung tâm Việt Nam (Đà Nẵng)
    mapInstance = L.map('mapViewContainer').setView([16.0611, 108.2272], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);
  }

  setTimeout(() => {
    mapInstance.invalidateSize();
    renderMapMarkers(allLocations);
  }, 200);
}

function renderMapMarkers(locations) {
  if (!mapInstance) return;

  // Xóa markers cũ
  mapMarkers.forEach(m => mapInstance.removeLayer(m));
  mapMarkers = [];

  locations.forEach(loc => {
    const [lng, lat] = loc.location.coordinates;
    const marker = L.marker([lat, lng]).addTo(mapInstance);
    
    marker.bindPopup(`
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px;">
        <b style="color: #059669; font-size: 13px;">${loc.name}</b><br/>
        <span style="font-size: 11px; color: #64748b;">${loc.city} • ${loc.category}</span><br/>
        <span style="font-size: 11px; font-weight: bold; color: #d97706;">⭐ ${loc.rating_avg} (${loc.total_reviews} reviews)</span><br/>
        <button onclick="openLocationModal('${loc._id}')" style="margin-top: 6px; padding: 4px 8px; background: #059669; color: white; border: none; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: bold;">
          Xem Review Chi Tiết
        </button>
      </div>
    `);

    mapMarkers.push(marker);
  });
}

function focusCityMap(city) {
  if (!mapInstance) return;
  const cityCoords = {
    'Đà Nẵng': [16.0611, 108.2272, 12],
    'Hà Nội': [21.0285, 105.8542, 12],
    'TP.HCM': [10.7769, 106.7009, 12]
  };

  const target = cityCoords[city];
  if (target) {
    mapInstance.flyTo([target[0], target[1]], target[2], { duration: 1.2 });
  }
}

// 6. TÌM GẦN VỊ TRÍ HIỆN TẠI (GEOSPATIAL $near)
function getUserCurrentLocationAndFetchNearby() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await fetchNearbyLocations(longitude, latitude);
      },
      (err) => {
        // Fallback tọa độ Cầu Rồng Đà Nẵng nếu người dùng chặn GPS
        alert('Không lấy được GPS tự động. Hệ thống sẽ mô phỏng tìm kiếm 5km xung quanh Cầu Rồng Đà Nẵng!');
        fetchNearbyLocations(108.2272, 16.0611);
      }
    );
  } else {
    fetchNearbyLocations(108.2272, 16.0611);
  }
}

async function fetchNearbyLocations(lng, lat) {
  try {
    const res = await fetch(`/api/locations/nearby?lng=${lng}&lat=${lat}&max_distance=15000`);
    const nearby = await res.json();
    alert(`📍 Đã tìm thấy ${nearby.length} địa điểm trong bán kính 15km quanh tọa độ [${lng.toFixed(2)}, ${lat.toFixed(2)}]!`);
    switchView('explore');
    renderLocationsGrid(nearby);
  } catch (err) {
    console.error('Lỗi tìm nearby:', err);
  }
}

// 7. THỐNG KÊ AGGREGATION PIPELINES (SV2)
async function fetchAggregationStats() {
  try {
    const [resCities, resTopRated] = await Promise.all([
      fetch('/api/analytics/top-cities').then(r => r.json()),
      fetch('/api/analytics/top-rated').then(r => r.json())
    ]);

    // Render Stats Cards
    const cardsBox = document.getElementById('statsCardsContainer');
    if (cardsBox) {
      cardsBox.innerHTML = resCities.map(c => `
        <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${c.city}</span>
            <span class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
              <i class="fa-solid fa-city"></i>
            </span>
          </div>
          <div class="text-2xl font-black text-slate-800">${c.total_locations} địa điểm</div>
          <div class="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>⭐ Rating TB: <b class="text-amber-500 font-bold">${c.avg_city_rating}</b></span>
            <span>💬 Tổng: <b class="text-slate-700">${c.total_reviews} reviews</b></span>
          </div>
        </div>
      `).join('');
    }

    // Render Top Rated Tables
    const tableBox = document.getElementById('topRatedTableContainer');
    if (tableBox) {
      tableBox.innerHTML = resTopRated.map(group => `
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <h4 class="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center space-x-1.5">
            <i class="fa-solid fa-medal text-amber-500"></i>
            <span>Top ${group.city}</span>
          </h4>
          <div class="space-y-2">
            ${group.best_places.map((p, idx) => `
              <div onclick="openLocationModal('${p.id}')" class="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer flex items-center justify-between">
                <div class="truncate mr-2">
                  <div class="text-xs font-bold text-slate-800 truncate">${idx + 1}. ${p.name}</div>
                  <div class="text-[10px] text-slate-400">${p.category}</div>
                </div>
                <div class="text-xs font-extrabold text-amber-500 shrink-0">⭐ ${p.rating_avg}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error('Lỗi thống kê Aggregation:', err);
  }
}

// 8. MODAL CHI TIẾT ĐỊA ĐIỂM & ĐĂNG REVIEW LỒNG NHAU (REVIEWS & REPLIES)
async function openLocationModal(locId) {
  activeLocationId = locId;
  const modal = document.getElementById('locationDetailModal');
  if (!modal) return;

  try {
    const res = await fetch(`/api/locations/${locId}`);
    const loc = await res.json();

    document.getElementById('modalLocationTitle').textContent = loc.name;
    document.getElementById('modalLocationAddress').querySelector('span').textContent = loc.address || `${loc.name}, ${loc.city}`;
    document.getElementById('modalCategoryBadge').textContent = loc.category;
    document.getElementById('modalCityBadge').textContent = loc.city;
    document.getElementById('modalRatingAvg').textContent = loc.rating_avg ? loc.rating_avg.toFixed(1) : '5.0';
    document.getElementById('modalTotalReviews').textContent = `${loc.total_reviews || 0} đánh giá`;
    document.getElementById('modalCoords').textContent = `[${loc.location.coordinates[0].toFixed(4)}, ${loc.location.coordinates[1].toFixed(4)}]`;
    document.getElementById('modalDescription').textContent = loc.description || 'Không có mô tả chi tiết.';
    
    const imgEl = document.getElementById('modalLocationImg');
    if (imgEl) {
      imgEl.src = (loc.images && loc.images.length > 0) ? loc.images[0] : 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600';
    }

    renderReviewsList(loc.reviews || []);
    modal.classList.remove('hidden');
  } catch (err) {
    console.error('Lỗi mở chi tiết địa điểm:', err);
  }
}

function closeLocationModal() {
  document.getElementById('locationDetailModal').classList.add('hidden');
}

function renderReviewsList(reviews) {
  const container = document.getElementById('modalReviewsList');
  const badge = document.getElementById('reviewsCountBadge');
  if (!container) return;

  if (badge) badge.textContent = `${reviews.length} đánh giá`;

  if (reviews.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá!</div>';
    return;
  }

  container.innerHTML = reviews.map(rev => {
    const stars = '⭐'.repeat(rev.rating);
    const repliesHtml = (rev.replies && rev.replies.length > 0) ? `
      <div class="mt-2.5 pl-3 border-l-2 border-emerald-400 space-y-2">
        ${rev.replies.map(rep => `
          <div class="bg-emerald-50/70 p-2.5 rounded-xl text-xs text-slate-700">
            <div class="font-bold text-emerald-900 text-[11px] flex items-center space-x-1">
              <i class="fa-solid fa-reply text-emerald-600 text-[10px]"></i>
              <span>${rep.user_name}</span>
            </div>
            <p class="mt-1 text-slate-600">${rep.content}</p>
          </div>
        `).join('')}
      </div>
    ` : '';

    return `
      <div class="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <img src="${rev.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-7 h-7 rounded-full object-cover">
            <div>
              <div class="text-xs font-bold text-slate-800">${rev.user_name}</div>
              <div class="text-[10px] text-slate-400">${new Date(rev.created_at).toLocaleDateString('vi-VN')}</div>
            </div>
          </div>
          <span class="text-xs text-amber-500 font-bold">${stars}</span>
        </div>

        <p class="text-xs text-slate-600 leading-relaxed">${rev.content}</p>

        <!-- Nested Replies -->
        ${repliesHtml}

        <!-- Nút Trả lời bình luận -->
        <div class="pt-1 flex items-center justify-end">
          <button onclick="promptReply('${rev._id}')" class="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 cursor-pointer">
            <i class="fa-solid fa-reply text-[10px]"></i>
            <span>Phản hồi</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 9. GỬI ĐÁNH GIÁ MỚI (REAL-TIME RATING UPDATE)
async function submitReview() {
  if (!activeLocationId) return;

  const userName = document.getElementById('inputReviewUser').value.trim();
  const rating = document.getElementById('inputReviewRating').value;
  const content = document.getElementById('inputReviewContent').value.trim();

  if (!userName || !content) {
    alert('Vui lòng nhập họ tên và nội dung đánh giá!');
    return;
  }

  try {
    const res = await fetch(`/api/locations/${activeLocationId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: userName, rating, content })
    });

    const data = await res.json();
    if (res.ok) {
      alert(`🎉 Đã đăng đánh giá thành công! Rating mới được cập nhật tự động: ⭐ ${data.rating_avg}`);
      document.getElementById('inputReviewContent').value = '';
      openLocationModal(activeLocationId); // Refresh modal
      fetchLocations(); // Refresh grid
    } else {
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi submit review:', err);
  }
}

// 10. TRẢ LỜI REVIEW (NESTED REPLIES)
async function promptReply(reviewId) {
  const replyName = prompt('Nhập tên của bạn (hoặc Ban Quản Lý):', 'Người phản hồi');
  if (!replyName) return;
  const replyContent = prompt('Nhập nội dung phản hồi:');
  if (!replyContent) return;

  try {
    const res = await fetch(`/api/locations/${activeLocationId}/reviews/${reviewId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: replyName, content: replyContent })
    });

    if (res.ok) {
      alert('Đã gửi phản hồi thành công!');
      openLocationModal(activeLocationId);
    }
  } catch (err) {
    console.error('Lỗi gửi reply:', err);
  }
}

// 11. THÊM ĐỊA ĐIỂM MỚI (CRUD SV1)
function openNewLocationModal() {
  document.getElementById('newLocationModal').classList.remove('hidden');
}

function closeNewLocationModal() {
  document.getElementById('newLocationModal').classList.add('hidden');
}

async function submitNewLocation() {
  const name = document.getElementById('newLocName').value.trim();
  const city = document.getElementById('newLocCity').value;
  const category = document.getElementById('newLocCategory').value;
  const lng = parseFloat(document.getElementById('newLocLng').value);
  const lat = parseFloat(document.getElementById('newLocLat').value);
  const desc = document.getElementById('newLocDesc').value.trim();

  if (!name || isNaN(lng) || isNaN(lat)) {
    alert('Vui lòng điền đầy đủ Tên địa điểm, Kinh độ và Vĩ độ hợp lệ!');
    return;
  }

  try {
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        city,
        category,
        lng,
        lat,
        description: desc
      })
    });

    const data = await res.json();
    if (res.ok) {
      alert('🎉 Đã thêm địa điểm mới vào MongoDB thành công!');
      closeNewLocationModal();
      fetchLocations();
      fetchSystemStatus();
    } else {
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi tạo địa điểm:', err);
  }
}

// 12. THỐNG KÊ TRẠNG THÁI HỆ THỐNG
async function fetchSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const badge = document.getElementById('badgeDbCount');
    if (badge && data.total_locations) {
      badge.textContent = `${data.total_locations} địa điểm`;
    }
  } catch (e) {
    console.error('Lỗi status:', e);
  }
}
