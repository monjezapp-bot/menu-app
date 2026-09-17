// home.js — منطق الصفحة الرئيسية لمنصة منيوز (اكتشاف كل التجار)
// ملف مستقل بالكامل، مالوش أي اعتماد على core.js أو أي ملف تاجر — لأن الصفحة
// دي مش بتاعة تاجر معيّن، فمفيش سلة ولا حساب عميل هنا خالص. دورها الوحيد إنها
// تدلّك على التاجر؛ دوسة على أي كارت بتوديك لـ index.html?r=slug (نفس رحلة
// التاجر القديمة تمامًا، من غير أي تعديل عليها).

// ── XSS PROTECTION (نسخة مطابقة لـ core.js) ──────────────────────────
function escapeHTML(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── CONFIG ────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://pcmyugeqveyjnappulng.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbXl1Z2VxdmV5am5hcHB1bG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNjU0NDAsImV4cCI6MjA5Njc0MTQ0MH0.uwn0X4CvNRW38FGh_0rYD9KjBRM19CydXucfBsCDYeo'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { storageKey: 'menu-customer-auth', detectSessionInUrl: true, flowType: 'pkce' }
})

// ── STATE ─────────────────────────────────────────────────────────────
let allRestaurants = []
let categoryType   = null // النوع المفتوح حاليًا في صفحة التصنيف (null يعني الرئيسية العامة)
let categoryFilter = null // فلتر فرعي (وسم) داخل صفحة التصنيف
let categorySearchTerm = ''
let searchTerm      = ''
let activeTab       = 'home'
let customer        = null // صف platform_customers لو العميل مسجّل دخول، وإلا null

// أيقونات 3D الحقيقية (PNG شفافة موحدة المقاس) بدل Material Symbols المسطحة.
// الملفات جوه مجلد icons/ في جذر المشروع (icons/مطاعم.png وهكذا).
const HOME_TYPES = [
  { key: 'مطاعم',       label: 'مطاعم',       iconImg: 'icons/مطاعم.png' },
  { key: 'كافيهات',     label: 'كافيهات',     iconImg: 'icons/كافيهات.png' },
  { key: 'سوبر ماركت',  label: 'سوبر ماركت',  iconImg: 'icons/سوبر ماركت.png' },
  { key: 'أسماك ولحوم', label: 'أسماك ولحوم', iconImg: 'icons/أسماك ولحوم.png' },
  { key: 'صيدليات',     label: 'صيدليات',     iconImg: 'icons/صيدليات.png' },
]

function showHomeState(name) {
  ['loading', 'app', 'error'].forEach(s => document.getElementById('home-' + s).classList.add('hidden'))
  document.getElementById('home-' + name).classList.remove('hidden')
}

// ── BOOT ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS (منقول من core.js — نفس السلوك بالظبط، بس عميل موحّد
// عبر المنصة كلها مش تاجر واحد) — دلوقتي الجرس شغال في كل الأبلكيشن،
// مش بس جوه صفحة مطعم.
// ══════════════════════════════════════════════════════════════
let _notifPanelOpen = false
let _notifications  = []

function showToast(msg) {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1c1e;color:#fff;font-size:13px;font-weight:700;padding:10px 20px;border-radius:20px;z-index:70;box-shadow:0 4px 16px rgba(0,0,0,0.2)'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2800)
}

function positionNotifPanel() {
  const panel = document.getElementById('notif-panel')
  const btn   = document.getElementById('notif-btn')
  if (!panel || !btn) return
  const margin = 14
  const rect   = btn.getBoundingClientRect()
  const width  = Math.min(320, window.innerWidth - margin * 2)
  panel.style.width = width + 'px'
  let right = window.innerWidth - rect.right
  right = Math.max(margin, Math.min(right, window.innerWidth - width - margin))
  panel.style.right     = right + 'px'
  panel.style.left      = 'auto'
  panel.style.top       = (rect.bottom + 8) + 'px'
  panel.style.maxHeight = Math.max(160, Math.min(320, window.innerHeight - rect.bottom - 24)) + 'px'
}

function toggleNotifPanel() {
  _notifPanelOpen = !_notifPanelOpen
  const panel = document.getElementById('notif-panel')
  if (_notifPanelOpen) positionNotifPanel()
  panel.style.display = _notifPanelOpen ? 'block' : 'none'
  if (_notifPanelOpen && customer) loadNotifications()
}

