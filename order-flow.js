// هذا الملف جزء من تطبيق Monjez Menu — تم تقسيمه من index.html الأصلي

// ── FIELD VALIDATION HELPERS (مستخدمة في نموذج الطلب) ──────────────────
// تمييز حقل ناقص بإطار أحمر، وإزالته عند التصحيح
function markFieldError(id) {
  const el = document.getElementById(id)
  if (el) { el.style.borderColor = '#ef4444'; el.addEventListener('input', () => { el.style.borderColor = '#eee' }, { once: true }) }
}
function clearFieldErrors() {
  ;['order-phone', 'map-pick-btn'].forEach(id => { const el = document.getElementById(id); if (el) el.style.borderColor = '#eee' })
}

// تفاعل لوحة المفاتيح: الضغط على "تم/Next" ينقل التركيز للحقل التالي،
// أو ينفّذ فعل الفورم الرئيسي (مثل sendOrder) لو كان هذا آخر حقل
function focusNextField(event, nextFieldId, submitFn) {
  const isEnterKey = event.key === 'Enter'
  if (!isEnterKey) return
  // في textarea، Enter العادي بيعمل سطر جديد — نمنع ذلك فقط لو هذا آخر حقل بالفورم (عنده submitFn)
  if (event.target.tagName === 'TEXTAREA' && !submitFn) return
  event.preventDefault()
  if (nextFieldId) {
    const next = document.getElementById(nextFieldId)
    if (next) next.focus()
  } else if (submitFn) {
    event.target.blur() // يقفل لوحة المفاتيح قبل التنفيذ
    submitFn()
  }
}


