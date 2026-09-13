// هذا الملف جزء من تطبيق Monjez Menu — وضع اكتشاف المطاعم (Discovery Mode)
// بيتفعّل بس لما مفيش ?r=slug في الرابط ولا في localStorage (زيارة أولى لمنصة منيوز
// من غير رابط تاجر معيّن) — مش بديل عن صفحة التاجر، رحلة منفصلة تمامًا وميّتها
// عدم لمس أي حاجة في تدفق التاجر الحالي (core.js لسه بيحوّل لصفحة التاجر العادية
// فور ما يتوفر slug، من خلال ?r= في الرابط زي ما كان بالظبط).

S.discoverRestaurants = []
S.discoverFilter      = null   // اسم تصنيف فرعي مختار (وسم حر داخل النوع)، أو null = عرض الكل
S.discoverType        = 'مطاعم' // النوع الأساسي المختار — نفس تبويب طلبات (مطاعم/كافيهات/سوبر ماركت/أسماك ولحوم)

const DISCOVER_TYPES = [
  { key: 'مطاعم',       label: 'مطاعم',       icon: '🍽️' },
  { key: 'كافيهات',     label: 'كافيهات',     icon: '☕' },
  { key: 'سوبر ماركت',  label: 'سوبر ماركت',  icon: '🛒' },
  { key: 'أسماك ولحوم', label: 'أسماك ولحوم', icon: '🍗' },
]

async function bootDiscover() {
  document.title = 'منيوز — اطلب من مطعمك المفضل'
  showState('discover')
  renderDiscoverTypeTabs()
  await loadDiscoverRestaurants()
}

// بيحاول ياخد موقع العميل (زي طلب الفرونت إند الحالي للتوصيل بالظبط)، ولو
// اتمنع أو اتعذّر بيكمل عادي من غير موقع — المطاعم كلها بتتعرض برضه، بس
// الترتيب بالمسافة مش هيبقى متاح (get_nearby_restaurants بترجع القريب مع
// المسافة، والباقي في الآخر مرتب بالتقييم بدل كده).
function renderDiscoverTypeTabs() {
  const wrap = document.getElementById('discover-type-tabs')
  if (!wrap) return
  wrap.innerHTML = DISCOVER_TYPES.map(t => `
    <div class="discover-type-tab${S.discoverType === t.key ? ' active' : ''}" data-type="${t.key}" onclick="setDiscoverType(this.dataset.type)">
      <span class="discover-type-icon">${t.icon}</span>
      <span>${t.label}</span>
    </div>
  `).join('')
}

function setDiscoverType(type) {
  S.discoverType   = type
  S.discoverFilter = null // بنصفّر الفلتر الفرعي لما نبدّل النوع الأساسي، عشان مايفضلش فلتر من نوع تاني مطبّق غلط
  renderDiscoverTypeTabs()
  renderDiscoverFilters()
  renderDiscoverGrid()
}

function loadDiscoverRestaurants() {
  return new Promise((resolve) => {
    const finish = (lat, lng) => {
      db.rpc('get_nearby_restaurants', { p_lat: lat, p_lng: lng }).then(({ data, error }) => {
        if (error) {
          logApiFail(error, 'get_nearby_restaurants')
          S.discoverRestaurants = []
        } else {
          S.discoverRestaurants = data || []
        }
        renderDiscoverFilters()
        renderDiscoverGrid()
        resolve()
      })
    }
    if (!navigator.geolocation) { finish(null, null); return }
    navigator.geolocation.getCurrentPosition(
      pos => finish(pos.coords.latitude, pos.coords.longitude),
      ()  => finish(null, null), // رفض الإذن — نكمل من غير إزعاج العميل، زي requestAutoLocation تمامًا
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    )
  })
}

function renderDiscoverFilters() {
  const wrap = document.getElementById('discover-filters')
  if (!wrap) return
  const inType = S.discoverRestaurants.filter(r => r.business_type === S.discoverType)
  const allCats = [...new Set(inType.flatMap(r => r.categories || []))]
  if (!allCats.length) { wrap.innerHTML = ''; return }

  wrap.innerHTML = `<div class="discover-chip${!S.discoverFilter ? ' active' : ''}" onclick="setDiscoverFilter(null)">الكل</div>` +
    allCats.map(c => {
      const safe = escapeHTML(c)
      return `<div class="discover-chip${S.discoverFilter === c ? ' active' : ''}" data-cat="${safe}" onclick="setDiscoverFilter(this.dataset.cat)">${safe}</div>`
    }).join('')
}

function setDiscoverFilter(cat) {
  S.discoverFilter = cat || null
  renderDiscoverFilters()
  renderDiscoverGrid()
}

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

function renderDiscoverGrid() {
  const wrap = document.getElementById('discover-grid')
  if (!wrap) return

  let list = S.discoverRestaurants.filter(r => r.business_type === S.discoverType)
  if (S.discoverFilter) list = list.filter(r => (r.categories || []).includes(S.discoverFilter))

  if (!list.length) {
    wrap.innerHTML = `<div style="padding:60px 16px;text-align:center;color:#aaa;font-size:13px">
      ${S.discoverFilter ? 'مفيش متاجر في التصنيف ده دلوقتي' : 'مفيش متاجر في القسم ده دلوقتي'}
    </div>`
    return
  }
  wrap.innerHTML = list.map(restaurantCardHTML).join('')
}

// دوس على كارت مطعم → نفس رحلة العميل العادية بالظبط (?r=slug)، من غير أي
// اختصار أو مسار موازٍ، عشان تفضل كل قواعد التاجر (فروع، أسعار، منيو) شغالة زي ما هي.
function goToRestaurant(slug) {
  location.href = location.pathname + '?r=' + encodeURIComponent(slug)
}
