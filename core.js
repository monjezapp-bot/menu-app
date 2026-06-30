// هذا الملف جزء من تطبيق Monjez Menu — تم تقسيمه من index.html الأصلي

// ── GLOBAL ERROR HANDLER (debug) ─────────────────────────────────────
window.onerror = function(msg, src, line, col, err) {
  const el = document.getElementById('state-error') || document.body
  el.innerHTML = `<div style="padding:20px;font-family:monospace;background:#fff;color:#c00;font-size:12px;direction:ltr;word-break:break-all;position:fixed;inset:0;z-index:9999;overflow:auto">
    <b>JS Error:</b><br>${msg}<br><br>
    <b>Line:</b> ${line}:${col}<br><br>
    <b>Stack:</b><br><pre>${err?.stack || 'N/A'}</pre>
  </div>`
  return false
}
window.addEventListener('unhandledrejection', e => {
  const el = document.getElementById('state-error') || document.body
  el.innerHTML = `<div style="padding:20px;font-family:monospace;background:#fff;color:#c00;font-size:12px;direction:ltr;word-break:break-all;position:fixed;inset:0;z-index:9999;overflow:auto">
    <b>Unhandled Promise Rejection:</b><br>${e.reason?.message || e.reason}<br><br>
    <b>Stack:</b><br><pre>${e.reason?.stack || 'N/A'}</pre>
  </div>`
})

// ── CONFIG ────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://pcmyugeqveyjnappulng.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbXl1Z2VxdmV5am5hcHB1bG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNjU0NDAsImV4cCI6MjA5Njc0MTQ0MH0.uwn0X4CvNRW38FGh_0rYD9KjBRM19CydXucfBsCDYeo'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storageKey: 'menu-customer-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true   // ← لازم true: ده اللي بيقرأ access_token/code من الـ URL بعد رجوع Google
  }
})

// ── STATE ─────────────────────────────────────────────────────────────
const S = {
  restaurant:    null,
  categories:    [],
  products:      [],
  bundles:       [],
  banners:       [],
  branches:      [],
  cart:          [],
  activeCat:     null,
  search:        '',
  currentBanner: 0,
  customer:      null,   // بيانات العميل المسجّل
  coinTxs:       [],     // حركات المحفظة
}

// ── CART PERSISTENCE ──────────────────────────────────────────────────
function cartKey()  { return 'cart_' + (new URLSearchParams(location.search).get('r') || 'default') }
function saveCart() { try { localStorage.setItem(cartKey(), JSON.stringify(S.cart)) } catch(e) {} }
function loadCart() {
  try {
    const raw = localStorage.getItem(cartKey())
    if (raw) S.cart = JSON.parse(raw)
  } catch(e) { S.cart = [] }
}
function clearCart() { S.cart = []; try { localStorage.removeItem(cartKey()) } catch(e) {} }

// ── MODAL HISTORY (زر الرجوع الفعلي يغلق آخر طبقة مفتوحة فقط) ──────────
// كل مودال/طبقة فرعية مفتوحة = خطوة واحدة في تاريخ المتصفح.
// الضغط على زر الرجوع الفعلي يُغلق آخر طبقة فقط (طبقة بطبقة)، لا كل الطبقات دفعة واحدة.
const _modalStack = []
function pushModal(name, closeFn) {
  _modalStack.push({ name, closeFn })
  history.pushState({ _modalName: name }, '')
}
function popModalSilently(name) {
  // يُستخدم عند إغلاق المودال بزر "إغلاق" العادي (مش زر الرجوع)
  // فنحتاج نرجع خطوة في history بدون ما نشغّل closeFn تاني (history.back سيشغّل popstate)
  const idx = _modalStack.findIndex(m => m.name === name)
  if (idx === -1) return
  _modalStack.splice(idx, 1)
  if (history.state && history.state._modalName === name) history.back()
}

history.pushState({ _appBase: true }, '') // طبقة حماية فوق صفحة الدخول الأصلية

window.addEventListener('popstate', () => {
  const top = _modalStack.pop()
  if (top) { top.closeFn(true); return }

  // الـ stack فاضي = العميل على الصفحة الرئيسية وضغط رجوع — خروج مباشر
  history.back()
})

