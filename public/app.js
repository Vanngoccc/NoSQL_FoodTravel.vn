// =====================================================================
// FoodTravel.vn Frontend Application Logic
// Mạng xã hội Ẩm thực & Du lịch Việt Nam (Chuẩn Figma 1541127234113621997)
// Toàn bộ Tài khoản, Đánh giá, Tim/Like và Thống kê lưu trên MONGODB
// =====================================================================

let allLocations = [];
let currentCategoryFilter = 'ALL';
let mapInstance = null;
let mapMarkers = [];
let activeLocationId = null;

// Phân trang danh sách bài viết / địa điểm (12 bài / trang)
let currentPage = 1;
const itemsPerPage = 12;

// Trạng thái modal Auth (login hoặc register)
let authMode = 'login';

// Người dùng hiện tại (Lấy từ MongoDB session)
let currentUser = localStorage.getItem('foodtravel_user') ? JSON.parse(localStorage.getItem('foodtravel_user')) : null;

// Nếu chưa có, tự động kết nối tài khoản mặc định của bạn (Huỳnh Văn Ngọc) trong MongoDB
if (!currentUser) {
  currentUser = {
    name: 'Huỳnh Văn Ngọc',
    email: 'vanngoc@foodtravel.vn',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    bio: 'Trưởng nhóm đồ án NoSQL Đề tài 04 - Đam mê khám phá ẩm thực ba miền và du lịch phượt.',
    saved_locations: []
  };
  localStorage.setItem('foodtravel_user', JSON.stringify(currentUser));
}

// Kiểm tra xem địa điểm có nằm trong danh sách đã lưu của người dùng hay không
function isLocationSaved(locId) {
  if (!currentUser || !currentUser.saved_locations || !locId) return false;
  return currentUser.saved_locations.some(item => {
    if (!item) return false;
    const id = typeof item === 'object' ? item._id : item;
    return id && id.toString() === locId.toString();
  });
}