document.addEventListener('click', e => {
  if (_notifPanelOpen && !document.getElementById('notif-btn')?.contains(e.target) && !document.getElementById('notif-panel')?.contains(e.target)) {
    _notifPanelOpen = false
    const panel = document.getElementById('notif-panel')
    if (panel) panel.style.display = 'none'
  }
})
window.addEventListener('scroll', () => {
  if (_notifPanelOpen) {
    _notifPanelOpen = false
    const panel = document.getElementById('notif-panel')
    if (panel) panel.style.display = 'none'
  }
}, { passive: true })
window.addEventListener('resize', () => { if (_notifPanelOpen) positionNotifPanel() })

async function loadNotifications() {
  if (!customer) return
  try {
    const { data } = await db.from('notifications').select('*')
      .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20)
    _notifications = data || []
    renderNotifList()
    await refreshUnreadNotifCount()
  } catch (e) {}
}

function renderNotifList() {
  const el = document.getElementById('notif-list')
  if (!_notifications.length) { el.innerHTML = `<p class="text-center text-xs text-outline py-6">لا توجد إشعارات</p>`; return }
  const iconMap = { order_confirmed:'✅', order_ready:'📦', order_delivering:'🛵', order_delivered:'🎉', order_cancelled:'❌', coins:'🪙', promo:'🎁', birthday:'🎂', return_approved:'✅', return_rejected:'❌' }
  el.innerHTML = _notifications.map(n => `
    <div onclick="handleNotifClick('${n.id}', ${n.order_id ? `'${n.order_id}'` : 'null'})"
         class="flex items-start gap-2.5 px-4 py-3 border-b border-outline-variant cursor-pointer ${n.is_read ? '' : 'bg-orange-50'}">
      <span class="flex-shrink-0" style="font-size:18px">${iconMap[n.type] || '🔔'}</span>
      <div class="flex-1 min-w-0">
        <p class="text-xs ${n.is_read ? 'font-semibold' : 'font-extrabold'} text-on-surface">${escapeHTML(n.title)}</p>
        <p class="text-[11px] text-outline mt-0.5">${escapeHTML(n.body)}</p>
      </div>
      ${!n.is_read ? '<span class="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1"></span>' : ''}
    </div>`).join('')
}

async function handleNotifClick(notifId, orderId) {
  const n = _notifications.find(x => x.id === notifId)
  if (n && !n.is_read) {
    n.is_read = true
    renderNotifList()
    try { await db.from('notifications').update({ is_read: true }).eq('id', notifId) } catch (e) {}
    refreshUnreadNotifCount()
  }
  if (orderId) {
    toggleNotifPanel()
    // الطلب تابع لمطعم معيّن — نودّي العميل لصفحة المطعم ده مباشرة مفتوح على تفاصيل الطلب
    const { data: o } = await db.from('orders').select('restaurant_id, restaurants(slug)').eq('id', orderId).maybeSingle()
    if (o?.restaurants?.slug) location.href = 'index.html?r=' + o.restaurants.slug + '&order=' + orderId
  }
}

async function refreshUnreadNotifCount() {
  const badge = document.getElementById('notif-badge')
  if (!customer || !badge) return
  try {
    const { count } = await db.from('notifications').select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id).eq('is_read', false)
    const unread = count || 0
    badge.textContent = unread > 9 ? '9+' : String(unread)
    badge.classList.toggle('hidden', unread === 0)
  } catch (e) {}
}

async function markAllNotifsRead() {
  if (!customer || !_notifications.length) return
  _notifications.forEach(n => n.is_read = true)
  renderNotifList()
  try { await db.from('notifications').update({ is_read: true }).eq('customer_id', customer.id).eq('is_read', false) } catch (e) {}
  refreshUnreadNotifCount()
}

let _customerNotifChannel = null
function startCustomerNotifRealtime() {
  if (!customer || _customerNotifChannel) return
  _customerNotifChannel = db.channel('customer-notifs-' + customer.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `customer_id=eq.${customer.id}` }, p => {
      _notifications.unshift(p.new)
      if (_notifications.length > 20) _notifications = _notifications.slice(0, 20)
      renderNotifList()
      refreshUnreadNotifCount()
      if (!_notifPanelOpen) showToast(p.new.title || '🔔 إشعار جديد')
    }).subscribe()
}
function stopCustomerNotifRealtime() {
  if (_customerNotifChannel) { db.removeChannel(_customerNotifChannel); _customerNotifChannel = null }
}


async function bootHome() {
  document.title = 'منيوز — اطلب من مطعمك المفضل'
  const { lat, lng } = await getLocation()
  const { data, error } = await db.rpc('get_nearby_restaurants', { p_lat: lat, p_lng: lng })
  if (error) { showHomeState('error'); return }
  allRestaurants = data || []
  renderTypeTabs()
  renderGrid()
  showHomeState('app')

  // الأقسام الإضافية (بانرات/اشتريت منها/الأكثر مبيعًا/عروض/مقترحات) —
  // كل واحد بيحمّل ويعرض نفسه لوحده وبيختفي بأمان لو مفيش بيانات كفاية
  loadBanners()
  loadBestSellers()
  loadOffers()
  if (customer) { loadBoughtBefore().then(renderRecommended) }
}

