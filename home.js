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
const db = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── STATE ─────────────────────────────────────────────────────────────
let allRestaurants = []
let activeType      = 'مطاعم'
let activeFilter    = null

const HOME_TYPES = [
  { key: 'مطاعم',       label: 'مطاعم',       icon: '🍽️' },
  { key: 'كافيهات',     label: 'كافيهات',     icon: '☕' },
  { key: 'سوبر ماركت',  label: 'سوبر ماركت',  icon: '🛒' },
  { key: 'أسماك ولحوم', label: 'أسماك ولحوم', icon: '🍗' },
]

function showHomeState(name) {
  ['loading', 'app', 'error'].forEach(s => document.getElementById('home-' + s).classList.add('hidden'))
  document.getElementById('home-' + name).classList.remove('hidden')
}

// ── BOOT ──────────────────────────────────────────────────────────────
async function bootHome() {
  document.title = 'منيوز — اطلب من مطعمك المفضل'
  const { lat, lng } = await getLocation()
  const { data, error } = await db.rpc('get_nearby_restaurants', { p_lat: lat, p_lng: lng })
  if (error) { showHomeState('error'); return }
  allRestaurants = data || []
  renderTypeTabs()
  renderFilters()
  renderGrid()
  showHomeState('app')
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

// ── RENDER: NAV ───────────────────────────────────────────────────────
function renderTypeTabs() {
  const wrap = document.getElementById('home-type-tabs')
  wrap.innerHTML = HOME_TYPES.map(t => `
    <div class="home-type-tab${activeType === t.key ? ' active' : ''}" data-type="${t.key}" onclick="setActiveType(this.dataset.type)">
      <span class="home-type-icon">${t.icon}</span>
      <span>${t.label}</span>
    </div>
  `).join('')
}

function setActiveType(type) {
  activeType   = type
  activeFilter = null // تصفير الفلتر الفرعي لما نبدّل النوع الأساسي
  renderTypeTabs()
  renderFilters()
  renderGrid()
}

function renderFilters() {
  const wrap = document.getElementById('home-filters')
  const inType = allRestaurants.filter(r => r.business_type === activeType)
  const allCats = [...new Set(inType.flatMap(r => r.categories || []))]
  if (!allCats.length) { wrap.innerHTML = ''; return }

  wrap.innerHTML = `<div class="home-chip${!activeFilter ? ' active' : ''}" onclick="setActiveFilter(null)">الكل</div>` +
    allCats.map(c => {
      const safe = escapeHTML(c)
      return `<div class="home-chip${activeFilter === c ? ' active' : ''}" data-cat="${safe}" onclick="setActiveFilter(this.dataset.cat)">${safe}</div>`
    }).join('')
}

function setActiveFilter(cat) {
  activeFilter = cat || null
  renderFilters()
  renderGrid()
}

// ── RENDER: GRID ──────────────────────────────────────────────────────
function restaurantCardHTML(r) {
  const closedBadge   = r.is_open === false ? `<div class="restaurant-badge restaurant-badge-closed">مغلق الآن</div>` : ''
  const distanceBadge = (r.distance_km !== null && r.distance_km !== undefined)
    ? `<div class="restaurant-badge restaurant-badge-distance">${r.distance_km} كم</div>` : ''
  const metaParts = []
  if (r.rating)           metaParts.push(`⭐ ${Number(r.rating).toFixed(1)}`)
  if (r.avg_prep_minutes) metaParts.push(`${r.avg_prep_minutes} دقيقة`)
  const tags = (r.categories || []).slice(0, 3).map(c => escapeHTML(c)).join(' · ')

  return `<div class="restaurant-card" onclick="goToRestaurant('${r.slug}')">
    <div class="restaurant-card-cover">
      ${r.cover_url ? `<img src="${r.cover_url}" alt="${escapeHTML(r.name)}" loading="lazy" />` : `<div class="no-img">🍽️</div>`}
      ${closedBadge}
      ${distanceBadge}
    </div>
    <div class="restaurant-card-info">
      ${r.logo_url ? `<img class="restaurant-card-logo" src="${r.logo_url}" alt="" />` : `<div class="restaurant-card-logo no-img" style="font-size:18px">🏪</div>`}
      <div style="flex:1;min-width:0">
        <h3>${escapeHTML(r.name)}</h3>
        ${metaParts.length ? `<div class="restaurant-card-meta">${metaParts.join(' · ')}</div>` : ''}
        ${tags ? `<div class="restaurant-card-tags">${tags}</div>` : ''}
      </div>
    </div>
  </div>`
}

function renderGrid() {
  const wrap = document.getElementById('home-grid')
  let list = allRestaurants.filter(r => r.business_type === activeType)
  if (activeFilter) list = list.filter(r => (r.categories || []).includes(activeFilter))

  if (!list.length) {
    wrap.innerHTML = `<div class="home-empty">${activeFilter ? 'مفيش متاجر في التصنيف ده دلوقتي' : 'مفيش متاجر في القسم ده دلوقتي'}</div>`
    return
  }
  wrap.innerHTML = list.map(restaurantCardHTML).join('')
}

// دوس على كارت مطعم → رحلة العميل العادية بالظبط (index.html?r=slug)، من غير
// أي اختصار أو مسار موازٍ، عشان تفضل كل قواعد التاجر (فروع، أسعار، منيو) شغالة زي ما هي.
function goToRestaurant(slug) {
  location.href = 'index.html?r=' + encodeURIComponent(slug)
}

bootHome()