// ── BOOT ──────────────────────────────────────────────────────────────
let _lastSlug = null
async function boot() {
  let slug = new URLSearchParams(location.search).get('r')

  // لو مفيش slug في URL (بعد Google redirect)، جيبه من localStorage
  if (!slug) {
    slug = localStorage.getItem('mnio_last_slug')
  }
  if (slug) {
    // احفظه دايماً عشان بعد أي redirect
    localStorage.setItem('mnio_last_slug', slug)
    // لو الـ URL مش فيه r، أضفه بدون reload
    if (!new URLSearchParams(location.search).get('r')) {
      const url = new URL(location.href)
      url.searchParams.set('r', slug)
      history.replaceState({}, '', url.toString())
    }
  }

  _lastSlug = slug
  if (!slug) return showError('لم يتم تحديد المطعم. تأكد من الرابط الذي تستخدمه.', false)

  try {
    await loadData(slug)
    applyTheme()
    renderHeader()
    renderCatGrid()
    renderAnnouncement()
    renderAdBanners()
    loadCart()
    renderAllSections()
    updateCartUI()
    showState('app')
    initScrollBehavior()
    initScrollSpy()
    initAuthListener()   // ← لازم تتسجل قبل أي قراءة session، عشان ما نفوّتش SIGNED_IN لو جايين من Google redirect
    await initCustomerSession().catch(() => {})
    handleReferralParam()
    renderInfoStrip()
    renderAccountPage()
    showBottomNav(!!S.customer)
    updateWalletBadge()
    if (S.customer) loadNotifications().catch(() => {})
    window._bootDone = true
    // استعادة الصفحة بعد refresh أو Google redirect
    const savedPage = sessionStorage.getItem('mnio_page')
    if (savedPage && savedPage !== 'home' && S.customer) {
      switchPage(savedPage)
    } else if (S.customer && new URLSearchParams(location.search).get('ref')) {
      switchPage('account')
    }

  } catch(e) {
    // أخطاء "المطعم غير موجود" نهائية (لا تحتاج إعادة محاولة)، وأي خطأ آخر (شبكة/تقني) مؤقت وقابل لإعادة المحاولة
    const isNotFound = e.message === 'المطعم غير موجود أو غير نشط'
    showError(isNotFound ? e.message : ('خطأ: ' + (e.message || e)), !isNotFound)
  }
}
function retryLoad() {
  showState('loading')
  boot()
}

// ── DATA LOADING ──────────────────────────────────────────────────────
async function loadData(slug) {
  const { data: r, error: rErr } = await db
    .from('restaurants')
    .select('*')
    .eq('slug', slug).eq('is_active', true).single()

  if (rErr || !r) throw new Error('المطعم غير موجود أو غير نشط')
  S.restaurant = r

  const [catRes, prodRes, bundleRes, bannerRes, branchRes] = await Promise.all([
    db.from('categories').select('id,name,sort_order,icon_url').eq('restaurant_id', r.id).order('sort_order'),
    db.from('products')
      .select('*')
      .eq('restaurant_id', r.id).neq('status', 'hidden').order('sort_order'),
    db.from('bundles').select('id,name,description,price,image_url,items,sort_order').eq('restaurant_id', r.id).eq('is_active', true).order('sort_order'),
    db.from('banners').select('id,image_url,link_type,link_value,sort_order').eq('restaurant_id', r.id).order('sort_order'),
    db.from('branches').select('id,name,lat,lng').eq('restaurant_id', r.id).eq('is_active', true)
  ])

  if (catRes.error)  throw new Error('فشل تحميل التصنيفات')
  if (prodRes.error) throw new Error('فشل تحميل المنتجات')

  S.categories = catRes.data
  S.products   = prodRes.data
  S.branches   = branchRes.data ?? []
  S.banners    = bannerRes.data ?? []

  // جلب bundle_branches مفلترة بالـ ids بتاعة bundles هذا المطعم
  const bundleIds = (bundleRes.data ?? []).map(b => b.id)
  const bbMap = {}
  if (bundleIds.length) {
    try {
      const { data: bbData } = await db.from('bundle_branches').select('bundle_id,branch_id').in('bundle_id', bundleIds)
      ;(bbData || []).forEach(row => { if (!bbMap[row.bundle_id]) bbMap[row.bundle_id] = []; bbMap[row.bundle_id].push(row.branch_id) })
    } catch(e) { /* bundle_branches اختياري */ }
  }
  S.bundles    = (bundleRes.data ?? []).map(b => ({ ...b, branch_ids: bbMap[b.id] || [] }))
  S.activeCat  = catRes.data[0]?.id ?? null
}

// ── THEME ─────────────────────────────────────────────────────────────
function applyTheme() {
  const t = S.restaurant.theme ?? {}
  if (t.primary)   document.documentElement.style.setProperty('--brand',  t.primary)
  if (t.secondary) document.documentElement.style.setProperty('--brand2', t.secondary)
}

// ── HELPERS ───────────────────────────────────────────────────────────
function isDiscountActive(p) {
  if (!p.discount_price || !p.discount_active) return false
  const now = new Date()
  if (p.discount_starts_at && new Date(p.discount_starts_at) > now) return false
  if (p.discount_ends_at   && new Date(p.discount_ends_at)   < now) return false
  return Number(p.discount_price) < Number(p.price)
}
function fmt(v)          { return `${Number(v).toFixed(0)} ج.م` }