// Đồng bộ thông tin người dùng mới nhất từ MongoDB (bao gồm saved_locations)
async function syncCurrentUserFromDB() {
  if (!currentUser || !currentUser.email) return;
  try {
    const res = await fetch(`/api/auth/me?email=${encodeURIComponent(currentUser.email)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        currentUser = { ...currentUser, ...data.user };
        localStorage.setItem('foodtravel_user', JSON.stringify(currentUser));
        updateUserUI();
      }
    }
  } catch (e) {
    console.error('Lỗi sync user từ MongoDB:', e);
  }
}

// Khởi chạy khi load trang
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
  syncCurrentUserFromDB();
  fetchHeroOverviewStats();
  fetchStories();
  fetchLocations();
  fetchSidebarTopRated();
  initStarRatingComponent();
  // Tự động kiểm tra thông báo mới định kỳ
  setInterval(() => {
    if (currentUser && currentUser.email) loadNotifications();
  }, 25000);
});

// =====================================================================
// 1. ĐỒNG BỘ SỐ LIỆU HERO VÀ TỔNG QUAN TỪ MONGODB
// =====================================================================
async function fetchHeroOverviewStats() {
  try {
    const res = await fetch('/api/stats/overview');
    const data = await res.json();

    // Đồng bộ trực tiếp 4 con số Hero Banner từ MongoDB (Đã tách riêng Bài viết và Đánh giá)
    const elUsers = document.getElementById('heroTotalUsers');
    const elLocations = document.getElementById('heroTotalLocations');
    const elReviews = document.getElementById('heroTotalReviews');
    const elCities = document.getElementById('heroTotalCities');

    if (elUsers) elUsers.textContent = data.total_users || 60;
    if (elLocations) elLocations.textContent = data.total_locations || 100;
    if (elReviews) elReviews.textContent = (data.total_reviews || 854).toLocaleString('vi-VN');
    if (elCities) elCities.textContent = data.total_cities || 3;

    // Cập nhật tab thống kê
    const statLocs = document.getElementById('statTotalLocations');
    const statRevs = document.getElementById('statTotalReviews');
    const statAvg = document.getElementById('statAvgRating');
    if (statLocs) statLocs.textContent = data.total_locations || 100;
    if (statRevs) statRevs.textContent = (data.total_reviews || 854).toLocaleString('vi-VN');
    if (statAvg) statAvg.textContent = `${data.avg_rating || 4.7}`;

    // Cập nhật Widget Chủ đề thịnh hành (Trending Tags) đồng bộ từ MongoDB
    if (data.trending_tags) {
      renderTrendingTags(data.trending_tags);
    }
  } catch (err) {
    console.error('Lỗi tải thống kê MongoDB:', err);
  }
}

function renderTrendingTags(tags) {
  const container = document.getElementById('trendingTagsContainer');
  if (!container || !tags || tags.length === 0) return;

  container.innerHTML = tags.map(t => `
    <div onclick="filterByTag('${t.type}', '${t.keyword}')" class="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group">
      <div>
        <div class="flex items-center space-x-1.5">
          <span class="text-sm font-bold text-slate-800 group-hover:text-[#FF5422] transition-colors">${t.tag}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-50 text-[#FF5422] font-semibold">${t.label}</span>
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5">${t.subtext}</p>
      </div>
      <i class="fa-solid fa-arrow-up-right-from-square text-xs text-slate-300 group-hover:text-[#FF5422] transition-colors"></i>
    </div>
  `).join('');
}

function filterByTag(type, keyword) {
  if (type === 'city') {
    document.getElementById('filterCity').value = keyword;
    currentCategoryFilter = 'ALL';
    updateCategoryChipsUI();
  } else if (type === 'category') {
    document.getElementById('filterCity').value = 'ALL';
    currentCategoryFilter = keyword;
    updateCategoryChipsUI();
  }
  fetchLocations();
  scrollToContent();
}

// =====================================================================
// ĐỒNG BỘ AVATAR VÀ THÔNG BÁO THỜI GIAN THỰC (MONGODB)
// =====================================================================
function getConsistentAvatar(name, customAvatar) {
  // Nếu là chính người dùng đang đăng nhập thì luôn ưu tiên avatar thực tế của họ
  if (currentUser && currentUser.name && name && currentUser.name.toLowerCase().trim() === name.toLowerCase().trim() && currentUser.avatar) {
    return currentUser.avatar;
  }
  // Bỏ qua placeholder ảnh nam Unsplash mặc định photo-1535713875002-d1d0cf377fde
  if (customAvatar && customAvatar.trim() && !customAvatar.includes('default') && !customAvatar.includes('photo-1535713875002-d1d0cf377fde') && (customAvatar.startsWith('http') || customAvatar.startsWith('/uploads'))) {
    return customAvatar;
  }
  const cleanName = (name || 'FoodTravel').trim();
  const colors = ['FF5422', '0ea5e9', '10b981', '8b5cf6', 'f59e0b', 'ec4899', '06b6d4', '3b82f6'];
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=${color}&color=ffffff&size=150&bold=true`;
}

let userNotifications = [];

async function loadNotifications() {
  const badge = document.getElementById('notifBadgeCount');
  const totalBadge = document.getElementById('notifTotalBadge');
  const container = document.getElementById('notifListContainer');

  if (!currentUser || !currentUser.email) {
    if (badge) badge.classList.add('hidden');
    if (totalBadge) totalBadge.textContent = '0 mới';
    if (container) {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-400 space-y-2 p-4">
          <i class="fa-regular fa-bell text-2xl text-slate-300"></i>
          <p class="text-xs font-semibold text-slate-700">Vui lòng đăng nhập</p>
          <p class="text-[10px] text-slate-400">Đăng nhập tài khoản để nhận thông báo mới khi có tương tác.</p>
          <button onclick="toggleNotificationDropdown(); openAuthModal('login')" class="px-4 py-1.5 bg-[#FF5422] text-white text-xs font-bold rounded-full hover:bg-[#E84615] transition-colors cursor-pointer">
            Đăng nhập ngay
          </button>
        </div>
      `;
    }
    return;
  }
  try {
    const res = await fetch(`/api/notifications?email=${encodeURIComponent(currentUser.email)}&name=${encodeURIComponent(currentUser.name || '')}`);
    if (res.ok) {
      userNotifications = await res.json();
      updateNotificationsUI();
    }
  } catch (e) {
    console.warn('Lỗi tải thông báo:', e);
  }
}

function updateNotificationsUI() {
  const badge = document.getElementById('notifBadgeCount');
  const totalBadge = document.getElementById('notifTotalBadge');
  const container = document.getElementById('notifListContainer');

  const unreadCount = userNotifications.filter(n => !n.is_read).length;

  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (totalBadge) {
    totalBadge.textContent = `${unreadCount} mới`;
  }

  if (container) {
    if (!userNotifications || userNotifications.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-400 space-y-1">
          <i class="fa-regular fa-bell-slash text-2xl text-slate-300"></i>
          <p class="text-xs font-semibold text-slate-600">Chưa có thông báo nào</p>
          <p class="text-[10px] text-slate-400">Khi có người thích bài viết, đánh giá hoặc nhắn tin, bạn sẽ thấy ở đây.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = userNotifications.map(n => {
      const typeIcons = {
        like: '<i class="fa-solid fa-heart text-rose-500"></i>',
        review: '<i class="fa-solid fa-star text-amber-500"></i>',
        reply: '<i class="fa-solid fa-reply text-blue-500"></i>',
        story_reply: '<i class="fa-solid fa-camera text-[#FF5422]"></i>'
      };
      const icon = typeIcons[n.type] || '<i class="fa-solid fa-bell text-[#FF5422]"></i>';
      const timeStr = formatPostTime(n.created_at || n.createdAt);
      const isUnread = !n.is_read;

      return `
        <div onclick="handleNotificationClick('${n.type}', '${n.target_id}')" class="p-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-start space-x-3 ${isUnread ? 'bg-orange-50/40' : ''}">
          <div class="relative shrink-0 mt-0.5">
            <img src="${getConsistentAvatar(n.sender_name, n.sender_avatar)}" class="w-8 h-8 rounded-full object-cover border border-slate-100">
            <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center text-[10px] shadow-xs">
              ${icon}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-slate-800 leading-snug font-medium">
              ${n.title}
            </p>
            ${n.content ? `<p class="text-[11px] text-slate-500 truncate mt-0.5 italic">"${n.content}"</p>` : ''}
            <span class="text-[10px] text-slate-400 mt-1 block">${timeStr}</span>
          </div>
          ${isUnread ? '<span class="w-2 h-2 rounded-full bg-[#FF5422] shrink-0 mt-2"></span>' : ''}
        </div>
      `;
    }).join('');
  }
}

function toggleNotificationDropdown() {
  const dd = document.getElementById('notificationDropdown');
  if (!dd) return;
  const isHidden = dd.classList.contains('hidden');
  if (isHidden) {
    dd.classList.remove('hidden');
    loadNotifications();
  } else {
    dd.classList.add('hidden');
  }
}

async function markAllNotificationsAsRead() {
  if (!currentUser || !currentUser.email) return;
  try {
    await fetch('/api/notifications/read-all', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email })
    });
    userNotifications.forEach(n => n.is_read = true);
    updateNotificationsUI();
  } catch (e) {
    console.error('Lỗi đánh dấu đã đọc:', e);
  }
}

function handleNotificationClick(type, targetId) {
  const dd = document.getElementById('notificationDropdown');
  if (dd) dd.classList.add('hidden');

  if (targetId) {
    if (type === 'story_reply') {
      openProfileModal('messages');
    } else {
      openLocationModal(targetId);
    }
  }
}

// =====================================================================
// 2. QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG & TRANG CÁ NHÂN (MONGODB)
// =====================================================================
function updateUserUI() {
  const section = document.getElementById('userAccountSection');
  const composerAvatar = document.getElementById('composerUserAvatar');
  const fbComposerName = document.getElementById('fbComposerName');
  const fbComposerAvatar = document.getElementById('fbComposerAvatar');
  const storyPreviewUserName = document.getElementById('storyPreviewUserName');
  const storyPreviewUserAvatar = document.getElementById('storyPreviewUserAvatar');

  if (currentUser) {
    currentUser.avatar = getConsistentAvatar(currentUser.name, currentUser.avatar);

    if (composerAvatar) composerAvatar.src = currentUser.avatar;
    if (fbComposerName) fbComposerName.textContent = currentUser.name;
    if (fbComposerAvatar) fbComposerAvatar.src = currentUser.avatar;
    if (storyPreviewUserName) storyPreviewUserName.textContent = currentUser.name;
    if (storyPreviewUserAvatar) storyPreviewUserAvatar.src = currentUser.avatar;

    if (section) {
      section.innerHTML = `
        <div class="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 pl-1.5 pr-3 py-1 rounded-full border border-slate-200 transition-all cursor-pointer shadow-2xs hover:border-[#FF5422]/50" onclick="openProfileModal()" title="Xem trang cá nhân của bạn">
          <img src="${currentUser.avatar}" alt="${currentUser.name}" class="w-7 h-7 rounded-full object-cover border border-[#FF5422]">
          <span class="text-xs font-bold text-slate-800 hidden sm:inline">${currentUser.name}</span>
        </div>
      `;
    }

    // Cập nhật form viết đánh giá chuẩn Ảnh 2
    const inputContent = document.getElementById('inputReviewContent');
    const avatarUser = document.getElementById('reviewUserAvatar');
    if (inputContent) inputContent.placeholder = `Bình luận dưới tên ${currentUser.name}...`;
    if (avatarUser) avatarUser.src = currentUser.avatar;

    loadNotifications();
  } else {
    if (fbComposerName) fbComposerName.textContent = 'Thành viên FoodTravel';
    if (storyPreviewUserName) storyPreviewUserName.textContent = 'Thành viên FoodTravel';
    if (section) {
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
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  if (btn) {
    btn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash text-xs"></i>' : '<i class="fa-solid fa-eye text-xs"></i>';
  }
}

function openAuthModal(mode = 'login') {
  authMode = mode;
  const title = document.getElementById('authModalTitle');
  const nameContainer = document.getElementById('authNameFieldContainer');
  const switchBtn = document.getElementById('authSwitchBtn');
  const submitBtn = document.getElementById('authSubmitBtn');
  const passInput = document.getElementById('authPassword');
  if (passInput) passInput.value = '';

  if (mode === 'login') {
    if (title) title.textContent = 'Đăng nhập tài khoản';
    if (nameContainer) nameContainer.classList.add('hidden');
    if (switchBtn) switchBtn.textContent = 'Chưa có tài khoản? Đăng ký ngay';
    if (submitBtn) submitBtn.textContent = 'Đăng nhập';
  } else {
    if (title) title.textContent = 'Đăng ký tài khoản mới';
    if (nameContainer) nameContainer.classList.remove('hidden');
    if (switchBtn) switchBtn.textContent = 'Đã có tài khoản? Đăng nhập ngay';
    if (submitBtn) submitBtn.textContent = 'Đăng ký';
  }

  document.getElementById('authModal').classList.remove('hidden');
}

function toggleAuthMode() {
  openAuthModal(authMode === 'login' ? 'register' : 'login');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

// Xử lý đăng nhập / đăng ký kết nối trực tiếp với MongoDB
async function handleAuthSubmit() {
  const email = document.getElementById('authUserEmail').value.trim();
  const name = document.getElementById('authUserName').value.trim();
  const password = document.getElementById('authPassword') ? document.getElementById('authPassword').value : '';

  if (!email) {
    alert('Vui lòng nhập email đăng nhập!');
    return;
  }

  if (!password || password.trim().length < 4) {
    alert('Vui lòng nhập mật khẩu tối thiểu 4 ký tự!');
    return;
  }

  try {
    let endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    let body = { email, password: password.trim() };
    if (authMode === 'register') {
      if (!name) {
        alert('Vui lòng nhập họ và tên của bạn!');
        return;
      }
      body.name = name;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok) {
      currentUser = data.user;
      localStorage.setItem('foodtravel_user', JSON.stringify(currentUser));
      updateUserUI();
      closeAuthModal();
      fetchHeroOverviewStats();
      alert(`Xin chào ${currentUser.name}! Bạn đã đăng nhập thành công.`);
    } else {
      alert('Thông báo: ' + (data.error || 'Đăng nhập thất bại'));
    }
  } catch (err) {
    console.error('Lỗi xác thực:', err);
  }
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('foodtravel_user');
  updateUserUI();
  closeProfileModal();
  alert('Đã đăng xuất tài khoản.');
}

// Modal Trang cá nhân (User Profile)
let currentProfileMessages = { received: [], sent: [], all: [] };
let activeMsgFilter = 'all';

async function openProfileModal(initialTab = 'posts') {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  const modal = document.getElementById('userProfileModal');

  // Khôi phục các nút riêng của tài khoản hiện tại
  const editAvatarBtn = document.getElementById('profileAvatarEditBtn');
  const logoutBtn = document.getElementById('profileLogoutBtn');
  const tabSaved = document.getElementById('btnProfileTabSaved');
  const tabMessages = document.getElementById('btnProfileTabMessages');
  if (editAvatarBtn) editAvatarBtn.classList.remove('hidden');
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  if (tabSaved) tabSaved.classList.remove('hidden');
  if (tabMessages) tabMessages.classList.remove('hidden');

  const tabPostsBtn = document.getElementById('btnProfileTabPosts');
  if (tabPostsBtn) tabPostsBtn.textContent = 'Bài viết của tôi';

  document.getElementById('profileModalAvatar').src = currentUser.avatar;
  document.getElementById('profileModalName').textContent = currentUser.name;
  document.getElementById('profileModalEmail').textContent = currentUser.email;
  document.getElementById('profileModalBio').textContent = currentUser.bio || 'Thành viên FoodTravel.vn';

  // Đồng bộ thông tin, bài viết đã đăng và bài đánh giá do user viết từ MongoDB
  try {
    let userData = null;
    let userReviews = [];
    let userPosts = [];

    // Tìm profile đầy đủ từ MongoDB (Bài viết, Đánh giá, Thông tin)
    let profileUrl = `/api/auth/user-profile?name=${encodeURIComponent(currentUser.name || '')}&email=${encodeURIComponent(currentUser.email || '')}`;
    if (currentUser._id) profileUrl += `&id=${currentUser._id}`;
    const res = await fetch(profileUrl);
    if (res.ok) {
      const data = await res.json();
      userData = data.user;
      userReviews = data.reviews || [];
      userPosts = data.posts || [];
    }

    if (userData) {
      currentUser = { ...currentUser, ...userData };
      localStorage.setItem('foodtravel_user', JSON.stringify(currentUser));

      const postCountEl = document.getElementById('profilePostCount');
      const revCountEl = document.getElementById('profileReviewCount');
      const savedCountEl = document.getElementById('profileSavedCount');
      const savedBadgeEl = document.getElementById('profileSavedBadge');

      if (postCountEl) postCountEl.textContent = userPosts.length;
      if (revCountEl) revCountEl.textContent = userReviews.length;
      const savedList = userData.saved_locations || [];
      if (savedCountEl) savedCountEl.textContent = savedList.length;
      if (savedBadgeEl) {
        savedBadgeEl.textContent = savedList.length;
        if (savedList.length > 0) savedBadgeEl.classList.remove('hidden');
        else savedBadgeEl.classList.add('hidden');
      }

      // 1. Render danh sách bài viết do người dùng đăng tải
      const postsListEl = document.getElementById('profilePostsList');
      if (postsListEl) {
        if (userPosts.length === 0) {
          postsListEl.innerHTML = '<div class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Bạn chưa đăng bài viết nào. Hãy bấm "Chia sẻ bài viết" để chia sẻ địa điểm nhé!</div>';
        } else {
          postsListEl.innerHTML = userPosts.map(p => {
            const pImg = (p.images && p.images.length > 0) ? p.images[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200';
            return `
              <div class="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 text-xs flex items-center justify-between gap-2.5 transition-colors group">
                <div class="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer" onclick="closeProfileModal(); openLocationModal('${p._id}')">
                  <img src="${pImg}" class="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 shadow-2xs">
                  <div class="min-w-0 flex-1">
                    <h5 class="text-xs font-bold text-slate-900 truncate group-hover:text-[#FF5422] transition-colors">${p.name}</h5>
                    <div class="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
                      <span>${p.city}</span>
                      <span>•</span>
                      <span class="text-[#FF5422] font-semibold">${p.category}</span>
                      <span>•</span>
                      <span class="text-slate-400">${formatPostTime(p.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center space-x-1 shrink-0">
                  <button onclick="closeProfileModal(); flyToLocationOnMap('${p._id}')" class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#FF5422] hover:text-[#FF5422] text-[10px] font-bold text-slate-700 transition-all cursor-pointer shadow-2xs" title="Xem trên bản đồ">
                    Bản đồ
                  </button>
                  <button onclick="deleteLocation('${p._id}', event)" class="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-400 flex items-center justify-center text-xs transition-all cursor-pointer shadow-2xs" title="Xóa bài viết này">
                    <i class="fa-solid fa-trash-can text-[11px]"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // 2. Render danh sách đánh giá đã viết
      const listEl = document.getElementById('profileReviewsList');
      if (listEl) {
        if (userReviews.length === 0) {
          listEl.innerHTML = '<div class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Bạn chưa viết đánh giá nào.</div>';
        } else {
          listEl.innerHTML = userReviews.map(r => `
            <div class="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 text-xs transition-colors cursor-pointer" onclick="closeProfileModal(); openLocationModal('${r.location_id}')">
              <div class="flex items-center justify-between font-bold text-slate-800">
                <span class="truncate text-slate-900 font-extrabold hover:text-[#FF5422]">${r.location_name}</span>
                <span class="text-amber-500 font-extrabold shrink-0">${r.rating}/5</span>
              </div>
              <p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${r.content}</p>
            </div>
          `).join('');
        }
      }

      // 3. Render danh sách địa điểm đã lưu
      renderSavedLocationsList(savedList);
    }

    // 4. Lấy tin nhắn (Nhận được & Đã gửi kiểu Messenger)
    if (currentUser.email) {
      const resReplies = await fetch(`/api/stories/my-replies/${encodeURIComponent(currentUser.email)}`);
      const repliesData = await resReplies.json();
      
      if (repliesData && !Array.isArray(repliesData)) {
        currentProfileMessages = {
          received: repliesData.received || [],
          sent: repliesData.sent || [],
          all: repliesData.all || []
        };
      } else if (Array.isArray(repliesData)) {
        currentProfileMessages = {
          received: repliesData,
          sent: [],
          all: repliesData
        };
      } else {
        currentProfileMessages = { received: [], sent: [], all: [] };
      }

      const badgeEl = document.getElementById('profileMessagesBadge');
      if (badgeEl) {
        const totalCount = currentProfileMessages.received.length;
        if (totalCount > 0) {
          badgeEl.textContent = totalCount;
          badgeEl.classList.remove('hidden');
        } else {
          badgeEl.classList.add('hidden');
        }
      }

      filterProfileMessages(activeMsgFilter || 'all');
    }
  } catch (e) {
    console.error('Lỗi tải profile data:', e);
  }

  switchProfileTab(initialTab);
  modal.classList.remove('hidden');
}

// Lọc tin nhắn Hộp thư Messenger (Tất cả / Nhận được / Đã gửi)
function filterProfileMessages(filterType) {
  activeMsgFilter = filterType;
  const btnAll = document.getElementById('btnMsgFilterAll');
  const btnReceived = document.getElementById('btnMsgFilterReceived');
  const btnSent = document.getElementById('btnMsgFilterSent');
  const inactiveClass = 'flex-1 py-1 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer';
  const activeClass = 'flex-1 py-1 rounded-lg bg-white text-slate-900 shadow-2xs font-extrabold cursor-pointer transition-all';

  if (btnAll) btnAll.className = (filterType === 'all') ? activeClass : inactiveClass;
  if (btnReceived) btnReceived.className = (filterType === 'received') ? activeClass : inactiveClass;
  if (btnSent) btnSent.className = (filterType === 'sent') ? activeClass : inactiveClass;

  renderProfileMessagesList();
}

function renderProfileMessagesList() {
  const container = document.getElementById('profileMessagesInnerList');
  if (!container) return;

  const list = currentProfileMessages[activeMsgFilter] || [];
  if (list.length === 0) {
    let emptyMsg = 'Chưa có tin nhắn nào.';
    if (activeMsgFilter === 'received') emptyMsg = 'Chưa có tin nhắn nào được gửi đến story của bạn.';
    if (activeMsgFilter === 'sent') emptyMsg = 'Bạn chưa gửi tin nhắn nào vào story của người khác.';
    container.innerHTML = `<div class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">${emptyMsg}</div>`;
    return;
  }

  container.innerHTML = list.map(msg => {
    const isSentByMe = msg.type === 'sent';
    if (isSentByMe) {
      // Tin nhắn tôi gửi cho người khác
      const recipientName = msg.story_owner_name || 'Tác giả';
      const recipientAvatar = getConsistentAvatar(recipientName, msg.story_owner_avatar);
      return `
        <div class="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs space-y-1.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-1.5 font-bold text-slate-800">
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">Đã gửi</span>
              <img src="${recipientAvatar}" class="w-5 h-5 rounded-full object-cover">
              <span class="truncate max-w-[140px]">Gửi đến: ${recipientName}</span>
            </div>
            <div class="flex items-center space-x-1.5">
              <span class="text-[10px] text-slate-400 font-medium">${formatMessageTime(msg.created_at)}</span>
              <button onclick="deleteStoryMessage('${msg.story_id}', ${msg.reply_index})" class="text-slate-400 hover:text-rose-500 text-xs p-1 cursor-pointer transition-colors" title="Xóa tin nhắn này">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
          <p class="text-[11px] text-slate-700 font-medium bg-white p-2 rounded-lg border border-blue-100/60">"${msg.message}"</p>
          <div class="text-[10px] text-blue-600 font-semibold flex items-center space-x-1">
            <i class="fa-solid fa-camera text-[9px]"></i>
            <span>Khoảnh khắc: ${msg.location_name}</span>
          </div>
          ${msg.reply_back ? `
            <div class="p-2 bg-emerald-50 rounded-lg text-emerald-800 text-[11px] font-semibold flex items-start space-x-1.5 border border-emerald-100">
              <span class="text-emerald-600 font-bold shrink-0">↳ ${recipientName} trả lời:</span>
              <span>${msg.reply_back}</span>
            </div>
          ` : `
            <div class="text-[10px] text-slate-400 italic">Đang chờ ${recipientName} phản hồi...</div>
          `}
          <!-- Nhắn tiếp như Messenger -->
          <div class="flex items-center space-x-1.5 pt-1">
            <input type="text" id="replySentInput_${msg.story_id}_${msg.reply_index}" placeholder="Nhắn tiếp cho ${recipientName}..." class="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500" onkeydown="if(event.key==='Enter') sendStoryReplyFromInbox('${msg.story_id}', 'replySentInput_${msg.story_id}_${msg.reply_index}')">
            <button onclick="sendStoryReplyFromInbox('${msg.story_id}', 'replySentInput_${msg.story_id}_${msg.reply_index}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0">
              Gửi
            </button>
          </div>
        </div>
      `;
    } else {
      // Tin nhắn người khác gửi vào story của tôi
      const senderName = msg.user_name || 'Người dùng';
      const senderAvatar = getConsistentAvatar(senderName, msg.user_avatar);
      return `
        <div class="p-3 bg-orange-50/50 rounded-xl border border-orange-100 text-xs space-y-1.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-1.5 font-bold text-slate-800">
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">Nhận được</span>
              <img src="${senderAvatar}" class="w-5 h-5 rounded-full object-cover">
              <span class="truncate max-w-[140px]">${senderName}</span>
            </div>
            <div class="flex items-center space-x-1.5">
              <span class="text-[10px] text-slate-400 font-medium">${formatMessageTime(msg.created_at)}</span>
              <button onclick="deleteStoryMessage('${msg.story_id}', ${msg.reply_index})" class="text-slate-400 hover:text-rose-500 text-xs p-1 cursor-pointer transition-colors" title="Xóa tin nhắn này">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
          <p class="text-[11px] text-slate-700 font-medium bg-white p-2 rounded-lg border border-orange-100/50">"${msg.message}"</p>
          <div class="text-[10px] text-[#FF5422] font-semibold flex items-center space-x-1">
            <i class="fa-solid fa-camera text-[9px]"></i>
            <span>Khoảnh khắc: ${msg.location_name}</span>
          </div>

          ${msg.reply_back ? `
            <div class="p-2 bg-emerald-50 rounded-lg text-emerald-800 text-[11px] font-semibold flex items-start space-x-1.5 border border-emerald-100">
              <span class="text-emerald-600 font-bold shrink-0">↳ Bạn:</span>
              <span>${msg.reply_back}</span>
            </div>
          ` : ''}

          <!-- Khung chat trả lời luôn sẵn sàng như Messenger -->
          <div class="flex items-center space-x-1.5 pt-1">
            <input type="text" id="replyInput_${msg.story_id}_${msg.reply_index}" placeholder="Nhập câu trả lời cho ${senderName}..." class="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-[#FF5422]" onkeydown="if(event.key==='Enter') sendStoryReplyBack('${msg.story_id}', ${msg.reply_index})">
            <button onclick="sendStoryReplyBack('${msg.story_id}', ${msg.reply_index})" class="px-3 py-1.5 bg-[#FF5422] hover:bg-[#E84615] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0">
              Gửi
            </button>
          </div>
        </div>
      `;
    }
  }).join('');
}

// Gửi tin nhắn tiếp cho tác giả Story từ Hộp thư
async function sendStoryReplyFromInbox(storyId, inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    alert('Vui lòng nhập nội dung tin nhắn!');
    return;
  }
  try {
    const res = await fetch(`/api/stories/${storyId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: currentUser ? currentUser.name : 'Khách',
        user_avatar: currentUser ? currentUser.avatar : '',
        user_email: currentUser ? currentUser.email : '',
        message: val
      })
    });
    if (res.ok) {
      input.value = '';
      alert('Đã gửi tin nhắn thành công!');
      await openProfileModal('messages');
    } else {
      const data = await res.json();
      alert('Lỗi: ' + (data.error || 'Không thể gửi tin nhắn'));
    }
  } catch (err) {
    console.error('Lỗi gửi tin nhắn từ hộp thư:', err);
  }
}

// Xem trang cá nhân công khai của người dùng bất kỳ
async function openUserProfile(name, email, event) {
  if (event) {
    event.stopPropagation();
  }
  if (!name || name === 'Thành viên FoodTravel' || name === 'Người khám phá') return;

  // Nếu là chính mình thì mở Profile cá nhân thông thường
  if (currentUser && (
    (currentUser.name && currentUser.name.toLowerCase() === name.toLowerCase()) ||
    (email && currentUser.email && currentUser.email.toLowerCase() === email.toLowerCase())
  )) {
    openProfileModal('posts');
    return;
  }

  const modal = document.getElementById('userProfileModal');
  if (!modal) return;

  // Ẩn các nút chỉnh sửa/đăng xuất/hộp thư/đã lưu của riêng mình
  const editAvatarBtn = document.getElementById('profileAvatarEditBtn');
  const logoutBtn = document.getElementById('profileLogoutBtn');
  const tabSaved = document.getElementById('btnProfileTabSaved');
  const tabMessages = document.getElementById('btnProfileTabMessages');
  if (editAvatarBtn) editAvatarBtn.classList.add('hidden');
  if (logoutBtn) logoutBtn.classList.add('hidden');
  if (tabSaved) tabSaved.classList.add('hidden');
  if (tabMessages) tabMessages.classList.add('hidden');

  // Đổi tiêu đề tab bài viết
  const tabPostsBtn = document.getElementById('btnProfileTabPosts');
  if (tabPostsBtn) tabPostsBtn.textContent = `Bài viết của ${name}`;

  // Đặt thông tin tạm thời
  document.getElementById('profileModalAvatar').src = getConsistentAvatar(name);
  document.getElementById('profileModalName').textContent = name;
  document.getElementById('profileModalEmail').textContent = email || '';
  document.getElementById('profileModalBio').textContent = 'Thành viên cộng đồng FoodTravel.vn';

  document.getElementById('profilePostCount').textContent = '0';
  document.getElementById('profileReviewCount').textContent = '0';
  document.getElementById('profileSavedCount').textContent = '0';

  const postsListEl = document.getElementById('profilePostsList');
  const reviewsListEl = document.getElementById('profileReviewsList');
  if (postsListEl) postsListEl.innerHTML = '<div class="text-xs text-slate-400 text-center py-6">Đang tải bài viết...</div>';
  if (reviewsListEl) reviewsListEl.innerHTML = '<div class="text-xs text-slate-400 text-center py-6">Đang tải đánh giá...</div>';

  switchProfileTab('posts');
  modal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/auth/user-profile?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email || '')}`);
    if (res.ok) {
      const data = await res.json();
      const user = data.user || {};
      const posts = data.posts || [];
      const reviews = data.reviews || [];

      if (user.avatar) document.getElementById('profileModalAvatar').src = getConsistentAvatar(user.name || name, user.avatar);
      if (user.bio) document.getElementById('profileModalBio').textContent = user.bio;
      document.getElementById('profilePostCount').textContent = posts.length;
      document.getElementById('profileReviewCount').textContent = reviews.length;

      // Render bài viết của user này
      if (postsListEl) {
        if (posts.length === 0) {
          postsListEl.innerHTML = `<div class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">${name} chưa đăng bài viết nào.</div>`;
        } else {
          postsListEl.innerHTML = posts.map(p => {
            const pImg = (p.images && p.images.length > 0) ? p.images[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200';
            return `
              <div class="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 text-xs flex items-center justify-between gap-2.5 transition-colors group">
                <div class="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer" onclick="closeProfileModal(); openLocationModal('${p._id}')">
                  <img src="${pImg}" class="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 shadow-2xs">
                  <div class="min-w-0 flex-1">
                    <h5 class="text-xs font-bold text-slate-900 truncate group-hover:text-[#FF5422] transition-colors">${p.name}</h5>
                    <div class="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
                      <span>${p.city}</span>
                      <span>•</span>
                      <span class="text-[#FF5422] font-semibold">${p.category}</span>
                      <span>•</span>
                      <span class="text-slate-400">${formatPostTime(p.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center space-x-1 shrink-0">
                  <button onclick="closeProfileModal(); flyToLocationOnMap('${p._id}')" class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#FF5422] hover:text-[#FF5422] text-[10px] font-bold text-slate-700 transition-all cursor-pointer shadow-2xs" title="Xem trên bản đồ">
                    Bản đồ
                  </button>
                  <button onclick="closeProfileModal(); openLocationModal('${p._id}')" class="px-2.5 py-1 rounded-lg bg-[#FF5422] text-white text-[10px] font-bold transition-all cursor-pointer shadow-2xs">
                    Xem
                  </button>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // Render đánh giá của user này
      if (reviewsListEl) {
        if (reviews.length === 0) {
          reviewsListEl.innerHTML = `<div class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">${name} chưa có đánh giá nào.</div>`;
        } else {
          reviewsListEl.innerHTML = reviews.map(r => `
            <div class="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 text-xs transition-colors cursor-pointer" onclick="closeProfileModal(); openLocationModal('${r.location_id}')">
              <div class="flex items-center justify-between font-bold text-slate-800">
                <span class="truncate text-slate-900 font-extrabold hover:text-[#FF5422]">${r.location_name}</span>
                <span class="text-amber-500 font-extrabold shrink-0">${r.rating}/5</span>
              </div>
              <p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${r.content}</p>
            </div>
          `).join('');
        }
      }
    }
  } catch (err) {
    console.error('Lỗi tải public profile:', err);
  }
}

// Xóa tin nhắn câu hỏi/phản hồi Story (Đồng bộ MongoDB)
async function deleteStoryMessage(storyId, replyIndex) {
  if (!confirm('Bạn có chắc chắn muốn xóa tin nhắn này không?')) return;
  try {
    const res = await fetch(`/api/stories/${storyId}/replies/${replyIndex}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      alert('Đã xóa tin nhắn thành công!');
      openProfileModal('messages');
    } else {
      const data = await res.json();
      alert('Lỗi: ' + (data.error || 'Không thể xóa tin nhắn'));
    }
  } catch (err) {
    console.error('Lỗi xóa tin nhắn:', err);
  }
}

// Gửi câu trả lời cho tin nhắn story
async function sendStoryReplyBack(storyId, replyIndex) {
  const input = document.getElementById(`replyInput_${storyId}_${replyIndex}`);
  if (!input) return;
  const replyText = input.value.trim();
  if (!replyText) {
    alert('Vui lòng nhập nội dung câu trả lời!');
    return;
  }

  try {
    const res = await fetch(`/api/stories/${storyId}/reply-back`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply_index: replyIndex,
        reply_text: replyText
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Đã gửi câu trả lời thành công!');
      await openProfileModal('messages');
    } else {
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi gửi reply back:', err);
  }
}

// Render danh sách địa điểm đã lưu trong trang cá nhân
function renderSavedLocationsList(savedLocs) {
  const container = document.getElementById('profileSavedList');
  if (!container) return;

  if (!savedLocs || savedLocs.length === 0) {
    container.innerHTML = `
      <div class="py-6 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl p-4 border border-dashed border-slate-200">
        <i class="fa-regular fa-bookmark text-2xl text-amber-500/60"></i>
        <p class="text-xs font-bold text-slate-700">Chưa có địa điểm đã lưu</p>
        <p class="text-[11px] text-slate-400 max-w-xs mx-auto">Nhấn nút Lưu trên các bài viết để lưu lại các địa điểm yêu thích nhé!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = savedLocs.map(item => {
    const locId = item._id || item;
    const locName = item.name || 'Địa điểm yêu thích';
    const locCity = item.city || '';
    const locCategory = item.category || 'Địa danh';
    const locImg = (item.images && item.images.length > 0) ? item.images[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200';
    const locRating = item.rating_avg ? item.rating_avg.toFixed(1) : '5.0';

    return `
      <div class="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 text-xs flex items-center justify-between gap-2.5 transition-colors group">
        <div class="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer" onclick="closeProfileModal(); openLocationModal('${locId}')">
          <img src="${locImg}" class="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 shadow-2xs">
          <div class="min-w-0 flex-1">
            <h5 class="text-xs font-bold text-slate-900 truncate group-hover:text-[#FF5422] transition-colors">${locName}</h5>
            <div class="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
              <span>${locCity}</span>
              <span>•</span>
              <span class="text-[#FF5422] font-semibold">${locCategory}</span>
              <span>•</span>
              <span class="text-amber-500 font-bold flex items-center space-x-0.5">
                <i class="fa-solid fa-star text-[9px]"></i>
                <span>${locRating}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-1 shrink-0">
          <button onclick="closeProfileModal(); openLocationModal('${locId}')" class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#FF5422] hover:text-[#FF5422] text-[10px] font-bold text-slate-700 transition-all cursor-pointer shadow-2xs" title="Xem chi tiết">
            Xem
          </button>
          <button onclick="toggleSaveLocation('${locId}', event)" class="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-400 flex items-center justify-center text-xs transition-all cursor-pointer shadow-2xs" title="Bỏ lưu địa điểm này">
            <i class="fa-solid fa-trash-can text-[11px]"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function switchProfileTab(tab) {
  const btnPosts = document.getElementById('btnProfileTabPosts');
  const btnReviews = document.getElementById('btnProfileTabReviews');
  const btnSaved = document.getElementById('btnProfileTabSaved');
  const btnMessages = document.getElementById('btnProfileTabMessages');

  const listPosts = document.getElementById('profilePostsList');
  const listReviews = document.getElementById('profileReviewsList');
  const listSaved = document.getElementById('profileSavedList');
  const listMessages = document.getElementById('profileStoryRepliesList');

  const defaultTabClass = 'text-xs font-semibold text-slate-400 hover:text-slate-700 pb-1 cursor-pointer transition-colors flex items-center space-x-1 shrink-0';
  const activeTabClass = 'text-xs font-bold text-[#FF5422] border-b-2 border-[#FF5422] pb-1 cursor-pointer transition-colors flex items-center space-x-1 shrink-0';

  if (btnPosts) btnPosts.className = defaultTabClass;
  if (btnReviews) btnReviews.className = defaultTabClass;
  if (btnSaved) btnSaved.className = defaultTabClass;
  if (btnMessages) btnMessages.className = defaultTabClass;

  if (listPosts) listPosts.classList.add('hidden');
  if (listReviews) listReviews.classList.add('hidden');
  if (listSaved) listSaved.classList.add('hidden');
  if (listMessages) listMessages.classList.add('hidden');

  if (tab === 'posts') {
    if (btnPosts) btnPosts.className = 'text-xs font-bold text-rose-500 border-b-2 border-rose-500 pb-1 cursor-pointer transition-colors shrink-0';
    if (listPosts) listPosts.classList.remove('hidden');
  } else if (tab === 'reviews') {
    if (btnReviews) btnReviews.className = activeTabClass;
    if (listReviews) listReviews.classList.remove('hidden');
  } else if (tab === 'saved') {
    if (btnSaved) btnSaved.className = activeTabClass;
    if (listSaved) {
      listSaved.classList.remove('hidden');
      renderSavedLocationsList(currentUser ? currentUser.saved_locations : []);
    }
  } else if (tab === 'messages') {
    if (btnMessages) btnMessages.className = activeTabClass;
    if (listMessages) listMessages.classList.remove('hidden');
  }
}

function closeProfileModal() {
  document.getElementById('userProfileModal').classList.add('hidden');
}

async function promptChangeAvatar() {
  const newAvatar = prompt('Nhập đường dẫn (URL) ảnh đại diện mới:', currentUser.avatar);
  if (!newAvatar || newAvatar.trim() === '') return;

  currentUser.avatar = newAvatar.trim();
  localStorage.setItem('foodtravel_user', JSON.stringify(currentUser));
  updateUserUI();
  document.getElementById('profileModalAvatar').src = currentUser.avatar;

  if (currentUser._id) {
    await fetch(`/api/auth/profile/${currentUser._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: newAvatar.trim() })
    });
  } else if (currentUser.email) {
    await fetch('/api/auth/profile-by-email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email, avatar: newAvatar.trim() })
    });
  }
  if (typeof fetchStories === 'function') fetchStories();
}

// Cuộn mượt đến nội dung chính
function scrollToContent() {
  const target = document.getElementById('mainContentContainer');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

// =====================================================================
// 3. TẢI DANH SÁCH BÀI VIẾT / ĐỊA ĐIỂM TỪ BACKEND
// =====================================================================
async function fetchLocations() {
  try {
    const searchVal = document.getElementById('searchInput').value.trim();
    const cityVal = document.getElementById('filterCity').value;
    const sortVal = document.getElementById('sortBy').value;
    const filterTime = document.getElementById('filterTime');
    const timeVal = filterTime ? filterTime.value : 'all';

    let url = `/api/locations?city=${cityVal}&category=${currentCategoryFilter}&sort=${sortVal}&time=${timeVal}`;
    if (searchVal) {
      url += `&search=${encodeURIComponent(searchVal)}`;
    }

    const res = await fetch(url);
    allLocations = await res.json();
    currentPage = 1;

    renderLocationsPage();
    if (mapInstance) {
      renderMapMarkers(allLocations);
    }
  } catch (err) {
    console.error('Lỗi tải danh sách địa điểm:', err);
  }
}

function handleSearchMobile() {
  const mobileInput = document.getElementById('searchInputMobile');
  if (mobileInput) {
    document.getElementById('searchInput').value = mobileInput.value;
    fetchLocations();
  }
}

function quickFilterKeyword(keyword) {
  document.getElementById('searchInput').value = keyword;
  currentCategoryFilter = 'ALL';
  updateCategoryChipsUI();
  fetchLocations();
  scrollToContent();
}

// =====================================================================
// 4. PHÂN TRANG & HIỂN THỊ POST CARDS (TIM / LIKE LƯU TRỰC TIẾP TRÊN MONGODB)
// =====================================================================
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

  const startIndex = (currentPage - 1) * itemsPerPage;
  const pageItems = allLocations.slice(startIndex, startIndex + itemsPerPage);

  container.innerHTML = pageItems.map((loc, index) => {
    const imgUrl = (loc.images && loc.images.length > 0) ? loc.images[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
    const isLiked = loc.liked_by && currentUser ? loc.liked_by.includes(currentUser.email) : false;
    const likesCount = loc.likes_count || 0;
    const isSaved = isLocationSaved(loc._id);

    // Lấy thông tin tác giả bài viết từ MongoDB (chỉ gắn cờ nếu đúng là bài của người đăng nhập)
    const isMyPost = currentUser && (
      (loc.author_email && currentUser.email && loc.author_email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (loc.author_name && currentUser.name && loc.author_name.toLowerCase() === currentUser.name.toLowerCase())
    );

    const authorName = (loc.author_name && loc.author_name.trim() && loc.author_name !== 'Thành viên FoodTravel' && loc.author_name !== 'Người khám phá') 
      ? loc.author_name 
      : (isMyPost ? currentUser.name : (loc.reviews && loc.reviews.length > 0 && loc.reviews[0].user_name ? loc.reviews[0].user_name : (currentUser ? currentUser.name : 'Huỳnh Văn Ngọc')));
    const authorAvatar = isMyPost ? currentUser.avatar : getConsistentAvatar(authorName, loc.author_avatar);
    const timeAgoStr = formatPostTime(loc.createdAt);

    return `
      <div class="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
        <div>
          <!-- Header Thẻ: Người đăng & Tỉnh thành & Thời gian đăng (Đồng bộ MongoDB) -->
          <div class="p-3.5 pb-2.5 flex items-center justify-between">
            <div class="flex items-center space-x-2.5 min-w-0">
              <img src="${authorAvatar}" onclick="openUserProfile('${authorName.replace(/'/g, "\\'")}', '${(loc.author_email || '').replace(/'/g, "\\'")}', event)" class="w-8 h-8 rounded-full object-cover border border-slate-100 shrink-0 cursor-pointer hover:ring-2 hover:ring-[#FF5422]/50 transition-all" title="Xem trang cá nhân của ${authorName}">
              <div class="min-w-0">
                <div class="flex items-center space-x-1.5 truncate">
                  <h4 onclick="openUserProfile('${authorName.replace(/'/g, "\\'")}', '${(loc.author_email || '').replace(/'/g, "\\'")}', event)" class="text-xs font-bold text-slate-900 leading-tight truncate cursor-pointer hover:text-[#FF5422] transition-colors" title="Xem trang cá nhân của ${authorName}">${authorName}</h4>
                  ${isMyPost ? '<span class="text-[9px] px-1.5 py-0.5 bg-rose-50 text-rose-600 font-bold rounded shrink-0">Tác giả</span>' : ''}
                </div>
                <div class="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5">
                  <div onclick="flyToLocationOnMap('${loc._id}', event)" class="flex items-center space-x-0.5 hover:text-[#FF5422] cursor-pointer transition-colors" title="Lia bản đồ tới ${loc.name}">
                    <i class="fa-solid fa-location-dot text-[#FF5422] text-[9px]"></i>
                    <span>${loc.city}</span>
                  </div>
                  <span>•</span>
                  <span>${timeAgoStr}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center space-x-1.5 shrink-0">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                ${loc.category || 'Ẩm thực'}
              </span>
              ${isMyPost ? `
                <button onclick="deleteLocation('${loc._id}', event)" class="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs transition-colors cursor-pointer" title="Xóa bài viết của bạn">
                  <i class="fa-solid fa-trash-can text-[11px]"></i>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Thumbnail Hình ảnh, Nút Lưu nhanh & Badge Sao -->
          <div onclick="openLocationModal('${loc._id}')" class="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-100 cursor-pointer">
            <img src="${imgUrl}" alt="${loc.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            
            <!-- Nút Lưu nhanh góc phải trên ảnh -->
            <button onclick="toggleSaveLocation('${loc._id}', event)" id="badgeSaveCard_${loc._id}" class="absolute top-3 right-3 w-8 h-8 rounded-full ${isSaved ? 'bg-amber-500 text-white' : 'bg-slate-900/60 text-white hover:bg-slate-900/80'} backdrop-blur-md flex items-center justify-center transition-all shadow-md cursor-pointer hover:scale-110 z-10" title="${isSaved ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm này'}">
              <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark text-xs"></i>
            </button>

            <div class="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-900/75 backdrop-blur-md text-amber-400 flex items-center space-x-1 shadow-sm">
              <i class="fa-solid fa-star text-xs"></i>
              <span>${(loc.total_reviews && loc.total_reviews > 0) ? (loc.rating_avg ? loc.rating_avg.toFixed(1) : '0.0') : 'Mới'}</span>
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

        <!-- Thanh tương tác: TIM/LIKE & LƯU & LIA BẢN ĐỒ -->
        <div class="p-3 sm:p-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/40">
          <div class="flex items-center space-x-3">
            <!-- Nút Like kết nối MongoDB -->
            <button onclick="toggleLikePost('${loc._id}', event)" id="btnLike_${loc._id}" class="flex items-center space-x-1.5 ${isLiked ? 'text-rose-600 font-bold' : 'text-slate-600 hover:text-rose-500'} transition-colors cursor-pointer" title="Thích bài viết">
              <i class="${isLiked ? 'fa-solid text-rose-500' : 'fa-regular'} fa-heart text-sm"></i>
              <span id="likeCount_${loc._id}">${likesCount}</span>
            </button>

            <!-- Nút Bình luận -->
            <button onclick="openLocationModal('${loc._id}')" class="flex items-center space-x-1.5 text-slate-600 hover:text-[#FF5422] transition-colors cursor-pointer" title="Xem bình luận">
              <i class="fa-regular fa-comment text-sm"></i>
              <span>${loc.total_reviews || 0}</span>
            </button>

            <!-- Nút Lưu địa điểm (Bookmark MongoDB) -->
            <button onclick="toggleSaveLocation('${loc._id}', event)" id="btnSaveCard_${loc._id}" class="flex items-center space-x-1.5 ${isSaved ? 'text-amber-600 font-bold' : 'text-slate-600 hover:text-amber-500'} transition-colors cursor-pointer" title="${isSaved ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm này'}">
              <i class="${isSaved ? 'fa-solid text-amber-500' : 'fa-regular'} fa-bookmark text-sm"></i>
              <span class="hidden sm:inline">${isSaved ? 'Đã lưu' : 'Lưu'}</span>
            </button>

            <!-- Nút Lia bản đồ tới vị trí bài viết -->
            <button onclick="flyToLocationOnMap('${loc._id}', event)" class="flex items-center space-x-1 text-slate-600 hover:text-[#FF5422] font-semibold transition-colors cursor-pointer" title="Lia bản đồ tới ${loc.name}">
              <i class="fa-solid fa-map-location-dot text-sm text-[#FF5422]"></i>
              <span class="hidden sm:inline">Bản đồ</span>
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

  renderPagination(allLocations.length);
}

// Xóa bài viết / địa điểm do chính tác giả đăng tải
async function deleteLocation(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
  try {
    const res = await fetch(`/api/locations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: currentUser ? currentUser.email : '' })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Đã xóa bài viết thành công!');
      fetchLocations();
      fetchHeroOverviewStats();
      if (document.getElementById('locationDetailModal') && !document.getElementById('locationDetailModal').classList.contains('hidden')) {
        closeLocationModal();
      }
      if (currentUser) openProfileModal();
    } else {
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi xóa bài:', err);
  }
}

// Bật tắt tim/like lưu trữ trực tiếp vào MongoDB
async function toggleLikePost(locId, event) {
  event.stopPropagation();
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch(`/api/locations/${locId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: currentUser.email })
    });

    const data = await res.json();
    if (res.ok) {
      // Cập nhật trạng thái trong bộ nhớ và giao diện
      const loc = allLocations.find(l => l._id === locId);
      if (loc) {
        loc.likes_count = data.likes_count;
        if (!loc.liked_by) loc.liked_by = [];
        if (data.isLiked) {
          loc.liked_by.push(currentUser.email);
        } else {
          loc.liked_by = loc.liked_by.filter(e => e !== currentUser.email);
        }
      }

      const btn = document.getElementById(`btnLike_${locId}`);
      if (btn) {
        if (data.isLiked) {
          btn.className = 'flex items-center space-x-1.5 text-rose-600 font-bold transition-colors cursor-pointer';
          btn.innerHTML = `<i class="fa-solid fa-heart text-rose-500 text-sm"></i><span id="likeCount_${locId}">${data.likes_count}</span>`;
        } else {
          btn.className = 'flex items-center space-x-1.5 text-slate-600 hover:text-rose-500 transition-colors cursor-pointer';
          btn.innerHTML = `<i class="fa-regular fa-heart text-sm"></i><span id="likeCount_${locId}">${data.likes_count}</span>`;
        }
      }
    }
  } catch (err) {
    console.error('Lỗi thả tim MongoDB:', err);
  }
}

// Phân trang
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

// 5. TÌM KIẾM & BỘ LỌC
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
  const filterTime = document.getElementById('filterTime');
  if (filterTime) filterTime.value = 'all';
  const sortBy = document.getElementById('sortBy');
  if (sortBy) sortBy.value = 'newest';
  currentCategoryFilter = 'ALL';
  updateCategoryChipsUI();
  switchView('explore');
  fetchLocations();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 6. CHUYỂN TAB XEM
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
    if (heroBanner) heroBanner.classList.add('hidden');
    btnMap.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-[#FF5422] shadow-xs flex items-center space-x-1 cursor-pointer';
    initLeafletMap();
    setTimeout(() => {
      if (mapInstance) {
        mapInstance.invalidateSize();
        mapInstance.fitBounds([[8.1, 102.0], [23.5, 109.8]], { padding: [15, 15] });
        autoShowUserLocationOnMap();
      }
    }, 100);
    setTimeout(() => {
      if (mapInstance) {
        mapInstance.invalidateSize();
      }
    }, 350);
  } else if (viewName === 'stats') {
    vStats.classList.remove('hidden');
    if (heroBanner) heroBanner.classList.add('hidden');
    btnStats.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-[#FF5422] shadow-xs flex items-center space-x-1 cursor-pointer';
    fetchAggregationStats();
  }
}

// 7. WIDGET SIDEBAR: TOP ĐỊA ĐIỂM ĐÁNH GIÁ CAO (AGGREGATION)
async function fetchSidebarTopRated() {
  const container = document.getElementById('sidebarTopRatedContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/analytics/top-rated');
    const data = await res.json();
    
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

// 8. BẢN ĐỒ VIỆT NAM (LEAFLET TỌA ĐỘ THỰC & TỰ ĐỘNG ĐỊNH VỊ VỊ TRÍ BẠN)
let userLocationMarker = null;
let currentUserGpsCoords = null;

// Giới hạn khu vực bản đồ rộng rãi quanh Việt Nam và Biển Đông để gạch bản đồ tải tràn viền 100% (triệt tiêu hoàn toàn khoảng trống xám)
const VIETNAM_REGION_BOUNDS = L.latLngBounds(
  [5.0, 95.0],   // Phía Nam & Tây Nam (bao gồm trọn vẹn biển đảo, Vịnh Thái Lan)
  [26.0, 118.0]  // Phía Bắc & Đông Bắc (bao gồm trọn vẹn miền Bắc, Vịnh Bắc Bộ và Biển Đông)
);

function initLeafletMap() {
  if (!mapInstance) {
    mapInstance = L.map('mapViewContainer', {
      scrollWheelZoom: true,
      maxBounds: VIETNAM_REGION_BOUNDS,
      maxBoundsViscosity: 0.6,
      minZoom: 4.2,            // Cho phép thu nhỏ vừa vặn toàn cảnh dải đất chữ S Việt Nam
      maxZoom: 18
    });

    // Sử dụng Esri World Street Map không giới hạn bounds để gạch bản đồ tải tràn viền 100%, không bao giờ xuất hiện mảng xám trống
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Bản đồ Việt Nam (Esri World Street Map)',
      maxZoom: 18
    }).addTo(mapInstance);

    // Canh chỉnh khung nhìn hiển thị trọn vẹn toàn bộ dải đất chữ S Việt Nam từ Bắc vào Nam
    mapInstance.fitBounds([[8.1, 102.0], [23.5, 109.8]], { padding: [15, 15] });

    // Sự kiện nhấn vào bản đồ để chọn tọa độ chính xác khi tạo bài viết
    mapInstance.on('click', function(e) {
      if (isPickingOnMap) {
        isPickingOnMap = false;
        mapInstance.getContainer().style.cursor = '';
        const lat = parseFloat(e.latlng.lat.toFixed(6));
        const lng = parseFloat(e.latlng.lng.toFixed(6));
        openNewLocationModal();
        document.getElementById('newLocLat').value = lat;
        document.getElementById('newLocLng').value = lng;
        const coordsDisplay = document.getElementById('newLocCoordsDisplay');
        if (coordsDisplay) {
          coordsDisplay.innerHTML = `
            <i class="fa-solid fa-circle-check text-emerald-500"></i>
            <span class="text-emerald-700 font-bold">Đã ghim: ${lat}, ${lng}</span>
          `;
        }
      }
    });
  }

  // Invalidate kích thước container để bản đồ hiển thị đầy đủ ngay lập tức
  setTimeout(() => {
    if (mapInstance) {
      mapInstance.invalidateSize();
      mapInstance.fitBounds([[8.1, 102.0], [23.5, 109.8]], { padding: [15, 15] });
      autoShowUserLocationOnMap();
    }
  }, 80);

  setTimeout(() => {
    if (mapInstance) {
      mapInstance.invalidateSize();
      renderMapMarkers(allLocations);
      autoShowUserLocationOnMap();
    }
  }, 250);
}

// Tự động lấy GPS hiển thị vị trí người dùng lên bản đồ
function autoShowUserLocationOnMap() {
  if (currentUserGpsCoords) {
    addUserLocationPinToMap(currentUserGpsCoords.lat, currentUserGpsCoords.lng, false);
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        currentUserGpsCoords = { lat: latitude, lng: longitude };
        addUserLocationPinToMap(latitude, longitude, false);
      },
      (err) => {
        console.log('Chưa cấp quyền GPS hoặc dùng tọa độ mặc định:', err.message);
      },
      { timeout: 6000, enableHighAccuracy: true }
    );
  }
}

// Ghim biểu tượng vị trí người dùng với hiệu ứng sóng xanh tỏa ra và bảng tên nổi bật
function addUserLocationPinToMap(userLat, userLng, isFallback = false) {
  if (!mapInstance) return;

  if (userLocationMarker) {
    mapInstance.removeLayer(userLocationMarker);
  }

  const userPinIcon = L.divIcon({
    className: 'custom-user-pin',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <span class="user-pulse-ring" style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background: rgba(37, 99, 235, 0.4);"></span>
        <div style="position: relative; width: 22px; height: 22px; background: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.7); display: flex; align-items: center; justify-content: center; z-index: 2;">
          <div style="width: 7px; height: 7px; background: white; border-radius: 50%;"></div>
        </div>
        <div style="position: absolute; top: -22px; white-space: nowrap; background: #1e3a8a; color: white; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 6px rgba(0,0,0,0.25); pointer-events: none;">
          Vị trí của bạn
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22]
  });

  userLocationMarker = L.marker([userLat, userLng], { icon: userPinIcon, zIndexOffset: 1000 }).addTo(mapInstance);
  userLocationMarker.bindPopup(`
    <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; text-align: center;">
      <div style="font-weight: 800; color: #1e3a8a; font-size: 13px;">Vị trí hiện tại của bạn</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Tọa độ: [${userLng.toFixed(4)}, ${userLat.toFixed(4)}]</div>
      ${isFallback ? '<div style="font-size: 10px; color: #f59e0b; margin-top: 2px;">(Tọa độ mẫu Đà Nẵng)</div>' : '<div style="font-size: 10px; color: #10b981; font-weight: 700; margin-top: 2px;">Đã xác thực GPS chính xác</div>'}
    </div>
  `);
}

// Chế độ chấm điểm trực tiếp trên bản đồ
function enablePickLocationOnMap() {
  closeNewLocationModal();
  switchView('map');
  isPickingOnMap = true;
  if (!mapInstance) initLeafletMap();
  if (mapInstance) {
    mapInstance.getContainer().style.cursor = 'crosshair';
  }
  alert('Chế độ ghim bản đồ đã kích hoạt!\n\nHãy nhấn chuột (hoặc chạm tay trên màn hình) vào vị trí trên bản đồ bạn muốn chọn làm tọa độ bài viết.');
}

function renderMapMarkers(locations) {
  if (!mapInstance) return;

  mapMarkers.forEach(m => mapInstance.removeLayer(m));
  mapMarkers = [];

  const countLabel = document.getElementById('mapPointsCountLabel');
  if (countLabel) countLabel.textContent = `${locations.length} điểm ghim`;

  // Custom marker pin màu cam chuẩn FoodTravel.vn
  const orangePinIcon = L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position: relative; width: 30px; height: 38px;">
        <div style="position: absolute; width: 30px; height: 30px; background: #FF5422; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(255, 84, 34, 0.5); border: 2.5px solid white;">
          <i class="fa-solid fa-location-dot" style="transform: rotate(45deg); color: white; font-size: 13px;"></i>
        </div>
      </div>
    `,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -38]
  });

  // Bảng theo dõi tọa độ trùng để áp dụng micro-offset (spiderfy jitter)
  // Giúp các bài viết có cùng vị trí hoặc gần sát nhau đều hiển thị rõ ràng, không bị đè che khuất!
  const coordRegistry = {};

  locations.forEach(loc => {
    if (!loc.location || !loc.location.coordinates || loc.location.coordinates.length < 2) return;
    let [lng, lat] = loc.location.coordinates;

    const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (coordRegistry[coordKey]) {
      const offsetCount = coordRegistry[coordKey];
      const angle = (offsetCount * 60) * (Math.PI / 180);
      const radius = 0.00015 * Math.ceil(offsetCount / 6); // bán kính ~10-15 mét
      lat += radius * Math.cos(angle);
      lng += radius * Math.sin(angle);
      coordRegistry[coordKey]++;
    } else {
      coordRegistry[coordKey] = 1;
    }

    const marker = L.marker([lat, lng], { icon: orangePinIcon }).addTo(mapInstance);
    marker.locationId = loc._id.toString();
    
    const imgUrl = (loc.images && loc.images.length > 0) ? loc.images[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400';

    marker.bindPopup(`
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 2px; width: 220px;">
        <img src="${imgUrl}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 12px; margin-bottom: 8px;">
        <div style="font-weight: 800; color: #0f172a; font-size: 13px; line-height: 1.3;">${loc.name}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${loc.city} • ${loc.category}</div>
        <div style="font-size: 11px; font-weight: 700; color: #f59e0b; margin-top: 4px;">
          ⭐ ${loc.rating_avg ? loc.rating_avg.toFixed(1) : '5.0'} <span style="color: #94a3b8; font-weight: 400;">(${loc.total_reviews} đánh giá)</span>
        </div>
        <button onclick="openLocationModal('${loc._id}')" style="margin-top: 8px; width: 100%; padding: 7px 10px; background: #FF5422; color: white; border: none; border-radius: 10px; font-size: 11px; cursor: pointer; font-weight: 700; transition: background 0.2s;">
          Xem bài viết &amp; đánh giá
        </button>
      </div>
    `, { maxWidth: 260 });

    mapMarkers.push(marker);
  });
}

// Lia bản đồ mượt mà tới địa điểm khi người dùng nhấp từ bất kỳ bài viết/thẻ nào
function flyToLocationOnMap(locId, event) {
  if (event) event.stopPropagation();

  // Đóng modal chi tiết nếu đang mở
  closeLocationModal();

  // Chuyển sang View Bản đồ
  switchView('map');

  // Tìm thông tin địa điểm theo id
  const loc = allLocations.find(l => l._id.toString() === locId.toString());
  if (!loc || !loc.location || !loc.location.coordinates) return;

  const [lng, lat] = loc.location.coordinates;

  // Đảm bảo Leaflet map đã khởi tạo và invalidate kích thước
  setTimeout(() => {
    if (!mapInstance) initLeafletMap();
    if (mapInstance) {
      mapInstance.invalidateSize();
      // Lia bản đồ mượt mà tới tọa độ với zoom 16
      mapInstance.flyTo([lat, lng], 16, {
        duration: 1.5,
        easeLinearity: 0.25
      });

      // Tự động mở popup của marker tại địa điểm đó
      setTimeout(() => {
        const targetMarker = mapMarkers.find(m => m.locationId === locId.toString());
        if (targetMarker) {
          targetMarker.openPopup();
        }
      }, 1000);

      // Cuộn màn hình tới bản đồ
      const mapContainer = document.getElementById('mapViewContainer');
      if (mapContainer) {
        mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, 120);
}

function focusCityMap(city) {
  if (!mapInstance) return;
  if (city === 'ALL') {
    mapInstance.fitBounds([[8.1, 102.0], [23.5, 109.8]], { padding: [15, 15] });
  } else {
    const cityCoords = {
      'Đà Nẵng': [16.0544, 108.2022, 13],
      'Hà Nội': [21.0285, 105.8542, 13],
      'TP.HCM': [10.7769, 106.7009, 13]
    };

    const target = cityCoords[city];
    if (target) {
      mapInstance.flyTo([target[0], target[1]], target[2], { duration: 1.2 });
    }
  }

  // Cập nhật nút active
  document.querySelectorAll('.map-city-btn').forEach(btn => {
    btn.className = 'map-city-btn px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer';
  });
  const btnIdMap = {
    'ALL': 'btnMapCity_ALL',
    'Hà Nội': 'btnMapCity_HN',
    'Đà Nẵng': 'btnMapCity_DN',
    'TP.HCM': 'btnMapCity_HCM'
  };
  const activeBtn = document.getElementById(btnIdMap[city]);
  if (activeBtn) {
    activeBtn.className = 'map-city-btn px-3 py-1.5 bg-[#FF5422] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs';
  }
}

// 9. ĐỊNH VỊ GPS NGƯỜI DÙNG & GỢI Ý ĐỊA ĐIỂM GẦN BẠN
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function locateUserAndSuggestNearby() {
  const btn = document.getElementById('btnMapLocateMe');
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> <span>Đang xác định GPS...</span>';
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        currentUserGpsCoords = { lat: latitude, lng: longitude };
        handleUserLocated(latitude, longitude, false);
        if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs text-xs"></i> <span>Vị trí của tôi & Gợi ý gần đây</span>';
      },
      (err) => {
        console.warn('Không lấy được GPS chính xác, dùng tọa độ trung tâm:', err);
        const fallbackLat = currentUserGpsCoords ? currentUserGpsCoords.lat : 16.0611;
        const fallbackLng = currentUserGpsCoords ? currentUserGpsCoords.lng : 108.2272;
        handleUserLocated(fallbackLat, fallbackLng, !currentUserGpsCoords);
        if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs text-xs"></i> <span>Vị trí của tôi & Gợi ý gần đây</span>';
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  } else {
    handleUserLocated(16.0611, 108.2272, true);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs text-xs"></i> <span>Vị trí của tôi & Gợi ý gần đây</span>';
  }
}

function handleUserLocated(userLat, userLng, isFallback = false) {
  if (!mapInstance) initLeafletMap();

  currentUserGpsCoords = { lat: userLat, lng: userLng };
  addUserLocationPinToMap(userLat, userLng, isFallback);

  if (userLocationMarker) {
    userLocationMarker.openPopup();
  }

  // Lia bản đồ mượt mà tới vị trí người dùng
  mapInstance.flyTo([userLat, userLng], 14, { duration: 1.5 });

  // Tính khoảng cách tới toàn bộ các địa điểm trong MongoDB
  const distances = allLocations
    .filter(loc => loc.location && loc.location.coordinates && loc.location.coordinates.length >= 2)
    .map(loc => {
      const [lng, lat] = loc.location.coordinates;
      const d = calculateHaversineDistance(userLat, userLng, lat, lng);
      return { ...loc, distance_km: d };
    });

  distances.sort((a, b) => a.distance_km - b.distance_km);
  const topNearby = distances.slice(0, 6);

  // Hiển thị khung gợi ý
  const box = document.getElementById('nearbySuggestionsBox');
  const list = document.getElementById('nearbySuggestionsList');
  const title = document.getElementById('nearbySuggestionsTitle');

  if (box && list) {
    box.classList.remove('hidden');
    if (title) {
      title.textContent = `Top ${topNearby.length} địa điểm ẩm thực & du lịch gần bạn nhất`;
    }

    list.innerHTML = topNearby.map(item => {
      const img = (item.images && item.images.length > 0) ? item.images[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300';
      const distStr = item.distance_km < 1
        ? `${Math.round(item.distance_km * 1000)} m`
        : `${item.distance_km.toFixed(1)} km`;

      return `
        <div class="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-xs flex items-center space-x-3 hover:shadow-md transition-shadow">
          <img src="${img}" class="w-16 h-16 rounded-xl object-cover shrink-0 cursor-pointer" onclick="openLocationModal('${item._id}')">
          <div class="flex-1 min-w-0">
            <h5 onclick="openLocationModal('${item._id}')" class="text-xs font-bold text-slate-800 truncate hover:text-[#FF5422] cursor-pointer">${item.name}</h5>
            <div class="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
              <span class="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md flex items-center space-x-0.5">
                <i class="fa-solid fa-person-walking"></i>
                <span>${distStr}</span>
              </span>
              <span>•</span>
              <span class="text-amber-500 font-bold">⭐ ${item.rating_avg ? item.rating_avg.toFixed(1) : '5.0'}</span>
            </div>
            <div class="flex items-center space-x-2 mt-1.5">
              <button onclick="flyToLocationOnMap('${item._id}')" class="text-[10px] font-bold text-[#FF5422] hover:underline cursor-pointer">
                Lia bản đồ
              </button>
              <span class="text-slate-300">|</span>
              <button onclick="openLocationModal('${item._id}')" class="text-[10px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
                Xem chi tiết
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// 9. TÌM GẦN VỊ TRÍ HIỆN TẠI (GEOSPATIAL 2DSPHERE)
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

// 10. BẢNG THỐNG KÊ AGGREGATION PIPELINE
async function fetchAggregationStats() {
  try {
    const [resCities, resTopRated] = await Promise.all([
      fetch('/api/analytics/top-cities').then(r => r.json()),
      fetch('/api/analytics/top-rated').then(r => r.json())
    ]);

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

// =====================================================================
// 11. MODAL CHI TIẾT ĐỊA ĐIỂM (ĐÃ XÓA THANH CUỘN THEO ẢNH 1 & TỰ ĐỘNG LẤY TÀI KHOẢN MONGODB)
// =====================================================================
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
    const addressDisplay = loc.address && loc.address.trim() ? loc.address : loc.city;
    document.getElementById('modalCity').querySelector('span').textContent = addressDisplay;
    document.getElementById('modalCategoryBadge').textContent = loc.category;
    document.getElementById('modalRatingAvg').textContent = (loc.total_reviews && loc.total_reviews > 0) ? (loc.rating_avg ? loc.rating_avg.toFixed(1) : '0.0') : 'Chưa có đánh giá';
    document.getElementById('modalTotalReviews').textContent = `${loc.total_reviews || 0} đánh giá`;
    document.getElementById('modalCoords').textContent = `[${loc.location.coordinates[0].toFixed(4)}, ${loc.location.coordinates[1].toFixed(4)}]`;
    document.getElementById('modalDescription').textContent = loc.description || 'Chưa có bài viết mô tả chi tiết.';
    
    // Cập nhật thông tin Tác giả bài viết & Thời gian đăng (Chỉ hiện huy hiệu và nút xóa nếu đúng là chủ bài viết)
    const isMyPost = currentUser && (
      (loc.author_email && currentUser.email && loc.author_email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (loc.author_name && currentUser.name && loc.author_name.toLowerCase() === currentUser.name.toLowerCase())
    );

    const authorName = (loc.author_name && loc.author_name.trim() && loc.author_name !== 'Thành viên FoodTravel' && loc.author_name !== 'Người khám phá') 
      ? loc.author_name 
      : (isMyPost ? currentUser.name : (loc.reviews && loc.reviews.length > 0 && loc.reviews[0].user_name ? loc.reviews[0].user_name : (currentUser ? currentUser.name : 'Huỳnh Văn Ngọc')));
    const authorAvatar = isMyPost ? currentUser.avatar : getConsistentAvatar(authorName, loc.author_avatar);

    const modalAuthorName = document.getElementById('modalAuthorName');
    const modalAuthorAvatar = document.getElementById('modalAuthorAvatar');
    const modalAuthorBadge = document.getElementById('modalAuthorBadge');
    const modalCreatedAtText = document.getElementById('modalCreatedAtText');
    const modalBannerDeleteBtn = document.getElementById('modalBannerDeleteBtn');

    if (modalAuthorName) {
      modalAuthorName.textContent = authorName;
      modalAuthorName.onclick = (e) => openUserProfile(authorName, loc.author_email, e);
      modalAuthorName.classList.add('cursor-pointer', 'hover:text-[#FF5422]', 'transition-colors');
    }
    if (modalAuthorAvatar) {
      modalAuthorAvatar.src = authorAvatar;
      modalAuthorAvatar.onclick = (e) => openUserProfile(authorName, loc.author_email, e);
      modalAuthorAvatar.classList.add('cursor-pointer', 'hover:opacity-80', 'transition-opacity');
    }
    if (modalCreatedAtText) modalCreatedAtText.textContent = formatPostTime(loc.createdAt);

    if (modalAuthorBadge) {
      if (isMyPost) modalAuthorBadge.classList.remove('hidden');
      else modalAuthorBadge.classList.add('hidden');
    }

    if (modalBannerDeleteBtn) {
      if (isMyPost) modalBannerDeleteBtn.classList.remove('hidden');
      else modalBannerDeleteBtn.classList.add('hidden');
    }

    const imgEl = document.getElementById('modalImg');
    if (imgEl) {
      imgEl.src = (loc.images && loc.images.length > 0) ? loc.images[0] : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
    }

    // Cập nhật trạng thái Thả tim trong Modal (Đồng bộ MongoDB)
    const isLiked = loc.liked_by && currentUser ? loc.liked_by.includes(currentUser.email) : false;
    updateModalLikeUI(isLiked, loc.likes_count || 0);

    // Cập nhật trạng thái Lưu địa điểm trong Modal (Đồng bộ MongoDB)
    const isSaved = isLocationSaved(locId);
    updateModalSaveUI(isSaved);

    // Chuẩn bị khung bình luận phong cách Facebook
    const inputContent = document.getElementById('inputReviewContent');
    const avatarUser = document.getElementById('reviewUserAvatar');
    if (inputContent) {
      inputContent.value = '';
      inputContent.placeholder = `Bình luận dưới tên ${currentUser ? currentUser.name : 'bạn'}...`;
    }
    if (avatarUser) {
      avatarUser.src = currentUser ? getConsistentAvatar(currentUser.name, currentUser.avatar) : getConsistentAvatar('Khách');
    }

    // Reset bộ chọn sao về 5 sao
    resetStarRatingToDefault();

    activeLocationData = loc;
    renderReviewsList(loc.reviews || []);
    modal.classList.remove('hidden');

    // Reset cuộn lên đỉnh đầu
    if (modalContainer) modalContainer.scrollTop = 0;
    if (modalBody) modalBody.scrollTop = 0;
  } catch (err) {
    console.error('Lỗi mở chi tiết bài viết:', err);
  }
}

// Thả tim trực tiếp trong Modal chi tiết (Đồng bộ MongoDB)
async function toggleModalLike() {
  if (!activeLocationId) return;
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch(`/api/locations/${activeLocationId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: currentUser.email })
    });

    const data = await res.json();
    if (res.ok) {
      // Cập nhật mảng địa điểm trong bộ nhớ
      const loc = allLocations.find(l => l._id === activeLocationId);
      if (loc) {
        loc.likes_count = data.likes_count;
        if (!loc.liked_by) loc.liked_by = [];
        if (data.isLiked) {
          loc.liked_by.push(currentUser.email);
        } else {
          loc.liked_by = loc.liked_by.filter(e => e !== currentUser.email);
        }
      }

      // Cập nhật giao diện trong Modal
      updateModalLikeUI(data.isLiked, data.likes_count);

      // Đồng bộ ra nút like ngoài danh sách thẻ card
      const cardBtn = document.getElementById(`btnLike_${activeLocationId}`);
      if (cardBtn) {
        if (data.isLiked) {
          cardBtn.className = 'flex items-center space-x-1.5 text-rose-600 font-bold transition-colors cursor-pointer';
          cardBtn.innerHTML = `<i class="fa-solid fa-heart text-rose-500 text-sm"></i><span id="likeCount_${activeLocationId}">${data.likes_count}</span>`;
        } else {
          cardBtn.className = 'flex items-center space-x-1.5 text-slate-600 hover:text-rose-500 transition-colors cursor-pointer';
          cardBtn.innerHTML = `<i class="fa-regular fa-heart text-sm"></i><span id="likeCount_${activeLocationId}">${data.likes_count}</span>`;
        }
      }
    }
  } catch (err) {
    console.error('Lỗi thả tim trong chi tiết:', err);
  }
}

function updateModalLikeUI(isLiked, count) {
  const modalLikeBtn = document.getElementById('modalLikeBtn');
  const modalLikeIcon = document.getElementById('modalLikeIcon');
  const modalLikesCount = document.getElementById('modalLikesCount');
  const bannerLikeBtn = document.getElementById('modalBannerLikeBtn');
  const bannerLikeIcon = document.getElementById('modalBannerLikeIcon');

  if (modalLikesCount) modalLikesCount.textContent = `${count || 0} thích`;

  if (isLiked) {
    if (modalLikeBtn) {
      modalLikeBtn.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold transition-all cursor-pointer shadow-sm shadow-rose-500/25 border border-rose-500';
    }
    if (modalLikeIcon) {
      modalLikeIcon.className = 'fa-solid fa-heart text-white text-xs';
    }
    if (bannerLikeBtn) {
      bannerLikeBtn.className = 'absolute top-4 right-16 z-20 w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105';
    }
    if (bannerLikeIcon) {
      bannerLikeIcon.className = 'fa-solid fa-heart text-sm text-white';
    }
  } else {
    if (modalLikeBtn) {
      modalLikeBtn.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold transition-all cursor-pointer border border-slate-200 shadow-xs';
    }
    if (modalLikeIcon) {
      modalLikeIcon.className = 'fa-regular fa-heart text-rose-500 text-xs';
    }
    if (bannerLikeBtn) {
      bannerLikeBtn.className = 'absolute top-4 right-16 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-rose-500 flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105';
    }
    if (bannerLikeIcon) {
      bannerLikeIcon.className = 'fa-regular fa-heart text-sm text-rose-500';
    }
  }
}

// Lưu / Bỏ lưu trực tiếp trong Modal chi tiết (Đồng bộ MongoDB)
async function toggleModalSave() {
  if (!activeLocationId) return;
  await toggleSaveLocation(activeLocationId, null);
  const isSaved = isLocationSaved(activeLocationId);
  updateModalSaveUI(isSaved);
}

function updateModalSaveUI(isSaved) {
  const bannerSaveBtn = document.getElementById('modalBannerSaveBtn');
  const bannerSaveIcon = document.getElementById('modalBannerSaveIcon');
  const modalSaveBtn = document.getElementById('modalSaveBtn');
  const modalSaveIcon = document.getElementById('modalSaveIcon');
  const modalSaveText = document.getElementById('modalSaveText');

  if (bannerSaveBtn) {
    bannerSaveBtn.title = isSaved ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm này';
    bannerSaveBtn.className = isSaved
      ? 'absolute top-4 right-28 z-20 w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105'
      : 'absolute top-4 right-28 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105';
  }
  if (bannerSaveIcon) {
    bannerSaveIcon.className = isSaved ? 'fa-solid fa-bookmark text-sm text-white' : 'fa-regular fa-bookmark text-sm text-amber-500';
  }

  if (modalSaveBtn) {
    modalSaveBtn.className = isSaved
      ? 'flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all cursor-pointer shadow-sm shadow-amber-500/25 border border-amber-500'
      : 'flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-600 font-bold transition-all cursor-pointer border border-slate-200 shadow-xs';
  }
  if (modalSaveIcon) {
    modalSaveIcon.className = isSaved ? 'fa-solid fa-bookmark text-white text-xs' : 'fa-regular fa-bookmark text-amber-500 text-xs';
  }
  if (modalSaveText) {
    modalSaveText.textContent = isSaved ? 'Đã lưu' : 'Lưu';
  }
}

// Bật tắt lưu địa điểm (Bookmarks) kết nối API MongoDB
async function toggleSaveLocation(locId, event) {
  if (event) event.stopPropagation();
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch(`/api/auth/save-location/${locId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser._id,
        user_email: currentUser.email
      })
    });

    const data = await res.json();
    if (res.ok) {
      currentUser.saved_locations = data.saved_locations || [];
      localStorage.setItem('foodtravel_user', JSON.stringify(currentUser));

      updateSaveUI(locId, data.isSaved, data.saved_count);
      showToast(data.message || (data.isSaved ? 'Đã lưu địa điểm thành công!' : 'Đã bỏ lưu địa điểm!'));
    } else {
      showToast(data.error || 'Lỗi thao tác lưu địa điểm', 'error');
    }
  } catch (err) {
    console.error('Lỗi toggleSaveLocation:', err);
  }
}

function updateSaveUI(locId, isSaved, count) {
  // Cập nhật nút bookmark trên thẻ card
  const badgeCard = document.getElementById(`badgeSaveCard_${locId}`);
  if (badgeCard) {
    badgeCard.title = isSaved ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm này';
    badgeCard.className = `absolute top-3 right-3 w-8 h-8 rounded-full ${isSaved ? 'bg-amber-500 text-white' : 'bg-slate-900/60 text-white hover:bg-slate-900/80'} backdrop-blur-md flex items-center justify-center transition-all shadow-md cursor-pointer hover:scale-110 z-10`;
    badgeCard.innerHTML = `<i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark text-xs"></i>`;
  }

  const btnCard = document.getElementById(`btnSaveCard_${locId}`);
  if (btnCard) {
    btnCard.title = isSaved ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm này';
    btnCard.className = `flex items-center space-x-1.5 ${isSaved ? 'text-amber-600 font-bold' : 'text-slate-600 hover:text-amber-500'} transition-colors cursor-pointer`;
    btnCard.innerHTML = `<i class="${isSaved ? 'fa-solid text-amber-500' : 'fa-regular'} fa-bookmark text-sm"></i><span class="hidden sm:inline">${isSaved ? 'Đã lưu' : 'Lưu'}</span>`;
  }

  // Cập nhật Modal chi tiết nếu đang mở cho địa điểm này
  if (activeLocationId && activeLocationId.toString() === locId.toString()) {
    updateModalSaveUI(isSaved);
  }

  // Cập nhật số lượng trên Modal Profile
  const profileCountEl = document.getElementById('profileSavedCount');
  const profileBadgeEl = document.getElementById('profileSavedBadge');
  const totalSaved = count !== undefined ? count : (currentUser.saved_locations ? currentUser.saved_locations.length : 0);
  if (profileCountEl) profileCountEl.textContent = totalSaved;
  if (profileBadgeEl) {
    profileBadgeEl.textContent = totalSaved;
    if (totalSaved > 0) profileBadgeEl.classList.remove('hidden');
    else profileBadgeEl.classList.add('hidden');
  }

  // Nếu tab "Địa điểm đã lưu" đang mở trong profile modal, vẽ lại ngay
  const profileSavedList = document.getElementById('profileSavedList');
  if (profileSavedList && !profileSavedList.classList.contains('hidden')) {
    renderSavedLocationsList(currentUser.saved_locations || []);
  }
}

// Bộ chọn đánh giá sao kiểu Google Play
let currentSelectedRating = 5;
const ratingTextMap = {
  1: '1 sao - Rất tệ',
  2: '2 sao - Tệ',
  3: '3 sao - Bình thường',
  4: '4 sao - Hài lòng',
  5: '5 sao - Tuyệt vời'
};

function initStarRatingComponent() {
  const container = document.getElementById('starRatingGroup');
  if (!container) return;
  const stars = container.querySelectorAll('.star-rate-item');
  const ratingInput = document.getElementById('inputReviewRating');
  const ratingLabel = document.getElementById('starRatingLabel');

  function renderStars(val) {
    stars.forEach(s => {
      const v = parseInt(s.dataset.value);
      if (v <= val) {
        s.className = 'star-rate-item fa-solid fa-star text-2xl text-amber-400 transition-all hover:scale-125';
      } else {
        s.className = 'star-rate-item fa-regular fa-star text-2xl text-slate-300 transition-all hover:scale-125';
      }
    });
    if (ratingLabel) ratingLabel.textContent = ratingTextMap[val] || `${val} sao`;
  }

  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const v = parseInt(star.dataset.value);
      renderStars(v);
    });
    star.addEventListener('click', () => {
      currentSelectedRating = parseInt(star.dataset.value);
      if (ratingInput) ratingInput.value = currentSelectedRating;
      renderStars(currentSelectedRating);
    });
  });

  container.addEventListener('mouseleave', () => {
    renderStars(currentSelectedRating);
  });

  resetStarRatingToDefault();
}

