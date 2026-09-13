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
let searchTerm      = ''

// أيقونات Material Symbols بتاعة نفس مكتبة تصميم Stitch
const HOME_TYPES = [
  { key: 'مطاعم',       label: 'مطاعم',       icon: 'restaurant' },
  { key: 'كافيهات',     label: 'كافيهات',     icon: 'local_cafe' },
  { key: 'سوبر ماركت',  label: 'سوبر ماركت',  icon: 'local_grocery_store' },
  { key: 'أسماك ولحوم', label: 'أسماك ولحوم', icon: 'set_meal' },
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

// ── RENDER: TYPE TABS ─────────────────────────────────────────────────
function renderTypeTabs() {
  const wrap = document.getElementById('home-type-tabs')
  wrap.innerHTML = HOME_TYPES.map(t => {
    const active = activeType === t.key
    return `<button data-type="${t.key}" onclick="setActiveType(this.dataset.type)"
      class="flex-shrink-0 flex flex-col items-center justify-center gap-1 w-20 h-16 rounded-xl shadow-[0_4px_16px_0_rgba(0,0,0,0.08)] transition-all
      ${active ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}">
      <span class="material-symbols-outlined" style="font-size:20px; font-variation-settings:'FILL' ${active ? 1 : 0}">${t.icon}</span>
      <span class="text-[11px] font-bold">${t.label}</span>
    </button>`
  }).join('')
}

function setActiveType(type) {
  activeType   = type
  activeFilter = null // تصفير الفلتر الفرعي لما نبدّل النوع الأساسي
  renderTypeTabs()
  renderFilters()
  renderGrid()
}

// ── RENDER: SUB FILTERS ───────────────────────────────────────────────
function renderFilters() {
  const wrap = document.getElementById('home-filters')
  const inType = allRestaurants.filter(r => r.business_type === activeType)
  const allCats = [...new Set(inType.flatMap(r => r.categories || []))]
  if (!allCats.length) { wrap.innerHTML = ''; return }

  const chip = (active, label, onclick) =>
    `<button onclick="${onclick}" class="flex-shrink-0 text-xs font-bold rounded-full px-4 py-2 border transition-all whitespace-nowrap
      ${active ? 'bg-secondary-container text-white border-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'}">${label}</button>`

  wrap.innerHTML = chip(!activeFilter, 'الكل', 'setActiveFilter(null)') +
    allCats.map(c => {
      const safe = escapeHTML(c)
      return `<button data-cat="${safe}" onclick="setActiveFilter(this.dataset.cat)" class="flex-shrink-0 text-xs font-bold rounded-full px-4 py-2 border transition-all whitespace-nowrap
        ${activeFilter === c ? 'bg-secondary-container text-white border-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'}">${safe}</button>`
    }).join('')
}

function setActiveFilter(cat) {
  activeFilter = cat || null
  renderFilters()
  renderGrid()
}

function onSearchInput(val) {
  searchTerm = (val || '').trim()
  renderGrid()
}

// ── RENDER: GRID ──────────────────────────────────────────────────────
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

function renderGrid() {
  const wrap = document.getElementById('home-grid')
  let list = allRestaurants.filter(r => r.business_type === activeType)
  if (activeFilter) list = list.filter(r => (r.categories || []).includes(activeFilter))
  if (searchTerm) {
    const q = searchTerm.toLowerCase()
    list = list.filter(r => r.name.toLowerCase().includes(q) || (r.categories || []).some(c => c.toLowerCase().includes(q)))
  }

  if (!list.length) {
    wrap.innerHTML = `<div class="text-center py-16 px-4 text-outline text-xs">
      <span class="material-symbols-outlined block mx-auto mb-2" style="font-size:32px">search_off</span>
      ${searchTerm ? 'مفيش نتائج تطابق بحثك' : (activeFilter ? 'مفيش متاجر في التصنيف ده دلوقتي' : 'مفيش متاجر في القسم ده دلوقتي')}
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

bootHome()
