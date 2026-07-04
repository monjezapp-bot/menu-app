// هذا الملف جزء من تطبيق Monjez Menu — تم تقسيمه من index.html الأصلي

// ── HEADER ────────────────────────────────────────────────────────────
function renderHeader() {
  document.title = S.restaurant.name

  const nameEl = document.getElementById('restaurant-name')
  if (nameEl) nameEl.textContent = S.restaurant.name

  if (S.restaurant.logo_url) {
    const logoEl = document.getElementById('restaurant-logo')
    if (logoEl) { logoEl.src = S.restaurant.logo_url; logoEl.style.display = 'block' }
  }

  if (S.restaurant.cover_url) {
    const coverImg = document.getElementById('hero-cover-img')
    if (coverImg) coverImg.src = S.restaurant.cover_url
  }

  // تصنيفات المطعم كوصف مختصر تحت الاسم
  const taglineEl = document.getElementById('hero-card-tagline')
  if (taglineEl && Array.isArray(S.categories) && S.categories.length) {
    taglineEl.textContent = S.categories.slice(0, 5).map(c => c.name).join('، ')
  }

  // رقم التواصل
  const phone = normalizeWhatsAppNumber(S.restaurant.whatsapp)
  if (phone) {
    const callBtn = document.getElementById('call-restaurant-btn')
    if (callBtn) { callBtn.href = `tel:+${phone}`; callBtn.style.display = 'inline-flex' }
  }
}

// ── ANNOUNCEMENT ──────────────────────────────────────────────────────
function renderAnnouncement() {
  const bar = document.getElementById('announcement-bar')
  if (S.restaurant.announcement_active && S.restaurant.announcement_text) {
    document.getElementById('announcement-text').textContent = S.restaurant.announcement_text
    bar.classList.remove('hidden')
  }
}

// ── AD BANNERS ────────────────────────────────────────────────────────
let bannerTimer = null

function renderAdBanners() {
  if (!S.banners.length) return
  document.getElementById('ad-banners-wrap').classList.remove('hidden')
  showBanner(0)

  if (S.banners.length > 1) {
    const dots = document.getElementById('ad-dots')
    dots.innerHTML = S.banners.map((_, i) => `<div class="ad-dot ${i === 0 ? 'active' : ''}" id="dot-${i}"></div>`).join('')
    bannerTimer = setInterval(() => {
      S.currentBanner = (S.currentBanner + 1) % S.banners.length
      showBanner(S.currentBanner)
    }, 3500)
  }
}

function showBanner(idx) {
  const b = S.banners[idx]; if (!b) return
  document.getElementById('ad-banner-img').src = b.image_url
  S.currentBanner = idx
  document.querySelectorAll('.ad-dot').forEach((d, i) => d.classList.toggle('active', i === idx))
}

function handleBannerClick() {
  const b = S.banners[S.currentBanner]
  if (!b || !b.link_value) return
  if      (b.link_type === 'external') window.open(b.link_value, '_blank')
  else if (b.link_type === 'product')  openModal(b.link_value)
  else if (b.link_type === 'category') selectCat(b.link_value)
}

// ── SCROLL BEHAVIOR ───────────────────────────────────────────────────
function initScrollBehavior() {
  const backBtn = document.getElementById('back-to-top-btn')
  const cartBar = document.getElementById('cart-bar')

  window.addEventListener('scroll', () => {
    const y = window.scrollY

    // Show back-to-top after 400px or near bottom
    const nearBottom = (window.innerHeight + y) >= (document.body.scrollHeight - 120)
    if (y > 400 || nearBottom) {
      backBtn.classList.remove('hidden-btn')
      backBtn.style.bottom = cartBar.classList.contains('hidden') ? '24px' : '84px'
    } else {
      backBtn.classList.add('hidden-btn')
    }
  }, { passive: true })
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }) }

// ── SEARCH (full mode) ────────────────────────────────────────────────
function fuzzyMatch(text, query) {
  text = text.toLowerCase(); query = query.toLowerCase()
  if (text.includes(query)) return { match: true, score: 2 }
  let ti = 0, qi = 0
  while (ti < text.length && qi < query.length) { if (text[ti] === query[qi]) qi++; ti++ }
  return { match: qi === query.length, score: 1 }
}