// بيحاول ياخد موقع العميل عشان ترتيب المطاعم بالمسافة (القريب الأول). لو
// اتمنع الإذن أو اتعذّر، بيكمل من غير موقع من غير ما يزعج العميل — كل
// المطاعم بتفضل تظهر، بس مرتبة بالتقييم بدل المسافة (get_nearby_restaurants
// بتتعامل مع null بأمان).
function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve({ lat: null, lng: null }); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => resolve({ lat: null, lng: null }),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    )
  })
}

// ── RENDER: TYPE TABS ─────────────────────────────────────────────────
function renderTypeTabs() {
  const wrap = document.getElementById('home-type-tabs')
  wrap.innerHTML = HOME_TYPES.map(t => {
    const iconHTML = t.iconImg
      ? `<img src="${t.iconImg}" alt="" class="w-16 h-16 object-contain" />`
      : `<span class="material-symbols-outlined" style="font-size:40px">${t.icon}</span>`
    return `<button data-type="${t.key}" onclick="openCategory(this.dataset.type)"
      class="flex-shrink-0 flex flex-col items-center justify-center gap-1 w-20 bg-transparent active:scale-95 transition-transform">
      ${iconHTML}
      <span class="text-[11px] font-bold text-on-surface-variant">${t.label}</span>
    </button>`
  }).join('')
}

function onSearchInput(val) {
  searchTerm = (val || '').trim()
  renderGrid()
}