// ── تنسيق أرقام آمن للأرقام الإنجليزية دايماً ───────────────────────────
// بعض متصفحات الموبايل (خصوصاً Android WebView مع نظام تشغيل بلغة عربية)
// تتجاهل المعامل 'en-US' في toLocaleString() وتعرض أرقام عربية (١٠,٠٠٠)
// رغم تحديد اللغة الإنجليزية صراحةً في الكود — وهو سبب تضارب الأرقام في صفحة المحفظة.
// numFmt() تبني الفاصلة العشرية يدوياً بدون الاعتماد على Intl إطلاقاً، فتضمن أرقام إنجليزية دايماً.
function numFmt(v) {
  const n = Math.round(Number(v) || 0)
  // toLocaleString('en-US') بيدّينا الفواصل، وبعدين نضمن تحويل أي رقم عربي
  // (لو الـ WebView تجاهل الـ locale) لرقم إنجليزي يدوياً
  return n.toLocaleString('en-US').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
}

// المسافة بالكيلومتر بين نقطتين (صيغة Haversine)
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
// أقرب فرع نشط لموقع العميل، باستثناء الفروع المرفوضة مسبقاً لهذا الطلب (للتحويل التلقائي عند الرفض)
function findNearestBranch(custLat, custLng, excludeIds = []) {
  const candidates = (S.branches || []).filter(b => !excludeIds.includes(b.id))
  if (!candidates.length) return null
  let nearest = null, minDist = Infinity
  candidates.forEach(b => {
    const d = distanceKm(custLat, custLng, b.lat, b.lng)
    if (d < minDist) { minDist = d; nearest = b }
  })
  return { branch: nearest, distanceKm: minDist }
}
// تنضيف رقم تواصل المطعم لصيغة دولية موحدة قبل استخدامه في رابط tel:
// (يغطي صيغ مختلفة: 0 محلي / + / مسافات / بدون كود دولة)
function normalizeWhatsAppNumber(raw) {
  let n = String(raw || '').replace(/[^\d]/g, '')
  if (!n) return null
  if (n.startsWith('00')) n = n.slice(2)
  if (n.startsWith('0'))  n = n.slice(1)
  if ((n.length === 10 || n.length === 9) && n.startsWith('1')) n = '20' + n
  return (n.length >= 10 && n.length <= 15) ? n : null
}
function showState(name) {
  ['loading', 'error', 'app'].forEach(s => document.getElementById('state-' + s).classList.add('hidden'))
  document.getElementById('state-' + name).classList.remove('hidden')
}
function showError(msg, showRetry = false) {
  document.getElementById('error-msg').textContent = msg
  document.getElementById('retry-btn').classList.toggle('hidden', !showRetry)
  document.getElementById('error-icon').textContent  = showRetry ? '📡' : '🍽️'
  document.getElementById('error-title').textContent = showRetry ? 'حدثت مشكلة في الاتصال' : 'لم نجد هذا المطعم'
  showState('error')
}

// ── CUSTOMER AUTH & WALLET ─────────────────────────────────────────────────
let _custAuthMode  = 'login'  // 'login' | 'signup'
let _appliedDiscount = 0      // خصم الكود بالجنيه
let _appliedCode     = null   // الكود المطبّق
let _coinsToRedeem   = 0      // كوينز سيتم استخدامها في الطلب

async function initCustomerSession(forceCreate, extraData) {
  const { data: { session } } = await db.auth.getSession()
  if (!session) return
  await loadCustomerProfile(forceCreate, extraData)
  if (S.customer) await checkAndAwardBirthdayGift()
}

// يفحص لو النهاردة عيد ميلاد العميل ولم يُمنح الهدية هذا العام، يمنحها فوراً
async function checkAndAwardBirthdayGift() {
  const r = S.restaurant, c = S.customer
  if (!(r?.birthday_gift_enabled) || !r.birthday_coins || !c?.birthdate) return

  const today = new Date()
  const bday  = new Date(c.birthdate)
  const isBirthdayToday = today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()
  if (!isBirthdayToday) return

  const thisYear = today.getFullYear()
  if (c.birthday_gift_claimed_year === thisYear) return // اتمنحت السنة دي خلاص

  try {
    await incrementCustomerCoins(c.id, r.birthday_coins)
    await db.from('menu_customers').update({ birthday_gift_claimed_year: thisYear }).eq('id', c.id)
    S.customer.birthday_gift_claimed_year = thisYear
    S.customer.coins_balance = (S.customer.coins_balance || 0) + r.birthday_coins
    await db.from('coin_transactions').insert({
      customer_id:   c.id,
      restaurant_id: r.id,
      type:   'birthday',
      amount: r.birthday_coins,
      note:   '🎂 هدية عيد ميلادك السعيد!'
    }).catch(() => {})
    showToast(`🎂 عيد ميلاد سعيد! حصلت على ${numFmt(r.birthday_coins)} كوين هدية 🎉`)
    playSuccessSound()
  } catch(e) {}
}