function resetStarRatingToDefault() {
  currentSelectedRating = 5;
  const ratingInput = document.getElementById('inputReviewRating');
  const ratingLabel = document.getElementById('starRatingLabel');
  if (ratingInput) ratingInput.value = 5;
  if (ratingLabel) ratingLabel.textContent = '5 sao - Tuyệt vời';

  const container = document.getElementById('starRatingGroup');
  if (container) {
    const stars = container.querySelectorAll('.star-rate-item');
    stars.forEach(s => {
      s.className = 'star-rate-item fa-solid fa-star text-2xl text-amber-400 transition-all hover:scale-125';
    });
  }
}

function closeLocationModal() {
  document.getElementById('locationDetailModal').classList.add('hidden');
}

function handleReviewKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitReview();
  }
}

function renderReviewsList(reviews) {
  const container = document.getElementById('modalReviewsList');
  const badge = document.getElementById('reviewsCountBadge');
  if (!container) return;

  if (badge) badge.textContent = `${reviews.length} đánh giá`;

  if (reviews.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ cảm nhận!</div>';
    return;
  }

  container.innerHTML = reviews.map(rev => {
    const revAvatar = getConsistentAvatar(rev.user_name, rev.avatar);
    const isAuthor = activeLocationData && (
      (activeLocationData.author_name && rev.user_name && activeLocationData.author_name.toLowerCase() === rev.user_name.toLowerCase()) ||
      (activeLocationData.author_email && rev.email && activeLocationData.author_email.toLowerCase() === rev.email.toLowerCase())
    );

    const repliesHtml = (rev.replies && rev.replies.length > 0) ? `
      <div class="mt-2.5 pl-3 border-l-2 border-[#FF5422]/60 space-y-2">
        ${rev.replies.map(rep => {
          const repAvatar = getConsistentAvatar(rep.user_name, rep.avatar);
          return `
            <div class="bg-slate-100/70 p-2.5 rounded-xl text-xs text-slate-700 space-y-1">
              <div class="flex items-center justify-between">
                <div class="font-bold text-slate-900 text-[11px] flex items-center space-x-1.5">
                  <img src="${repAvatar}" onclick="openUserProfile('${rep.user_name.replace(/'/g, "\\'")}', '', event)" class="w-4 h-4 rounded-full object-cover cursor-pointer hover:opacity-80" title="Xem trang cá nhân của ${rep.user_name}">
                  <span onclick="openUserProfile('${rep.user_name.replace(/'/g, "\\'")}', '', event)" class="cursor-pointer hover:text-[#FF5422] transition-colors" title="Xem trang cá nhân của ${rep.user_name}">${rep.user_name}</span>
                </div>
                <button onclick="toggleInlineReply('${rev._id}', '${rep.user_name}')" class="text-[10px] text-slate-400 hover:text-[#FF5422] font-semibold cursor-pointer">
                  Trả lời
                </button>
              </div>
              <p class="text-slate-600 text-[11px] leading-relaxed">${rep.content}</p>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    return `
      <div class="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <img src="${revAvatar}" onclick="openUserProfile('${rev.user_name.replace(/'/g, "\\'")}', '${(rev.email || '').replace(/'/g, "\\'")}', event)" class="w-8 h-8 rounded-full object-cover border border-slate-200 cursor-pointer hover:ring-2 hover:ring-[#FF5422]/50 transition-all" title="Xem trang cá nhân của ${rev.user_name}">
            <div>
              <div class="flex items-center space-x-1.5">
                <span onclick="openUserProfile('${rev.user_name.replace(/'/g, "\\'")}', '${(rev.email || '').replace(/'/g, "\\'")}', event)" class="text-xs font-bold text-slate-900 cursor-pointer hover:text-[#FF5422] transition-colors" title="Xem trang cá nhân của ${rev.user_name}">${rev.user_name}</span>
                ${isAuthor ? '<span class="text-[9px] px-1.5 py-0.2 bg-orange-50 text-[#FF5422] font-bold rounded">Tác giả</span>' : ''}
              </div>
              <div class="text-[10px] text-slate-400">${new Date(rev.created_at).toLocaleDateString('vi-VN')}</div>
            </div>
          </div>
          <div class="flex items-center space-x-1 text-amber-500 text-xs font-bold">
            <span>${rev.rating}/5</span>
            <i class="fa-solid fa-star text-[10px]"></i>
          </div>
        </div>

        <p class="text-xs text-slate-700 leading-relaxed">${rev.content}</p>

        <!-- Phản hồi phân cấp -->
        ${repliesHtml}

        <!-- Nút Trả lời và Khung nhập phản hồi trực tiếp (Inline Reply) -->
        <div class="pt-1">
          <div class="flex items-center justify-end">
            <button onclick="toggleInlineReply('${rev._id}')" class="text-[11px] font-bold text-[#FF5422] hover:text-[#E84615] flex items-center space-x-1 cursor-pointer">
              <i class="fa-solid fa-reply text-[10px]"></i>
              <span>Phản hồi</span>
            </button>
          </div>

          <div id="replyBox_${rev._id}" class="hidden mt-2 pt-2 border-t border-slate-200/60">
            <div class="flex items-center space-x-2">
              <img src="${currentUser ? getConsistentAvatar(currentUser.name, currentUser.avatar) : getConsistentAvatar('Khách')}" class="w-6 h-6 rounded-full object-cover shrink-0">
              <input type="text" id="inlineReplyInput_${rev._id}" placeholder="Viết phản hồi cho ${rev.user_name}..." class="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-[#FF5422]" onkeydown="if(event.key==='Enter') submitInlineReply('${rev._id}')">
              <button onclick="submitInlineReply('${rev._id}')" class="px-3 py-1.5 bg-[#FF5422] hover:bg-[#E84615] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0">
                Gửi
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleInlineReply(reviewId, targetUser = '') {
  const box = document.getElementById(`replyBox_${reviewId}`);
  if (!box) return;
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) {
    const input = document.getElementById(`inlineReplyInput_${reviewId}`);
    if (input) {
      if (targetUser) input.value = `@${targetUser} `;
      input.focus();
    }
  }
}

async function submitInlineReply(reviewId) {
  if (!activeLocationId) return;
  const input = document.getElementById(`inlineReplyInput_${reviewId}`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) {
    alert('Vui lòng nhập nội dung phản hồi!');
    return;
  }

  const replyName = currentUser ? currentUser.name : 'Khách trải nghiệm';
  const replyAvatar = currentUser ? currentUser.avatar : '';
  const replyEmail = currentUser ? currentUser.email : '';

  try {
    const res = await fetch(`/api/locations/${activeLocationId}/reviews/${reviewId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user_name: replyName, 
        content,
        user_avatar: replyAvatar,
        user_email: replyEmail
      })
    });

    if (res.ok) {
      input.value = '';
      const box = document.getElementById(`replyBox_${reviewId}`);
      if (box) box.classList.add('hidden');
      // Tải lại chi tiết địa điểm để cập nhật review mới mượt mà
      const locRes = await fetch(`/api/locations/${activeLocationId}`);
      if (locRes.ok) {
        const freshLoc = await locRes.json();
        activeLocationData = freshLoc;
        renderReviewsList(freshLoc.reviews || []);
      }
    } else {
      const data = await res.json();
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi gửi reply:', err);
  }
}