function restaurantCardTalabatHTML(r) {
  const closed = r.is_open === false
  const metaParts = []
  if (r.rating) metaParts.push(`⭐ ${Number(r.rating).toFixed(1)}`)
  const timeCost = [r.avg_prep_minutes ? `${r.avg_prep_minutes} دقيقة` : null, r.distance_km != null ? `${r.distance_km} كم` : null].filter(Boolean).join(' · ')

  return `<div onclick="goToRestaurant('${r.slug}')" class="flex items-center gap-3 bg-surface-container-lowest rounded-xl p-2.5 shadow-[0_2px_10px_0_rgba(0,0,0,0.05)] cursor-pointer active:scale-[0.98] transition-transform">
    <div class="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-surface-container">
      ${r.cover_url || r.logo_url ? `<img src="${r.cover_url || r.logo_url}" alt="${escapeHTML(r.name)}" loading="lazy" class="w-full h-full object-cover" />`
                    : `<div class="w-full h-full flex items-center justify-center text-outline"><span class="material-symbols-outlined" style="font-size:26px">storefront</span></div>`}
      <button onclick="event.stopPropagation()" class="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
        <span class="material-symbols-outlined" style="font-size:14px;color:#c0392b">favorite_border</span>
      </button>
      ${closed ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><span class="text-white text-[10px] font-extrabold">مغلق الآن</span></div>` : ''}
    </div>
    <div class="flex-1 min-w-0 text-right">
      <h4 class="text-sm font-extrabold text-on-surface truncate">${escapeHTML(r.name)}</h4>
      ${metaParts.length ? `<div class="text-[11.5px] font-bold text-on-surface-variant mt-0.5">${metaParts.join(' · ')}</div>` : ''}
      ${timeCost ? `<div class="text-[11px] text-outline mt-0.5">${timeCost}</div>` : ''}
      ${(r.categories && r.categories.length) ? `<div class="text-[10.5px] font-semibold text-secondary mt-1 truncate">${r.categories.slice(0,2).map(c=>escapeHTML(c)).join(' · ')}</div>` : ''}
    </div>
  </div>`
}

// ══════════════════════════════════════════════════════════════
// CATEGORY VIEW (صفحة تصنيف مخصصة بستايل طلبات)
// ══════════════════════════════════════════════════════════════
function openCategory(type) {
  categoryType   = type
  categoryFilter = null
  categorySearchTerm = ''
  const label = (HOME_TYPES.find(t => t.key === type) || {}).label || type
  document.getElementById('category-title').textContent   = label
  document.getElementById('category-title-2').textContent = label
  document.getElementById('category-search').value = ''

  document.getElementById('home-app').classList.add('hidden')
  document.getElementById('category-view').classList.remove('hidden')
  window.scrollTo(0, 0)

  renderCategoryTop()
  renderCategoryTags()
  renderCategoryFilters()
  renderCategoryGrid()
  history.pushState({ menuzCategory: type }, '', '#' + encodeURIComponent(type))
}

function closeCategory() {
  document.getElementById('category-view').classList.add('hidden')
  document.getElementById('home-app').classList.remove('hidden')
  categoryType = null
}

window.addEventListener('popstate', () => {
  if (categoryType) closeCategory()
})

function categoryRestaurants() {
  return allRestaurants.filter(r => r.business_type === categoryType)
}

function renderCategoryTop() {
  const list = categoryRestaurants().filter(r => r.rating).sort((a, b) => b.rating - a.rating).slice(0, 8)
  renderHorizontalSection('category-top-wrap', 'category-top', list)
}

function renderCategoryTags() {
  const wrap = document.getElementById('category-tags-wrap')
  const tags = [...new Set(categoryRestaurants().flatMap(r => r.categories || []))].slice(0, 10)
  if (!tags.length) { wrap.classList.add('hidden'); return }
  wrap.classList.remove('hidden')
  const palette = ['#0d631b', '#9f4200', '#1a73e8', '#8e24aa', '#c0392b', '#00897b']
  document.getElementById('category-tags').innerHTML = tags.map((t, i) => `
    <button onclick="setCategoryTag('${escapeHTML(t).replace(/'/g,"\\'")}')" class="flex-shrink-0 flex flex-col items-center gap-1.5 w-16">
      <div class="w-14 h-14 rounded-full flex items-center justify-center text-white font-extrabold text-lg" style="background:${palette[i % palette.length]}">${escapeHTML(t).charAt(0)}</div>
      <span class="text-[10.5px] font-bold text-on-surface-variant truncate w-full text-center">${escapeHTML(t)}</span>
    </button>`).join('')
}

function setCategoryTag(tag) {
  categoryFilter = (categoryFilter === tag) ? null : tag
  renderCategoryFilters()
  renderCategoryGrid()
}

let categoryMinRating = false
let categoryOffersOnly = false
let categorySortByRating = false
function toggleCategoryRatingFilter() { categoryMinRating = !categoryMinRating; renderCategoryFilters(); renderCategoryGrid() }
function toggleCategoryOffersFilter() { categoryOffersOnly = !categoryOffersOnly; renderCategoryFilters(); renderCategoryGrid() }
function toggleCategorySortMode()     { categorySortByRating = !categorySortByRating; renderCategoryFilters(); renderCategoryGrid() }

function renderCategoryFilters() {
  const chip = (active, label, onclick, icon) =>
    `<button onclick="${onclick}" class="flex-shrink-0 flex items-center gap-1 text-xs font-bold rounded-full px-4 py-2 border whitespace-nowrap
      ${active ? 'bg-secondary-container text-white border-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'}">${icon || ''}${label}</button>`

  document.getElementById('category-filters').innerHTML =
    chip(categoryMinRating, 'تقييم +4.0', 'toggleCategoryRatingFilter()') +
    chip(categoryOffersOnly, 'عروض', 'toggleCategoryOffersFilter()') +
    chip(categorySortByRating, 'الأعلى تقييمًا', 'toggleCategorySortMode()',
      `<span class="material-symbols-outlined" style="font-size:14px">swap_vert</span>`) +
    (categoryFilter ? chip(true, '✕ ' + escapeHTML(categoryFilter), `setCategoryTag('${escapeHTML(categoryFilter).replace(/'/g,"\\'")}')`) : '')
}

function onCategorySearchInput(val) {
  categorySearchTerm = (val || '').trim()
  renderCategoryGrid()
}

async function categoryOfferSlugs() {
  try {
    const { data } = await db.from('bundles').select('restaurant_id').eq('is_active', true)
    return new Set((data || []).map(b => b.restaurant_id))
  } catch (e) { return new Set() }
}

async function renderCategoryGrid() {
  const wrap = document.getElementById('category-grid')
  let list = categoryRestaurants()

  if (categoryFilter) list = list.filter(r => (r.categories || []).includes(categoryFilter))
  if (categoryMinRating) list = list.filter(r => (r.rating || 0) >= 4)
  if (categorySearchTerm) {
    const q = categorySearchTerm.toLowerCase()
    list = list.filter(r => r.name.toLowerCase().includes(q) || (r.categories || []).some(c => c.toLowerCase().includes(q)))
  }
  if (categoryOffersOnly) {
    const offerIds = await categoryOfferSlugs()
    list = list.filter(r => offerIds.has(r.id))
  }
  if (categorySortByRating) list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0))

  if (!list.length) {
    wrap.innerHTML = `<div class="text-center py-16 text-outline text-xs">مفيش نتائج تطابق الفلاتر دي</div>`
    return
  }
  wrap.innerHTML = list.map(restaurantCardTalabatHTML).join('')
}