// ── SEND ORDER ────────────────────────────────────────────────────────
async function sendOrder() {
  if (!S.cart.length) return

  const table    = document.getElementById('table-number-input').value.trim()
  const custName = document.getElementById('order-name').value.trim()
  const custPhone= document.getElementById('order-phone').value.trim()
  const custAddr = document.getElementById('order-address').value.trim()
  const custLoc  = document.getElementById('order-location').value.trim()
  const custLat  = document.getElementById('order-location-lat').value
  const custLng  = document.getElementById('order-location-lng').value
  const note     = document.getElementById('order-note').value.trim()

  // تحقق إجباري: لو الطلب توصيل (مفيش رقم طاولة)، لازم رقم تواصل + تحديد الموقع على الخريطة
  // (الموقع إجباري وليس بديلاً اختيارياً للعنوان، لأنه أساس حساب أقرب فرع وتكلفة التوصيل)
  clearFieldErrors()
  if (!table) {
    const missing = []
    if (!custPhone) missing.push('order-phone')
    if (!custLat) missing.push('map-pick-btn')
    if (missing.length) {
      missing.forEach(id => markFieldError(id))
      showToast('من فضلك اكتب رقم تواصلك وحدد موقعك على الخريطة لإتمام التوصيل')
      document.getElementById(missing[0]).scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
  }

  const btn      = document.getElementById('send-order-btn')
  const btnLabel = '<span>إرسال الطلب</span><span style="font-size:20px">✅</span>'
  const resetBtn = () => { btn.style.opacity = '1'; btn.innerHTML = btnLabel }
  btn.style.opacity = '0.6'; btn.innerHTML = '<span>جاري الإرسال...</span>'

  const items = S.cart.map(c => ({
    id: c.id, type: c.type, name: c.name, price: c.price, qty: c.qty,
    unit: c.unit || 'قطعة', options: c.options || null,
    subtotal: Number((c.price * c.qty).toFixed(2))
  }))
  const total = cartTotal()

  // الوقت التقديري الكلي للطلب = أكبر وقت تجهيز بين كل المنتجات (تُجهَّز بالتوازي لا بالتتابع)
  const estimatedPrepMinutes = Math.max(
    10, // حد أدنى افتراضي لو مفيش بيانات وقت تجهيز
    ...S.cart.map(c => {
      if (c.type === 'bundle') return 10 // العروض المجمّعة: قيمة افتراضية (لا يوجد وقت تجهيز مخصص لها حالياً)
      const product = S.products.find(p => p.id === c.id)
      return product?.prep_minutes || 10
    })
  )

  // أقرب فرع نشط لموقع العميل (لو الطلب توصيل ومفيش طاولة) — أساس توجيه الطلب وحساب التوصيل
  let nearestBranchId = null
  let deliveryFee     = 0
  if (!table && custLat && custLng) {
    const pricePerKm = parseFloat(S.restaurant.price_per_km) || 0
    if (S.branches.length > 0) {
      const result = findNearestBranch(parseFloat(custLat), parseFloat(custLng))
      if (result) {
        nearestBranchId = result.branch.id
        if (pricePerKm > 0) deliveryFee = Math.round(result.distanceKm * pricePerKm * 100) / 100
      }
    } else {
      // fallback: موقع المطعم مباشرة
      const restLat = parseFloat(S.restaurant.lat)
      const restLng = parseFloat(S.restaurant.lng)
      if (!isNaN(restLat) && !isNaN(restLng) && pricePerKm > 0) {
        const d = distanceKm(parseFloat(custLat), parseFloat(custLng), restLat, restLng)
        deliveryFee = Math.round(d * pricePerKm * 100) / 100
      }
    }
  }
  const grandTotal = Math.round((cartTotal() + deliveryFee) * 100) / 100

  // الخصومات
  const coinsPerEgp      = S.restaurant?.coins_per_egp ?? 1000
  const coinsDiscountEgp = _coinsToRedeem > 0 ? Math.round(_coinsToRedeem / coinsPerEgp * 100) / 100 : 0
  const walletAmountUsed = (_walletToUse > 0 && S.customer) ? _walletToUse : 0
  let finalTotal = Math.max(0, Math.round((grandTotal - _appliedDiscount - coinsDiscountEgp - walletAmountUsed) * 100) / 100)

  // Save order to DB — the merchant receives it live in the dashboard (no WhatsApp)
  let orderId, orderNumber
  try {
    const { data: rpc, error: re } = await db.rpc('generate_order_number')
    if (re || !rpc) throw new Error(re?.message || 'generate_order_number failed')

    let { data: od, error: ie } = await db.from('orders')
      .insert({
        restaurant_id:    S.restaurant.id,
        order_number:     rpc,
        items, total:     finalTotal,
        table_number:     table     || null,
        customer_name:    custName  || S.customer?.name || null,
        customer_phone:   custPhone || S.customer?.phone || null,
        customer_address: custAddr  || null,
        customer_location:custLoc   || null,
        customer_lat:     custLat   ? parseFloat(custLat) : null,
        customer_lng:     custLng   ? parseFloat(custLng) : null,
        note:             note      || null,
        estimated_prep_minutes: estimatedPrepMinutes,
        branch_id:        nearestBranchId,
        delivery_fee:     deliveryFee > 0 ? deliveryFee : null,
        customer_id:      S.customer?.id || null,
        coins_redeemed:   _coinsToRedeem > 0 ? _coinsToRedeem : null,
        coins_discount:   coinsDiscountEgp > 0 ? coinsDiscountEgp : null,
        discount_code:    _appliedCode ? document.getElementById('cart-discount-code').value.trim().toUpperCase() : null,
        discount_code_amount: _appliedDiscount > 0 ? _appliedDiscount : null,
        wallet_amount_used: walletAmountUsed > 0 ? walletAmountUsed : null
      })
      .select('id,order_number').single()

    // customer_id بقى يشاور على صف ملوش وجود (اتمسح، أو السيشن مش متوافقة) — صفّر S.customer وأعد المحاولة بدون ربط
    if (ie?.message?.includes('orders_customer_id_fkey')) {
      console.warn('customer_id غير صالح، إعادة المحاولة كـ زائر:', S.customer?.id)
      S.customer = null
      // خصم الكوينز ورصيد المحفظة يتطلبان حساب عميل صالح — بما إننا رجعنا "زائر" لازم نعيد حساب الإجمالي بدونهم
      finalTotal = Math.max(0, Math.round((grandTotal - _appliedDiscount) * 100) / 100)
      const retry = await db.from('orders')
        .insert({
          restaurant_id:    S.restaurant.id,
          order_number:     rpc,
          items, total:     finalTotal,
          table_number:     table     || null,
          customer_name:    custName  || null,
          customer_phone:   custPhone || null,
          customer_address: custAddr  || null,
          customer_location:custLoc   || null,
          customer_lat:     custLat   ? parseFloat(custLat) : null,
          customer_lng:     custLng   ? parseFloat(custLng) : null,
          note:             note      || null,
          estimated_prep_minutes: estimatedPrepMinutes,
          branch_id:        nearestBranchId,
          delivery_fee:     deliveryFee > 0 ? deliveryFee : null,
          customer_id:      null,
          discount_code:    _appliedCode ? document.getElementById('cart-discount-code').value.trim().toUpperCase() : null,
          discount_code_amount: _appliedDiscount > 0 ? _appliedDiscount : null
        })
        .select('id,order_number').single()
      od = retry.data
      ie = retry.error
    }

    if (ie || !od?.order_number) throw new Error(ie?.message || 'insert failed')
    orderId     = od.id
    orderNumber = od.order_number

    // خصم الكوينز المستخدمة من المحفظة
    if (_coinsToRedeem > 0 && S.customer) {
      const newBal = Math.max(0, (S.customer.coins_balance || 0) - _coinsToRedeem)
      await db.from('menu_customers').update({ coins_balance: newBal }).eq('id', S.customer.id)
      await db.from('coin_transactions').insert({
        customer_id: S.customer.id, restaurant_id: S.restaurant.id,
        type: 'redeem', amount: -_coinsToRedeem, order_id: orderId,
        note: `استخدام في طلب ${orderNumber}`
      })
      S.customer.coins_balance = newBal
    }

    // خصم رصيد المحفظة النقدي المستخدم
    if (walletAmountUsed > 0 && S.customer) {
      const newWalletBal = Math.max(0, Number(S.customer.wallet_balance || 0) - walletAmountUsed)
      await db.from('menu_customers').update({ wallet_balance: newWalletBal }).eq('id', S.customer.id)
      await db.from('coin_transactions').insert({
        customer_id: S.customer.id, restaurant_id: S.restaurant.id,
        type: 'wallet_redeem', amount: -walletAmountUsed, order_id: orderId,
        note: `استخدام رصيد المحفظة (نقدي) في طلب ${orderNumber}`
      })
      S.customer.wallet_balance = newWalletBal
    }

    // تحديث عداد الكود المستخدم
    if (_appliedCode) {
      const { data: codeRow } = await db.from('discount_codes').select('used_count').eq('id', _appliedCode).single()
      if (codeRow) await db.from('discount_codes').update({ used_count: (codeRow.used_count || 0) + 1 }).eq('id', _appliedCode)
    }

    // ملحوظة مهمة: كوينز هدية الشراء (الولاء) ما بتتمنحش هنا وقت إرسال الطلب —
    // بتتمنح فقط لما الطلب يوصل فعلاً ويتأكد استلامه (راجع confirmOrderReceipt / startAutoConfirmTimer أسفل).
    // ده بيمنع استفادة العميل بالكوينز لو لغى الطلب أو المطعم لغاه بعد القبول.
  } catch(e) {
    btn.style.opacity = '1'
    btn.innerHTML = `<span>⚠️ ${e.message || 'خطأ غير معروف'}</span>`
    setTimeout(resetBtn, 5000)
    return
  }

  clearCart(); updateCartUI(); closeCartSheet()
  ;['order-name', 'order-phone', 'order-address', 'order-location', 'order-note', 'table-number-input', 'cart-discount-code']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  document.getElementById('order-location-lat').value = ''
  document.getElementById('order-location-lng').value = ''
  const coinsInput = document.getElementById('cart-coins-input'); if (coinsInput) coinsInput.value = ''
  const walletInput = document.getElementById('cart-wallet-input'); if (walletInput) walletInput.value = ''
  const walletPreview = document.getElementById('cart-wallet-preview'); if (walletPreview) walletPreview.style.display = 'none'
  document.getElementById('cart-discount-msg').style.display = 'none'
  _appliedDiscount = 0; _appliedCode = null; _coinsToRedeem = 0; _walletToUse = 0
  resetBtn()
  showOrderSuccess(orderNumber, orderId, finalTotal, deliveryFee)
  trackOrderStatus(orderId)
}

// ── ORDER STATUS TRACKING (live) ────────────────────────────────────────
let _orderTrackChannel = null
let _orderDelayTimeout  = null
const ORDER_DELAY_WARNING_SECONDS = 300 // 5 دقائق بدون استجابة من المطعم = تنبيه للعميل

function trackOrderStatus(orderId) {
  if (_orderTrackChannel) { db.removeChannel(_orderTrackChannel); _orderTrackChannel = null }
  _orderTrackChannel = db
    .channel('order-status-' + orderId)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, p => handleOrderStatusChange(p.new))
    .subscribe()

  clearTimeout(_orderDelayTimeout)
  _orderDelayTimeout = setTimeout(() => showOrderDelayWarning(), ORDER_DELAY_WARNING_SECONDS * 1000)
}
// تنبيه العميل لو الطلب فضل بدون استجابة من المطعم لفترة غير طبيعية —
// لا يعني هذا فقدان الطلب، فقط تنبيه بوجود تأخير مع تأكيد أن الطلب لم يُفقد
function showOrderDelayWarning() {
  const msgEl = document.getElementById('success-sub-msg')
  if (!msgEl || msgEl.dataset.state !== 'pending') return // الطلب أُكِّد أو اترفض بالفعل، التحذير غير مطلوب
  const warnEl = document.getElementById('success-delay-warning')
  if (warnEl) warnEl.classList.remove('hidden')
}
function handleOrderStatusChange(order) {
  if (['confirmed', 'ready', 'delivering', 'delivered', 'cancelled'].includes(order.status)) {
    if (isOrderMinimized(order.id)) {
      // الطلب مُصغّر بمعرفة العميل: منفرضش المودال، التحديث هيظهر له لما يفتح "طلباتي"
      if (['delivered', 'cancelled'].includes(order.status) && _orderTrackChannel) {
        db.removeChannel(_orderTrackChannel); _orderTrackChannel = null
      }
      return
    }
    updateSuccessModalState(order.status, order.cancel_reason, order)
  }
}