let suggestTimeout = null
function handleSearch() {
  const q = document.getElementById('search-input').value.trim()
  S.search = q
  clearTimeout(suggestTimeout)
  if (!q) { renderAllSections(); hideSuggestions(); return }

  const filtered = S.products
    .map(p => ({ p, r: fuzzyMatch(p.name + ' ' + (p.description || ''), q) }))
    .filter(x => x.r.match).sort((a, b) => b.r.score - a.r.score).map(x => x.p)

  renderAllSections(filtered)
  suggestTimeout = setTimeout(() => renderSuggestions(q, filtered), 80)
}

function renderSuggestions(q, results) {
  const el = document.getElementById('search-suggestions')
  if (!results.length) { el.classList.add('hidden'); return }
  el.innerHTML = results.slice(0, 5).map(p => {
    const hl    = p.name.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<span class="suggestion-match">${m}</span>`)
    const price = isDiscountActive(p) ? fmt(p.discount_price) : fmt(p.price)
    return `<div class="suggestion-item" onmousedown="selectSuggestion('${p.id}')">
      ${p.image_url ? `<img class="suggestion-img" src="${p.image_url}" />` : `<div class="suggestion-img" style="display:flex;align-items:center;justify-content:center;font-size:18px">🍽️</div>`}
      <div><div class="suggestion-name">${hl}</div><div class="suggestion-price">${price}</div></div>
    </div>`
  }).join('')
  el.classList.remove('hidden')
}
function selectSuggestion(pid) {
  document.getElementById('search-input').value = ''
  hideSuggestions(); renderAllSections()
  setTimeout(() => openModal(pid), 80)
}
function showSuggestions() {
  const q = document.getElementById('search-input').value.trim()
  if (q) renderSuggestions(q, S.products.filter(p => fuzzyMatch(p.name, q).match))
}
function hideSuggestions() {
  setTimeout(() => document.getElementById('search-suggestions')?.classList.add('hidden'), 150)
}

// ── SEARCH OVERLAY (mini mode) ────────────────────────────────────────
function openSearchOverlay() {
  document.getElementById('search-overlay').classList.remove('hidden')
  setTimeout(() => document.getElementById('search-overlay-input').focus(), 100)
  pushModal('search', closeSearchOverlay)
}
function closeSearchOverlay(e) {
  if (e && e.target && e.target !== document.getElementById('search-overlay')) return
  document.getElementById('search-overlay').classList.add('hidden')
  document.getElementById('search-overlay-input').value = ''
  document.getElementById('overlay-suggestions').classList.add('hidden')
  if (e !== true) popModalSilently('search') // e === true يعني تم الاستدعاء من popstate
}
function handleOverlaySearch() {
  const q = document.getElementById('search-overlay-input').value.trim()
  if (!q) { document.getElementById('overlay-suggestions').classList.add('hidden'); return }

  const filtered = S.products
    .map(p => ({ p, r: fuzzyMatch(p.name + ' ' + (p.description || ''), q) }))
    .filter(x => x.r.match).sort((a, b) => b.r.score - a.r.score).map(x => x.p)

  const el = document.getElementById('overlay-suggestions')
  if (!filtered.length) { el.classList.add('hidden'); return }

  el.innerHTML = filtered.slice(0, 5).map(p => {
    const hl    = p.name.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<span class="suggestion-match">${m}</span>`)
    const price = isDiscountActive(p) ? fmt(p.discount_price) : fmt(p.price)
    return `<div class="suggestion-item" onmousedown="overlaySelectSuggestion('${p.id}')">
      ${p.image_url ? `<img class="suggestion-img" src="${p.image_url}" />` : `<div class="suggestion-img" style="display:flex;align-items:center;justify-content:center;font-size:18px">🍽️</div>`}
      <div><div class="suggestion-name">${hl}</div><div class="suggestion-price">${price}</div></div>
    </div>`
  }).join('')
  el.classList.remove('hidden')
}
function overlaySelectSuggestion(pid) {
  document.getElementById('search-overlay').classList.add('hidden')
  document.getElementById('search-overlay-input').value = ''
  document.getElementById('overlay-suggestions').classList.add('hidden')
  setTimeout(() => openModal(pid), 100)
}