// 12. GỬI ĐÁNH GIÁ MỚI
async function submitReview() {
  if (!activeLocationId) return;

  const userName = currentUser ? currentUser.name : 'Khách trải nghiệm';
  const userAvatar = currentUser ? currentUser.avatar : '';
  const userEmail = currentUser ? currentUser.email : '';
  const rating = parseInt(document.getElementById('inputReviewRating').value) || 5;
  const contentEl = document.getElementById('inputReviewContent');
  const content = contentEl ? contentEl.value.trim() : '';

  // Cho phép đánh giá chấm sao trực tiếp mà không bắt buộc phải nhập bình luận văn bản
  const reviewContent = content || (rating >= 4 ? 'Trải nghiệm rất tuyệt vời!' : `Đã chấm ${rating} sao cho địa điểm này.`);

  try {
    const res = await fetch(`/api/locations/${activeLocationId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user_name: userName, 
        user_email: userEmail,
        avatar: getConsistentAvatar(userName, userAvatar),
        rating, 
        content: reviewContent 
      })
    });

    const data = await res.json();
    if (res.ok) {
      if (contentEl) contentEl.value = '';
      resetStarRatingToDefault();

      // Cập nhật lại dữ liệu địa điểm thời gian thực
      const locRes = await fetch(`/api/locations/${activeLocationId}`);
      if (locRes.ok) {
        const freshLoc = await locRes.json();
        activeLocationData = freshLoc;
        document.getElementById('modalRatingAvg').textContent = (freshLoc.total_reviews && freshLoc.total_reviews > 0) ? (freshLoc.rating_avg ? freshLoc.rating_avg.toFixed(1) : '0.0') : 'Chưa có đánh giá';
        document.getElementById('modalTotalReviews').textContent = `${freshLoc.total_reviews || 0} đánh giá`;
        renderReviewsList(freshLoc.reviews || []);
      }

      fetchLocations();
      fetchHeroOverviewStats();
    } else {
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi gửi review:', err);
  }
}

// =====================================================================
// 14. CHIA SẺ BÀI VIẾT / ĐỊA ĐIỂM KÈM HÌNH ẢNH THỰC TẾ
// =====================================================================
function openNewLocationModal() {
  document.getElementById('newLocationModal').classList.remove('hidden');
  // Tự động hỏi quyền GPS từ trình duyệt và lấy đúng vị trí thực tế của người dùng
  requestLocationAccessForNewPost();
}

function closeNewLocationModal() {
  document.getElementById('newLocationModal').classList.add('hidden');
}

// Xử lý tải file ảnh thực tế (PNG, JPG, JPE, WEBP, GIF, BMP) từ thiết bị
async function handleImageFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const isImage = (file.type && file.type.startsWith('image/')) || file.name.match(/\.(jpe?g|png|webp|jfif|bmp|gif|svg)$/i);
  if (!isImage) {
    alert('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, JPEG, JPE, WEBP, GIF)!');
    event.target.value = '';
    return;
  }

  // 1. Hiển thị xem trước ảnh ngay lập tức bằng FileReader và lưu DataURL làm fallback
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('imgPreviewTag').src = e.target.result;
    document.getElementById('imgPreviewFileName').textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    document.getElementById('imgPreviewBox').classList.remove('hidden');
    document.getElementById('uploadPromptBox').classList.add('hidden');
    // Lưu tạm thời Data URL để nếu mạng chậm hay lỗi thì ảnh người dùng chọn vẫn được bảo toàn
    document.getElementById('newLocImgUrl').value = e.target.result;
  };
  reader.readAsDataURL(file);

  // 2. Tải file ảnh thực tế lên máy chủ (lưu vào /uploads/ trên server)
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok && data.url) {
      document.getElementById('newLocImgUrl').value = data.url;
      console.log('Đã tải file ảnh lên thành công:', data.url);
    } else {
      console.warn('Upload ảnh qua máy chủ có thông báo:', data.error);
    }
  } catch (err) {
    console.error('Lỗi upload file:', err);
  }
}

function clearSelectedImage(event) {
  if (event) event.stopPropagation();
  document.getElementById('newLocFileInput').value = '';
  document.getElementById('newLocImgUrl').value = '';
  document.getElementById('imgPreviewBox').classList.add('hidden');
  document.getElementById('uploadPromptBox').classList.remove('hidden');
}

function setPresetImage(url, name) {
  document.getElementById('newLocImgUrl').value = url;
  document.getElementById('imgPreviewTag').src = url;
  document.getElementById('imgPreviewFileName').textContent = `Mẫu: ${name || 'Ảnh ẩm thực'}`;
  document.getElementById('imgPreviewBox').classList.remove('hidden');
  document.getElementById('uploadPromptBox').classList.add('hidden');
}

// Xử lý khi người dùng chọn file ảnh đại diện PNG/JPG từ máy tính
async function handleAvatarFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const isImage = (file.type && file.type.startsWith('image/')) || file.name.match(/\.(jpe?g|png|webp|jfif|bmp|gif|svg)$/i);
  if (!isImage) {
    alert('Vui lòng chọn file hình ảnh đại diện hợp lệ!');
    event.target.value = '';
    return;
  }

  // Xem trước avatar ngay
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('profileModalAvatar').src = e.target.result;
    if (currentUser) {
      currentUser.avatar = e.target.result;
      updateUserUI();
    }
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok && data.url) {
      currentUser.avatar = data.url;
      localStorage.setItem('foodtravel_user', JSON.stringify(currentUser));
      updateUserUI();
      document.getElementById('profileModalAvatar').src = currentUser.avatar;

      if (currentUser._id) {
        await fetch(`/api/auth/profile/${currentUser._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: data.url })
        });
      } else if (currentUser.email) {
        await fetch('/api/auth/profile-by-email', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUser.email, avatar: data.url })
        });
      }
      if (typeof fetchStories === 'function') fetchStories();
      alert('Đã cập nhật ảnh đại diện mới vào hồ sơ và toàn bộ Story trên MongoDB!');
    } else {
      alert('Lỗi tải ảnh đại diện: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi đổi avatar:', err);
  }
}

