// هذا الملف جزء من تطبيق Monjez Menu — تم تقسيمه من index.html الأصلي

// ── صفحة طلباتك ──────────────────────────────────────────────────────
const ORDER_STEPS = ['pending','confirmed','ready','delivering','delivered']
const ORDER_STATUS = {
  pending:    { label:'استلمنا طلبك', icon:'⏳', color:'#f59e0b', bg:'#fef9c3' },
  confirmed:  { label:'بنحضّر',        icon:'👨‍🍳', color:'#3b82f6', bg:'#eff6ff' },
  ready:      { label:'جاهز للتوصيل', icon:'📦', color:'#8b5cf6', bg:'#f5f3ff' },
  delivering: { label:'في الطريق إليك',icon:'🛵', color:'#6366f1', bg:'#eef2ff' },
  delivered:  { label:'تم التسليم 🎉', icon:'✅', color:'#22c55e', bg:'#f0fdf4' },
  cancelled:  { label:'ملغي',          icon:'❌', color:'#ef4444', bg:'#fff0f0' },
}

async function loadOrdersPage() {
  if (!S.customer) return
  const listEl = document.getElementById('orders-page-list')
  listEl.innerHTML = `<div style="text-align:center;padding:40px 0"><div style="font-size:40px;animation:floatCoin 1s ease-in-out infinite">⏳</div></div>`

  try {
    const { data: orders } = await db.from('orders')
      .select('*')
      .eq('customer_id', S.customer.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (!orders || !orders.length) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:60px 20px">
          <div style="font-size:72px;margin-bottom:16px;animation:floatCoin 3s ease-in-out infinite">🍽️</div>
          <p style="font-size:20px;font-weight:900;color:#1a1a1a;margin-bottom:8px">لسه ما طلبتش!</p>
          <p style="font-size:14px;color:#aaa;margin-bottom:24px;line-height:1.6">اطلب أول وجبة وابدأ تجمع كوينز ومكافآت 🎁</p>
          <button onclick="switchPage('home')" style="background:linear-gradient(135deg,var(--brand),#ff8c38);color:#fff;font-size:15px;font-weight:900;border-radius:18px;padding:15px 32px;border:none;cursor:pointer;font-family:'Rubik',sans-serif;box-shadow:0 4px 20px rgba(255,107,0,0.4)">
            اطلب دلوقتي 🛒
          </button>
        </div>`
      // reset stats
      ;['orders-stat-total','orders-stat-spend','orders-stat-coins'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '0' })
      document.getElementById('active-order-tracker').style.display = 'none'
      return
    }

    // Stats
    const totalSpend = orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+Number(o.total||0),0)
    const totalCoins = orders.reduce((s,o)=>s+Number(o.loyalty_coins_earned||0),0)
    const statTotal = document.getElementById('orders-stat-total')
    const statSpend = document.getElementById('orders-stat-spend')
    const statCoins = document.getElementById('orders-stat-coins')
    if(statTotal) statTotal.textContent = orders.filter(o=>o.status!=='cancelled').length
    if(statSpend) statSpend.textContent = totalSpend.toFixed(0)
    if(statCoins) statCoins.textContent = totalCoins.toLocaleString('ar-EG')

    // Active order tracker
    const active = orders.find(o => !['delivered','cancelled'].includes(o.status))
    renderOrderTracker(active)

    // Orders list
    listEl.innerHTML = orders.map(o => {
      const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || [])
      const preview = items.slice(0,2).map(i => i.name || '').filter(Boolean).join('، ')
      return `<div class="order-card" onclick="openOrderDetail('${o.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <p style="font-size:14px;font-weight:900;color:#1a1a1a;margin-bottom:2px">${o.order_number || '#' + o.id.slice(-6)}</p>
            <p style="font-size:11px;color:#aaa">${new Date(o.created_at).toLocaleDateString('ar-EG',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
          </div>
          <span style="font-size:11px;font-weight:800;color:${st.color};background:${st.bg};border-radius:10px;padding:4px 10px">${st.icon} ${st.label}</span>
        </div>
        ${preview ? `<p style="font-size:12px;color:#888;margin-bottom:10px;line-height:1.5">${preview}${items.length>2?' وأكثر...':''}</p>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f5f5f5;padding-top:10px">
          <span style="font-size:16px;font-weight:900;color:var(--brand)">${Number(o.total||0).toFixed(2)} ج.م</span>
          <div style="display:flex;align-items:center;gap:10px">
            ${o.loyalty_coins_earned ? `<span style="font-size:11px;color:#f97316;font-weight:700">+${Number(o.loyalty_coins_earned).toLocaleString('ar-EG')} 🪙</span>` : ''}
            <svg width="14" height="14" fill="none" stroke="#bbb" stroke-width="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
          </div>
        </div>
      </div>`
    }).join('')

  } catch(e) {
    listEl.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;font-size:13px">خطأ: ${e.message}</p>`
  }
}

function renderOrderTracker(order) {
  const tracker = document.getElementById('active-order-tracker')
  if (!order || !tracker) { if(tracker) tracker.style.display='none'; return }
  tracker.style.display = 'block'
  document.getElementById('tracker-order-num').textContent = order.order_number || '#' + order.id.slice(-6)
  const st = ORDER_STATUS[order.status] || ORDER_STATUS.pending
  const badge = document.getElementById('tracker-status-badge')
  badge.textContent    = st.icon + ' ' + st.label
  badge.style.color    = st.color
  badge.style.background = st.bg

  const stepIdx = ORDER_STEPS.indexOf(order.status)
  const pct     = stepIdx < 0 ? 0 : Math.round((stepIdx / (ORDER_STEPS.length - 1)) * 100)
  const line    = document.getElementById('tracker-progress-line')
  if (line) setTimeout(() => line.style.width = pct + '%', 200)

  ORDER_STEPS.forEach((step, i) => {
    const dot = document.querySelector(`#tstep-${step} .tstep-dot`)
    const lbl = document.querySelector(`#tstep-${step} .tstep-label`)
    if (!dot || !lbl) return
    dot.classList.remove('active','done')
    lbl.classList.remove('active','done')
    if (i < stepIdx)      { dot.classList.add('done');   lbl.classList.add('done') }
    else if (i === stepIdx){ dot.classList.add('active'); lbl.classList.add('active') }
  })

  // ETA
  const etaEl = document.getElementById('tracker-eta')
  if (etaEl) {
    if (order.status === 'confirmed' && order.estimated_prep_minutes) {
      etaEl.textContent = `⏱ وقت التحضير المتوقع: ${order.estimated_prep_minutes} دقيقة`
    } else if (order.status === 'delivering') {
      etaEl.textContent = `🛵 الطلب في الطريق إليك الآن!`
    } else {
      etaEl.textContent = ''
    }
  }

  // صوت عند الوصول
  if (order.status === 'delivered') playSuccessSound()
}

// ── ORDER DETAIL SHEET ────────────────────────────────────────────────
let _allOrdersCache = []

async function openOrderDetail(orderId) {
  const sheet = document.getElementById('order-detail-sheet')
  if (!sheet) return
  sheet.style.display = 'flex'
  document.documentElement.style.overflow = 'hidden'
  const body = document.getElementById('ods-body')
  body.innerHTML = '<p style="text-align:center;padding:30px;color:#bbb">جاري التحميل...</p>'

  try {
    const { data: o } = await db.from('orders').select('*').eq('id', orderId).single()
    if (!o) throw new Error('الطلب غير موجود')
    document.getElementById('ods-num').textContent = o.order_number || '#' + o.id.slice(-6)
    const st    = ORDER_STATUS[o.status] || ORDER_STATUS.pending
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || [])
    body.innerHTML = `
      <div style="display:flex;justify-content:center;margin-bottom:20px">
        <span style="font-size:12px;font-weight:800;color:${st.color};background:${st.bg};border-radius:12px;padding:6px 16px">${st.icon} ${st.label}</span>
      </div>
      <div style="background:#f9f9f9;border-radius:16px;padding:14px;margin-bottom:14px">
        ${items.map(item => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0">
            <div>
              <p style="font-size:13px;font-weight:700;color:#1a1a1a">${item.name || ''}</p>
              ${item.options?.length ? `<p style="font-size:11px;color:#aaa">${item.options.map(op=>op.label||op).join('، ')}</p>` : ''}
            </div>
            <div style="text-align:left">
              <p style="font-size:12px;color:#888">×${item.qty||1}</p>
              <p style="font-size:13px;font-weight:800;color:var(--brand)">${Number((item.price||0)*(item.qty||1)).toFixed(2)} ج.م</p>
            </div>
          </div>`).join('')}
      </div>
      <div style="background:#fff;border-radius:16px;padding:14px;border:1.5px solid #f0f0f0">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:13px;color:#888">المجموع</span><span style="font-size:13px;font-weight:700">${Number(o.subtotal||o.total||0).toFixed(2)} ج.م</span></div>
        ${o.delivery_fee ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:13px;color:#888">التوصيل</span><span style="font-size:13px;font-weight:700">${Number(o.delivery_fee).toFixed(2)} ج.م</span></div>` : ''}
        ${o.coins_discount ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:13px;color:#f97316">خصم الكوينز 🪙</span><span style="font-size:13px;font-weight:700;color:#f97316">-${Number(o.coins_discount).toFixed(2)} ج.م</span></div>` : ''}
        ${o.discount_code_amount ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:13px;color:#22c55e">كود خصم</span><span style="font-size:13px;font-weight:700;color:#22c55e">-${Number(o.discount_code_amount).toFixed(2)} ج.م</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1.5px solid #f0f0f0">
          <span style="font-size:15px;font-weight:900;color:#1a1a1a">الإجمالي</span>
          <span style="font-size:15px;font-weight:900;color:var(--brand)">${Number(o.total||0).toFixed(2)} ج.م</span>
        </div>
        ${o.loyalty_coins_earned ? `<div style="margin-top:10px;background:#fff8f3;border-radius:10px;padding:8px 12px;text-align:center"><span style="font-size:12px;font-weight:800;color:var(--brand)">+${Number(o.loyalty_coins_earned).toLocaleString('ar-EG')} 🪙 كوينز كسبتها من هذا الطلب</span></div>` : ''}
      </div>
      ${o.notes ? `<div style="margin-top:12px;background:#f9f9f9;border-radius:12px;padding:12px 14px"><p style="font-size:12px;color:#888;font-weight:600">ملاحظات: ${o.notes}</p></div>` : ''}
      <button onclick="closeOrderDetail();switchPage('home')" style="width:100%;margin-top:16px;background:linear-gradient(135deg,var(--brand),#ff8c38);color:#fff;font-size:14px;font-weight:900;border-radius:14px;padding:14px;border:none;cursor:pointer;font-family:'Rubik',sans-serif">
        🔄 اطلب مرة تانية
      </button>`
  } catch(e) {
    body.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px">خطأ: ${e.message}</p>`
  }
}

function closeOrderDetail() {
  const sheet = document.getElementById('order-detail-sheet')
  if (sheet) sheet.style.display = 'none'
  document.documentElement.style.overflow = ''
}