// ── CATEGORY GRID ─────────────────────────────────────────────────────
function renderCatGrid() {
  const el         = document.getElementById('cat-grid')
  const hasBundles = S.bundles.length > 0
  const catsHTML   = S.categories.map(c =>
    `<button class="cat-tab ${c.id === S.activeCat ? 'active' : ''}" data-cat="${c.id}" onclick="selectCat('${c.id}')">${c.name}</button>`
  ).join('')
  const bundleTab  = hasBundles
    ? `<button class="cat-tab ${S.activeCat === 'bundles' ? 'active' : ''}" data-cat="bundles" onclick="selectCat('bundles')">🎁 العروض</button>`
    : ''
  el.innerHTML = catsHTML + bundleTab
}

// تمرير أفقي آمن داخل شريط التابات فقط — بدون استخدام scrollIntoView()
// لأن scrollIntoView() يتجاهل position:sticky ويحسب المكان بناءً على
// الموضع الأصلي للعنصر في الـ document flow، فيسبب قفزة للصفحة بالكامل لأعلى
// (وهو سبب الـ Auto-Scroll/Jump Bug في الـ Home Feed)
function scrollTabIntoView(tabEl) {
  if (!tabEl) return
  const container = document.getElementById('cat-grid')
  if (!container) return
  const cRect = container.getBoundingClientRect()
  const tRect = tabEl.getBoundingClientRect()
  const offset = (tRect.left + tRect.right) / 2 - (cRect.left + cRect.right) / 2
  container.scrollBy({ left: offset, behavior: 'smooth' })
}

function selectCat(id) {
  S.activeCat = id
  S.search = ''
  document.getElementById('search-input').value = ''
  hideSuggestions(); renderCatGrid(); renderAllSections()

  // Scroll tab into view (أفقي فقط)
  const tabEl = document.querySelector(`.cat-tab[data-cat="${id}"]`)
  scrollTabIntoView(tabEl)

  // Scroll to section
  const sec = document.getElementById(id === 'bundles' ? 'sec-bundles' : 'sec-' + id)
  if (sec) {
    setTimeout(() => {
      const stickyH = document.getElementById('sticky-bar').offsetHeight
      const top   = sec.getBoundingClientRect().top + window.scrollY - stickyH - 8
      window.scrollTo({ top, behavior: 'smooth' })
    }, 50)
  }
}

// ── SCROLL SPY ────────────────────────────────────────────────────────
function initScrollSpy() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      const id = entry.target.id.replace('sec-', '')
      if (id === S.activeCat) return
      S.activeCat = id
      renderCatGrid()
      const tabEl = document.querySelector(`.cat-tab[data-cat="${id}"]`)
      scrollTabIntoView(tabEl)
    })
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 })

  setTimeout(() => document.querySelectorAll('[id^="sec-"]').forEach(el => observer.observe(el)), 300)
}