// ── MINIMIZE / RESTORE التتبع ────────────────────────────────────────
// طلب مُصغّر = العميل ضغط (−)؛ بطاقة التتبع متبقاش بتفرض نفسها تلقائي،
// والرجوع ليها يبقى فقط من صفحة "طلباتي" (active-order-tracker أو تفاصيل الطلب)
function getMinimizedOrders() {
  try { return JSON.parse(localStorage.getItem('minimized_orders') || '[]') } catch(e) { return [] }
}
function isOrderMinimized(orderId) { return getMinimizedOrders().includes(orderId) }
function setOrderMinimized(orderId, minimized) {
  const list = getMinimizedOrders().filter(id => id !== orderId)
  if (minimized) list.push(orderId)
  try { localStorage.setItem('minimized_orders', JSON.stringify(list)) } catch(e) {}
}
function minimizeSuccessModal() {
  const orderId = document.getElementById('order-success-modal').dataset.orderId
  if (orderId) setOrderMinimized(orderId, true)
  closeSuccessModal()
}
// إعادة فتح بطاقة التتبع يدويًا من صفحة طلباتي (بتجيب أحدث حالة من الداتابيز أولاً)
async function reopenOrderTracking(orderId) {
  if (!orderId) return
  setOrderMinimized(orderId, false)
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).single()
  if (!order) return
  document.getElementById('order-success-modal').dataset.orderId = orderId
  document.getElementById('success-order-num').textContent = `رقم الطلب: ${order.order_number || ''}`
  document.getElementById('order-success-modal').classList.remove('hidden')
  document.documentElement.style.overflow = 'hidden'
  pushModal('success', closeSuccessModal)
  setSuccessModalVisual(order.status, order.cancel_reason, order)
  if (!['delivered', 'cancelled'].includes(order.status)) trackOrderStatus(orderId)
}

// ── VIEW DETAILS WHILE TRACKING ─────────────────────────────────────────
// يفتح شيت تفاصيل الطلب الكامل (نفس المستخدم في صفحة "طلباتي") من فوق مودال التتبع،
// عشان العميل يتأكد من كل بيانات طلبه (المنتجات، العنوان، رقم التواصل...) لو حسّ إن في خطأ.
// لازم نقفل مودال التتبع الأول (closeSuccessModal) قبل ما نفتح الشيت، وإلا الاتنين
// (كل واحد fixed inset:0 بخلفية شبه شفافة) بيترسموا فوق بعض ويطلع تداخل/تقطيع في النص.
// بنسجّل إن التتبع كان مفتوح عشان نرجّعه تلقائي لما العميل يقفل شيت التفاصيل.
function viewTrackedOrderDetail() {
  const orderId = document.getElementById('order-success-modal').dataset.orderId
  if (!orderId) return
  closeSuccessModal()
  _reopenTrackingAfterDetail = orderId
  openOrderDetail(orderId)
}
let _reopenTrackingAfterDetail = null

// ── CONTACT RESTAURANT ABOUT AN ORDER ──────────────────────────────────
// يفتح واتساب المطعم مباشرة برسالة جاهزة تتضمن رقم الطلب — يُستخدم من مودال التتبع
// (خصوصاً وقت تأخير المطعم في الرد) ومن شيت تفاصيل الطلب في صفحة "طلباتي"
function contactRestaurantAboutOrder(orderNumber) {
  const num = orderNumber || document.getElementById('success-order-num').textContent.replace('رقم الطلب:', '').trim()
  const phone = normalizeWhatsAppNumber(S.restaurant?.whatsapp)
  if (!phone) { showToast('رقم تواصل المطعم غير متوفر حالياً'); return }
  const msg = encodeURIComponent(`السلام عليكم، بخصوص طلبي${num ? ' (' + num + ')' : ''} — `)
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
}

// ── CANCEL ORDER BY CUSTOMER ─────────────────────────────────────────
// قاعدة: قبل قبول التاجر (pending) الإلغاء ممنوع أول 10 دقايق (فرصة عادلة للمطعم يقبل الطلب)،
// وبعد 10 دقايق من غير قبول، يتاح الإلغاء للعميل تلقائيًا.
// بعد القبول (confirmed) فيه مهلة دقيقتين بالظبط من وقت القبول، وبعدها يُمنع الإلغاء نهائيًا.
const CANCEL_GRACE_SECONDS = 120
const PENDING_CANCEL_WAIT_SECONDS = 600 // 10 دقايق
let _cancelGraceInterval  = null
let _lateCancelInterval   = null
let _pendingCancelTimeout = null

function showCancelButton(visible, lateMode) {
  const btn = document.getElementById('cancel-order-btn')
  const countdownEl = document.getElementById('cancel-order-countdown')
  if (!btn) return
  btn.classList.toggle('hidden', !visible)
  if (visible) {
    btn.dataset.late = lateMode ? '1' : ''
    btn.textContent = lateMode ? '❌ إلغاء الطلب — تأخر عن الوقت المتوقع' : '❌ إلغاء الطلب'
  }
  if ((!visible || lateMode) && countdownEl) countdownEl.classList.add('hidden')
}