function restaurantCardHTML(r) {
  const closedBadge = r.is_open === false
    ? `<div class="absolute top-2.5 right-2.5 bg-on-background/75 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg">مغلق الآن</div>` : ''
  const distanceBadge = (r.distance_km !== null && r.distance_km !== undefined)
    ? `<div class="absolute top-2.5 left-2.5 bg-white text-on-background text-[10px] font-extrabold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
         <span class="material-symbols-outlined" style="font-size:12px">near_me</span>${r.distance_km} كم
       </div>` : ''

  const metaParts = []
  if (r.rating)           metaParts.push(`<span class="flex items-center gap-0.5"><span class="material-symbols-outlined text-secondary" style="font-size:14px;font-variation-settings:'FILL' 1">star</span>${Number(r.rating).toFixed(1)}</span>`)
  if (r.avg_prep_minutes)  metaParts.push(`<span>${r.avg_prep_minutes} دقيقة</span>`)
  const tags = (r.categories || []).slice(0, 3).map(c => escapeHTML(c)).join(' · ')

  return `<div onclick="goToRestaurant('${r.slug}')"
    class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_16px_0_rgba(0,0,0,0.06)] cursor-pointer active:scale-[0.98] transition-transform">
    <div class="relative w-full h-32 bg-surface-container">
      ${r.cover_url ? `<img src="${r.cover_url}" alt="${escapeHTML(r.name)}" loading="lazy" class="w-full h-full object-cover" />`
                    : `<div class="w-full h-full flex items-center justify-center text-outline"><span class="material-symbols-outlined" style="font-size:34px">storefront</span></div>`}
      ${closedBadge}
      ${distanceBadge}
    </div>
    <div class="flex items-center gap-3 p-3.5">
      ${r.logo_url ? `<img src="${r.logo_url}" alt="" class="w-11 h-11 rounded-lg object-cover border border-outline-variant flex-shrink-0" />`
                   : `<div class="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-outline" style="font-size:18px">store</span></div>`}
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-extrabold text-on-surface truncate">${escapeHTML(r.name)}</h3>
        ${metaParts.length ? `<div class="flex items-center gap-2.5 text-[11px] font-bold text-on-surface-variant mt-0.5">${metaParts.join('')}</div>` : ''}
        ${tags ? `<div class="text-[10.5px] font-semibold text-secondary mt-1 truncate">${tags}</div>` : ''}
      </div>
      <span class="material-symbols-outlined text-outline flex-shrink-0">chevron_left</span>
    </div>
  </div>`
}

function restaurantCardSmHTML(r) {
  return `<div onclick="goToRestaurant('${r.slug}')" class="flex-shrink-0 w-36 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_16px_0_rgba(0,0,0,0.06)] cursor-pointer active:scale-[0.98] transition-transform snap-start">
    <div class="relative w-full h-24 bg-surface-container">
      ${r.cover_url || r.logo_url ? `<img src="${r.cover_url || r.logo_url}" alt="${escapeHTML(r.name)}" loading="lazy" class="w-full h-full object-cover" />`
                    : `<div class="w-full h-full flex items-center justify-center text-outline"><span class="material-symbols-outlined" style="font-size:26px">storefront</span></div>`}
    </div>
    <div class="p-2">
      <h4 class="text-xs font-extrabold text-on-surface truncate">${escapeHTML(r.name)}</h4>
      ${r.rating ? `<div class="text-[10px] text-on-surface-variant mt-0.5">⭐ ${Number(r.rating).toFixed(1)}</div>` : ''}
    </div>
  </div>`
}

function renderHorizontalSection(wrapId, listId, restaurants) {
  const wrap = document.getElementById(wrapId)
  const list = document.getElementById(listId)
  if (!restaurants || !restaurants.length) { wrap.classList.add('hidden'); return }
  wrap.classList.remove('hidden')
  list.innerHTML = restaurants.map(restaurantCardSmHTML).join('')
}

// ── 2) بانرات وإعلانات (اختياري — لو الجدول مش موجود أو فاضي، القسم بيختفي بهدوء) ──
async function loadBanners() {
  try {
    const { data, error } = await db.from('platform_banners').select('*').eq('is_active', true).order('sort_order', { ascending: true })
    if (error || !data || !data.length) { document.getElementById('home-banners-wrap').classList.add('hidden'); return }
    document.getElementById('home-banners-wrap').classList.remove('hidden')
    document.getElementById('home-banners').innerHTML = data.map(b => `
      <a href="${b.link_url || '#'}" class="flex-shrink-0 w-[85%] snap-start rounded-xl overflow-hidden">
        <img src="${b.image_url}" alt="${escapeHTML(b.title || '')}" class="w-full h-28 object-cover" />
      </a>`).join('')
  } catch (e) { document.getElementById('home-banners-wrap').classList.add('hidden') }
}