// ── RENDER ALL SECTIONS ───────────────────────────────────────────────
function renderAllSections(filtered) {
  const wrap  = document.getElementById('products-wrapper')
  const noRes = document.getElementById('no-results')
  const prods = filtered !== undefined ? filtered : S.products

  if (filtered !== undefined && filtered.length === 0) {
    wrap.innerHTML = ''; noRes.classList.remove('hidden'); stopBundleAutoScroll(); return
  }
  noRes.classList.add('hidden')

  const chunk = (arr, size) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out }
  _bundleAutoScrollWanted = false

  const prodsHTML = S.categories.map(cat => {
    const items = prods.filter(p => p.category_id === cat.id)
    if (!items.length) return ''
    const style = cat.display_style || 'grid'
    const body  = style === 'list'
      ? `<div class="products-list">${items.map(p => prodCardListHTML(p)).join('')}</div>`
      : style === 'scroll'
        ? `<div class="products-scroll">${items.map(p => prodCardHTML(p)).join('')}</div>`
        : style === 'scroll_compact'
          ? `<div class="products-scroll-compact">${chunk(items, 10).map(group => `<div class="scroll-compact-block">${group.map(p => prodTileHTML(p)).join('')}</div>`).join('')}</div>`
          : style === 'grid_3'
            ? `<div class="products-grid-3">${items.map(p => prodTileHTML(p)).join('')}</div>`
            : `<div class="products-grid">${items.map(p => prodCardHTML(p)).join('')}</div>`
    return `<div id="sec-${cat.id}" class="fade-up" style="margin-top:4px">
      <p class="section-title">${cat.name}</p>
      ${body}
    </div>`
  }).join('')

  const bundlesHTML = S.bundles.length && !filtered ? (() => {
    // فلتر البنادل حسب أقرب فرع لو محدد
    const custLat = parseFloat(document.getElementById('order-location-lat')?.value)
    const custLng = parseFloat(document.getElementById('order-location-lng')?.value)
    let nearestBranchId = null
    if (!isNaN(custLat) && !isNaN(custLng) && S.branches.length) {
      const r = findNearestBranch(custLat, custLng)
      if (r) nearestBranchId = r.branch.id
    }
    const visibleBundles = S.bundles.filter(b => {
      if (!b.branch_ids || b.branch_ids.length === 0) return true // كل الفروع
      if (!nearestBranchId) return true // موقع العميل غير محدد → اعرض الكل
      return b.branch_ids.includes(nearestBranchId)
    })
    if (!visibleBundles.length) return ''
    const style = S.restaurant.bundles_display_style || 'featured'
    const body  = style === 'grid'
      ? `<div class="bundle-grid">${visibleBundles.map(b => bundleTileHTML(b)).join('')}</div>`
      : style === 'list'
        ? `<div class="bundle-list">${visibleBundles.map(b => bundleCardListHTML(b)).join('')}</div>`
        : style === 'scroll'
          ? `<div class="bundle-scroll" id="bundle-scroll-track">${visibleBundles.map(b => bundleCardHTML(b, true)).join('')}</div>`
          : `${visibleBundles.map(b => bundleCardHTML(b)).join('')}`
    _bundleAutoScrollWanted = style === 'scroll' && visibleBundles.length > 1
    return `<div id="sec-bundles" class="fade-up" style="margin-top:4px">
      <p class="section-title">🎁 العروض والباقات</p>
      ${body}
    </div>`
  })() : ''

  const uncatItems = prods.filter(p => !p.category_id)
  const uncatHTML  = uncatItems.length ? `
    <div class="fade-up" style="margin-top:4px">
      <p class="section-title">منتجات أخرى</p>
      <div class="products-grid">${uncatItems.map(p => prodCardHTML(p)).join('')}</div>
    </div>` : ''

  wrap.innerHTML = prodsHTML + bundlesHTML + uncatHTML
  if (_bundleAutoScrollWanted) initBundleAutoScroll(); else stopBundleAutoScroll()
}

// ── BUNDLES AUTO-SCROLL (جذب انتباه العميل) ────────────────────────────
let _bundleAutoScrollWanted = false
let _bundleAutoTimer  = null
let _bundleResumeTimer = null
function initBundleAutoScroll() {
  stopBundleAutoScroll()
  const track = document.getElementById('bundle-scroll-track')
  if (!track || track.children.length <= 1) return
  let idx = 0
  const advance = () => {
    idx = (idx + 1) % track.children.length
    const child     = track.children[idx]
    const trackRect = track.getBoundingClientRect()
    const childRect = child.getBoundingClientRect()
    const delta     = childRect.left - trackRect.left
    track.scrollBy({ left: delta, behavior: 'smooth' })
  }
  _bundleAutoTimer = setInterval(advance, 2800)
  const pauseThenResume = () => {
    clearInterval(_bundleAutoTimer); _bundleAutoTimer = null
    clearTimeout(_bundleResumeTimer)
    _bundleResumeTimer = setTimeout(() => {
      if (document.getElementById('bundle-scroll-track') === track) {
        _bundleAutoTimer = setInterval(advance, 2800)
      }
    }, 1000)
  }
  track.addEventListener('touchstart', pauseThenResume, { passive: true })
  track.addEventListener('mousedown',  pauseThenResume)
  track.addEventListener('wheel',      pauseThenResume, { passive: true })
}
function stopBundleAutoScroll() {
  clearInterval(_bundleAutoTimer);  _bundleAutoTimer  = null
  clearTimeout(_bundleResumeTimer); _bundleResumeTimer = null
}