// يمنع الإلغاء أول 10 دقايق من وقت إنشاء الطلب، ثم يتيحه تلقائيًا لو المطعم لسه مقبلش
function startPendingCancelWatch(createdAt) {
  clearTimeout(_pendingCancelTimeout)
  const startMs   = createdAt ? new Date(createdAt).getTime() : Date.now()
  const remaining = PENDING_CANCEL_WAIT_SECONDS - (Date.now() - startMs) / 1000
  if (remaining <= 0) { showCancelButton(true); return }
  showCancelButton(false)
  _pendingCancelTimeout = setTimeout(() => showCancelButton(true), remaining * 1000)
}

function startCancelGracePeriod(confirmedAt) {
  clearInterval(_cancelGraceInterval)
  if (!confirmedAt) { showCancelButton(false); return } // مفيش وقت قبول معروف، أمان: امنع الإلغاء
  const countdownEl = document.getElementById('cancel-order-countdown')
  const tick = () => {
    const elapsedSec = (Date.now() - new Date(confirmedAt).getTime()) / 1000
    const remaining = Math.ceil(CANCEL_GRACE_SECONDS - elapsedSec)
    if (remaining <= 0) {
      clearInterval(_cancelGraceInterval)
      showCancelButton(false)
      return
    }
    showCancelButton(true)
    if (countdownEl) {
      countdownEl.classList.remove('hidden')
      const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
      const ss = String(remaining % 60).padStart(2, '0')
      countdownEl.textContent = `⏱ تقدر تلغي خلال ${mm}:${ss}`
    }
  }
  tick()
  _cancelGraceInterval = setInterval(tick, 1000)
}

async function cancelOrderByCustomer() {
  const orderId = document.getElementById('order-success-modal').dataset.orderId
  if (!orderId) return
  showConfirmSheet(
    'إلغاء الطلب',
    '<p style="font-size:13px;color:#888;line-height:1.6">هل أنت متأكد من إلغاء الطلب؟ لا يمكن التراجع عن هذا القرار.</p>',
    () => doCancelOrder(orderId),
    'نعم، إلغاء الطلب'
  )
}
async function doCancelOrder(orderId) {
  const btn = document.getElementById('cancel-order-btn')
  const isLate = btn?.dataset.late === '1'
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الإلغاء...' }
  if (isLate) {
    const ok = await performLateCancel(orderId)
    if (btn) { btn.disabled = false }
    if (!ok) { showCancelButton(true, true); return }
    clearInterval(_cancelGraceInterval); clearInterval(_lateCancelInterval)
    setSuccessModalVisual('cancelled', 'تم الإلغاء بواسطة العميل بسبب تأخر الطلب عن الوقت المتوقع')
    if (_orderTrackChannel) { db.removeChannel(_orderTrackChannel); _orderTrackChannel = null }
    return
  }
  const { data: cancelled, error } = await db.from('orders')
    .update({ status: 'cancelled', cancel_reason: 'تم الإلغاء بواسطة العميل', refunded_at: new Date().toISOString() })
    .eq('id', orderId)
    .in('status', ['pending', 'confirmed']) // حماية إضافية: منع الإلغاء لو الحالة تخطّت confirmed فعليًا على السيرفر
    .select('id, customer_id, restaurant_id, wallet_amount_used, coins_redeemed, loyalty_coins_earned')
    .maybeSingle()
  if (btn) { btn.disabled = false; btn.textContent = '❌ إلغاء الطلب' }
  if (error || !cancelled) { showToast('تعذّر إلغاء الطلب، حاول تاني'); return }
  clearInterval(_cancelGraceInterval)
  const refund = await refundOrderPayment(cancelled)
  const refundMsg = refundToastMessage(refund)
  if (refundMsg) showToast(refundMsg)
  setSuccessModalVisual('cancelled', 'تم الإلغاء بواسطة العميل')
  if (_orderTrackChannel) { db.removeChannel(_orderTrackChannel); _orderTrackChannel = null }
}

// ── استرجاع رصيد المحفظة والكوينز المستخدمة في الطلب عند إلغائه ────────
// بيتنفّذ من أي مسار إلغاء (العميل نفسه، أو رفض/إلغاء التاجر من الداشبورد).
// الحماية من الاسترجاع المزدوج بتيجي من إن تحديث status لـ 'cancelled' نفسه
// بيبقى مسموح مرة واحدة بس (بعد كده الطلب مش هيقع في شرط .in('status', [...]) تاني).
async function refundOrderPayment(order) {
  if (!order?.customer_id) return null
  const walletAmt = Number(order.wallet_amount_used || 0)
  const coinsAmt  = Number(order.coins_redeemed || 0)
  // كوينز الولاء تتمنح فقط لحظة تأكيد الاستلام (بعد delivering)، وطلب زي ده أصلاً مايبقاش قابل للإلغاء
  // في المرحلة دي — لكن ده احتياط إضافي (طبقة حماية ثانية) لو حصل ظرف استثنائي وكانت اتمنحت فعلاً
  const loyaltyAmt = Number(order.loyalty_coins_earned || 0)
  if (walletAmt <= 0 && coinsAmt <= 0 && loyaltyAmt <= 0) return null

  const { data: cust } = await db.from('menu_customers')
    .select('wallet_balance, coins_balance').eq('id', order.customer_id).single()
  if (!cust) return null

  const updates = {}
  if (walletAmt > 0) updates.wallet_balance = Number(cust.wallet_balance || 0) + walletAmt
  if (coinsAmt > 0 || loyaltyAmt > 0) updates.coins_balance = Math.max(0, (cust.coins_balance || 0) + coinsAmt - loyaltyAmt)
  await db.from('menu_customers').update(updates).eq('id', order.customer_id)

  const txs = []
  if (walletAmt > 0) txs.push({
    customer_id: order.customer_id, restaurant_id: order.restaurant_id,
    type: 'wallet_refund', amount: Math.round(walletAmt), order_id: order.id,
    note: 'استرجاع رصيد المحفظة بعد إلغاء الطلب'
  })
  if (coinsAmt > 0) txs.push({
    customer_id: order.customer_id, restaurant_id: order.restaurant_id,
    type: 'refund', amount: coinsAmt, order_id: order.id,
    note: 'استرجاع كوينز بعد إلغاء الطلب'
  })
  if (loyaltyAmt > 0) txs.push({
    customer_id: order.customer_id, restaurant_id: order.restaurant_id,
    type: 'loyalty_reversed', amount: -loyaltyAmt, order_id: order.id,
    note: 'سحب كوينز هدية الشراء بعد إلغاء الطلب'
  })
  if (txs.length) await db.from('coin_transactions').insert(txs)
  // نصفّر loyalty_coins_earned في الطلب نفسه عشان لو الدالة اتنادت تاني بالغلط ما يتسحبش مرتين
  if (loyaltyAmt > 0) await db.from('orders').update({ loyalty_coins_earned: 0 }).eq('id', order.id)

  // لو ده حساب العميل الحالي، حدّث الحالة محليًا عشان يشوف رصيده الجديد فورًا
  if (S.customer && S.customer.id === order.customer_id) {
    if (walletAmt > 0) S.customer.wallet_balance = updates.wallet_balance
    if (coinsAmt > 0 || loyaltyAmt > 0) S.customer.coins_balance = updates.coins_balance
    updateWalletBadge()
  }

  return { walletAmt, coinsAmt, loyaltyAmt }
}