// Tự động hỏi quyền GPS của trình duyệt và lấy đúng vị trí thực tế của người dùng
async function requestLocationAccessForNewPost() {
  const helperBox = document.getElementById('gpsStatusHelperBox');
  const coordsDisplay = document.getElementById('newLocCoordsDisplay');
  const latInput = document.getElementById('newLocLat');
  const lngInput = document.getElementById('newLocLng');

  if (!navigator.geolocation) {
    if (helperBox) {
      helperBox.classList.remove('hidden');
      helperBox.innerHTML = `
        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start space-x-2">
          <i class="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5"></i>
          <div>Trình duyệt không hỗ trợ Geolocation. Tọa độ được gán theo thành phố bạn chọn.</div>
        </div>
      `;
    }
    handleCityChangeManual();
    return;
  }

  // Kiểm tra trạng thái quyền vị trí của trình duyệt
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const pStatus = await navigator.permissions.query({ name: 'geolocation' });
      if (pStatus.state === 'denied') {
        if (helperBox) {
          helperBox.classList.remove('hidden');
          helperBox.innerHTML = `
            <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
              <div class="flex items-center space-x-1.5 font-bold text-rose-700">
                <i class="fa-solid fa-ban text-rose-600"></i>
                <span>Trình duyệt đang CHẶN quyền vị trí cho trang web này!</span>
              </div>
              <p class="text-[11px] text-rose-800 leading-relaxed">
                Đó là lý do bạn <strong>không thấy popup thông báo hỏi lại</strong>. Cách mở lại:
              </p>
              <div class="text-[11px] text-rose-900 space-y-1 pl-1 bg-white/70 p-2 rounded-lg border border-rose-100">
                <div><strong>Bước 1:</strong> Bấm vào biểu tượng <strong>Cài đặt / Ổ khóa</strong> ở thanh URL (bên trái chữ <code>localhost:5055</code>).</div>
                <div><strong>Bước 2:</strong> Gạt dòng <strong>"Vị trí" (Location)</strong> sang <strong>Cho phép (Allow)</strong> hoặc "Hỏi lại (Ask)".</div>
                <div><strong>Bước 3:</strong> Nhấn nút <strong>"Lấy lại GPS"</strong> ngay bên dưới.</div>
              </div>
            </div>
          `;
        }
      } else if (pStatus.state === 'prompt') {
        if (helperBox) {
          helperBox.classList.remove('hidden');
          helperBox.innerHTML = `
            <div class="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
              <i class="fa-solid fa-arrow-turn-up text-blue-600 mt-0.5 text-sm animate-bounce"></i>
              <div class="leading-relaxed text-[11px]">
                <strong>Hãy nhìn lên góc trên bên trái màn hình</strong> (ngay dưới thanh địa chỉ URL) và bấm nút <strong>"Cho phép" (Allow)</strong> trong popup nhỏ của trình duyệt để FoodTravel.vn lấy đúng GPS nhé!
              </div>
            </div>
          `;
        }
      }
    } catch (e) {
      console.warn('Permissions query không khả dụng:', e);
    }
  }

  if (coordsDisplay) {
    coordsDisplay.innerHTML = `<i class="fa-solid fa-location-crosshairs text-blue-500 animate-spin"></i> <span class="text-blue-600 font-semibold">Đang yêu cầu GPS từ trình duyệt...</span>`;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      currentUserGpsCoords = { lat, lng };
      latInput.value = lat.toFixed(4);
      lngInput.value = lng.toFixed(4);

      if (helperBox) helperBox.classList.add('hidden');

      // Tính khoảng cách thực tế để chọn đúng thành phố gần bạn nhất
      const cityDistances = [
        { city: 'Hà Nội', dist: calculateHaversineDistance(lat, lng, 21.0285, 105.8542) },
        { city: 'Đà Nẵng', dist: calculateHaversineDistance(lat, lng, 16.0611, 108.2272) },
        { city: 'TP.HCM', dist: calculateHaversineDistance(lat, lng, 10.7769, 106.7009) }
      ];
      cityDistances.sort((a, b) => a.dist - b.dist);
      const closestCity = cityDistances[0].city;

      const citySelect = document.getElementById('newLocCity');
      if (citySelect) citySelect.value = closestCity;
      const cityTag = document.getElementById('fbCityTagDisplay');
      if (cityTag) cityTag.innerHTML = `<span>${closestCity}</span>`;

      if (coordsDisplay) {
        coordsDisplay.innerHTML = `
          <div class="flex items-center space-x-1.5 text-emerald-700">
            <i class="fa-solid fa-circle-check text-emerald-500"></i>
            <span class="font-bold">Đã định vị GPS thực tế: [${lng.toFixed(4)}, ${lat.toFixed(4)}] (${closestCity})</span>
          </div>
        `;
      }

      updateFbCheckinTag(document.getElementById('newLocName').value.trim() || closestCity);
    },
    (err) => {
      console.warn('Lỗi định vị Geolocation:', err.code, err.message);
      handleCityChangeManual();
      const curCity = document.getElementById('newLocCity').value;

      if (helperBox) {
        helperBox.classList.remove('hidden');
        if (err.code === 1) { // PERMISSION_DENIED
          helperBox.innerHTML = `
            <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
              <div class="font-bold text-rose-700 flex items-center space-x-1">
                <i class="fa-solid fa-ban text-rose-600"></i>
                <span>Trình duyệt đang CHẶN quyền vị trí!</span>
              </div>
              <p class="text-[11px] text-rose-800">
                Bạn hoặc trình duyệt đã từ chối yêu cầu GPS trước đó. Hãy nhấn vào biểu tượng <strong>Cài đặt / Ổ khóa</strong> ở đầu thanh địa chỉ URL &rarr; <strong>Bật "Vị trí" thành Cho phép</strong> &rarr; Bấm "Thử lại GPS".
              </p>
            </div>
          `;
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          helperBox.innerHTML = `
            <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
              <i class="fa-solid fa-satellite-dish mr-1 text-amber-600"></i>
              <strong>Không lấy được tín hiệu GPS phần cứng:</strong> Thiết bị có thể đang tắt Location Service của Windows hoặc không có WiFi/GPS. Tạm dùng tọa độ theo thành phố [${curCity}].
            </div>
          `;
        } else {
          helperBox.innerHTML = `
            <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
              <i class="fa-solid fa-clock mr-1 text-amber-600"></i>
              Yêu cầu GPS quá thời gian chờ. Hệ thống tạm dùng tọa độ theo thành phố [${curCity}].
            </div>
          `;
        }
      }

      if (coordsDisplay) {
        coordsDisplay.innerHTML = `
          <div class="flex items-center space-x-1 text-slate-500">
            <i class="fa-solid fa-location-pin text-amber-500"></i>
            <span>Tọa độ trung tâm: [${document.getElementById('newLocLng').value}, ${document.getElementById('newLocLat').value}] (${curCity})</span>
            <button type="button" onclick="requestLocationAccessForNewPost()" class="text-blue-600 font-bold underline hover:text-blue-700 cursor-pointer ml-1">Thử lại GPS</button>
          </div>
        `;
      }
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function handleCityChangeManual() {
  const city = document.getElementById('newLocCity').value;
  const cityTag = document.getElementById('fbCityTagDisplay');
  if (cityTag) cityTag.innerHTML = `<span>${city}</span>`;

  const coords = {
    'Đà Nẵng': { lng: 108.2272, lat: 16.0611 },
    'Hà Nội': { lng: 105.8542, lat: 21.0285 },
    'TP.HCM': { lng: 106.7009, lat: 10.7769 }
  };
  if (coords[city]) {
    document.getElementById('newLocLng').value = coords[city].lng;
    document.getElementById('newLocLat').value = coords[city].lat;
    const coordsDisplay = document.getElementById('newLocCoordsDisplay');
    if (coordsDisplay) {
      coordsDisplay.innerHTML = `
        <div class="flex items-center space-x-1 text-slate-500">
          <i class="fa-solid fa-location-pin text-slate-400"></i>
          <span>Tọa độ trung tâm: [${coords[city].lng}, ${coords[city].lat}] (${city})</span>
          <button type="button" onclick="requestLocationAccessForNewPost()" class="text-blue-600 font-bold underline hover:text-blue-700 cursor-pointer ml-1">Lấy GPS thực</button>
        </div>
      `;
    }
  }
}

function autoFillCoordinatesByCity() {
  handleCityChangeManual();
}

function getCurrentLocationForNewPost() {
  requestLocationAccessForNewPost();
}

// Cập nhật tag check-in phong cách Facebook
function updateFbCheckinTag(name) {
  const tag = document.getElementById('fbPostCheckinTag');
  if (!tag) return;
  if (name && name.trim()) {
    tag.textContent = `— đang ở tại ${name.trim()}`;
    tag.classList.remove('hidden');
  } else {
    tag.textContent = '';
    tag.classList.add('hidden');
  }
}

async function submitNewLocation() {
  const name = document.getElementById('newLocName').value.trim();
  const city = document.getElementById('newLocCity').value;
  const category = document.getElementById('newLocCategory').value;
  const address = document.getElementById('newLocAddress') ? document.getElementById('newLocAddress').value.trim() : '';
  const imgUrl = document.getElementById('newLocImgUrl').value.trim() || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
  const lng = parseFloat(document.getElementById('newLocLng').value);
  const lat = parseFloat(document.getElementById('newLocLat').value);
  const desc = document.getElementById('newLocDesc').value.trim();

  if (!name || isNaN(lng) || isNaN(lat)) {
    alert('Vui lòng điền đầy đủ Tên địa điểm, Kinh độ và Vĩ độ hợp lệ!');
    return;
  }

  const authorName = currentUser ? currentUser.name : 'Huỳnh Văn Ngọc';
  const authorAvatar = currentUser ? currentUser.avatar : '';
  const authorEmail = currentUser ? currentUser.email : '';

  try {
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        city,
        category,
        address: address || city,
        images: [imgUrl],
        lng,
        lat,
        description: desc,
        author_name: authorName,
        author_email: authorEmail,
        author_avatar: getConsistentAvatar(authorName, authorAvatar)
      })
    });

    const data = await res.json();
    if (res.ok) {
      alert('Đã lưu bài viết & địa điểm mới kèm hình ảnh vào MongoDB thành công!');
      if (document.getElementById('newLocAddress')) document.getElementById('newLocAddress').value = '';
      closeNewLocationModal();
      fetchLocations();
      fetchHeroOverviewStats();
    } else {
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi tạo địa điểm:', err);
  }
}