let _customerLoadInFlight = null // mutex: يمنع تشغيل loadCustomerProfile مرتين بالتوازي
                                  // (initCustomerSession + onAuthStateChange ممكن يشتغلوا في نفس اللحظة عند تحميل الصفحة،
                                  //  وده كان بيسبب الـ Flicker في الهيدر: بيانات تظهر وتختفي وترجع تظهر)
async function loadCustomerProfile(forceCreate, extraData) {
  if (_customerLoadInFlight) return _customerLoadInFlight
  _customerLoadInFlight = _loadCustomerProfileInner(forceCreate, extraData)
  try {
    await _customerLoadInFlight
  } finally {
    _customerLoadInFlight = null
  }
}

async function _loadCustomerProfileInner(forceCreate, extraData) {
  const { data: { user } } = await db.auth.getUser()
  if (!user || !S.restaurant) return

  const { data } = await db.from('menu_customers')
    .select('*')
    .eq('user_id', user.id)
    .eq('restaurant_id', S.restaurant.id)
    .maybeSingle()

  if (data) {
    S.customer = data
  } else if (forceCreate || user.app_metadata?.provider === 'google') {
    // أنشئ profile جديد لهذا المتجر
    const refCode    = await genUniqueReferralCode()
    const welcomeEnabled = S.restaurant.welcome_bonus_enabled ?? true
    const welcomeCoins   = S.restaurant.welcome_coins ?? 10000
    const cpE            = S.restaurant.coins_per_egp ?? 1000
    const name       = extraData?.name || user.user_metadata?.full_name || null
    const avatarUrl  = user.user_metadata?.avatar_url || null

    // تحقق من كود الإحالة
    let referredBy = null
    const pendingRef = extraData?.referral_code_used || getPendingRef()
    if (pendingRef) {
      try {
        const { data: refCust } = await db.from('menu_customers')
          .select('id').eq('referral_code', pendingRef)
          .eq('restaurant_id', S.restaurant.id).maybeSingle()
        if (refCust) referredBy = refCust.id
      } catch(e) {}
    }

    try {
      const { data: newCust } = await db.from('menu_customers').insert({
        user_id:     user.id,
        restaurant_id: S.restaurant.id,
        email:       user.email,
        name,
        avatar_url:  avatarUrl,
        phone:       extraData?.phone     || null,
        birthdate:   extraData?.birthdate || null,
        gender:      extraData?.gender    || null,
        area:        extraData?.area      || null,
        // بونص الترحيب يتحول فلوس فوراً في wallet_balance، لا يدخل محفظة الكوينز العادية
        wallet_balance: welcomeEnabled ? (welcomeCoins / cpE) : 0,
        referral_code: refCode,
        referred_by: referredBy,
        welcome_coins_claimed: false
      }).select('*').maybeSingle()

      if (newCust) {
        S.customer = newCust
        clearPendingRef() // امسح الكود بعد الاستخدام
        // سجّل معاملة الترحيب (لو الميزة مفعّلة)
        if (welcomeEnabled) {
          await db.from('coin_transactions').insert({
            customer_id:   newCust.id,
            restaurant_id: S.restaurant.id,
            type:   'welcome',
            amount: welcomeCoins,
            note:   'بونص الترحيب — تحوّل فوراً لرصيد المحفظة النقدي'
          }).catch(() => {})
        }
        // كوينز الإحالة للمُحيل (لو الميزة مفعّلة) — تتحول فلوس فوراً في wallet_balance أيضاً
        const referralEnabled = S.restaurant.referral_enabled ?? true
        if (referredBy && referralEnabled && S.restaurant.referral_coins) {
          const rc = S.restaurant.referral_coins
          await incrementCustomerWallet(referredBy, rc / cpE).catch(() => {})
          await db.from('coin_transactions').insert({
            customer_id:   referredBy,
            restaurant_id: S.restaurant.id,
            type:   'referral_reward',
            amount: rc,
            note:   `إحالة: ${user.email} — تحوّل فوراً لرصيد المحفظة النقدي`
          }).catch(() => {})
        }
      }
    } catch(e) {
      // لو فشل الـ insert (race condition)، جرب تجيب الـ profile تاني
      const { data: retry } = await db.from('menu_customers')
        .select('*').eq('user_id', user.id).eq('restaurant_id', S.restaurant.id).maybeSingle()
      if (retry) S.customer = retry
    }
  }

  updateWalletBadge()
  updateCoinsRowInCart()
}