// رسالة قصيرة تتعرض للعميل بعد الإلغاء توضّح إن المبلغ رجع لمحفظته
function refundToastMessage(refund) {
  if (!refund) return null
  const parts = []
  if (refund.walletAmt > 0) parts.push(`${refund.walletAmt.toFixed(2)} ج.م لرصيد المحفظة`)
  if (refund.coinsAmt  > 0) parts.push(`${refund.coinsAmt.toLocaleString('en-US')} كوين`)
  return parts.length ? `💰 تم استرجاع ${parts.join(' و')}` : null
}

// ── LATE CANCELLATION (تأخر الطلب عن وقت التحضير المقدر + ساعة) ─────────
// حتى لو انتهت مهلة الإلغاء العادية (دقيقتين بعد القبول)، لو الطلب فضل عالق
// (وقت التحضير المقدر + ساعة كاملة من وقت قبول التاجر) العميل يرجع له حق الإلغاء تاني —
// حماية له من انتظار بلا نهاية لو المطعم اتأخر جداً أو نسي الطلب.
const LATE_CANCEL_EXTRA_MINUTES = 60

function lateCancelDeadline(order) {
  if (!order?.confirmed_at) return null
  const prepMin = order.estimated_prep_minutes || 30
  return new Date(order.confirmed_at).getTime() + (prepMin + LATE_CANCEL_EXTRA_MINUTES) * 60000
}
function isOrderLateEnoughToCancel(order) {
  if (!order || !['confirmed', 'ready', 'delivering'].includes(order.status)) return false
  const deadline = lateCancelDeadline(order)
  return deadline !== null && Date.now() >= deadline
}
// يُستدعى مع كل تحديث لحالة مودال التتبع؛ بيراقب لحد ما ميعاد "التأخر" يحين ويظهر زر الإلغاء تلقائياً
function startLateCancelWatch(order) {
  clearInterval(_lateCancelInterval)
  if (!order || !['confirmed', 'ready', 'delivering'].includes(order.status)) return
  const deadline = lateCancelDeadline(order)
  if (deadline === null) return
  const check = () => {
    if (Date.now() >= deadline) {
      clearInterval(_lateCancelInterval)
      showCancelButton(true, true)
    }
  }
  check()
  _lateCancelInterval = setInterval(check, 30000)
}
// إلغاء فعلي بعد تأخر الطلب — بيتأكد من confirmed_at الحقيقي على السيرفر قبل التنفيذ
// (مش بس ساعة جهاز العميل) عشان محدش يلغي طلب لسه في وقته المسموح بمجرد تغيير ساعة موبايله
async function performLateCancel(orderId) {
  const { data: ord } = await db.from('orders').select('status, confirmed_at, estimated_prep_minutes').eq('id', orderId).single()
  const deadline = lateCancelDeadline(ord)
  if (!ord || !['confirmed', 'ready', 'delivering'].includes(ord.status) || deadline === null || Date.now() < deadline) {
    showToast('لسه الوقت المسموح بإلغاء الطلب لم يحن')
    return false
  }
  const { data: cancelled, error } = await db.from('orders')
    .update({ status: 'cancelled', cancel_reason: 'تم الإلغاء بواسطة العميل بسبب تأخر الطلب عن الوقت المتوقع', refunded_at: new Date().toISOString() })
    .eq('id', orderId)
    .in('status', ['confirmed', 'ready', 'delivering'])
    .select('id, customer_id, restaurant_id, wallet_amount_used, coins_redeemed, loyalty_coins_earned')
    .maybeSingle()
  if (error || !cancelled) { showToast('تعذّر إلغاء الطلب، حاول تاني'); return false }
  const refund = await refundOrderPayment(cancelled)
  const refundMsg = refundToastMessage(refund)
  showToast(refundMsg ? `❌ تم إلغاء الطلب — ${refundMsg}` : '❌ تم إلغاء الطلب')
  return true
}