// ── 3) متاجر اشتريت منها (محتاج تسجيل دخول) ──
async function loadBoughtBefore() {
  if (!customer) { document.getElementById('home-bought-before-wrap').classList.add('hidden'); return }
  const { data } = await db.from('orders')
    .select('restaurant_id, restaurants(id, slug, name, logo_url, cover_url, rating)')
    .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(50)
  const seen = new Set(); const list = []
  for (const row of (data || [])) {
    const r = row.restaurants
    if (r && !seen.has(r.id)) { seen.add(r.id); list.push(r) }
  }
  renderHorizontalSection('home-bought-before-wrap', 'home-bought-before', list.slice(0, 10))
}

// ── 4) الأكثر مبيعًا (عدد الطلبات المكتملة لكل مطعم عبر المنصة) ──
async function loadBestSellers() {
  try {
    const { data, error } = await db.from('orders').select('restaurant_id').eq('status', 'delivered').limit(2000)
    if (error || !data) { document.getElementById('home-best-sellers-wrap').classList.add('hidden'); return }
    const counts = {}
    data.forEach(o => { counts[o.restaurant_id] = (counts[o.restaurant_id] || 0) + 1 })
    const topIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0])
    const list = topIds.map(id => allRestaurants.find(r => r.id === id)).filter(Boolean)
    renderHorizontalSection('home-best-sellers-wrap', 'home-best-sellers', list)
  } catch (e) { document.getElementById('home-best-sellers-wrap').classList.add('hidden') }
}

// ── 5) عروض (منتجات عليها عرض عبر كل المطاعم — يعتمد على جدول bundles، بيختفي بأمان لو مش جاهز) ──
async function loadOffers() {
  try {
    const { data, error } = await db.from('bundles')
      .select('*, restaurants(id, slug, name, logo_url, cover_url, rating)')
      .eq('is_active', true).limit(10)
    if (error || !data || !data.length) { document.getElementById('home-offers-wrap').classList.add('hidden'); return }
    const list = data.map(b => b.restaurants).filter(Boolean)
    renderHorizontalSection('home-offers-wrap', 'home-offers', list)
  } catch (e) { document.getElementById('home-offers-wrap').classList.add('hidden') }
}

// ── 7) نقترح لك (بدائي دلوقتي: نفس نوع المطاعم اللي طلب منها قبل كده، غير اللي طلب منها) ──
function renderRecommended() {
  if (!customer) { document.getElementById('home-recommended-wrap').classList.add('hidden'); return }
  const boughtIds = new Set()
  document.querySelectorAll('#home-bought-before [onclick]').forEach(el => {
    const m = el.getAttribute('onclick').match(/goToRestaurant\('([^']+)'\)/)
    if (m) boughtIds.add(m[1])
  })
  if (!boughtIds.size) { document.getElementById('home-recommended-wrap').classList.add('hidden'); return }
  const boughtTypes = new Set(allRestaurants.filter(r => boughtIds.has(r.slug)).map(r => r.business_type))
  const list = allRestaurants.filter(r => boughtTypes.has(r.business_type) && !boughtIds.has(r.slug)).slice(0, 10)
  renderHorizontalSection('home-recommended-wrap', 'home-recommended', list)
}

function renderGrid() {
  const wrap = document.getElementById('home-grid')
  let list = allRestaurants
  if (searchTerm) {
    const q = searchTerm.toLowerCase()
    list = list.filter(r => r.name.toLowerCase().includes(q) || (r.categories || []).some(c => c.toLowerCase().includes(q)))
  }

  if (!list.length) {
    wrap.innerHTML = `<div class="text-center py-16 px-4 text-outline text-xs">
      <span class="material-symbols-outlined block mx-auto mb-2" style="font-size:32px">search_off</span>
      ${searchTerm ? 'مفيش نتائج تطابق بحثك' : 'مفيش متاجر متاحة دلوقتي'}
    </div>`
    return
  }
  wrap.innerHTML = list.map(restaurantCardHTML).join('')
}

// دوس على كارت مطعم → رحلة العميل العادية بالظبط (index.html?r=slug)، من غير
// أي اختصار أو مسار موازٍ، عشان تفضل كل قواعد التاجر (فروع، أسعار، منيو) شغالة زي ما هي.
function goToRestaurant(slug) {
  location.href = 'index.html?r=' + encodeURIComponent(slug)
}

// ══════════════════════════════════════════════════════════════
// AUTH — نفس جلسة تسجيل الدخول المستخدمة في صفحات التاجر (storageKey
// مشترك)، فلو العميل سجّل دخول قبل كده من أي مطعم، هيلاقي نفسه مسجّل
// هنا تلقائيًا من غير ما يعمل حاجة.
// ══════════════════════════════════════════════════════════════
function isInAppOrWebView() {
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok/i.test(ua)
}