// =====================================================================
// 15. HỆ THỐNG STORY PHONG CÁCH MẠNG XÃ HỘI (INSTAGRAM / TIKTOK / FACEBOOK)
// LƯU TRỮ VÀ ĐỒNG BỘ 100% TRỰC TIẾP TRÊN MONGODB
// =====================================================================

let allStories = [];
let currentStoryIndex = 0;
let storyTimer = null;
let storyProgressInterval = null;
let storyProgressPercent = 0;
let isStoryPaused = false;
const STORY_DURATION_MS = 5000; // Mỗi story chạy 5 giây

// Tải danh sách Story từ MongoDB
async function fetchStories() {
  try {
    const res = await fetch('/api/stories');
    if (!res.ok) throw new Error('Không thể tải stories');
    allStories = await res.json();
    renderStoriesTray();
    renderFigmaHeroStories();
  } catch (err) {
    console.error('Lỗi tải Stories từ MongoDB:', err);
  }
}

// Cập nhật 4 thẻ Mosaic trên Hero Banner đồng bộ trực tiếp từ các Story thực tế trên MongoDB theo đúng mẫu Figma
function renderFigmaHeroStories() {
  if (!allStories || allStories.length === 0) return;

  const s0 = allStories[0];
  const s1 = allStories[1] || s0;
  const s2 = allStories[2] || s0;
  const s3 = allStories[3] || s0;

  // Thẻ 0 (Trên - Trái): Ảnh Story + Số like (Figma chuẩn)
  const img0 = document.getElementById('heroMosaicImg_0');
  const like0 = document.getElementById('heroMosaicLike_0');
  if (img0 && s0) {
    img0.src = s0.image;
    img0.alt = s0.location_name;
  }
  if (like0 && s0) {
    like0.textContent = s0.likes_count || 0;
  }

  // Thẻ 1 (Dưới - Trái): Ảnh Story + Tên địa điểm check-in (Figma chuẩn)
  const img1 = document.getElementById('heroMosaicImg_1');
  const loc1 = document.getElementById('heroMosaicLoc_1');
  if (img1 && s1) {
    img1.src = s1.image;
    img1.alt = s1.location_name;
  }
  if (loc1 && s1) {
    loc1.textContent = s1.location_name || 'Hội An';
  }

  // Thẻ 2 (Trên - Phải): Ảnh Story + Tên địa điểm check-in (Figma chuẩn)
  const img2 = document.getElementById('heroMosaicImg_2');
  const loc2 = document.getElementById('heroMosaicLoc_2');
  if (img2 && s2) {
    img2.src = s2.image;
    img2.alt = s2.location_name;
  }
  if (loc2 && s2) {
    loc2.textContent = s2.location_name || 'Hạ Long';
  }

  // Thẻ 3 (Dưới - Phải): Ảnh Story + Số like (Figma chuẩn)
  const img3 = document.getElementById('heroMosaicImg_3');
  const like3 = document.getElementById('heroMosaicLike_3');
  if (img3 && s3) {
    img3.src = s3.image;
    img3.alt = s3.location_name;
  }
  if (like3 && s3) {
    like3.textContent = s3.likes_count || 0;
  }
}