// ── مراقبة تغيير الـ Auth State (Google redirect) ─────────────────────
function initAuthListener() {
  db.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
      // انتظر لو S.restaurant لسه مش موجود
      let tries = 0
      while (!S.restaurant && tries < 20) {
        await new Promise(r => setTimeout(r, 200))
        tries++
      }
      if (!S.restaurant) return

      if (!S.customer) {
        await loadCustomerProfile(true)
        renderAccountPage()
        showBottomNav(true)
        updateWalletBadge()
        loadNotifications().catch(() => {})
        // لو جاي من Google redirect (مش refresh عادي)
        const isOAuthCallback = window.location.hash.includes('access_token') ||
                                 window.location.search.includes('code=')
        if (isOAuthCallback) {
          switchPage('account')
          // احتفال لو أول تسجيل
          const isNew = !sessionStorage.getItem('was_customer_' + S.restaurant.id)
          if (isNew && S.customer && (S.restaurant.welcome_bonus_enabled ?? true)) {
            sessionStorage.setItem('was_customer_' + S.restaurant.id, '1')
            showCelebration(S.restaurant.welcome_coins ?? 10000)
            playSuccessSound()
          }
        }
      }
    } else if (event === 'SIGNED_OUT') {
      S.customer = null
      showBottomNav(false)
      switchPage('home')
      renderAccountPage()
      updateWalletBadge()
    }
  })
}

function updateWalletBadge() {
  const badge = document.getElementById('wallet-mini-badge')
  const icon  = document.getElementById('wallet-mini-icon')
  const label = document.getElementById('wallet-mini-label')
  if (!badge || !icon || !label) return

  if (S.customer && (S.customer.coins_balance > 0)) {
    const egp = ((S.customer.coins_balance || 0) / (S.restaurant?.coins_per_egp || 1000)).toFixed(0)
    badge.textContent = egp + 'ج'
    badge.style.display = 'block'
    icon.textContent  = '🪙'
    label.textContent = S.customer.name?.split(' ')[0] || 'حسابي'
  } else if (S.customer) {
    badge.style.display = 'none'
    icon.textContent  = '👤'
    label.textContent = S.customer.name?.split(' ')[0] || 'حسابي'
  } else {
    badge.style.display = 'none'
    icon.textContent  = '👤'
    label.textContent = 'دخول'
  }
}

function openWalletOrLogin() {
  if (S.customer) switchPage('wallet')
  else switchPage('account')
}

// Auth القديم اتشال — Google OAuth بس
function openCustAuth()           { switchPage('account') }
function closeCustAuth()          { }
function toggleCauthMode()        { }
function syncCauthUI()            { }
async function custAuthSubmit()   { }

async function genUniqueReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let i = 0; i < 10; i++) {
    let code = ''
    for (let j = 0; j < 6; j++) code += chars[Math.floor(Math.random() * chars.length)]
    const { data } = await db.from('menu_customers').select('id').eq('referral_code', code).eq('restaurant_id', S.restaurant.id).maybeSingle()
    if (!data) return code
  }
  return 'REF' + Date.now().toString(36).toUpperCase().slice(-3)
}

async function custLogout() {
  await db.auth.signOut()
  S.customer = null
  _coinsToRedeem = 0
  _appliedDiscount = 0
  _appliedCode = null
  updateWalletBadge()
  updateCoinsRowInCart()
  closeWalletModal()
  renderCartItems()
  showBottomNav(false)
  switchPage('home')
}

// ── BOTTOM NAV & PAGE SWITCHING ─────────────────────────────────────────
let _currentPage = 'home'

function switchPage(page) {
  _currentPage = page
  _switchPageCore(page)
}

function showBottomNav(show) {
  const nav = document.getElementById('bottom-nav')
  if (nav) nav.style.display = show ? 'block' : 'none'
  // لو في bottom nav، زوّد الـ padding السفلي للصفحة الرئيسية
  document.getElementById('state-app')?.classList.toggle('pb-36', !show)
  if (show) document.getElementById('state-app')?.style.setProperty('padding-bottom', '100px')
  // يحرّك السلة/الأزرار العائمة السفلية لترتفع فوق شريط التنقل بدل ما تختفي تحته
  document.body.classList.toggle('has-bottom-nav', !!show)
}

// ── SESSION PERSISTENCE ───────────────────────────────────────────────
window._bootDone = false