let _googleSignInInFlight = false
async function signInWithGoogle(btn) {
  if (_googleSignInInFlight) return
  if (isInAppOrWebView()) {
    alert('افتح الرابط في متصفح خارجي (كروم/سفاري) عشان تقدر تسجّل دخول بجوجل')
    return
  }
  _googleSignInInFlight = true
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6' }
  try {
    sessionStorage.setItem('mnio_oauth_pending', '1')
    const redirectTo = window.location.origin + window.location.pathname
    const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) throw error
  } catch (e) {
    sessionStorage.removeItem('mnio_oauth_pending')
    _googleSignInInFlight = false
    if (btn) { btn.disabled = false; btn.style.opacity = '1' }
    alert('تعذر تسجيل الدخول: ' + e.message)
  }
}

async function signOut() {
  await db.auth.signOut()
  customer = null
  renderAccountTab()
  renderWalletTab()
  renderOrdersTab()
}

async function loadCustomer() {
  const { data: { user } } = await db.auth.getUser()
  if (!user) { customer = null; return }

  const { data } = await db.from('platform_customers').select('*').eq('user_id', user.id).maybeSingle()
  if (data) { customer = data; return }

  // أول مرة يسجّل دخول العميل ده على منيوز كله — أنشئله بروفايل موحّد فورًا
  const { data: loyalty } = await db.from('menuz_loyalty_settings').select('*').eq('id', true).maybeSingle()
  const welcomeCoins = loyalty?.welcome_coins ?? 10000
  const cpe          = loyalty?.coins_per_egp ?? 1000
  const refCode = 'REF' + Date.now().toString(36).toUpperCase().slice(-6)

  const { data: newCust } = await db.from('platform_customers').insert({
    user_id: user.id, email: user.email,
    name: user.user_metadata?.full_name || null,
    avatar_url: user.user_metadata?.avatar_url || null,
    wallet_balance: welcomeCoins / cpe,
    referral_code: refCode
  }).select('*').maybeSingle()

  if (newCust) {
    customer = newCust
    await db.rpc('record_welcome_bonus_transaction', { p_customer_id: newCust.id })
  }
}

function initAuthListener() {
  db.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
      await loadCustomer()
      renderAccountTab(); renderWalletTab(); renderOrdersTab()
      refreshUnreadNotifCount()
      startCustomerNotifRealtime()
      if (allRestaurants.length) { loadBoughtBefore().then(renderRecommended) }
      if (sessionStorage.getItem('mnio_oauth_pending') === '1') {
        sessionStorage.removeItem('mnio_oauth_pending')
        switchTab('account')
      }
    } else if (event === 'SIGNED_OUT') {
      customer = null
      stopCustomerNotifRealtime()
      document.getElementById('notif-badge').classList.add('hidden')
      document.getElementById('home-bought-before-wrap').classList.add('hidden')
      document.getElementById('home-recommended-wrap').classList.add('hidden')
    }
  })
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════
function switchTab(tab) {
  activeTab = tab
  if (categoryType) document.getElementById('category-view').classList.add('hidden')
  categoryType = null
  ;['home', 'orders', 'wallet', 'account'].forEach(t => {
    const el = document.getElementById(t === 'home' ? 'home-app' : 'home-tab-' + t)
    if (el) el.classList.toggle('hidden', t !== tab)
  })
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))

  if (tab === 'account') renderAccountTab()
  if (tab === 'wallet')  renderWalletTab()
  if (tab === 'orders')  renderOrdersTab()
}

function loginPromptHTML(message) {
  return `<div class="text-center py-16 px-4">
    <span class="material-symbols-outlined text-outline mb-3" style="font-size:44px">lock</span>
    <p class="text-sm text-on-surface-variant mb-5">${message}</p>
    <button onclick="signInWithGoogle(this)" class="bg-primary text-on-primary text-sm font-bold rounded-full px-6 py-3">متابعة مع Google</button>
  </div>`
}

