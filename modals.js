// هذا الملف جزء من تطبيق Monjez Menu — تم تقسيمه من index.html الأصلي

// ── PRODUCT PAGE (modal) ──────────────────────────────────────────────
function openModal(pid) {
  const p = S.products.find(x => x.id === pid); if (!p) return
  const hasDiscount  = p.discount_price && Number(p.discount_price) < Number(p.price)
  const displayPrice = hasDiscount ? Number(p.discount_price) : Number(p.price)

  const priceHTML = hasDiscount
    ? `<div class="prod-price"><span class="old-price">${fmt(p.price)}</span>${fmt(p.discount_price)}</div>`
    : `<div class="prod-price">${fmt(p.price)}</div>`

  // Customization options
  const opts = p.product_options || []
  const optionsHTML = opts.map((g, gi) => `
    <div class="opt-group">
      <div class="opt-group-header">
        <span class="opt-group-name">${g.name}</span>
        <span class="${g.selection === 'multiple' ? 'opt-optional' : 'opt-required'}">${g.selection === 'multiple' ? 'اختياري - أكثر من واحد' : 'اختر واحد (اختياري)'}</span>
      </div>
      <div class="chips-wrap">
        ${g.options.map((o, oi) => `
          <button class="chip-btn" id="chip-${gi}-${oi}"
            onclick="${g.selection === 'multiple' ? `toggleChip(${gi},${oi})` : `selectChip(${gi},${oi})`}">
            <span>${o.name}</span>
            ${o.price > 0 ? `<span class="chip-extra">+${fmt(o.price)}</span>` : o.price < 0 ? `<span class="chip-extra">${fmt(o.price)}</span>` : ''}
          </button>`).join('')}
      </div>
    </div>`).join('')

  // "Also with" section
  const alsoIds      = Array.isArray(p.also_with) ? p.also_with : []
  const alsoProducts = alsoIds.map(id => S.products.find(x => x.id === id))
    .filter(x => x && x.is_available !== false && x.availability !== 'hidden' && !(x.product_options || []).some(g => g.required))
  const alsoHTML = alsoProducts.length ? `
    <div class="prod-divider"></div>
    <p class="also-title">تطلب معها أيضاً 🤩</p>
    <div class="also-scroll">
      ${alsoProducts.map(s => {
        const sp = s.discount_price && Number(s.discount_price) < Number(s.price) ? Number(s.discount_price) : Number(s.price)
        return `<div class="also-card" id="also-${s.id}" onclick="toggleAlso('${s.id}',${sp},this)">
          ${s.image_url ? `<img src="${s.image_url}" />` : `<div class="also-no-img">🍽️</div>`}
          <div class="also-info">
            <p class="also-name">${s.name}</p>
            <span class="also-price">${fmt(sp)}</span>
          </div>
        </div>`
      }).join('')}
    </div>` : ''

  document.getElementById('modal-inner').innerHTML = `
    <div class="prod-page">
      <div class="prod-hero">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" />` : `<div class="prod-hero-placeholder">🍽️</div>`}
        <div class="prod-hero-overlay"></div>
        <button class="prod-back-btn" onclick="closeModal()">←</button>
        <button class="prod-back-btn prod-share-btn" onclick="shareItem('product','${pid}')" aria-label="مشاركة المنتج">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
        ${p.offer_badge ? `<div class="prod-badge">${p.offer_badge}</div>` : ''}
        <div class="prod-hero-info">
          <p class="prod-hero-name">${p.name}</p>
          ${priceHTML}
        </div>
      </div>
      <div class="prod-body">
        ${p.description ? `<p class="prod-desc">${p.description}</p>` : ''}
        ${opts.length ? `<div class="prod-divider"></div>${optionsHTML}` : ''}
        ${alsoHTML}
      </div>
    </div>
    <div class="prod-add-bar">
      <div class="prod-qty">
        <button class="prod-qty-btn prod-qty-minus" onclick="mQty(-1)">−</button>
        <span class="prod-qty-num" id="m-qty">1</span>
        <button class="prod-qty-btn prod-qty-plus"  onclick="mQty(1)">+</button>
      </div>
      <button class="prod-add-btn" onclick="addFromModal('${pid}')">
        <span>أضف للسلة</span>
        <span id="m-total">${fmt(displayPrice)}</span>
      </button>
    </div>`

  const modal = document.getElementById('product-modal')
  modal.dataset.pid  = pid
  modal.dataset.base = displayPrice
  modal.dataset.qty  = 1
  modal.scrollTop = 0
  modal.classList.remove('hidden')
  _lockBodyScroll()
  pushModal('product', closeModal)
}

// يحسب سعر المنتج النهائي حسب الخيارات المختارة:
// - أي مجموعة "إجبارية" (زي الحجم) → سعرها بديل للسعر الأساسي، مش زيادة عليه
//   (لو فيه أكتر من مجموعة إجبارية، بنجمع أسعارهم كلهم بدل السعر الأساسي)
// - أي مجموعة اختيارية (زي الإضافات) → سعرها بيتجمع فوق الأساس
function computeItemPrice(p, base, selectedOptIds) {
  const opts = p?.product_options || []
  let sum = 0
  ;(selectedOptIds || []).forEach(key => {
    const [gi, oi] = key.split('-').map(Number)
    const opt = opts[gi]?.options?.[oi]
    if (opt) sum += opt.price || 0
  })
  const anyRequiredGroup = opts.some(g => g.required)
  const effectiveBase = anyRequiredGroup ? 0 : base
  return effectiveBase + sum
}
function selectChip(gi, oi) {
  const btn = document.getElementById(`chip-${gi}-${oi}`)
  const wasSelected = btn?.classList.contains('selected')
  document.querySelectorAll(`[id^="chip-${gi}-"]`).forEach(b => b.classList.remove('selected'))
  if (!wasSelected) btn?.classList.add('selected') // toggle: لو كان محدد، يتشال التحديد بدل ما يتحدد تاني
  recalcModalTotal()
}
function toggleChip(gi, oi) {
  document.getElementById(`chip-${gi}-${oi}`)?.classList.toggle('selected')
  recalcModalTotal()
}
function toggleAlso(sid, price, el) {
  el.classList.toggle('also-selected')
  const added = el.classList.contains('also-selected')
  if (added) {
    if (!el.querySelector('.also-check')) {
      const c = document.createElement('div'); c.className = 'also-check'; c.textContent = '✓'; el.appendChild(c)
    }
    if (!S.cart.find(c => c.id === sid && c._also)) {
      const s = S.products.find(x => x.id === sid)
      if (s) S.cart.push({ id: sid, type: 'product', name: s.name, price, image_url: s.image_url, qty: 1, unit: 'قطعة', _also: true })
    }
  } else {
    el.querySelector('.also-check')?.remove()
    S.cart = S.cart.filter(c => !(c.id === sid && c._also))
  }
  recalcModalTotal()
}
function recalcModalTotal() {
  const modal = document.getElementById('product-modal')
  const base  = parseFloat(modal.dataset.base) || 0
  const qty   = parseInt(modal.dataset.qty)    || 1
  const pid   = modal.dataset.pid
  const p     = S.products.find(x => x.id === pid)

  const selectedOptIds = []
  document.querySelectorAll('.chip-btn.selected').forEach(btn => {
    const m = btn.id.match(/^chip-(\d+)-(\d+)$/)
    if (m) selectedOptIds.push(`${m[1]}-${m[2]}`)
  })

  const finalUnit = computeItemPrice(p, base, selectedOptIds)
  const alsoExtra = S.cart.filter(c => c._also).reduce((s, c) => s + c.price, 0)
  const totalEl   = document.getElementById('m-total')
  if (totalEl) totalEl.textContent = fmt(finalUnit * qty + alsoExtra)
}
const MAX_ITEM_QTY = 30 // نفس الحد المفروض في recalc_order_pricing على السيرفر
function mQty(d) {
  const modal = document.getElementById('product-modal')
  const qty   = Math.min(MAX_ITEM_QTY, Math.max(1, parseInt(modal.dataset.qty) + d))
  if (d > 0 && parseInt(modal.dataset.qty) >= MAX_ITEM_QTY) showToast(`أقصى كمية للصنف الواحد ${MAX_ITEM_QTY}`)
  modal.dataset.qty = qty
  document.getElementById('m-qty').textContent = qty
  recalcModalTotal()
}
function addFromModal(pid) {
  const modal = document.getElementById('product-modal')
  const base  = parseFloat(modal.dataset.base)
  const qty   = parseInt(modal.dataset.qty) || 1
  const p     = S.products.find(x => x.id === pid); if (!p) return
  const opts  = p.product_options || []

  const selectedOptIds = [] // معرف فريد لكل خيار محدد (gi-oi)، يستخدم للمطابقة الدقيقة في السلة وللتحقق من السيرفر لاحقًا
  const selectedOptNames = []
  opts.forEach((g, gi) => {
    document.querySelectorAll(`[id^="chip-${gi}-"].selected`).forEach(sel => {
      const oi  = parseInt(sel.id.split('-')[2])
      const opt = g.options[oi]
      if (opt) { selectedOptNames.push(opt.name); selectedOptIds.push(`${gi}-${oi}`) }
    })
  })

  // تحقق: أي مجموعة إجبارية (زي الحجم) لازم يكون فيها اختيار واحد على الأقل قبل الإضافة —
  // لأن الحجم بديل للسعر الأساسي مش زيادة عليه، فلو محدش اتختار السعر يبقى صفر بالغلط
  const missingRequired = opts.some((g, gi) => g.required && !selectedOptIds.some(k => k.startsWith(`${gi}-`)))
  if (missingRequired) { showToast('من فضلك اختر الحجم قبل الإضافة للسلة'); return }

  const finalPrice  = computeItemPrice(p, base, selectedOptIds)
  const unit        = p.unit || 'قطعة'
  const optionsKey  = selectedOptIds.sort().join(',') // توقيع فريد للتركيبة المختارة (مرتب لتجاهل ترتيب الضغط)
  // المطابقة في السلة تتم على (نفس المنتج + نفس تركيبة الخيارات بالضبط)، لا على المنتج فقط
  // هذا يمنع استبدال أي تركيبة سابقة مختلفة (مثل "بيتزا كبيرة" تستبدل "بيتزا صغيرة" بالخطأ)
  const ci   = S.cart.find(c => c.id === pid && c.type === 'product' && !c._also && (c._optionsKey || '') === optionsKey)
  const item = { id: pid, type: 'product', name: p.name, price: finalPrice, image_url: p.image_url, qty, unit, options: selectedOptNames.join('، ') || null, opt_idx: selectedOptIds, _optionsKey: optionsKey }

  if (ci) { ci.qty += qty } else S.cart.push(item) // لو نفس التركيبة موجودة، نزود الكمية بدل الاستبدال؛ غير ذلك سطر جديد مستقل

  // Commit "also" items
  S.cart.forEach(c => { if (c._also) delete c._also })

  saveCart(); closeModal(); updateCartUI(); renderAllSections()
}
function closeModal(fromPopstate) {
  document.getElementById('product-modal').classList.add('hidden')
  _unlockBodyScroll()
  S.cart = S.cart.filter(c => !c._also)
  if (!fromPopstate) popModalSilently('product')
}

// ── BUNDLE MODAL ──────────────────────────────────────────────────────
function openBundleModal(bid) {
  const b = S.bundles.find(x => String(x.id) === String(bid)); if (!b) return

  const itemsHTML = b.items && Array.isArray(b.items) && b.items.length
    ? `<div style="margin:14px 0 0">
        <p style="font-size:13px;font-weight:800;color:#1a1a1a;margin-bottom:10px">محتويات الباقة:</p>
        ${b.items.map(item => `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f5f5f5">
            <span style="color:var(--brand);font-weight:900;font-size:14px">✓</span>
            <span style="font-size:13px;color:#444;font-weight:600">${item.name || item}</span>
            ${item.quantity ? `<span style="font-size:12px;color:#aaa;margin-right:auto">× ${item.quantity}</span>` : ''}
          </div>`).join('')}
      </div>`
    : ''

  document.getElementById('bundle-modal-inner').innerHTML = `
    <div style="position:relative">
      ${b.image_url
        ? `<img src="${b.image_url}" alt="${b.name}" style="width:100%;height:210px;object-fit:cover" />`
        : `<div style="width:100%;height:170px;background:linear-gradient(135deg,var(--brand2),var(--brand));display:flex;align-items:center;justify-content:center;font-size:72px">🎁</div>`}
      <button onclick="closeBundleModal()" style="position:absolute;top:12px;left:12px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);color:#fff;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center">&times;</button>
      <button onclick="shareItem('bundle','${bid}')" aria-label="مشاركة العرض" style="position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);color:#fff;display:flex;align-items:center;justify-content:center">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
      </button>
    </div>
    <div style="padding:18px 16px 24px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px">
        <h2 style="font-size:19px;font-weight:900;color:#1a1a1a">${b.name}</h2>
        <span style="font-size:19px;font-weight:900;color:var(--brand);white-space:nowrap">${fmt(b.price)}</span>
      </div>
      ${b.description ? `<p style="font-size:13px;color:#888;line-height:1.75">${b.description}</p>` : ''}
      ${itemsHTML}
      <button onclick="addBundleToCart('${bid}'); closeBundleModal()"
              style="width:100%;background:var(--brand);color:#fff;font-size:15px;font-weight:900;border-radius:18px;padding:16px;display:flex;align-items:center;justify-content:center;gap:10px;margin-top:18px">
        <span>أضف للسلة</span><span style="font-size:20px">🛒</span>
      </button>
    </div>`

  document.getElementById('bundle-modal').classList.remove('hidden')
  _lockBodyScroll()
  pushModal('bundle', closeBundleModal)
}
function closeBundleModal(fromPopstate) {
  document.getElementById('bundle-modal').classList.add('hidden')
  _unlockBodyScroll()
  if (!fromPopstate) popModalSilently('bundle')
}

// ── SHARE (مشاركة منتج أو عرض برابط مباشر) ─────────────────────────────
async function shareItem(type, id) {
  const item = type === 'bundle'
    ? S.bundles.find(x => String(x.id) === String(id))
    : S.products.find(x => x.id === id)
  if (!item) return

  const params = new URLSearchParams(location.search)
  params.delete('p'); params.delete('b')
  params.set(type === 'bundle' ? 'b' : 'p', id)
  const url = `${location.origin}${location.pathname}?${params.toString()}`

  if (navigator.share) {
    try { await navigator.share({ title: item.name, text: item.name, url }) }
    catch (e) { /* المستخدم لغى نافذة المشاركة — تجاهل */ }
  } else {
    try {
      await navigator.clipboard.writeText(url)
      showToast('🔗 تم نسخ رابط ' + (type === 'bundle' ? 'العرض' : 'المنتج'))
    } catch (e) {
      showToast('تعذّر نسخ الرابط')
    }
  }
}

// لو العميل داخل من رابط مشاركة (?p=معرف المنتج أو ?b=معرف العرض) — افتح المودال تلقائياً
function openSharedLinkIfAny() {
  const params = new URLSearchParams(location.search)
  const pid = params.get('p')
  const bid = params.get('b')
  if (pid && S.products.find(x => x.id === pid)) openModal(pid)
  else if (bid && S.bundles.find(x => String(x.id) === String(bid))) openBundleModal(bid)
}

// ── CART ──────────────────────────────────────────────────────────────
function quickAdd(pid) {
  const p = S.products.find(x => x.id === pid); if (!p) return
  // لو المنتج مش وحدة "قطعة"، أو عنده خيارات لازم اختيارها (حجم/إضافات)، افتح صفحة المنتج الكاملة بدل الإضافة السريعة —
  // بدون ده، منتج عنده حجم إجباري كان بيتضاف بالسعر الأساسي غلط من غير ما حد يختار حجمه
  if ((p.unit || 'قطعة') !== 'قطعة' || (p.product_options && p.product_options.length > 0)) { openModal(pid); return }
  const price = isDiscountActive(p) ? Number(p.discount_price) : Number(p.price)
  const ci    = S.cart.find(c => c.id === pid && c.type === 'product')
  if (ci) {
    if (ci.qty >= MAX_ITEM_QTY) { showToast(`أقصى كمية للصنف الواحد ${MAX_ITEM_QTY}`); return }
    ci.qty += 1
  } else { S.cart.push({ id: pid, type: 'product', name: p.name, price, image_url: p.image_url, qty: 1, unit: 'قطعة' }) }
  saveCart(); updateCartUI()
}
function addBundleToCart(bid) {
  const b  = S.bundles.find(x => String(x.id) === String(bid)); if (!b) return
  const ci = S.cart.find(c => String(c.id) === String(bid) && c.type === 'bundle')
  if (ci) {
    if (ci.qty >= MAX_ITEM_QTY) { showToast(`أقصى كمية للصنف الواحد ${MAX_ITEM_QTY}`); return }
    ci.qty += 1
  } else { S.cart.push({ id: bid, type: 'bundle', name: b.name, price: Number(b.price), image_url: b.image_url, qty: 1 }) }
  saveCart(); updateCartUI()
}
function cQty(id, type, d) {
  const idx = S.cart.findIndex(c => c.id === id && c.type === type); if (idx === -1) return
  if (d > 0 && S.cart[idx].qty >= MAX_ITEM_QTY) { showToast(`أقصى كمية للصنف الواحد ${MAX_ITEM_QTY}`); return }
  S.cart[idx].qty += d
  const removed = S.cart[idx].qty <= 0
  if (removed) S.cart.splice(idx, 1)
  saveCart(); updateCartUI()
  if (!document.getElementById('cart-sheet').classList.contains('hidden')) renderCartItems()
}
function cartTotal() { return S.cart.reduce((s, c) => s + c.price * c.qty, 0) }
function updateCartUI() {
  saveCart()
  const n   = S.cart.reduce((s, c) => s + c.qty, 0)
  const bar = document.getElementById('cart-bar')

  document.getElementById('cart-count-badge').textContent = n
  document.getElementById('cart-total-badge').textContent = fmt(cartTotal())

  // Mini header cart icon
  const miniBtn   = document.getElementById('cart-mini-btn')
  const miniBadge = document.getElementById('cart-mini-badge')
  if (miniBtn) {
    miniBtn.style.display   = n > 0 ? 'flex' : 'none'
    miniBadge.style.display = n > 0 ? 'flex' : 'none'
    miniBadge.textContent   = n
  }

  if (n > 0) {
    bar.classList.remove('hidden')
    const btn = bar.querySelector('.cart-bar-btn')
    btn.style.animation = 'none'; btn.offsetHeight; btn.style.animation = 'cartBounce 0.35s ease'
  } else {
    bar.classList.add('hidden'); closeCartSheet()
  }
}
function openCartSheet()  { renderCartItems(); document.getElementById('cart-sheet').classList.remove('hidden'); _lockBodyScroll(); pushModal('cart', closeCartSheet) }
function closeCartSheet(fromPopstate) { document.getElementById('cart-sheet').classList.add('hidden'); _unlockBodyScroll(); if (!fromPopstate) popModalSilently('cart') }
function renderCartItems() {
  const el  = document.getElementById('cart-items-list')
  const tot = document.getElementById('cart-grand-total')
  const cnt = document.getElementById('cart-count-text')
  const n   = S.cart.reduce((s, c) => s + c.qty, 0)

  cnt.textContent = `${n} ${n === 1 ? 'منتج' : 'منتجات'}`

  if (!S.cart.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px 0"><div style="font-size:52px;margin-bottom:12px">🛒</div><p style="font-weight:800;color:#bbb;font-size:15px">السلة فارغة</p></div>`
    tot.textContent = '0 ج.م'; return
  }

  el.innerHTML = S.cart.map(c => `
    <div style="display:flex;align-items:center;gap:10px;background:#f9f9f9;border-radius:16px;padding:11px 12px;margin-bottom:8px">
      ${c.image_url
        ? `<img src="${c.image_url}" style="width:54px;height:54px;border-radius:12px;object-fit:cover;flex-shrink:0" />`
        : `<div style="width:54px;height:54px;border-radius:12px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${c.type === 'bundle' ? '🎁' : '🍽️'}</div>`}
      <div style="flex:1;min-width:0">
        <p style="font-size:13px;font-weight:800;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</p>
        ${c.type === 'bundle' ? `<span style="font-size:10px;background:#FFF3EB;color:var(--brand);padding:2px 7px;border-radius:6px;font-weight:700">باقة</span>` : ''}
        ${c.options ? `<p style="font-size:11px;color:var(--brand);font-weight:600;margin-top:1px">${c.options}</p>` : ''}
        <p style="font-size:12px;color:#aaa;margin-top:2px">${c.qty} ${c.unit || 'قطعة'}</p>
        <p style="font-size:13px;font-weight:900;color:var(--brand);margin-top:2px">${fmt(c.price * c.qty)}</p>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <button onclick="cQty('${c.id}','${c.type}',-1)" style="width:30px;height:30px;border-radius:9px;background:#fff;border:1.5px solid #eee;color:#555;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center">−</button>
        <span style="font-size:14px;font-weight:900;min-width:20px;text-align:center">${c.qty}</span>
        <button onclick="cQty('${c.id}','${c.type}',1)" style="width:30px;height:30px;border-radius:9px;background:var(--brand);color:#fff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center">+</button>
      </div>
    </div>`).join('')

  tot.textContent = fmt(cartTotal())

  // عرض رسوم التوصيل التقديرية لو العميل حدد موقعه
  const deliveryRow = document.getElementById('cart-delivery-row')
  const custLat = document.getElementById('order-location-lat')?.value
  const custLng = document.getElementById('order-location-lng')?.value
  const pricePerKm = parseFloat(S.restaurant?.price_per_km) || 0
  let currentDeliveryFee = 0
  if (deliveryRow) {
    // استخدم الفروع أو موقع المتجر كـ fallback
    const restLat = parseFloat(S.restaurant?.lat)
    const restLng = parseFloat(S.restaurant?.lng)
    const hasOrigin = S.branches.length > 0 || (!isNaN(restLat) && !isNaN(restLng))
    if (custLat && custLng && pricePerKm > 0 && hasOrigin) {
      let distKm = null
      if (S.branches.length > 0) {
        const result = findNearestBranch(parseFloat(custLat), parseFloat(custLng))
        if (result) distKm = result.distanceKm
      } else {
        distKm = distanceKm(parseFloat(custLat), parseFloat(custLng), restLat, restLng)
      }
      if (distKm !== null) {
        currentDeliveryFee = Math.round(distKm * pricePerKm * 100) / 100
        deliveryRow.innerHTML = `<span style="font-size:13px;color:#888">🛵 رسوم التوصيل (${distKm.toFixed(1)} كم)</span><span style="font-size:13px;font-weight:900;color:#555">${fmt(currentDeliveryFee)}</span>`
        deliveryRow.style.display = 'flex'
      } else deliveryRow.style.display = 'none'
    } else deliveryRow.style.display = 'none'
  }

  // خصم الكود
  const discRow = document.getElementById('cart-discount-row')
  const discVal  = document.getElementById('cart-discount-val')
  if (_appliedDiscount > 0) {
    discRow.style.display = 'flex'; discVal.textContent = '- ' + fmt(_appliedDiscount)
  } else { discRow.style.display = 'none' }

  // استخدام رصيد المحفظة النقدي — يظهر فقط للمسجّلين وعندهم رصيد
  const walletRow = document.getElementById('cart-wallet-row')
  if (walletRow) {
    const walletBalance = Number(S.customer?.wallet_balance || 0)
    if (S.customer && walletBalance > 0) {
      document.getElementById('cart-wallet-available').textContent = `رصيدك: ${walletBalance.toFixed(2)} ج.م`
      walletRow.style.display = 'block'
    } else {
      walletRow.style.display = 'none'
      _walletToUse = 0
    }
  }
  const walletDiscRow = document.getElementById('cart-wallet-disc-row')
  const walletDiscVal  = document.getElementById('cart-wallet-disc-val')
  if (_walletToUse > 0) {
    walletDiscRow.style.display = 'flex'; walletDiscVal.textContent = '- ' + fmt(_walletToUse)
  } else { walletDiscRow.style.display = 'none' }

  // الإجمالي النهائي = (المنتجات + التوصيل) − كل الخصومات (كود + كوينز + محفظة)
  // يظهر دايماً لما فيه توصيل أو أي خصم، عشان العميل يشوف رقم واحد واضح قبل التأكيد
  const finalRow = document.getElementById('cart-final-row')
  const finalTot  = document.getElementById('cart-final-total')
  const totalDiscount = _appliedDiscount + _walletToUse
  if (currentDeliveryFee > 0 || totalDiscount > 0) {
    const beforeDiscount = cartTotal() + currentDeliveryFee
    const final = Math.max(0, Math.round((beforeDiscount - totalDiscount) * 100) / 100)
    finalRow.style.display = 'flex'; finalTot.textContent = fmt(final)
  } else { finalRow.style.display = 'none' }
}

// ── MAP PICKER ────────────────────────────────────────────────────────
let _map = null, _marker = null, _pickedLat = null, _pickedLng = null

function openMapPicker() {
  document.getElementById('map-modal').classList.remove('hidden')
  _lockBodyScroll()
  pushModal('map', closeMapPicker)

  if (!_map) {
    const defaultLat = 30.0444, defaultLng = 31.2357
    _map = L.map('leaflet-map', { zoomControl: true }).setView([defaultLat, defaultLng], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(_map)

    _marker    = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(_map)
    _pickedLat = defaultLat; _pickedLng = defaultLng
    updateCoordsLabel()

    _marker.on('dragend', e => {
      const pos = e.target.getLatLng()
      _pickedLat = pos.lat; _pickedLng = pos.lng; updateCoordsLabel()
    })
    _map.on('click', e => {
      _pickedLat = e.latlng.lat; _pickedLng = e.latlng.lng
      _marker.setLatLng([_pickedLat, _pickedLng]); updateCoordsLabel()
    })
  }

  setTimeout(() => _map.invalidateSize(), 150)
}
function closeMapPicker(fromPopstate) {
  document.getElementById('map-modal').classList.add('hidden')
  _unlockBodyScroll()
  if (!fromPopstate) popModalSilently('map')
}
function updateCoordsLabel() {
  if (_pickedLat === null) return
  document.getElementById('map-coords-label').textContent = `📍 ${_pickedLat.toFixed(5)}, ${_pickedLng.toFixed(5)}`
}
function useMyLocation() {
  if (!navigator.geolocation) { alert('متصفحك لا يدعم تحديد الموقع'); return }
  navigator.geolocation.getCurrentPosition(pos => {
    _pickedLat = pos.coords.latitude; _pickedLng = pos.coords.longitude
    _map.setView([_pickedLat, _pickedLng], 16)
    _marker.setLatLng([_pickedLat, _pickedLng])
    updateCoordsLabel()
  }, () => alert('تعذّر تحديد موقعك — تأكد من إذن الموقع'))
}
function confirmLocation() {
  if (_pickedLat === null) { closeMapPicker(); return }
  const url = `https://www.google.com/maps?q=${_pickedLat},${_pickedLng}`
  document.getElementById('order-location').value     = url
  document.getElementById('order-location-lat').value = _pickedLat
  document.getElementById('order-location-lng').value = _pickedLng
  document.getElementById('map-pick-label').textContent = `✅ تم تحديد الموقع (${_pickedLat.toFixed(4)}, ${_pickedLng.toFixed(4)})`
  document.getElementById('map-pick-btn').style.borderColor = 'var(--brand)'
  document.getElementById('map-pick-btn').style.color       = 'var(--brand)'
  closeMapPicker()
  // تحديث عرض رسوم التوصيل في السلة فور تحديد الموقع
  renderCartItems()
}