function showOrderSuccess(orderNumber, orderId, total, deliveryFee) {
  document.getElementById('success-order-num').textContent = `رقم الطلب: ${orderNumber}`
  // عرض رسوم التوصيل في مودال النجاح
  const dfEl = document.getElementById('success-delivery-fee')
  if (dfEl) {
    if (deliveryFee > 0) {
      dfEl.textContent = `🛵 رسوم التوصيل: ${fmt(deliveryFee)} — الإجمالي: ${fmt(total)}`
      dfEl.style.display = 'block'
    } else dfEl.style.display = 'none'
  }
  document.getElementById('order-success-modal').dataset.orderId = orderId
  setSuccessModalVisual('pending')
  document.getElementById('order-success-modal').classList.remove('hidden')
  document.documentElement.style.overflow = 'hidden'
  pushModal('success', closeSuccessModal)
}
function updateSuccessModalState(state, cancelReason, order) {
  // لو المستخدم قفل المودال بالفعل، نفتحه تاني عشان يشوف نتيجة طلبه أكيد
  document.getElementById('order-success-modal').classList.remove('hidden')
  document.documentElement.style.overflow = 'hidden'
  setSuccessModalVisual(state, cancelReason, order)
  // الاشتراك يستمر طوال مراحل التتبع، ويُلغى فقط عند الوصول لحالة نهائية (تم التسليم أو الرفض)
  if ((state === 'delivered' || state === 'cancelled') && _orderTrackChannel) {
    db.removeChannel(_orderTrackChannel); _orderTrackChannel = null
  }
}
function setSuccessModalVisual(state, cancelReason, order) {
  const iconEl  = document.querySelector('#order-success-modal .success-icon')
  const titleEl = document.getElementById('success-title')
  const msgEl   = document.getElementById('success-sub-msg')
  const reasonEl= document.getElementById('success-cancel-reason')
  const stepsEl = document.getElementById('success-tracking-steps')
  const delayEl = document.getElementById('success-delay-warning')
  reasonEl.classList.add('hidden')
  stepsEl.classList.add('hidden')
  msgEl.dataset.state = state
  showCancelButton(false); clearTimeout(_cancelGraceInterval)
  if (state !== 'pending') { delayEl.classList.add('hidden'); clearTimeout(_orderDelayTimeout); clearTimeout(_pendingCancelTimeout) }

  const TRACKING_STATES = ['confirmed', 'ready', 'delivering', 'delivered']
  if (TRACKING_STATES.includes(state)) {
    stepsEl.classList.remove('hidden')
    stepsEl.style.display = 'flex'
    renderTrackingSteps(state)
  }

  if (state === 'pending') {
    iconEl.textContent = '⏳'
    titleEl.textContent = 'تم استلام طلبك!'
    msgEl.textContent = '🔔 في انتظار تأكيد المطعم... (تقدر تلغي الطلب لو لم يستجيب المطعم خلال 10 دقايق)'
    msgEl.style.color = '#aaa'
    startPendingCancelWatch(order?.created_at)
  } else if (state === 'confirmed') {
    iconEl.textContent = '👨‍🍳'
    titleEl.textContent = 'تم تأكيد طلبك!'
    const prepMin = order?.estimated_prep_minutes
    msgEl.textContent = prepMin ? `جاري التجهيز — تقريباً ${prepMin} دقيقة 🎉` : 'المطعم بيجهز طلبك دلوقتي 🎉'
    msgEl.style.color = '#22c55e'
    startCancelGracePeriod(order?.confirmed_at) // بعد القبول: مهلة دقيقتين فقط للإلغاء
  } else if (state === 'ready') {
    iconEl.textContent = '📦'
    titleEl.textContent = 'طلبك جاهز!'
    msgEl.textContent = 'في انتظار استلام مندوب التوصيل'
    msgEl.style.color = '#a855f7'
  } else if (state === 'delivering') {
    iconEl.textContent = '🛵'
    titleEl.textContent = 'الطلب في الطريق إليك!'
    msgEl.textContent = 'المندوب في الطريق الآن'
    msgEl.style.color = '#6366f1'
    document.getElementById('confirm-receipt-btn').classList.remove('hidden')
    startAutoConfirmTimer(order?.id)
  } else if (state === 'delivered') {
    iconEl.textContent = '🎉'
    titleEl.textContent = 'تم التسليم!'
    msgEl.textContent = 'بالعافية، نتمنى أن تكون استمتعت بطلبك'
    msgEl.style.color = '#22c55e'
    document.getElementById('confirm-receipt-btn').classList.add('hidden')
    clearTimeout(_autoConfirmTimeout)
  } else if (state === 'cancelled') {
    const cancelledByCustomer = !!(cancelReason && cancelReason.includes('بواسطة العميل'))
    iconEl.textContent = cancelledByCustomer ? '↩️' : '❌'
    titleEl.textContent = cancelledByCustomer ? 'تم إلغاء طلبك' : 'تعذّر قبول الطلب'
    msgEl.textContent   = cancelledByCustomer ? 'تم إلغاء الطلب بنجاح بناءً على طلبك' : 'للأسف المطعم لم يستطع تنفيذ طلبك'
    msgEl.style.color = '#ef4444'
    if (cancelReason) {
      reasonEl.textContent = `السبب: ${cancelReason}`
      reasonEl.classList.remove('hidden')
    }
  } else {
    document.getElementById('confirm-receipt-btn').classList.add('hidden')
  }

  // يُشغَّل آخر حاجة عشان لو الطلب متأخر فعلاً، زر الإلغاء يفضل ظاهر
  // حتى لو مهلة الدقيقتين العادية خلصت أو مبتنفّعش أصلاً في حالة ready/delivering
  if (['confirmed', 'ready', 'delivering'].includes(state)) startLateCancelWatch(order)
  else clearInterval(_lateCancelInterval)
}
// ── تحويل الطلب لحالة "تم التسليم" + منح كوينز هدية الشراء لحظة الاستلام فقط ──
// الشرط .eq('status', 'delivering') بيضمن إن التحديث والمنح يحصلوا مرة واحدة بالظبط
// حتى لو العميل ضغط الزر يدوياً في نفس لحظة تشغيل التايمر التلقائي (حماية من الـ double-award)
async function markOrderDeliveredAndAward(orderId) {
  if (!orderId) return
  const { data: order, error } = await db.from('orders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'delivering')
    .select('id, items, total, customer_id')
    .maybeSingle()
  if (error || !order) return // اتحدّثت قبل كده (double-fire) أو الطلب مش في حالة delivering فعلاً
  await awardLoyaltyAndWelcome(order.id, order.items, order.customer_id, order.total)
}
// تأكيد استلام يدوي من العميل (زر "تم استلام طلبي")
async function confirmOrderReceipt() {
  const orderId = document.getElementById('order-success-modal').dataset.orderId
  if (!orderId) return
  document.getElementById('confirm-receipt-btn').classList.add('hidden')
  await markOrderDeliveredAndAward(orderId)
}
// تأكيد استلام تلقائي لو العميل لم يضغط الزر بنفسه بعد مدة معقولة من بدء التوصيل
let _autoConfirmTimeout = null
const AUTO_CONFIRM_MINUTES_AFTER_DELIVERING = 30
function startAutoConfirmTimer(orderId) {
  clearTimeout(_autoConfirmTimeout)
  if (!orderId) return
  _autoConfirmTimeout = setTimeout(() => { markOrderDeliveredAndAward(orderId) }, AUTO_CONFIRM_MINUTES_AFTER_DELIVERING * 60 * 1000)
}
// يعرض شريط مراحل بصري (4 نقاط متصلة) يوضّح موقع الطلب الحالي ضمن رحلة التجهيز والتوصيل
function renderTrackingSteps(currentState) {
  const steps = [
    { key: 'confirmed',  icon: '👨‍🍳', label: 'التجهيز' },
    { key: 'ready',      icon: '📦',   label: 'جاهز' },
    { key: 'delivering', icon: '🛵',   label: 'التوصيل' },
    { key: 'delivered',  icon: '🎉',   label: 'التسليم' }
  ]
  const currentIdx = steps.findIndex(s => s.key === currentState)
  const el = document.getElementById('success-tracking-steps')
  el.innerHTML = steps.map((s, i) => {
    const isDone   = i < currentIdx
    const isActive = i === currentIdx
    const color = isDone || isActive ? 'var(--brand)' : '#e5e5e5'
    const textColor = isDone || isActive ? '#1a1a1a' : '#bbb'
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1">
        <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;${isActive ? 'box-shadow:0 0 0 4px ' + color + '33' : ''}">${isDone || isActive ? s.icon : ''}</div>
        <p style="font-size:10px;font-weight:700;color:${textColor};margin-top:4px">${s.label}</p>
      </div>
      ${i < steps.length - 1 ? `<div style="flex:0.5;height:2px;background:${i < currentIdx ? 'var(--brand)' : '#e5e5e5'};margin-top:16px"></div>` : ''}
    `
  }).join('')
}
function closeSuccessModal(fromPopstate) {
  document.getElementById('order-success-modal').classList.add('hidden')
  document.documentElement.style.overflow = ''
  if (!fromPopstate) popModalSilently('success')
}

// ── DISCOUNT CODE ──────────────────────────────────────────────────────
async function applyDiscountCode() {
  const code  = document.getElementById('cart-discount-code').value.trim().toUpperCase()
  const msgEl = document.getElementById('cart-discount-msg')
  if (!code) return
  msgEl.style.display = 'block'
  msgEl.style.color = '#aaa'; msgEl.textContent = 'جاري التحقق...'

  const now = new Date().toISOString()
  const { data } = await db.from('discount_codes')
    .select('*')
    .eq('restaurant_id', S.restaurant.id)
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (!data) { msgEl.style.color = '#ef4444'; msgEl.textContent = '❌ الكود غير صحيح أو منتهي'; return }
  if (data.valid_from && now < data.valid_from) { msgEl.style.color = '#ef4444'; msgEl.textContent = '❌ الكود لم يبدأ بعد'; return }
  if (data.valid_until && now > data.valid_until) { msgEl.style.color = '#ef4444'; msgEl.textContent = '❌ الكود انتهت صلاحيته'; return }
  if (data.max_uses !== null && data.used_count >= data.max_uses) { msgEl.style.color = '#ef4444'; msgEl.textContent = '❌ الكود استُنفد'; return }
  // كود موجّه لعملاء محددين أو لأعلى/أدنى نسبة شراء — غير عام، لازم العميل يكون داخل القائمة المحفوظة وقت إنشاء الكود
  if (data.target_type && data.target_type !== 'public') {
    const eligible = S.customer && Array.isArray(data.target_customer_ids) && data.target_customer_ids.includes(S.customer.id)
    if (!eligible) { msgEl.style.color = '#ef4444'; msgEl.textContent = '❌ هذا الكود غير متاح لحسابك'; return }
  }

  _appliedDiscount = Number(data.discount_egp)
  _appliedCode     = data.id
  msgEl.style.color = '#22c55e'
  msgEl.textContent = `✅ تم تطبيق خصم ${_appliedDiscount.toFixed(2)} ج.م`
  renderCartItems()
}

// ── COINS IN CART ──────────────────────────────────────────────────────
// قرار عمل: الكوينز مش قابلة للصرف المباشر كخصم في الطلبات إطلاقًا.
// الطريقة الوحيدة لصرف الكوينز هي تحويلها لرصيد نقدي في صفحة "محفظتي" (convertCoinsToBalance
// في page-wallet.js) بعد الوصول للحد الأدنى، وبعدها تُستخدم كرصيد محفظة عادي هنا في السلة.
// الدوال دي بقت stubs فاضية (بدل الحذف الكامل) عشان أي استدعاء قديم متبقي في أي مكان
// ما يعملش خطأ، ولضمان إن _coinsToRedeem تفضل صفر دايمًا مهما حصل.
function updateCoinsRowInCart() {
  const row = document.getElementById('cart-coins-row')
  if (row) row.style.display = 'none'
  _coinsToRedeem = 0
}

function updateCoinsDiscount() { _coinsToRedeem = 0 }

function useMaxCoins() { _coinsToRedeem = 0 }

// ── WALLET BALANCE IN CART (رصيد نقدي) ──────────────────────────────────
// المتاح فعلياً لاستخدام رصيد المحفظة = أقل قيمة بين (رصيد المحفظة) و (المتبقي المطلوب دفعه بعد خصم الكود والكوينز)
function _walletRemainingPayable() {
  const coinsPerEgp = S.restaurant?.coins_per_egp ?? 1000
  const coinsDiscount = _coinsToRedeem > 0 ? _coinsToRedeem / coinsPerEgp : 0
  const custLat = document.getElementById('order-location-lat')?.value
  const custLng = document.getElementById('order-location-lng')?.value
  const pricePerKm = parseFloat(S.restaurant?.price_per_km) || 0
  let deliveryFee = 0
  if (custLat && custLng && pricePerKm > 0) {
    if (S.branches.length > 0) {
      const result = findNearestBranch(parseFloat(custLat), parseFloat(custLng))
      if (result) deliveryFee = Math.round(result.distanceKm * pricePerKm * 100) / 100
    } else {
      const restLat = parseFloat(S.restaurant?.lat), restLng = parseFloat(S.restaurant?.lng)
      if (!isNaN(restLat) && !isNaN(restLng)) {
        deliveryFee = Math.round(distanceKm(parseFloat(custLat), parseFloat(custLng), restLat, restLng) * pricePerKm * 100) / 100
      }
    }
  }
  return Math.max(0, Math.round((cartTotal() + deliveryFee - _appliedDiscount - coinsDiscount) * 100) / 100)
}
// العميل بيكتب المبلغ اللي يحب يستخدمه بنفسه؛ لو أكبر من رصيده المتاح، نسأله يوافق على استخدام كل المتاح أو نلغي
function updateWalletUse() {
  const input   = document.getElementById('cart-wallet-input')
  const preview = document.getElementById('cart-wallet-preview')
  const balance = Number(S.customer?.wallet_balance || 0)
  let typed = parseFloat(input.value) || 0

  if (typed > balance) {
    const useAll = confirm(`رصيدك في المحفظة ${balance.toFixed(2)} ج.م بس، أقل من اللي كتبته. تحب نستخدم كل الرصيد المتاح (${balance.toFixed(2)} ج.م)؟`)
    typed = useAll ? balance : 0
  }

  const maxPayable = _walletRemainingPayable()
  _walletToUse = Math.max(0, Math.min(typed, balance, maxPayable))
  input.value = _walletToUse > 0 ? _walletToUse : ''

  if (_walletToUse > 0) {
    preview.textContent = `سيتم خصم ${_walletToUse.toFixed(2)} ج.م من رصيد محفظتك`
    preview.style.display = 'block'
  } else {
    preview.style.display = 'none'
  }
  renderCartItems()
}
function useMaxWallet() {
  const balance    = Number(S.customer?.wallet_balance || 0)
  const maxPayable = _walletRemainingPayable()
  _walletToUse = Math.max(0, Math.min(balance, maxPayable))
  document.getElementById('cart-wallet-input').value = _walletToUse > 0 ? _walletToUse : ''
  const preview = document.getElementById('cart-wallet-preview')
  if (_walletToUse > 0) {
    preview.textContent = `سيتم خصم ${_walletToUse.toFixed(2)} ج.م من رصيد محفظتك`
    preview.style.display = 'block'
  } else preview.style.display = 'none'
  renderCartItems()
}

// ── REFERRAL PARAM ON LOAD ──────────────────────────────────────────────
async function handleReferralParam() {
  const ref = new URLSearchParams(location.search).get('ref')
  if (!ref || !S.restaurant) return
  // خزّن كود الإحالة في localStorage لاستخدامه عند التسجيل
  try { localStorage.setItem('pending_ref_' + S.restaurant.id, ref.toUpperCase()) } catch(e) {}
}

function getPendingRef() {
  if (!S.restaurant) return null
  try { return localStorage.getItem('pending_ref_' + S.restaurant.id) || null } catch(e) { return null }
}

function clearPendingRef() {
  if (!S.restaurant) return
  try { localStorage.removeItem('pending_ref_' + S.restaurant.id) } catch(e) {}
}

// ── AWARD LOYALTY COINS AFTER ORDER ────────────────────────────────────
async function awardLoyaltyAndWelcome(orderId, orderItems, customerId, orderTotal) {
  if (!S.restaurant?.loyalty_enabled) return
  if (!customerId) return // طلب زائر بدون حساب — لا يوجد محفظة تُمنح لها كوينز

  let totalLoyalty = 0

  // هدية الشراء: التاجر يختار وضع واحد فقط — لكل منتج، أو لكل 100 ج.م من الفاتورة
  if (S.restaurant.purchase_reward_enabled) {
    const mode = S.restaurant.purchase_reward_mode || 'per_product'
    if (mode === 'per_product') {
      for (const item of (orderItems || [])) {
        if (item.type === 'bundle') continue
        const prod = S.products.find(p => p.id === item.id)
        if (prod?.loyalty_coins > 0) totalLoyalty += prod.loyalty_coins * item.qty
      }
    } else if (mode === 'per_100_egp') {
      const perHundred = S.restaurant.purchase_reward_per_100_egp ?? 500
      totalLoyalty += Math.floor((orderTotal || 0) / 100) * perHundred
    }
  }

  // نجيب بيانات العميل مباشرة من الداتابيز (مش من S.customer في الذاكرة) —
  // الدالة دي ممكن تتنفذ بعد 30 دقيقة من التايمر التلقائي، وقتها الجلسة المحلية ممكن تكون اتقفلت أو اتغيرت
  const { data: cust, error: custErr } = await db.from('menu_customers')
    .select('id, coins_balance, welcome_coins_claimed').eq('id', customerId).single()
  if (custErr || !cust) { console.error('awardLoyaltyAndWelcome: تعذر جلب بيانات العميل', custErr); return }

  let balanceDelta = 0
  const txs = []

  // بونص الترحيب وبونص الإحالة يُمنحان فوراً كرصيد نقدي وقت التسجيل (راجع core.js initCustomerSession)
  // هنا فقط نُعلّم أن العميل استخدم/استلم بونص الترحيب رسمياً عند أول طلب فعلي (لغرض العرض فقط، بلا منح مكرر)
  if (!cust.welcome_coins_claimed) {
    await db.from('menu_customers').update({ welcome_coins_claimed: true }).eq('id', cust.id)
    if (S.customer?.id === cust.id) S.customer.welcome_coins_claimed = true
  }

  // كوينز هدية الشراء
  if (totalLoyalty > 0) {
    txs.push({ customer_id: cust.id, restaurant_id: S.restaurant.id, type: 'loyalty', amount: totalLoyalty, order_id: orderId, note: 'هدية الشراء من الطلب' })
    balanceDelta += totalLoyalty
  }

  // قسيمة الشراء عند الوصول للحد الأدنى المحدد من التاجر
  if (S.restaurant.purchase_voucher_enabled) {
    const minAmount = S.restaurant.purchase_voucher_min_amount ?? 100
    const voucherCoins = S.restaurant.purchase_voucher_coins ?? 5000
    if ((orderTotal || 0) >= minAmount) {
      txs.push({ customer_id: cust.id, restaurant_id: S.restaurant.id, type: 'purchase_voucher', amount: voucherCoins, order_id: orderId, note: `قسيمة شراء — فاتورة ${minAmount}+ ج.م` })
      balanceDelta += voucherCoins
    }
  }

  if (!txs.length) { updateWalletBadge(); return }

  // نسجّل المعاملة في سجل المحفظة الأول — لو فشل التسجيل هنا نوقف تمامًا
  // ولا نلمس رصيد العميل خالص (بدل ما كان بيحصل قبل كده: تحديث الرصيد حتى لو سجل المعاملة فشل بصمت)
  const { error: txErr } = await db.from('coin_transactions').insert(txs)
  if (txErr) { console.error('awardLoyaltyAndWelcome: فشل تسجيل معاملة الكوينز في السجل', txErr); return }

  const newBalance = (cust.coins_balance || 0) + balanceDelta
  const { error: balErr } = await db.from('menu_customers').update({ coins_balance: newBalance }).eq('id', cust.id)
  if (balErr) { console.error('awardLoyaltyAndWelcome: فشل تحديث رصيد الكوينز', balErr); return }
  if (S.customer?.id === cust.id) S.customer.coins_balance = newBalance

  const { error: notifErr } = await db.from('notifications').insert({
    customer_id: cust.id, restaurant_id: S.restaurant.id, order_id: orderId, type: 'coins',
    title: '🪙 كسبت كوينز جديدة!',
    body: `تم إرسال ${balanceDelta.toLocaleString('ar-EG')} كوين هدية على طلبك — شوفها في سجل محفظتك`
  })
  if (notifErr) console.error('awardLoyaltyAndWelcome: فشل إرسال الإشعار', notifErr)
  if (S.customer?.id === cust.id) loadNotifications().catch(() => {})

  // تحديث loyalty_coins_earned في الطلب (يُستخدم لاسترجاع الكوينز لو الطلب اتلغى بطريقة استثنائية)
  if (totalLoyalty > 0) await db.from('orders').update({ loyalty_coins_earned: totalLoyalty }).eq('id', orderId)

  // احتفال بصري + صوت — بس لو العميل لسه فاتح نفس جلسة الطلب على شاشته دلوقتي
  if (S.customer?.id === cust.id && typeof showCelebration === 'function') {
    showCelebration(balanceDelta)
    playSuccessSound()
  }
  updateWalletBadge()
}