// ── حسابك ──
function renderAccountTab() {
  const wrap = document.getElementById('account-content')
  if (!customer) { wrap.innerHTML = loginPromptHTML('سجّل دخولك عشان تشوف بياناتك وكود الإحالة بتاعك'); return }

  wrap.innerHTML = `
    <div class="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_16px_0_rgba(0,0,0,0.06)] mb-4 flex items-center gap-3">
      ${customer.avatar_url ? `<img src="${customer.avatar_url}" class="w-14 h-14 rounded-full object-cover" />` : `<div class="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center"><span class="material-symbols-outlined text-outline">person</span></div>`}
      <div>
        <h3 class="text-sm font-extrabold">${escapeHTML(customer.name || 'عميل منيوز')}</h3>
        <p class="text-xs text-outline">${escapeHTML(customer.email || customer.phone || '')}</p>
      </div>
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_16px_0_rgba(0,0,0,0.06)] mb-4">
      <p class="text-xs font-bold text-on-surface-variant mb-1">كود الإحالة بتاعك</p>
      <p class="text-lg font-extrabold text-secondary tracking-widest">${escapeHTML(customer.referral_code || '—')}</p>
      <p class="text-[11px] text-outline mt-1">شارك الكود ده مع صحابك واكسبوا كوينز مع بعض</p>
    </div>
    <button onclick="signOut()" class="w-full bg-surface-container-lowest text-red-600 text-sm font-bold rounded-xl py-3 shadow-[0_4px_16px_0_rgba(0,0,0,0.06)]">تسجيل الخروج</button>
  `
}

// ── محفظتك ──
function renderWalletTab() {
  const wrap = document.getElementById('wallet-content')
  if (!customer) { wrap.innerHTML = loginPromptHTML('سجّل دخولك عشان تشوف رصيدك وتقدر تستخدمه في أي متجر على منيوز'); return }

  const wallet = Number(customer.wallet_balance || 0)
  const coins  = Number(customer.coins_balance || 0)

  wrap.innerHTML = `
    <div class="bg-primary rounded-xl p-5 mb-4 text-center">
      <p class="text-white/80 text-xs font-bold mb-1">رصيد المحفظة (يُصرف في أي متجر على منيوز)</p>
      <p class="text-white text-3xl font-extrabold">${wallet.toFixed(2)} ج.م</p>
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_16px_0_rgba(0,0,0,0.06)] flex items-center justify-between">
      <div>
        <p class="text-xs font-bold text-on-surface-variant mb-1">رصيد الكوينز 🪙</p>
        <p class="text-xl font-extrabold text-secondary">${numFmt(coins)}</p>
      </div>
      <button onclick="convertCoins()" class="bg-secondary-container text-white text-xs font-bold rounded-full px-4 py-2">حوّل لمحفظة</button>
    </div>
  `
}

function numFmt(n) { return Number(n || 0).toLocaleString('ar-EG') }

async function convertCoins() {
  try {
    const { data, error } = await db.rpc('convert_coins_to_wallet')
    if (error) throw error
    customer.coins_balance = 0
    customer.wallet_balance = data.new_wallet_balance
    renderWalletTab()
    alert(`تم تحويل ${Number(data.converted_amount).toFixed(2)} ج.م لمحفظتك!`)
  } catch (e) {
    alert('خطأ: ' + e.message)
  }
}

// ── طلباتك (عبر كل المطاعم) ──
async function renderOrdersTab() {
  const wrap = document.getElementById('orders-list')
  if (!customer) { wrap.innerHTML = loginPromptHTML('سجّل دخولك عشان تشوف كل طلباتك من كل المطاعم في مكان واحد'); return }

  wrap.innerHTML = `<div class="skeleton h-20 rounded-xl mb-3"></div><div class="skeleton h-20 rounded-xl"></div>`

  const { data, error } = await db.from('orders')
    .select('id, order_number, status, total, created_at, restaurant_id, restaurants(name, logo_url, slug)')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error || !data || !data.length) {
    wrap.innerHTML = `<div class="text-center py-16 text-outline text-xs">مفيش طلبات لسه</div>`
    return
  }

  const statusLabel = {
    pending: 'قيد المراجعة', confirmed: 'مؤكد', ready: 'جاهز', delivering: 'في الطريق',
    delivered: 'تم التسليم', cancelled: 'ملغي'
  }

  wrap.innerHTML = data.map(o => `
    <div onclick="location.href='index.html?r=${o.restaurants?.slug || ''}'" class="bg-surface-container-lowest rounded-xl p-3 shadow-[0_4px_16px_0_rgba(0,0,0,0.06)] flex items-center gap-3 cursor-pointer">
      ${o.restaurants?.logo_url ? `<img src="${o.restaurants.logo_url}" class="w-11 h-11 rounded-lg object-cover flex-shrink-0" />` : `<div class="w-11 h-11 rounded-lg bg-surface-container flex-shrink-0"></div>`}
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-extrabold truncate">${escapeHTML(o.restaurants?.name || '')}</h4>
        <p class="text-[11px] text-outline">#${o.order_number || ''} · ${statusLabel[o.status] || o.status}</p>
      </div>
      <p class="text-sm font-extrabold">${Number(o.total || 0).toFixed(0)} ج.م</p>
    </div>
  `).join('')
}

initAuthListener()
switchTab('home')
bootHome()