// ── PRODUCT CARD HTML ─────────────────────────────────────────────────
function prodCardHTML(p) {
  const ci          = S.cart.find(c => c.id === p.id && c.type === 'product')
  const hasDiscount = isDiscountActive(p)
  const unavailable = p.availability === 'unavailable' || p.status === 'unavailable'
  const discPct     = hasDiscount ? Math.round((1 - Number(p.discount_price) / Number(p.price)) * 100) : 0

  const priceHTML = hasDiscount
    ? `<div class="price-row"><span class="price-new">${fmt(p.discount_price)}</span><span class="price-old">${fmt(p.price)}</span></div>`
    : `<span class="price-normal">${fmt(p.price)}</span>`

  return `<div class="prod-card${unavailable ? ' opacity-60' : ''}"
       onclick="${unavailable ? '' : `openModal('${p.id}')`}"
       style="${unavailable ? 'cursor:default' : ''}">
    <div class="thumb">
      ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.add('img-ready')" onerror="this.parentElement.classList.add('img-ready')" />` : `<div class="no-img">🍽️</div>`}
      ${p.offer_badge ? `<div class="offer-badge">${p.offer_badge}</div>` : ''}
      ${discPct >= 5 && !p.offer_badge ? `<div class="disc-pct">-${discPct}%</div>` : ''}
      ${unavailable ? `<div class="unavail-overlay"></div>` : ''}
      ${!ci && !unavailable ? `<button class="add-btn" onclick="event.stopPropagation(); quickAdd('${p.id}')">+</button>` : ''}
    </div>
    <div class="info">
      <h3>${p.name}</h3>
      ${priceHTML}
      ${unavailable
        ? `<span style="font-size:10px;background:#f0f0f0;color:#999;font-weight:700;padding:4px 8px;border-radius:8px;display:inline-block;margin-top:4px">غير متوفر</span>`
        : ci
          ? `<div class="qty-row" onclick="event.stopPropagation()">
               <div class="qty-btn" onclick="cQty('${p.id}','product',-1)">−</div>
               <span style="font-size:13px;font-weight:900;min-width:20px;text-align:center">${ci.qty}</span>
               <div class="qty-btn" onclick="cQty('${p.id}','product',1)">+</div>
             </div>`
          : ''}
    </div>
  </div>`
}

// ── PRODUCT LIST-STYLE CARD HTML ──────────────────────────────────────
function prodCardListHTML(p) {
  const ci          = S.cart.find(c => c.id === p.id && c.type === 'product')
  const hasDiscount = isDiscountActive(p)
  const unavailable = p.availability === 'unavailable' || p.status === 'unavailable'
  const discPct     = hasDiscount ? Math.round((1 - Number(p.discount_price) / Number(p.price)) * 100) : 0

  const priceHTML = hasDiscount
    ? `<div class="price-row"><span class="price-new">${fmt(p.discount_price)}</span><span class="price-old">${fmt(p.price)}</span></div>`
    : `<span class="price-normal">${fmt(p.price)}</span>`

  return `<div class="prod-card-list${unavailable ? ' opacity-60' : ''}"
       onclick="${unavailable ? '' : `openModal('${p.id}')`}"
       style="${unavailable ? 'cursor:default' : ''}">
    <div class="info">
      <h3>${p.name}</h3>
      ${p.description ? `<p class="desc">${p.description}</p>` : ''}
      ${priceHTML}
      ${unavailable
        ? `<span style="font-size:10px;background:#f0f0f0;color:#999;font-weight:700;padding:4px 8px;border-radius:8px;display:inline-block;margin-top:4px">غير متوفر</span>`
        : ci
          ? `<div class="qty-row" onclick="event.stopPropagation()">
               <div class="qty-btn" onclick="cQty('${p.id}','product',-1)">−</div>
               <span style="font-size:13px;font-weight:900;min-width:20px;text-align:center">${ci.qty}</span>
               <div class="qty-btn" onclick="cQty('${p.id}','product',1)">+</div>
             </div>`
          : `<button class="add-btn-list" onclick="event.stopPropagation(); quickAdd('${p.id}')">+ أضف</button>`}
    </div>
    <div class="thumb">
      ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.add('img-ready')" onerror="this.parentElement.classList.add('img-ready')" />` : `<div class="no-img">🍽️</div>`}
      ${p.offer_badge ? `<div class="offer-badge">${p.offer_badge}</div>` : ''}
      ${discPct >= 5 && !p.offer_badge ? `<div class="disc-pct">-${discPct}%</div>` : ''}
      ${unavailable ? `<div class="unavail-overlay"></div>` : ''}
    </div>
  </div>`
}

// ── PRODUCT COMPACT TILE HTML (small square, wrapping scroll) ─────────
function prodTileHTML(p) {
  const ci          = S.cart.find(c => c.id === p.id && c.type === 'product')
  const hasDiscount = isDiscountActive(p)
  const unavailable = p.availability === 'unavailable' || p.status === 'unavailable'
  const discPct     = hasDiscount ? Math.round((1 - Number(p.discount_price) / Number(p.price)) * 100) : 0

  const priceHTML = hasDiscount
    ? `<div class="price-row"><span class="price-new">${fmt(p.discount_price)}</span></div>`
    : `<span class="price-normal">${fmt(p.price)}</span>`

  return `<div class="prod-tile${unavailable ? ' opacity-60' : ''}"
       onclick="${unavailable ? '' : `openModal('${p.id}')`}"
       style="${unavailable ? 'cursor:default' : ''}">
    <div class="thumb">
      ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.add('img-ready')" onerror="this.parentElement.classList.add('img-ready')" />` : `<div class="no-img">🍽️</div>`}
      ${p.offer_badge ? `<div class="offer-badge sm">${p.offer_badge}</div>` : ''}
      ${discPct >= 5 && !p.offer_badge ? `<div class="disc-pct sm">-${discPct}%</div>` : ''}
      ${unavailable ? `<div class="unavail-overlay"></div>` : ''}
      ${!ci && !unavailable ? `<button class="add-btn sm" onclick="event.stopPropagation(); quickAdd('${p.id}')">+</button>` : ''}
      ${ci ? `<div class="tile-qty" onclick="event.stopPropagation()">
               <div class="qty-btn sm" onclick="cQty('${p.id}','product',-1)">−</div>
               <span style="font-size:11px;font-weight:900;min-width:14px;text-align:center">${ci.qty}</span>
               <div class="qty-btn sm" onclick="cQty('${p.id}','product',1)">+</div>
             </div>` : ''}
    </div>
    <h3>${p.name}</h3>
    ${unavailable
      ? `<span style="font-size:9px;background:#f0f0f0;color:#999;font-weight:700;padding:3px 6px;border-radius:6px;display:inline-block">غير متوفر</span>`
      : priceHTML}
  </div>`
}

// ── BUNDLE CARD HTML (Featured / Scroll) ───────────────────────────────
function bundleCardHTML(b, forScroll = false) {
  return `<div class="bundle-card${forScroll ? ' bundle-card-scroll' : ''}" onclick="openBundleModal('${b.id}')">
    <div class="bundle-media">
      ${b.image_url ? `<img src="${b.image_url}" alt="${b.name}" loading="lazy" />` : `<div class="no-img">🎁</div>`}
      <div class="bundle-badge">🔥 عرض خاص</div>
      <div class="bundle-gradient"></div>
    </div>
    <div class="b-info">
      <h3>${b.name}</h3>
      ${b.description ? `<p>${b.description}</p>` : ''}
      <div class="b-footer">
        <span class="b-price">${fmt(b.price)}</span>
        <div class="bundle-add" onclick="event.stopPropagation(); addBundleToCart('${b.id}')">أضف للسلة +</div>
      </div>
    </div>
  </div>`
}

// ── BUNDLE TILE HTML (Grid) ─────────────────────────────────────────────
function bundleTileHTML(b) {
  return `<div class="bundle-tile" onclick="openBundleModal('${b.id}')">
    <div class="bundle-tile-media">
      ${b.image_url ? `<img src="${b.image_url}" alt="${b.name}" loading="lazy" />` : `<div class="no-img">🎁</div>`}
      <div class="bundle-badge sm">عرض</div>
    </div>
    <div class="bundle-tile-info">
      <h3>${b.name}</h3>
      <div class="b-footer">
        <span class="b-price">${fmt(b.price)}</span>
        <div class="bundle-add sm" onclick="event.stopPropagation(); addBundleToCart('${b.id}')">+</div>
      </div>
    </div>
  </div>`
}

// ── BUNDLE LIST HTML (Compact horizontal) ───────────────────────────────
function bundleCardListHTML(b) {
  return `<div class="bundle-card-list" onclick="openBundleModal('${b.id}')">
    <div class="bundle-list-media">
      ${b.image_url ? `<img src="${b.image_url}" alt="${b.name}" loading="lazy" />` : `<div class="no-img">🎁</div>`}
    </div>
    <div class="bundle-list-info">
      <h3>${b.name}</h3>
      ${b.description ? `<p>${b.description}</p>` : ''}
      <div class="b-footer">
        <span class="b-price">${fmt(b.price)}</span>
        <div class="bundle-add sm" onclick="event.stopPropagation(); addBundleToCart('${b.id}')">أضف +</div>
      </div>
    </div>
  </div>`
}