function _switchPageCore(page) {
  sessionStorage.setItem('mnio_page', page)
  const pages = ['home', 'orders', 'wallet', 'account']
  const brand = 'var(--brand)'
  document.getElementById('state-app')?.classList.toggle('hidden', page !== 'home')
  pages.filter(p => p !== 'home').forEach(p => {
    const el = document.getElementById('page-' + p)
    if (el) el.classList.toggle('hidden', p !== page)
  })
  pages.forEach(p => {
    const icon = document.getElementById('bnav-' + p + '-icon')
    const txt  = document.getElementById('bnav-' + p + '-txt')
    const active = p === page
    if (icon) icon.setAttribute('stroke', active ? 'var(--brand)' : '#bbb')
    if (txt)  { txt.style.color = active ? 'var(--brand)' : '#bbb'; txt.style.fontWeight = active ? '800' : '700' }
  })
  if (page === 'orders')  loadOrdersPage()
  if (page === 'wallet')  loadWalletPage()
  if (page === 'account') renderAccountPage()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ── SIMPLE TOAST ──────────────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById('mnio-toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'mnio-toast'
    t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:999;font-family:Rubik,sans-serif;transition:opacity 0.3s;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.3)'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.style.opacity = '1'
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.style.opacity = '0', 2500)
}

// ── CONFIRM SHEET HELPER (مُعاد بناؤه) ─────────────────────────────────
let _scrollLockY = 0

function _lockBodyScroll() {
  _scrollLockY = window.scrollY || document.body.scrollTop || 0
  document.body.style.position = 'fixed'
  document.body.style.top = `-${_scrollLockY}px`
  document.body.style.left = '0'
  document.body.style.right = '0'
  document.body.style.width = '100%'
}

function _unlockBodyScroll() {
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.width = ''
  window.scrollTo(0, _scrollLockY)
}

function showConfirmSheet(title, bodyHTML, onConfirm, confirmLabel, noConfirmBtn) {
  let sheet = document.getElementById('confirm-sheet')
  if (!sheet) {
    sheet = document.createElement('div')
    sheet.id = 'confirm-sheet'
    sheet.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;width:100vw;height:100%;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);isolation:isolate;-webkit-transform:translateZ(0);transform:translateZ(0)'
    sheet.innerHTML = `<div style="background:#fff;border-radius:24px 24px 0 0;padding:24px 20px 36px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;box-sizing:border-box;-webkit-overflow-scrolling:touch">
      <div id="cs-title" style="font-size:16px;font-weight:900;color:#1a1a1a;margin-bottom:16px"></div>
      <div id="cs-body"></div>
      <div id="cs-btns" style="display:flex;gap:10px;margin-top:16px;position:sticky;bottom:0;background:#fff;padding-top:4px">
        <button onclick="closeConfirmSheet()" style="flex:1;padding:13px;border-radius:14px;border:1.5px solid #eee;background:#f5f5f5;font-size:14px;font-weight:700;color:#888;cursor:pointer;font-family:'Rubik',sans-serif">إلغاء</button>
        <button id="cs-confirm-btn" style="flex:1;padding:13px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--brand),#ff8c38);color:#fff;font-size:14px;font-weight:900;cursor:pointer;font-family:'Rubik',sans-serif"></button>
      </div>
    </div>`
    // يتعلّق دايماً مباشرة بالـ body عشان يضمن إنه يتمركز بالنسبة للشاشة كلها مش لأي عنصر متحرك تاني
    document.body.appendChild(sheet)
    // قفل سكرول الخلفية لمنع تعارض السحب بين الصفحة والمودال
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeConfirmSheet() })
  }
  document.getElementById('cs-title').textContent = title
  document.getElementById('cs-body').innerHTML    = bodyHTML
  const btns    = document.getElementById('cs-btns')
  const cfmBtn  = document.getElementById('cs-confirm-btn')
  if (noConfirmBtn) { cfmBtn.style.display = 'none' }
  else {
    cfmBtn.style.display = 'block'
    cfmBtn.textContent   = confirmLabel || 'تأكيد'
    cfmBtn.onclick       = () => { closeConfirmSheet(); if (onConfirm) onConfirm() }
  }
  _lockBodyScroll()
  sheet.style.display = 'flex'
}
function closeConfirmSheet() {
  const s = document.getElementById('confirm-sheet')
  if (s) s.style.display = 'none'
  _unlockBodyScroll()
}


let _selectedGender = null

function setGender(g) {
  _selectedGender = g
  const male   = document.getElementById('gender-male')
  const female = document.getElementById('gender-female')
  if (!male || !female) return
  male.style.borderColor   = g === 'male'   ? 'var(--brand)' : '#eee'
  male.style.background    = g === 'male'   ? '#fff8f3'      : '#fff'
  male.style.color         = g === 'male'   ? 'var(--brand)' : '#555'
  female.style.borderColor = g === 'female' ? 'var(--brand)' : '#eee'
  female.style.background  = g === 'female' ? '#fff8f3'      : '#fff'
  female.style.color       = g === 'female' ? 'var(--brand)' : '#555'
}

function togglePassVis() {
  const inp = document.getElementById('acc-pass')
  const btn = document.getElementById('pass-vis-btn')
  if (!inp) return
  if (inp.type === 'password') { inp.type = 'text';     if (btn) btn.textContent = '🙈' }
  else                         { inp.type = 'password'; if (btn) btn.textContent = '👁️' }
}

