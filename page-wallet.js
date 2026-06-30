// هذا الملف جزء من تطبيق Monjez Menu — تم تقسيمه من index.html الأصلي

// ── WALLET MODAL ──────────────────────────────────────────────────────
async function openWalletModal() {
  if (!S.customer) { switchPage('account'); return }
  // تحديث البيانات
  await loadCustomerProfile()
  const c = S.customer
  const coinsPerEgp = S.restaurant.coins_per_egp ?? 1000
  const minRedeem   = S.restaurant.min_redeem_coins ?? 100000
  document.getElementById('wallet-balance').textContent     = numFmt(c.coins_balance)
  document.getElementById('wallet-balance-egp').textContent = `= ${(c.coins_balance / coinsPerEgp).toFixed(2)} ج.م`
  document.getElementById('wallet-min-redeem-note').textContent = c.coins_balance >= minRedeem
    ? `✅ يمكنك استخدام كوينزك الآن!`
    : `تحتاج ${numFmt(minRedeem - c.coins_balance)} كوين للوصول للحد الأدنى`
  document.getElementById('wallet-ref-code').textContent    = c.referral_code || '---'
  document.getElementById('wallet-ref-reward').textContent  = numFmt(S.restaurant.referral_coins ?? 5000)

  // طلبات العميل
  const { data: orders } = await db.from('orders')
    .select('id,order_number,total,status,created_at,coins_redeemed,loyalty_coins_earned')
    .eq('customer_id', c.id)
    .order('created_at', { ascending: false })
    .limit(10)
  const statusLabel = { pending:'⏳ قيد المراجعة', confirmed:'✅ مؤكد', ready:'📦 جاهز', delivering:'🛵 في الطريق', delivered:'✅ تم التسليم', cancelled:'❌ ملغي' }
  const ordersEl = document.getElementById('wallet-orders-list')
  ordersEl.innerHTML = orders && orders.length ? orders.map(o => `
    <div style="background:#f9f9f9;border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <p style="font-size:13px;font-weight:800;color:#1a1a1a">${o.order_number}</p>
        <p style="font-size:11px;color:#aaa">${new Date(o.created_at).toLocaleDateString('ar-EG-u-nu-latn')}</p>
        ${o.loyalty_coins_earned ? `<p style="font-size:11px;color:#f97316">+${numFmt(o.loyalty_coins_earned)} 🪙</p>` : ''}
      </div>
      <div style="text-align:left">
        <p style="font-size:14px;font-weight:900;color:var(--brand)">${Number(o.total).toFixed(2)} ج.م</p>
        <p style="font-size:11px;color:#888">${statusLabel[o.status] || o.status}</p>
      </div>
    </div>`).join('') : `<p style="font-size:13px;color:#aaa;text-align:center;padding:12px 0">لا توجد طلبات بعد</p>`

  // سجل الكوينز
  const { data: txs } = await db.from('coin_transactions')
    .select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(20)
  const txLabel = { welcome:'🎁 بونص ترحيبي', referral_reward:'🔗 إحالة صديق', loyalty:'⭐ ولاء', redeem:'🛒 استخدام في طلب', gift:'🎀 هدية', discount_code:'🏷️ كود خصم' }
  const txEl = document.getElementById('wallet-tx-list')
  txEl.innerHTML = txs && txs.length ? txs.map(t => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0">
      <div>
        <p style="font-size:13px;font-weight:700;color:#333">${txLabel[t.type] || t.type}</p>
        <p style="font-size:11px;color:#bbb">${new Date(t.created_at).toLocaleDateString('ar-EG-u-nu-latn')} ${t.note ? '· ' + t.note : ''}</p>
      </div>
      <p style="font-size:15px;font-weight:900;color:${t.amount > 0 ? '#22c55e' : '#ef4444'}">${t.amount > 0 ? '+' : ''}${numFmt(t.amount)}</p>
    </div>`).join('') : `<p style="font-size:13px;color:#aaa;text-align:center;padding:12px 0">لا توجد حركات بعد</p>`

  document.getElementById('wallet-modal').classList.remove('hidden')
  _lockBodyScroll()
  pushModal('wallet', closeWalletModal)
}
function closeWalletModal(fromPopstate) {
  document.getElementById('wallet-modal').classList.add('hidden')
  _unlockBodyScroll()
  if (!fromPopstate) popModalSilently('wallet')
}

function copyReferralLink() {
  if (!S.customer?.referral_code || !S.restaurant?.slug) return
  const link = `${location.origin}${location.pathname}?r=${S.restaurant.slug}&ref=${S.customer.referral_code}`
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.querySelector('#wallet-modal button[onclick="copyReferralLink()"]')
    if (btn) { const orig = btn.textContent; btn.textContent = 'تم النسخ ✅'; setTimeout(() => btn.textContent = orig, 2000) }
  })
}


// ── صفحة محفظتك ──────────────────────────────────────────────────────
// ── WALLET PAGE: عرض رصيد الكوينز فوراً من الذاكرة (يمنع فلاش الصفر) ──
function renderWalletBalances(c) {
  if (!c || !S.restaurant) return
  const cpE    = S.restaurant.coins_per_egp ?? 1000
  const minRed = S.restaurant.min_redeem_coins ?? 100000
  const balEl  = document.getElementById('wpage-balance')
  const egpEl  = document.getElementById('wpage-balance-egp')
  const noteEl = document.getElementById('wpage-min-note')
  if (balEl)  { balEl.textContent  = numFmt(c.coins_balance || 0); balEl.style.opacity = '1' }
  if (egpEl)  { egpEl.innerHTML    = `= <span class="ltr-num">${((c.coins_balance||0) / cpE).toFixed(2)}</span> ج.م متاح للشراء`; egpEl.style.opacity = '1' }
  if (noteEl) noteEl.innerHTML = (c.coins_balance || 0) >= minRed
    ? '✅ يمكنك تحويل كوينزك الآن!'
    : `تحتاج <span class="ltr-num">${numFmt(minRed - (c.coins_balance||0))}</span> كوين للحد الأدنى`
}

async function loadWalletPage() {
  if (!S.customer || !S.restaurant) { switchPage('account'); return }

  // اعرض القيم المعروفة فوراً من الذاكرة (من غير انتظار) عشان مفيش فلاش لصفر أو لودينج فاضي
  renderWalletBalances(S.customer)

  await loadCustomerProfile()
  renderWalletBalances(S.customer)
  const c      = S.customer
  const cpE    = S.restaurant.coins_per_egp ?? 1000
  const minRed = S.restaurant.min_redeem_coins ?? 100000

  // رصيد المحفظة النقدي
  const cashEl = document.getElementById('wpage-cash-balance')
  if (cashEl) cashEl.innerHTML = `<span class="ltr-num">${Number(c.wallet_balance || 0).toFixed(2)}</span> ج.م`

  // بطاقة التحويل
  const convertCard = document.getElementById('wpage-convert-card')
  if (convertCard) {
    const canConvert = (c.coins_balance || 0) >= minRed
    convertCard.style.display = canConvert ? 'block' : 'none'
    if (canConvert) {
      const convEl  = document.getElementById('wpage-convertable')
      const egpConv = document.getElementById('wpage-convert-egp')
      if (convEl)  convEl.textContent  = numFmt(c.coins_balance || 0) + ' 🪙'
      if (egpConv) egpConv.textContent = `= ${((c.coins_balance||0) / cpE).toFixed(2)} ج.م`
    }
  }

  // سجل المعاملات
  const txEl = document.getElementById('wpage-tx-list')
  if (!txEl) return
  txEl.innerHTML = '<p style="text-align:center;color:#ccc;padding:20px;font-size:12px">جاري التحميل...</p>'

  try {
    const { data: txs } = await db.from('coin_transactions')
      .select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(20)

    const txTypes = {
      welcome:          { icon:'🎁', label:'بونص الترحيب',    color:'#22c55e' },
      referral_reward:  { icon:'🔗', label:'إحالة صديق',      color:'#3b82f6' },
      loyalty:          { icon:'⭐', label:'كوينز ولاء',       color:'#f59e0b' },
      redeem:           { icon:'🛒', label:'استخدام في طلب',  color:'#ef4444' },
      gift:             { icon:'🎀', label:'هدية من المتجر',   color:'#8b5cf6' },
      discount_code:    { icon:'🏷️', label:'كود خصم',         color:'#06b6d4' },
      profile_complete: { icon:'👤', label:'إكمال الملف',      color:'#10b981' },
      convert:          { icon:'💳', label:'تحويل لرصيد',      color:'#f97316' },
      birthday:         { icon:'🎂', label:'هدية عيد الميلاد', color:'#ec4899' },
      purchase_voucher: { icon:'🎟️', label:'قسيمة شراء',       color:'#a855f7' },
    }

    if (!txs || !txs.length) {
      txEl.innerHTML = `
        <div style="text-align:center;padding:40px 0">
          <div style="font-size:48px;margin-bottom:12px">🪙</div>
          <p style="font-size:14px;font-weight:800;color:#bbb;margin-bottom:8px">لا توجد معاملات بعد</p>
          <button onclick="switchPage('home')" style="background:linear-gradient(135deg,var(--brand),#ff8c38);color:#fff;font-size:13px;font-weight:800;border-radius:12px;padding:10px 24px;border:none;cursor:pointer;font-family:'Rubik',sans-serif">اطلب الآن واكسب كوينز 🛒</button>
        </div>`
      return
    }

    txEl.innerHTML = txs.map(t => {
      const type = txTypes[t.type] || { icon:'🪙', label:t.type, color:'#888' }
      const plus = t.amount > 0
      return `<div class="tx-row">
        <div style="width:40px;height:40px;border-radius:14px;background:${type.color}18;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${type.icon}</div>
        <div style="flex:1">
          <p style="font-size:13px;font-weight:800;color:#1a1a1a;margin-bottom:2px">${type.label}</p>
          <p style="font-size:11px;color:#bbb">${new Date(t.created_at).toLocaleDateString('ar-EG-u-nu-latn',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}${t.note?' · '+t.note:''}</p>
        </div>
        <p style="font-size:16px;font-weight:900;color:${plus?'#22c55e':'#ef4444'}">${plus?'+':''}${numFmt(t.amount)} 🪙</p>
      </div>`
    }).join('')
  } catch(e) {
    txEl.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;font-size:12px">خطأ: ${e.message}</p>`
  }
}

// ── CONVERT COINS TO BALANCE ──────────────────────────────────────────
async function convertCoinsToBalance() {
  if (!S.customer || !S.restaurant) return
  const cpE    = S.restaurant.coins_per_egp ?? 1000
  const coins  = S.customer.coins_balance || 0
  const amount = coins / cpE

  showConfirmSheet(
    'تحويل الكوينز لرصيد 💳',
    `<div style="text-align:center;padding:10px 0">
      <p style="font-size:36px;font-weight:900;color:var(--brand);margin-bottom:4px">${numFmt(coins)} 🪙</p>
      <p style="font-size:16px;color:#888;margin-bottom:16px">= ${amount.toFixed(2)} ج.م</p>
      <div style="background:#f0fdf4;border-radius:14px;padding:14px;border:1.5px solid #bbf7d0">
        <p style="font-size:13px;color:#16a34a;font-weight:700;line-height:1.6">سيتم تحويل الكوينز لرصيد نقدي في محفظتك ويُستخدم للشراء من المتجر فقط 🛒</p>
      </div>
    </div>`,
    async () => {
      try {
        const newBalance = Number(S.customer.wallet_balance || 0) + amount
        await db.from('menu_customers').update({ coins_balance: 0, wallet_balance: newBalance }).eq('id', S.customer.id)
        await db.from('coin_transactions').insert({
          customer_id: S.customer.id, restaurant_id: S.restaurant.id,
          type: 'convert', amount: -coins, note: `تحويل ${numFmt(coins)} كوين = ${amount.toFixed(2)} ج.م`
        })
        S.customer.coins_balance = 0
        S.customer.wallet_balance = newBalance
        playSuccessSound()
        showToast(`✅ تم تحويل ${amount.toFixed(2)} ج.م لمحفظتك!`)
        loadWalletPage()
        updateWalletBadge()
      } catch(e) {
        showToast('خطأ: ' + e.message)
      }
    },
    'تأكيد التحويل'
  )
}