// Hiển thị thanh Story Tray trên bảng tin (chuẩn Instagram / Facebook)
function renderStoriesTray() {
  const container = document.getElementById('storiesTrayContainer');
  if (!container) return;

  const myAvatar = currentUser && currentUser.avatar ? currentUser.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';

  // Nút 1: Tạo Story của bạn (+ icon)
  let html = `
    <div onclick="openCreateStoryModal()" class="flex flex-col items-center space-y-1.5 shrink-0 cursor-pointer group">
      <div class="relative w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-full p-[2px] bg-slate-100 group-hover:bg-[#FFD4C4] transition-colors">
        <img src="${myAvatar}" class="w-full h-full rounded-full object-cover border-2 border-white">
        <div class="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#FF5422] text-white flex items-center justify-center border-2 border-white shadow-xs text-[11px] group-hover:scale-110 transition-transform">
          <i class="fa-solid fa-plus"></i>
        </div>
      </div>
      <span class="text-[11px] font-bold text-slate-800 text-center max-w-[70px] truncate">Tạo story</span>
    </div>
  `;

  // Các Story của cộng đồng từ MongoDB
  allStories.forEach((st, idx) => {
    const isMyStory = currentUser && (st.user_email === currentUser.email || st.user_name === currentUser.name);
    const authorAvatar = (isMyStory && currentUser.avatar) ? currentUser.avatar : (st.user_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100');
    const authorName = (isMyStory && currentUser.name) ? currentUser.name : st.user_name;

    html += `
      <div onclick="openStoryViewer(${idx})" class="flex flex-col items-center space-y-1.5 shrink-0 cursor-pointer group">
        <!-- Vòng tròn gradient phong cách Instagram / Facebook rực rỡ -->
        <div class="w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-full p-[2.5px] bg-gradient-to-tr from-[#FF5422] via-[#FF007A] to-[#7928CA] group-hover:scale-105 transition-transform duration-300 shadow-xs">
          <div class="w-full h-full rounded-full p-[2px] bg-white">
            <img src="${authorAvatar}" class="w-full h-full rounded-full object-cover">
          </div>
        </div>
        <div class="text-center max-w-[72px]">
          <span class="text-[11px] font-bold text-slate-800 block truncate group-hover:text-[#FF5422] transition-colors leading-tight">${authorName}</span>
          <span class="text-[9px] text-slate-400 block truncate leading-tight mt-0.5">${st.location_name}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// =====================================================================
// STORY VIEWER (XEM STORY TOÀN MÀN HÌNH TƯƠNG TÁC PHONG CÁCH MXH)
// =====================================================================

function openStoryViewer(index) {
  if (!allStories || allStories.length === 0) return;
  currentStoryIndex = Math.max(0, Math.min(index, allStories.length - 1));

  const modal = document.getElementById('storyViewerModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    showCurrentStory();
  }
}

function closeStoryViewer() {
  clearStoryTimers();
  const modal = document.getElementById('storyViewerModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function clearStoryTimers() {
  if (storyTimer) clearTimeout(storyTimer);
  if (storyProgressInterval) clearInterval(storyProgressInterval);
  storyTimer = null;
  storyProgressInterval = null;
}

function showCurrentStory() {
  clearStoryTimers();
  isStoryPaused = false;
  storyProgressPercent = 0;

  const st = allStories[currentStoryIndex];
  if (!st) return;

  const isMyStory = currentUser && (st.user_email === currentUser.email || st.user_name === currentUser.name);
  const authorAvatar = (isMyStory && currentUser.avatar) ? currentUser.avatar : (st.user_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100');
  const authorName = (isMyStory && currentUser.name) ? currentUser.name : st.user_name;

  // Cập nhật DOM
  const imgEl = document.getElementById('storyViewerImage');
  const avatarEl = document.getElementById('storyViewerAvatar');
  const authorEl = document.getElementById('storyViewerAuthor');
  const locationEl = document.getElementById('storyViewerLocation');
  const timeEl = document.getElementById('storyViewerTime');
  const captionEl = document.getElementById('storyViewerCaption');
  const likeCountEl = document.getElementById('storyViewerLikeCount');
  const likeIconEl = document.getElementById('iconStoryLike');
  const playPauseBtn = document.getElementById('btnStoryPlayPause');

  if (imgEl) imgEl.src = st.image;
  if (avatarEl) {
    avatarEl.src = authorAvatar;
    avatarEl.onclick = (e) => { closeStoryViewer(); openUserProfile(authorName, st.user_email, e); };
    avatarEl.classList.add('cursor-pointer');
  }
  if (authorEl) {
    authorEl.textContent = authorName;
    authorEl.onclick = (e) => { closeStoryViewer(); openUserProfile(authorName, st.user_email, e); };
    authorEl.classList.add('cursor-pointer', 'hover:underline');
  }
  if (locationEl) locationEl.textContent = `${st.location_name}, ${st.location_city}`;
  if (captionEl) captionEl.textContent = st.caption || 'Khung cảnh tuyệt đẹp tại ' + st.location_name;
  if (timeEl) timeEl.textContent = formatStoryTime(st.created_at || st.createdAt);
  if (likeCountEl) likeCountEl.textContent = st.likes_count || 0;
  if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';

  // Hiển thị nút xóa Story nếu là chính tác giả hoặc Quản trị viên
  const deleteBtn = document.getElementById('btnStoryDelete');
  if (deleteBtn) {
    const isOwner = currentUser && (
      (st.user_email && st.user_email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.email && currentUser.email.toLowerCase() === 'vanngoc@foodtravel.vn') ||
      (currentUser.email && currentUser.email.toLowerCase().includes('admin'))
    );
    if (isOwner) deleteBtn.classList.remove('hidden');
    else deleteBtn.classList.add('hidden');
  }

  // Trạng thái nút Like
  const isLiked = st.liked_by && currentUser ? st.liked_by.includes(currentUser.email) : false;
  if (likeIconEl) {
    likeIconEl.className = isLiked ? 'fa-solid fa-heart text-sm text-rose-500' : 'fa-regular fa-heart text-sm text-rose-400';
  }

  // Ẩn ngăn kéo replies khi chuyển story
  const drawer = document.getElementById('storyRepliesDrawer');
  if (drawer) drawer.classList.add('hidden');

  // Cập nhật số lượng replies trên badge
  const repliesBadge = document.getElementById('storyRepliesBadge');
  if (repliesBadge) {
    const rCount = st.replies ? st.replies.length : 0;
    repliesBadge.textContent = rCount;
    if (rCount > 0) {
      repliesBadge.classList.remove('hidden');
    } else {
      repliesBadge.classList.add('hidden');
    }
  }

  // Tự động tạm dừng Story khi người dùng đang nhập tin nhắn, chỉ chạy tiếp khi người dùng không thao tác
  const replyInput = document.getElementById('storyReplyInput');
  if (replyInput) {
    replyInput.value = '';
    replyInput.onfocus = () => {
      isStoryPaused = true;
      const playPauseBtn = document.getElementById('btnStoryPlayPause');
      if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    };
    replyInput.oninput = () => {
      isStoryPaused = true;
      const playPauseBtn = document.getElementById('btnStoryPlayPause');
      if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    };
    replyInput.onblur = () => {
      if (!replyInput.value.trim()) {
        isStoryPaused = false;
        const playPauseBtn = document.getElementById('btnStoryPlayPause');
        if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      }
    };
    replyInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        sendStoryReply();
      }
    };
  }

  // Render các đoạn Progress Bar trên đỉnh
  renderStoryProgressBars();

  // Bắt đầu thanh chạy thời gian tự động
  startStoryProgress();
}

function renderStoryProgressBars() {
  const container = document.getElementById('storyProgressBars');
  if (!container) return;

  container.innerHTML = allStories.map((_, idx) => {
    let fillWidth = '0%';
    if (idx < currentStoryIndex) fillWidth = '100%';
    return `
      <div class="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
        <div id="storyProgress_${idx}" class="h-full bg-white transition-all duration-100 ease-linear" style="width: ${fillWidth};"></div>
      </div>
    `;
  }).join('');
}

function startStoryProgress() {
  const currentBar = document.getElementById(`storyProgress_${currentStoryIndex}`);
  const stepMs = 50;
  const increment = (stepMs / STORY_DURATION_MS) * 100;

  storyProgressInterval = setInterval(() => {
    if (!isStoryPaused) {
      storyProgressPercent += increment;
      if (currentBar) currentBar.style.width = Math.min(100, storyProgressPercent) + '%';

      if (storyProgressPercent >= 100) {
        clearInterval(storyProgressInterval);
        nextStory();
      }
    }
  }, stepMs);
}

function nextStory() {
  if (currentStoryIndex < allStories.length - 1) {
    currentStoryIndex++;
    showCurrentStory();
  } else {
    closeStoryViewer();
  }
}

function prevStory() {
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    showCurrentStory();
  } else {
    // Reset lại story đầu tiên
    showCurrentStory();
  }
}

function toggleStoryPlayPause() {
  isStoryPaused = !isStoryPaused;
  const btn = document.getElementById('btnStoryPlayPause');
  if (btn) {
    btn.innerHTML = isStoryPaused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
  }
}

// Hiệu ứng Thả tim bay bổng phong cách Instagram Story
function spawnStoryHeartAnimation() {
  const container = document.getElementById('floatingEmojiContainer');
  if (!container) return;

  const count = 3;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.innerHTML = '<i class="fa-solid fa-heart text-rose-500 drop-shadow-lg"></i>';
      el.className = 'absolute bottom-20 text-3xl select-none animate-float-up pointer-events-none transition-all';
      el.style.left = (Math.random() * 50 + 25) + '%';
      container.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    }, i * 150);
  }
}

function reactStory(emoji) {
  spawnStoryHeartAnimation();
  toggleStoryLike(true);
}

async function toggleStoryLike(forceLike = false) {
  const st = allStories[currentStoryIndex];
  if (!st || !currentUser) return;

  try {
    const res = await fetch(`/api/stories/${st._id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: currentUser.email })
    });
    const data = await res.json();
    if (res.ok) {
      st.likes_count = data.likes_count;
      if (!st.liked_by) st.liked_by = [];
      if (data.isLiked) {
        if (!st.liked_by.includes(currentUser.email)) st.liked_by.push(currentUser.email);
        spawnStoryHeartAnimation();
      } else {
        st.liked_by = st.liked_by.filter(e => e !== currentUser.email);
      }

      const countEl = document.getElementById('storyViewerLikeCount');
      const iconEl = document.getElementById('iconStoryLike');
      if (countEl) countEl.textContent = data.likes_count;
      if (iconEl) {
        iconEl.className = data.isLiked ? 'fa-solid fa-heart text-sm text-rose-500' : 'fa-regular fa-heart text-sm text-rose-400';
      }
    }
  } catch (err) {
    console.error('Lỗi like story:', err);
  }
}