function setAccTab(mode) {
  const isSignup = mode === 'signup'
  const extra    = document.getElementById('acc-signup-extra')
  const nameF    = document.getElementById('field-name')
  if (extra) extra.style.display = isSignup ? 'flex' : 'none'
  if (nameF) nameF.style.display = isSignup ? 'block' : 'none'
  const submitBtn = document.getElementById('acc-submit-btn')
  if (submitBtn) { submitBtn.textContent = isSignup ? '🎁 إنشاء حسابي' : 'تسجيل الدخول'; submitBtn.dataset.mode = mode }
  const tLogin  = document.getElementById('acc-tab-login')
  const tSignup = document.getElementById('acc-tab-signup')
  if (tLogin)  { tLogin.style.background  = isSignup ? 'transparent' : 'linear-gradient(135deg,var(--brand),#ff8c38)'; tLogin.style.color  = isSignup ? '#999' : '#fff'; tLogin.style.boxShadow  = isSignup ? 'none' : '0 2px 8px rgba(255,107,0,0.3)' }
  if (tSignup) { tSignup.style.background = isSignup ? 'linear-gradient(135deg,var(--brand),#ff8c38)' : 'transparent'; tSignup.style.color = isSignup ? '#fff' : '#999'; tSignup.style.boxShadow = isSignup ? '0 2px 8px rgba(255,107,0,0.3)' : 'none' }
  const errEl = document.getElementById('acc-error')
  if (errEl) errEl.style.display = 'none'
  try { const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = isSignup ? 600 : 500; g.gain.setValueAtTime(0.05, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); o.start(); o.stop(ctx.currentTime + 0.15) } catch(e) {}
}

async function accAuthSubmit() {
  const mode    = document.getElementById('acc-submit-btn')?.dataset.mode || 'login'
  const email   = document.getElementById('acc-email')?.value.trim()
  const pass    = document.getElementById('acc-pass')?.value
  const errEl   = document.getElementById('acc-error')
  const showErr = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block' } }
  if (errEl) errEl.style.display = 'none'
  if (!email) return showErr('البريد الإلكتروني مطلوب')
  if (!pass || pass.length < 6) return showErr('كلمة المرور 6 أحرف على الأقل')
  const btn = document.getElementById('acc-submit-btn')
  const origText = btn.textContent
  btn.textContent = '⏳'; btn.disabled = true
  try {
    if (mode === 'login') {
      const { error } = await db.auth.signInWithPassword({ email, password: pass })
      if (error) throw new Error('البريد أو كلمة المرور غير صحيحة')
      await initCustomerSession()
      renderAccountPage(); showBottomNav(true); loadNotifications().catch(() => {}); playSuccessSound()
    } else {
      const name      = document.getElementById('acc-name')?.value.trim()
      const phone     = document.getElementById('acc-phone')?.value.trim()
      const birthdate = document.getElementById('acc-birthdate')?.value || null
      const area      = document.getElementById('acc-area')?.value.trim() || null
      const ref       = document.getElementById('acc-ref')?.value.trim().toUpperCase() || null
      if (!name)  return showErr('الاسم مطلوب')
      if (!phone) return showErr('رقم الموبايل مطلوب')
      // حاول تسجيل مستخدم جديد
      const { data: signData, error: signErr } = await db.auth.signUp({ email, password: pass })
      if (signErr) {
        if (signErr.message?.includes('already registered') || signErr.message?.includes('User already registered')) {
          // الإيميل موجود في auth — حاول تسجيل الدخول (نفس الباسورد = متجر تاني بنفس الإيميل)
          const { error: loginErr } = await db.auth.signInWithPassword({ email, password: pass })
          if (loginErr) throw new Error('هذا البريد مسجّل من قبل في منيو. لإنشاء حساب في هذا المتجر، استخدم كلمة مرور مختلفة أو سجّل دخولك مباشرة.')
          // تسجيل الدخول نجح — سنُنشئ profile جديد لهذا المتجر
          await initCustomerSession(true, { name, phone, birthdate, area, gender: _selectedGender, referral_code_used: ref })
        } else throw new Error(signErr.message)
      } else {
        await initCustomerSession(true, { name, phone, birthdate, area, gender: _selectedGender, referral_code_used: ref })
      }
      renderAccountPage(); showBottomNav(true); loadNotifications().catch(() => {})
      if (S.restaurant?.welcome_bonus_enabled ?? true) { showCelebration(S.restaurant?.welcome_coins ?? 10000); playSuccessSound() }
    }
  } catch(e) {
    showErr(e.message)
  } finally {
    btn.textContent = origText; btn.disabled = false
  }
}

