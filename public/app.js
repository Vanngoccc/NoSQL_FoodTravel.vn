// =====================================================================
// FoodTravel.vn Frontend Application Logic
// Mạng xã hội Ẩm thực & Du lịch Việt Nam (Chuẩn Figma 1541127234113621997)
// =====================================================================

let allLocations = [];
let currentCategoryFilter = 'ALL';
let mapInstance = null;
let mapMarkers = [];
let activeLocationId = null;

// Phân trang danh sách bài viết / địa điểm (12 bài / trang)
let currentPage = 1;
const itemsPerPage = 12;

// Trạng thái yêu thích (Likes lưu trong localStorage)
let likedPosts = JSON.parse(localStorage.getItem('foodtravel_likes') || '{}');

// Danh sách tác giả cộng đồng giả lập cho bài viết sinh động chuẩn mạng xã hội
const communityAuthors = [
  { name: 'Huỳnh Văn Ngọc', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120' },
  { name: 'Thanh Trúc', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120' },
  { name: 'Minh Tuấn', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120' },
  { name: 'Lan Anh Foodie', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120' },
  { name: 'Hoàng Long Travel', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120' }
];

// Người dùng hiện tại
let currentUser = localStorage.getItem('foodtravel_user') ? JSON.parse(localStorage.getItem('foodtravel_user')) : null;

// Khởi chạy khi load trang
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
  fetchLocations();
  fetchSidebarTopRated();
});

// Cập nhật giao diện Đăng nhập / Tài khoản người dùng
function updateUserUI() {
  const section = document.getElementById('userAccountSection');
  if (!section) return;

  if (currentUser) {
    section.innerHTML = `
      <div class="flex items-center space-x-2 bg-[#FF5422]/10 text-slate-800 px-3 py-1.5 rounded-full border border-[#FF5422]/20 text-xs font-bold">
        <i class="fa-solid fa-circle-user text-[#FF5422] text-sm"></i>
        <span>${currentUser.name}</span>
        <button onclick="logoutUser()" class="ml-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Đăng xuất">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
        </button>
      </div>
    `;
    const inputUser = document.getElementById('inputReviewUser');
    if (inputUser) inputUser.value = currentUser.name;
  } else {
    section.innerHTML = `
      <button onclick="openAuthModal('login')" class="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer">
        Đăng nhập
      </button>
      <button onclick="openAuthModal('register')" class="px-4 py-2 rounded-full text-xs font-bold bg-[#FF5422] hover:bg-[#E84615] text-white transition-all shadow-sm shadow-[#FF5422]/20 cursor-pointer">
        Đăng ký
      </button>
    `;
  }
}

function openAuthModal(type) {
  const title = document.getElementById('authModalTitle');
  if (title) title.textContent = type === 'login' ? 'Đăng nhập tài khoản' : 'Đăng ký tài khoản mới';
  document.getElementById('authModal').classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function handleAuthSubmit() {
  const name = document.getElementById('authUserName').value.trim();
  const email = document.getElementById('authUserEmail').value.trim();

  if (!name) {
    alert('Vui lòng nhập họ và tên của bạn!');
    return;
  }

  currentUser = { name, email: email || `${name.toLowerCase().replace(/\s+/g, '')}@gmail.com` };
  localStorage.setItem('foodtravel_user', JSON.stringify(currentUser));
  updateUserUI();
  closeAuthModal();
  alert(`Chào mừng ${name} đến với FoodTravel.vn!`);
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('foodtravel_user');
  updateUserUI();
}

// Cuộn mượt đến nội dung chính
function scrollToContent() {
  const target = document.getElementById('mainContentContainer');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

// 1. TẢI DANH SÁCH BÀI VIẾT / ĐỊA ĐIỂM TỪ BACKEND
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
    currentPage = 1; // Reset về trang 1 khi lọc hoặc tìm kiếm

    renderLocationsPage();
    if (mapInstance) {
      renderMapMarkers(allLocations);
    }
  } catch (err) {
    console.error('Lỗi tải danh sách địa điểm:', err);
  }
}

// Tìm kiếm từ ô mobile
function handleSearchMobile() {
  const mobileInput = document.getElementById('searchInputMobile');
  if (mobileInput) {
    document.getElementById('searchInput').value = mobileInput.value;
    fetchLocations();
  }
}

// Tìm kiếm nhanh theo từ khóa xu hướng (Figma Trending Tags)
function quickFilterKeyword(keyword) {
  document.getElementById('searchInput').value = keyword;
  currentCategoryFilter = 'ALL';
  updateCategoryChipsUI();
  fetchLocations();
  scrollToContent();
}

// 2. PHÂN TRANG & HIỂN THỊ POST CARDS CHUẨN MẠNG XÃ HỘI
function renderLocationsPage() {
  const container = document.getElementById('locationsGrid');
  const paginationBox = document.getElementById('paginationContainer');
  if (!container) return;

  if (allLocations.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400 space-y-3 bg-white rounded-3xl border border-slate-200/80 p-8">
        <i class="fa-solid fa-map-location-dot text-4xl text-[#FF5422]/40"></i>
        <p class="text-sm font-bold text-slate-700">Không tìm thấy món ăn hoặc địa điểm phù hợp</p>
        <p class="text-xs text-slate-400">Hãy thử tìm với từ khóa khác hoặc đặt lại bộ lọc để khám phá tiếp nhé.</p>
        <button onclick="resetFilters()" class="px-5 py-2 bg-[#FF5422] text-white rounded-full text-xs font-bold hover:bg-[#E84615] transition-all cursor-pointer shadow-sm">Đặt lại bộ lọc</button>
      </div>
    `;
    if (paginationBox) paginationBox.innerHTML = '';
    return;
  }

  // Cắt mảng theo trang hiện tại (12 bài / trang)
  const startIndex = (currentPage - 1) * itemsPerPage;
  const pageItems = allLocations.slice(startIndex, startIndex + itemsPerPage);

  container.innerHTML = pageItems.map((loc, index) => {
    const author = communityAuthors[index % communityAuthors.length];
    const imgUrl = (loc.images && loc.images.length > 0) ? loc.images[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
    const isLiked = !!likedPosts[loc._id];
    const initialLikes = 180 + (index * 23) % 450 + (isLiked ? 1 : 0);

    return `
      <div class="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
        <div>
          <!-- Header Thẻ: Avatar Người đăng & Tỉnh thành -->
          <div class="p-3.5 pb-2.5 flex items-center justify-between">
            <div class="flex items-center space-x-2.5">
              <img src="${author.avatar}" alt="${author.name}" class="w-8 h-8 rounded-full object-cover border border-slate-100">
              <div>
                <h4 class="text-xs font-bold text-slate-900 leading-tight">${author.name}</h4>
                <div class="flex items-center space-x-1 text-[10px] text-slate-400">
                  <i class="fa-solid fa-location-dot text-[#FF5422]"></i>
                  <span>${loc.city}</span>
                </div>
              </div>
            </div>

            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
              ${loc.category || 'Ẩm thực'}
            </span>
          </div>

          <!-- Thumbnail Hình ảnh & Badge Sao -->
          <div onclick="openLocationModal('${loc._id}')" class="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-100 cursor-pointer">
            <img src="${imgUrl}" alt="${loc.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <div class="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-900/75 backdrop-blur-md text-amber-400 flex items-center space-x-1 shadow-sm">
              <i class="fa-solid fa-star text-xs"></i>
              <span>${loc.rating_avg ? loc.rating_avg.toFixed(1) : '5.0'}</span>
              <span class="text-slate-300 text-[10px] font-normal">(${loc.total_reviews || 0})</span>
            </div>
          </div>

          <!-- Nội dung & Mô tả bài viết -->
          <div class="p-4 space-y-2">
            <h3 onclick="openLocationModal('${loc._id}')" class="text-base font-extrabold text-slate-900 group-hover:text-[#FF5422] transition-colors line-clamp-1 cursor-pointer">
              ${loc.name}
            </h3>

            <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
              ${loc.description || 'Trải nghiệm ẩm thực và du lịch tuyệt vời được yêu thích tại ' + loc.city}
            </p>
          </div>
        </div>

        <!-- Thanh tương tác mạng xã hội (Like, Bình luận, Lưu, Chi tiết) -->
        <div class="p-3 sm:p-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/40">
          <div class="flex items-center space-x-3">
            <!-- Nút Like -->
            <button onclick="toggleLikePost('${loc._id}', event)" id="btnLike_${loc._id}" class="flex items-center space-x-1.5 ${isLiked ? 'text-rose-600 font-bold' : 'text-slate-600 hover:text-rose-500'} transition-colors cursor-pointer">
              <i class="${isLiked ? 'fa-solid text-rose-500' : 'fa-regular'} fa-heart text-sm"></i>
              <span id="likeCount_${loc._id}">${initialLikes}</span>
            </button>

            <!-- Nút Bình luận -->
            <button onclick="openLocationModal('${loc._id}')" class="flex items-center space-x-1.5 text-slate-600 hover:text-[#FF5422] transition-colors cursor-pointer">
              <i class="fa-regular fa-comment text-sm"></i>
              <span>${loc.total_reviews || 0}</span>
            </button>
          </div>

          <!-- Nút Chi tiết -->
          <button onclick="openLocationModal('${loc._id}')" class="text-[#FF5422] font-bold text-xs hover:text-[#E84615] flex items-center space-x-1 cursor-pointer group-hover:translate-x-0.5 transition-transform">
            <span>Chi tiết</span>
            <i class="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Vẽ thanh phân trang
  renderPagination(allLocations.length);
}

// Bật tắt trạng thái thích (Like)
function toggleLikePost(locId, event) {
  event.stopPropagation();
  const isLiked = !likedPosts[locId];
  likedPosts[locId] = isLiked;
  localStorage.setItem('foodtravel_likes', JSON.stringify(likedPosts));

  const btn = document.getElementById(`btnLike_${locId}`);
  const countSpan = document.getElementById(`likeCount_${locId}`);
  if (btn && countSpan) {
    let currentVal = parseInt(countSpan.textContent) || 0;
    if (isLiked) {
      currentVal += 1;
      btn.className = 'flex items-center space-x-1.5 text-rose-600 font-bold transition-colors cursor-pointer';
      btn.innerHTML = `<i class="fa-solid fa-heart text-rose-500 text-sm"></i><span id="likeCount_${locId}">${currentVal}</span>`;
    } else {
      currentVal = Math.max(0, currentVal - 1);
      btn.className = 'flex items-center space-x-1.5 text-slate-600 hover:text-rose-500 transition-colors cursor-pointer';
      btn.innerHTML = `<i class="fa-regular fa-heart text-sm"></i><span id="likeCount_${locId}">${currentVal}</span>`;
    }
  }
}

// Vẽ thanh phân trang
function renderPagination(totalCount) {
  const container = document.getElementById('paginationContainer');
  if (!container) return;

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="cursor-pointer"'} class="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center justify-center transition-all">
      <i class="fa-solid fa-chevron-left text-[10px]"></i>
    </button>
  `;

  for (let p = 1; p <= totalPages; p++) {
    const isActive = p === currentPage;
    html += `
      <button onclick="goToPage(${p})" class="w-8 h-8 rounded-full text-xs font-bold transition-all cursor-pointer ${isActive ? 'bg-[#FF5422] text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}">
        ${p}
      </button>
    `;
  }

  html += `
    <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="cursor-pointer"'} class="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center justify-center transition-all">
      <i class="fa-solid fa-chevron-right text-[10px]"></i>
    </button>
  `;

  container.innerHTML = html;
}

function goToPage(page) {
  const totalPages = Math.ceil(allLocations.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderLocationsPage();
  scrollToContent();
}

// 3. TÌM KIẾM & BỘ LỌC
function handleSearch() {
  fetchLocations();
}

function applyFilters() {
  fetchLocations();
}

function filterCategory(cat) {
  currentCategoryFilter = cat;
  updateCategoryChipsUI();
  fetchLocations();
}

function updateCategoryChipsUI() {
  document.querySelectorAll('.category-chip').forEach(btn => {
    btn.className = 'category-chip px-4 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0 cursor-pointer';
  });
  const chips = document.querySelectorAll('.category-chip');
  chips.forEach(chip => {
    if (chip.getAttribute('onclick').includes(`'${currentCategoryFilter}'`)) {
      chip.className = 'category-chip active px-4 py-2 rounded-full text-xs font-bold bg-[#FF5422] text-white shadow-xs shrink-0 cursor-pointer';
    }
  });
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  const mobileInput = document.getElementById('searchInputMobile');
  if (mobileInput) mobileInput.value = '';
  document.getElementById('filterCity').value = 'ALL';
  currentCategoryFilter = 'ALL';
  updateCategoryChipsUI();
  switchView('explore');
  fetchLocations();
}

// 4. CHUYỂN TAB XEM (BANNER CHỈ HIỂN THỊ Ở TAB KHÁM PHÁ THEO YÊU CẦU)
function switchView(viewName) {
  const vExplore = document.getElementById('viewExplore');
  const vMap = document.getElementById('viewMap');
  const vStats = document.getElementById('viewStats');
  const heroBanner = document.getElementById('heroBannerSection');

  const btnExplore = document.getElementById('btnNavExplore');
  const btnMap = document.getElementById('btnNavMap');
  const btnStats = document.getElementById('btnNavStats');

  vExplore.classList.add('hidden');
  vMap.classList.add('hidden');
  vStats.classList.add('hidden');

  btnExplore.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1 cursor-pointer';
  btnMap.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1 cursor-pointer';
  btnStats.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1 cursor-pointer';

  if (viewName === 'explore') {
    vExplore.classList.remove('hidden');
    if (heroBanner) heroBanner.classList.remove('hidden');
    btnExplore.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-[#FF5422] shadow-xs flex items-center space-x-1 cursor-pointer';
  } else if (viewName === 'map') {
    vMap.classList.remove('hidden');
    if (heroBanner) heroBanner.classList.add('hidden'); // Ẩn banner khi qua tab Bản đồ
    btnMap.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-[#FF5422] shadow-xs flex items-center space-x-1 cursor-pointer';
    initLeafletMap();
  } else if (viewName === 'stats') {
    vStats.classList.remove('hidden');
    if (heroBanner) heroBanner.classList.add('hidden'); // Ẩn banner khi qua tab Thống kê
    btnStats.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-[#FF5422] shadow-xs flex items-center space-x-1 cursor-pointer';
    fetchAggregationStats();
  }
}

// 5. WIDGET SIDEBAR: TOP ĐỊA ĐIỂM ĐÁNH GIÁ CAO (AGGREGATION)
async function fetchSidebarTopRated() {
  const container = document.getElementById('sidebarTopRatedContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/analytics/top-rated');
    const data = await res.json();
    
    // Thu thập danh sách 4 địa điểm hàng đầu
    let list = [];
    data.forEach(group => {
      if (group.best_places && group.best_places.length > 0) {
        list.push(...group.best_places.slice(0, 2));
      }
    });

    list = list.slice(0, 4);

    if (list.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-400 text-center py-2">Chưa có dữ liệu xếp hạng</div>';
      return;
    }

    container.innerHTML = list.map((item, idx) => `
      <div onclick="openLocationModal('${item.id}')" class="flex items-center space-x-3 p-2 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group">
        <span class="w-6 h-6 rounded-full bg-amber-50 text-amber-700 text-xs font-black flex items-center justify-center shrink-0">
          ${idx + 1}
        </span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold text-slate-800 truncate group-hover:text-[#FF5422] transition-colors">${item.name}</div>
          <div class="text-[10px] text-slate-400">${item.category || 'Địa danh'}</div>
        </div>
        <div class="text-xs font-extrabold text-amber-500 shrink-0 flex items-center space-x-0.5">
          <i class="fa-solid fa-star text-[10px]"></i>
          <span>${item.rating_avg}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Lỗi tải widget top rated:', err);
  }
}

// 6. KHỞI TẠO BẢN ĐỒ VIỆT NAM (LEAFLET VỚI TỌA ĐỘ THỰC)
function initLeafletMap() {
  if (!mapInstance) {
    // Tọa độ trung tâm Việt Nam: [16.0611, 108.2272], zoom cấp quốc gia 6
    mapInstance = L.map('mapViewContainer').setView([16.0611, 108.2272], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; Bản đồ Việt Nam OpenStreetMap'
    }).addTo(mapInstance);
  }

  setTimeout(() => {
    mapInstance.invalidateSize();
    renderMapMarkers(allLocations);
  }, 200);
}

function renderMapMarkers(locations) {
  if (!mapInstance) return;

  // Xóa các marker cũ
  mapMarkers.forEach(m => mapInstance.removeLayer(m));
  mapMarkers = [];

  const countLabel = document.getElementById('mapPointsCountLabel');
  if (countLabel) countLabel.textContent = `${locations.length} điểm ghim`;

  locations.forEach(loc => {
    const [lng, lat] = loc.location.coordinates;
    const marker = L.marker([lat, lng]).addTo(mapInstance);
    
    marker.bindPopup(`
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; min-width: 190px;">
        <b style="color: #FF5422; font-size: 13px;">${loc.name}</b><br/>
        <span style="font-size: 11px; color: #64748b;">${loc.city} • ${loc.category}</span><br/>
        <span style="font-size: 11px; font-weight: bold; color: #f59e0b;">⭐ ${loc.rating_avg ? loc.rating_avg.toFixed(1) : '5.0'} (${loc.total_reviews} đánh giá)</span><br/>
        <button onclick="openLocationModal('${loc._id}')" style="margin-top: 8px; width: 100%; padding: 6px 10px; background: #FF5422; color: white; border: none; border-radius: 8px; font-size: 11px; cursor: pointer; font-weight: bold;">
          Xem bài viết &amp; đánh giá
        </button>
      </div>
    `);

    mapMarkers.push(marker);
  });
}

function focusCityMap(city) {
  if (!mapInstance) return;
  const cityCoords = {
    'ALL': [16.0611, 108.2272, 6],
    'Đà Nẵng': [16.0611, 108.2272, 13],
    'Hà Nội': [21.0285, 105.8542, 13],
    'TP.HCM': [10.7769, 106.7009, 13]
  };

  const target = cityCoords[city];
  if (target) {
    mapInstance.flyTo([target[0], target[1]], target[2], { duration: 1.2 });
  }
}

// 7. TÌM GẦN VỊ TRÍ HIỆN TẠI (GEOSPATIAL 2DSPHERE)
function getUserCurrentLocationAndFetchNearby() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await fetchNearbyLocations(longitude, latitude);
      },
      (err) => {
        alert('Hệ thống tìm kiếm các địa điểm trong bán kính 15km quanh Cầu Rồng Đà Nẵng!');
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
    alert(`Đã tìm thấy ${nearby.length} địa điểm ẩm thực & du lịch trong bán kính 15km quanh tọa độ [${lng.toFixed(2)}, ${lat.toFixed(2)}]!`);
    switchView('explore');
    allLocations = nearby;
    currentPage = 1;
    renderLocationsPage();
    scrollToContent();
  } catch (err) {
    console.error('Lỗi tìm nearby:', err);
  }
}

// 8. BẢNG THỐNG KÊ AGGREGATION PIPELINE
async function fetchAggregationStats() {
  try {
    const [resCities, resTopRated] = await Promise.all([
      fetch('/api/analytics/top-cities').then(r => r.json()),
      fetch('/api/analytics/top-rated').then(r => r.json())
    ]);

    // Bảng 1: Phân bố theo thành phố
    const tableCity = document.getElementById('tableStatsCity');
    if (tableCity) {
      tableCity.innerHTML = resCities.map(c => `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-3 font-bold text-slate-800">${c.city}</td>
          <td class="p-3 text-center font-semibold text-slate-700">${c.total_locations}</td>
          <td class="p-3 text-center text-amber-500 font-bold">⭐ ${c.avg_city_rating}</td>
          <td class="p-3 text-center text-slate-600">${c.total_reviews}</td>
        </tr>
      `).join('');
    }

    // Bảng 2: Top địa điểm điểm cao nhất
    const tableTopRated = document.getElementById('tableStatsTopRated');
    if (tableTopRated) {
      let topPlaces = [];
      resTopRated.forEach(group => {
        if (group.best_places) {
          group.best_places.forEach(p => {
            topPlaces.push({ ...p, city: group.city });
          });
        }
      });
      topPlaces.sort((a, b) => b.rating_avg - a.rating_avg);
      topPlaces = topPlaces.slice(0, 5);

      tableTopRated.innerHTML = topPlaces.map((p, idx) => `
        <tr class="hover:bg-slate-50 transition-colors cursor-pointer" onclick="openLocationModal('${p.id}')">
          <td class="p-3 font-bold text-slate-800 flex items-center space-x-2">
            <span class="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black flex items-center justify-center">${idx + 1}</span>
            <span class="hover:text-[#FF5422] transition-colors">${p.name}</span>
          </td>
          <td class="p-3 text-center text-slate-600">${p.city}</td>
          <td class="p-3 text-center text-amber-500 font-black">⭐ ${p.rating_avg}</td>
          <td class="p-3 text-center text-slate-500">${p.total_reviews || 0}</td>
        </tr>
      `).join('');
    }

  } catch (err) {
    console.error('Lỗi thống kê aggregation:', err);
  }
}

// 9. MODAL CHI TIẾT ĐỊA ĐIỂM (TỰ ĐỘNG RESET VỊ TRÍ CUỘN LÊN ĐỈNH ĐẦU)
async function openLocationModal(locId) {
  activeLocationId = locId;
  const modal = document.getElementById('locationDetailModal');
  const modalContainer = document.getElementById('locationModalContainer');
  const modalBody = document.getElementById('locationModalBody');
  if (!modal) return;

  try {
    const res = await fetch(`/api/locations/${locId}`);
    const loc = await res.json();

    document.getElementById('modalName').textContent = loc.name;
    document.getElementById('modalCity').querySelector('span').textContent = loc.address || `${loc.name}, ${loc.city}`;
    document.getElementById('modalCategoryBadge').textContent = loc.category;
    document.getElementById('modalRatingAvg').textContent = loc.rating_avg ? loc.rating_avg.toFixed(1) : '5.0';
    document.getElementById('modalTotalReviews').textContent = `${loc.total_reviews || 0} đánh giá`;
    document.getElementById('modalCoords').textContent = `[${loc.location.coordinates[0].toFixed(4)}, ${loc.location.coordinates[1].toFixed(4)}]`;
    document.getElementById('modalDescription').textContent = loc.description || 'Chưa có bài viết mô tả chi tiết.';
    
    const imgEl = document.getElementById('modalImg');
    if (imgEl) {
      imgEl.src = (loc.images && loc.images.length > 0) ? loc.images[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
    }

    renderReviewsList(loc.reviews || []);
    modal.classList.remove('hidden');

    // SỬA LỖI ẢNH 3: Luôn reset vị trí cuộn lên đỉnh đầu khi mở bất kỳ card nào
    if (modalContainer) {
      modalContainer.scrollTop = 0;
    }
    if (modalBody) {
      modalBody.scrollTop = 0;
    }
  } catch (err) {
    console.error('Lỗi mở chi tiết bài viết:', err);
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
    container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ cảm nhận!</div>';
    return;
  }

  container.innerHTML = reviews.map(rev => {
    const stars = '⭐'.repeat(rev.rating);
    const repliesHtml = (rev.replies && rev.replies.length > 0) ? `
      <div class="mt-2.5 pl-3 border-l-2 border-[#FF5422] space-y-2">
        ${rev.replies.map(rep => `
          <div class="bg-orange-50/60 p-2.5 rounded-xl text-xs text-slate-700">
            <div class="font-bold text-[#FF5422] text-[11px] flex items-center space-x-1">
              <i class="fa-solid fa-reply text-[10px]"></i>
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

        <!-- Phản hồi phân cấp (Replies lồng nhau) -->
        ${repliesHtml}

        <!-- Nút Trả lời -->
        <div class="pt-1 flex items-center justify-end">
          <button onclick="promptReply('${rev._id}')" class="text-[11px] font-bold text-[#FF5422] hover:text-[#E84615] flex items-center space-x-1 cursor-pointer">
            <i class="fa-solid fa-reply text-[10px]"></i>
            <span>Phản hồi</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 10. GỬI ĐÁNH GIÁ MỚI
async function submitReview() {
  if (!activeLocationId) return;

  const userNameInput = document.getElementById('inputReviewUser');
  const userName = userNameInput ? userNameInput.value.trim() : '';
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
      alert(`Đã gửi đánh giá thành công! Điểm đánh giá cập nhật: ⭐ ${data.rating_avg}`);
      document.getElementById('inputReviewContent').value = '';
      openLocationModal(activeLocationId);
      fetchLocations();
    } else {
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi gửi review:', err);
  }
}

// 11. PHẢN HỒI ĐÁNH GIÁ (REPLY)
async function promptReply(reviewId) {
  const defaultName = currentUser ? currentUser.name : 'Người phản hồi';
  const replyName = prompt('Nhập tên của bạn (hoặc Ban quản lý địa điểm):', defaultName);
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

// 12. THÊM ĐỊA ĐIỂM / BÀI VIẾT MỚI
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
      alert('Đã lưu bài viết / địa điểm mới thành công!');
      closeNewLocationModal();
      fetchLocations();
    } else {
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi tạo địa điểm:', err);
  }
}