// Gửi tin nhắn phản hồi cho tác giả Story (Lưu vào MongoDB)
async function sendStoryReply() {
  const input = document.getElementById('storyReplyInput');
  const val = input ? input.value.trim() : '';
  if (!val) {
    alert('Vui lòng nhập nội dung tin nhắn!');
    return;
  }

  const st = allStories[currentStoryIndex];
  if (!st) return;

  const replyData = {
    user_name: currentUser ? currentUser.name : 'Khách trải nghiệm',
    user_avatar: currentUser ? currentUser.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    user_email: currentUser ? currentUser.email : '',
    message: val
  };

  try {
    const res = await fetch(`/api/stories/${st._id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replyData)
    });

    const data = await res.json();
    if (res.ok) {
      if (!st.replies) st.replies = [];
      st.replies.push(data.reply);

      // Cập nhật badge
      const badge = document.getElementById('storyRepliesBadge');
      if (badge) {
        badge.textContent = st.replies.length;
        badge.classList.remove('hidden');
      }

      // Xóa input và khôi phục trạng thái
      if (input) input.value = '';
      isStoryPaused = false;

      // Hiệu ứng tim bay
      spawnStoryHeartAnimation();

      // Nếu ngăn kéo đang mở thì vẽ lại
      const drawer = document.getElementById('storyRepliesDrawer');
      if (drawer && !drawer.classList.contains('hidden')) {
        renderStoryRepliesList();
      }

      alert(`Đã gửi tin nhắn đến tác giả ${st.user_name} thành công!`);
    } else {
      alert('Lỗi: ' + (data.error || 'Không thể gửi tin nhắn'));
    }
  } catch (err) {
    console.error('Lỗi gửi tin nhắn story:', err);
  }
}

// Bật tắt ngăn kéo xem tin nhắn của Story
function toggleStoryRepliesDrawer() {
  const drawer = document.getElementById('storyRepliesDrawer');
  if (!drawer) return;

  const isHidden = drawer.classList.contains('hidden');
  if (isHidden) {
    drawer.classList.remove('hidden');
    isStoryPaused = true;
    const playPauseBtn = document.getElementById('btnStoryPlayPause');
    if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    renderStoryRepliesList();
  } else {
    drawer.classList.add('hidden');
    isStoryPaused = false;
    const playPauseBtn = document.getElementById('btnStoryPlayPause');
    if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  }
}

function renderStoryRepliesList() {
  const list = document.getElementById('storyRepliesList');
  if (!list) return;

  const st = allStories[currentStoryIndex];
  if (!st || !st.replies || st.replies.length === 0) {
    list.innerHTML = `
      <div class="py-6 text-center text-white/50 space-y-1">
        <i class="fa-regular fa-comment-dots text-2xl mb-1 block"></i>
        <p class="font-medium text-xs">Chưa có tin nhắn nào</p>
        <p class="text-[11px] text-white/40">Hãy gửi tin nhắn đầu tiên cho tác giả ${st ? st.user_name : ''}!</p>
      </div>
    `;
    return;
  }

  list.innerHTML = st.replies.map((r, idx) => `
    <div class="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 flex items-start space-x-2.5 border border-white/5">
      <img src="${getConsistentAvatar(r.user_name, r.user_avatar)}" class="w-7 h-7 rounded-full object-cover border border-[#FF5422] shrink-0 mt-0.5">
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <span class="font-bold text-white text-[11px] truncate">${r.user_name}</span>
          <div class="flex items-center space-x-1">
            <span class="text-[10px] text-white/70 font-medium">${formatMessageTime(r.created_at)}</span>
            <button onclick="deleteStoryMessage('${st._id}', ${idx})" class="text-white/40 hover:text-rose-400 p-0.5 cursor-pointer ml-1" title="Xóa tin nhắn">
              <i class="fa-regular fa-trash-can text-[10px]"></i>
            </button>
          </div>
        </div>
        <p class="text-[11px] text-white/90 mt-0.5 break-words font-normal">${r.message}</p>
      </div>
    </div>
  `).join('');
}

function formatStoryTime(dateStr) {
  if (!dateStr) return 'Mới xong';
  const diffHours = Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 3600));
  if (diffHours <= 0) return 'Vừa xong';
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${Math.round(diffHours / 24)} ngày trước`;
}

// Định dạng thời gian gửi tin nhắn rõ ràng: Giờ:Phút kèm Hôm nay / Hôm qua / phút trước
function formatMessageTime(dateStr) {
  if (!dateStr) return 'Vừa xong';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Vừa xong';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  // Kiểm tra nếu là cùng ngày hôm nay
  const isToday = d.getDate() === now.getDate() &&
                  d.getMonth() === now.getMonth() &&
                  d.getFullYear() === now.getFullYear();

  // Kiểm tra nếu là ngày hôm qua
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() &&
                      d.getMonth() === yesterday.getMonth() &&
                      d.getFullYear() === yesterday.getFullYear();

  if (diffMinutes < 1) {
    return `${timeStr} (Vừa xong)`;
  }
  if (diffMinutes < 60) {
    return `${timeStr} (${diffMinutes} phút trước)`;
  }
  if (isToday) {
    return `${timeStr} (Hôm nay)`;
  }
  if (isYesterday) {
    return `${timeStr} (Hôm qua)`;
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${timeStr} ${day}/${month}`;
}

// =====================================================================
// TẠO STORY MỚI (STORY CREATOR MODAL)
// =====================================================================

function openCreateStoryModal() {
  const modal = document.getElementById('createStoryModal');
  if (!modal) return;

  // Điền danh sách gợi ý vào datalist
  const datalist = document.getElementById('storyLocationDatalist');
  if (datalist && allLocations && allLocations.length > 0) {
    datalist.innerHTML = allLocations.map(l => `
      <option value="${l.name}">[${l.city}] ${l.name}</option>
    `).join('');
  }

  // Reset các trường
  selectedStoryImagesList = [];
  const inputImg = document.getElementById('storyImageUrlInput');
  if (inputImg) inputImg.value = '';
  const fileInput = document.getElementById('storyFileInput');
  if (fileInput) fileInput.value = '';
  const captionInput = document.getElementById('storyCaptionInput');
  if (captionInput) captionInput.value = '';
  const locationInput = document.getElementById('storyLocationInput');
  if (locationInput) locationInput.value = '';
  const thumbStrip = document.getElementById('storyUploadThumbnailsStrip');
  if (thumbStrip) {
    thumbStrip.innerHTML = '';
    thumbStrip.classList.add('hidden');
  }
  const countBadge = document.getElementById('storyMultiFileCount');
  if (countBadge) countBadge.classList.add('hidden');

  // Đặt ảnh xem trước mặc định nếu người dùng chưa chọn ảnh nào
  const defaultImg = (allLocations && allLocations.length > 0 && allLocations[0].images && allLocations[0].images[0])
    ? allLocations[0].images[0]
    : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
  updateStoryPreviewImage(defaultImg);
  if (inputImg) inputImg.value = defaultImg;

  const locTag = document.getElementById('storyPreviewLocationTag');
  if (locTag) locTag.textContent = 'Việt Nam';

  // Thông tin tác giả story
  const avatarEl = document.getElementById('storyPreviewUserAvatar');
  const nameEl = document.getElementById('storyPreviewUserName');
  if (currentUser) {
    if (avatarEl) avatarEl.src = currentUser.avatar;
    if (nameEl) nameEl.textContent = currentUser.name;
  }

  modal.classList.remove('hidden');
}

function closeCreateStoryModal() {
  const modal = document.getElementById('createStoryModal');
  if (modal) modal.classList.add('hidden');
}

// Nhập vị trí check-in tùy ý (giống Facebook check-in, KHÔNG đè hoặc đổi ảnh của người dùng)
function handleStoryLocationCustomInput(val) {
  const locTag = document.getElementById('storyPreviewLocationTag');
  if (locTag) {
    locTag.textContent = (val && val.trim()) ? val.trim() : 'Việt Nam';
  }
}

function updateStoryPreviewImage(url) {
  const preview = document.getElementById('storyPreviewImg');
  if (preview && url) {
    preview.src = url;
  }
}

function updateStoryPreviewCaption(text) {
  const preview = document.getElementById('storyPreviewCaptionText');
  if (preview) {
    preview.textContent = text || 'Khám phá ẩm thực và cảnh đẹp Việt Nam hôm nay thật tuyệt vời!';
  }
}

// Xóa khoảnh khắc Story (Chỉ tác giả hoặc admin)
async function deleteCurrentStory() {
  const st = allStories[currentStoryIndex];
  if (!st) return;
  if (!confirm('Bạn có chắc chắn muốn xóa khoảnh khắc Story này không?')) return;

  try {
    const res = await fetch(`/api/stories/${st._id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: currentUser ? currentUser.email : '' })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Đã xóa Story thành công!');
      closeStoryViewer();
      await fetchStories();
    } else {
      alert('Lỗi: ' + data.error);
    }
  } catch (err) {
    console.error('Lỗi xóa story:', err);
  }
}

// Danh sách URL các ảnh đã tải lên để hỗ trợ đăng nhiều story cùng lúc
let selectedStoryImagesList = [];

function renderStoryThumbnailsStrip() {
  const strip = document.getElementById('storyUploadThumbnailsStrip');
  const countBadge = document.getElementById('storyMultiFileCount');
  if (!strip) return;

  if (!selectedStoryImagesList || selectedStoryImagesList.length === 0) {
    strip.innerHTML = '';
    strip.classList.add('hidden');
    if (countBadge) countBadge.classList.add('hidden');
    return;
  }

  if (countBadge) {
    countBadge.textContent = `Đã chọn ${selectedStoryImagesList.length} ảnh khoảnh khắc`;
    countBadge.classList.remove('hidden');
  }

  strip.innerHTML = selectedStoryImagesList.map((url, idx) => `
    <div class="relative inline-block shrink-0 group">
      <img src="${url}" onclick="updateStoryPreviewImage('${url}')" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover cursor-pointer border-2 border-slate-200 hover:border-[#FF5422] shadow-sm transition-all hover:scale-105 bg-slate-100" title="Bấm để xem ảnh ${idx + 1}">
      <button type="button" onclick="removeStoryImage(${idx}, event)" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-110 z-10" title="Xóa ảnh này">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <span class="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded font-bold">${idx + 1}</span>
    </div>
  `).join('');
  strip.classList.remove('hidden');
}

function removeStoryImage(index, event) {
  if (event) event.stopPropagation();
  if (index < 0 || index >= selectedStoryImagesList.length) return;
  selectedStoryImagesList.splice(index, 1);

  if (selectedStoryImagesList.length > 0) {
    updateStoryPreviewImage(selectedStoryImagesList[0]);
    const inputImg = document.getElementById('storyImageUrlInput');
    if (inputImg) inputImg.value = selectedStoryImagesList[0];
  } else {
    const defaultImg = (allLocations && allLocations.length > 0 && allLocations[0].images && allLocations[0].images[0])
      ? allLocations[0].images[0]
      : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
    updateStoryPreviewImage(defaultImg);
    const inputImg = document.getElementById('storyImageUrlInput');
    if (inputImg) inputImg.value = defaultImg;
  }

  renderStoryThumbnailsStrip();
}

async function handleStoryImageUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  // 1. Tạo blob URLs tạm thời xem trước ngay lập tức
  const tempUrls = [];
  for (let i = 0; i < files.length; i++) {
    tempUrls.push(URL.createObjectURL(files[i]));
  }
  updateStoryPreviewImage(tempUrls[0]);
  const inputImg = document.getElementById('storyImageUrlInput');
  if (inputImg) inputImg.value = tempUrls[0];
  selectedStoryImagesList = [...tempUrls];
  renderStoryThumbnailsStrip();

  // 2. Upload file lên máy chủ
  try {
    if (files.length === 1) {
      const formData = new FormData();
      formData.append('image', files[0]);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        updateStoryPreviewImage(data.url);
        if (inputImg) inputImg.value = data.url;
        selectedStoryImagesList = [data.url];
        renderStoryThumbnailsStrip();
      }
    } else {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
      const res = await fetch('/api/upload-multiple', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.urls && data.urls.length > 0) {
        selectedStoryImagesList = data.urls;
        updateStoryPreviewImage(data.urls[0]);
        if (inputImg) inputImg.value = data.urls[0];
        renderStoryThumbnailsStrip();
      }
    }
  } catch (err) {
    console.error('Lỗi upload story ảnh:', err);
  }
}

async function submitNewStory() {
  const locationInput = document.getElementById('storyLocationInput');
  const locVal = locationInput ? locationInput.value.trim() : '';
  const location_name = locVal || 'Việt Nam';

  let location_city = 'Việt Nam';
  if (allLocations && allLocations.length > 0) {
    const matched = allLocations.find(l => l.name.toLowerCase() === location_name.toLowerCase());
    if (matched) {
      location_city = matched.city;
    } else if (locVal.includes(',')) {
      const parts = locVal.split(',');
      location_city = parts[parts.length - 1].trim();
    }
  }

  const singleImage = document.getElementById('storyImageUrlInput') ? document.getElementById('storyImageUrlInput').value.trim() : '';
  const caption = (document.getElementById('storyCaptionInput') && document.getElementById('storyCaptionInput').value.trim()) || 'Khám phá Việt Nam!';

  const imagesToPost = (selectedStoryImagesList.length > 0) ? selectedStoryImagesList : [singleImage];
  const validImages = imagesToPost.filter(Boolean);

  if (validImages.length === 0) {
    alert('Vui lòng chọn hoặc tải lên hình ảnh cho Story!');
    return;
  }

  const authorName = currentUser ? currentUser.name : 'Thành viên FoodTravel';
  const authorAvatar = currentUser ? currentUser.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
  const authorEmail = currentUser ? currentUser.email : 'guest@foodtravel.vn';

  try {
    // Đăng đồng thời từng Story nếu người dùng chọn nhiều ảnh cùng lúc
    const promises = validImages.map(img => {
      const payload = {
        user_name: authorName,
        user_avatar: authorAvatar,
        user_email: authorEmail,
        location_name,
        location_city,
        image: img,
        caption
      };
      return fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    });

    await Promise.all(promises);
    selectedStoryImagesList = [];
    const countBadge = document.getElementById('storyMultiFileCount');
    if (countBadge) countBadge.classList.add('hidden');

    closeCreateStoryModal();
    // Tải lại Stories từ MongoDB
    await fetchStories();
    // Tự động mở xem story vừa tạo
    openStoryViewer(0);
    alert(`Đã đăng thành công ${validImages.length} khoảnh khắc Story lên MongoDB!`);
  } catch (err) {
    console.error('Lỗi lưu story:', err);
    alert('Lỗi khi lưu story: ' + err.message);
  }
}

// Định dạng thời gian đăng bài viết (thân thiện, trực quan: Vừa xong, 5 phút trước, 2 giờ trước...)
function formatPostTime(dateString) {
  if (!dateString) return 'Vừa xong';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Vừa xong';

  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}