function playSuccessSound() {
  try {
    const ctx = new AudioContext()
    ;[523, 659, 784, 1047].forEach((freq, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq; o.type = 'sine'
      const t = ctx.currentTime + i * 0.1
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      o.start(t); o.stop(t + 0.25)
    })
  } catch(e) {}
}

// ── INFO STRIP ────────────────────────────────────────────────────────
function renderInfoStrip() {
  if (!S.restaurant) return
  // تقييم
  const rating = S.restaurant.rating ?? 5.0
  document.getElementById('strip-rating').textContent = Number(rating).toFixed(1)
  // وقت التوصيل
  const mins = S.restaurant.avg_prep_minutes ?? S.restaurant.delivery_time_minutes ?? null
  document.getElementById('strip-time').textContent = mins ? `${mins} د` : '-- د'
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────
let _notifPanelOpen = false
let _notifications  = []

function toggleNotifPanel() {
  _notifPanelOpen = !_notifPanelOpen
  const panel = document.getElementById('notif-panel')
  panel.style.display = _notifPanelOpen ? 'block' : 'none'
  if (_notifPanelOpen && S.customer) loadNotifications()
}

document.addEventListener('click', e => {
  if (_notifPanelOpen && !document.getElementById('notif-btn')?.contains(e.target) && !document.getElementById('notif-panel')?.contains(e.target)) {
    _notifPanelOpen = false
    const panel = document.getElementById('notif-panel')
    if (panel) panel.style.display = 'none'
  }
})

async function loadNotifications() {
  if (!S.customer) return
  try {
    const { data } = await db.from('notifications')
      .select('*')
      .eq('customer_id', S.customer.id)
      .order('created_at', { ascending: false })
      .limit(20)
    _notifications = data || []
    renderNotifList()
    updateNotifBadge()
  } catch(e) { /* جدول notifications مش موجود بعد */ }
}

function renderNotifList() {
  const el = document.getElementById('notif-list')
  if (!_notifications.length) {
    el.innerHTML = `<p style="font-size:13px;color:#bbb;text-align:center;padding:24px 0">لا توجد إشعارات</p>`
    return
  }
  const iconMap = { order_confirmed:'✅', order_ready:'📦', order_delivering:'🛵', order_delivered:'🎉', order_cancelled:'❌', coins:'🪙', promo:'🎁' }
  el.innerHTML = _notifications.map(n => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-bottom:1px solid #f5f5f5;${n.is_read ? '' : 'background:#fff8f3'}">
      <span style="font-size:20px;flex-shrink:0">${iconMap[n.type] || '🔔'}</span>
      <div style="flex:1">
        <p style="font-size:13px;font-weight:${n.is_read ? '600' : '800'};color:#1a1a1a;margin-bottom:2px">${n.title || ''}</p>
        <p style="font-size:11px;color:#888">${n.body || ''}</p>
        <p style="font-size:10px;color:#ccc;margin-top:3px">${new Date(n.created_at).toLocaleDateString('ar-EG-u-nu-latn', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
      </div>
      ${!n.is_read ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--brand);flex-shrink:0;margin-top:4px"></span>' : ''}
    </div>`).join('')
}

function updateNotifBadge() {
  const unread = _notifications.filter(n => !n.is_read).length
  const badge  = document.getElementById('notif-badge')
  if (badge) {
    badge.textContent    = unread > 9 ? '9+' : String(unread)
    badge.style.display  = unread > 0 ? 'block' : 'none'
  }
}

async function markAllNotifsRead() {
  if (!S.customer || !_notifications.length) return
  _notifications.forEach(n => n.is_read = true)
  renderNotifList()
  updateNotifBadge()
  try {
    await db.from('notifications').update({ is_read: true }).eq('customer_id', S.customer.id).eq('is_read', false)
  } catch(e) {}
}

// ── INCREMENT FUNCTION FOR REFERRAL ────────────────────────────────────
// Supabase لا يدعم atomic increment بدون stored procedure — نستخدم RLS + select+update
async function incrementCustomerCoins(customerId, amount) {
  const { data } = await db.from('menu_customers').select('coins_balance').eq('id', customerId).single()
  if (data) await db.from('menu_customers').update({ coins_balance: (data.coins_balance || 0) + amount }).eq('id', customerId)
}

// نفس المبدأ، لكن للرصيد النقدي (wallet_balance) — يُستخدم لبونص الترحيب وبونص الإحالة
// اللي بيتحولوا فلوس فوراً بدلاً من المرور بمحفظة الكوينز العادية
async function incrementCustomerWallet(customerId, amountEgp) {
  const { data } = await db.from('menu_customers').select('wallet_balance').eq('id', customerId).single()
  if (data) await db.from('menu_customers').update({ wallet_balance: Number(data.wallet_balance || 0) + amountEgp }).eq('id', customerId)
}
