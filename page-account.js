// هذا الملف جزء من تطبيق Monjez Menu — تم تقسيمه من index.html الأصلي

// ── صفحة حسابك ───────────────────────────────────────────────────────
// ── CONFIRM LOGOUT ────────────────────────────────────────────────────
function confirmLogout() {
  showConfirmSheet('تسجيل الخروج', '<p style="font-size:14px;color:#555;line-height:1.7">هل أنت متأكد من تسجيل الخروج؟<br>ستظل بياناتك محفوظة وتقدر ترجع في أي وقت.</p>', custLogout, 'تسجيل خروج')
}

// ── OPEN EDIT PROFILE ─────────────────────────────────────────────────
function openEditProfile() {
  if (!S.customer) return
  const c = S.customer
  showConfirmSheet('تعديل بياناتي', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:11px;font-weight:800;color:#888;display:block;margin-bottom:5px">الاسم</label>
        <input id="ep-name" type="text" value="${c.name || ''}" placeholder="اسمك"
               style="width:100%;background:#f5f5f5;border:1.5px solid #eee;border-radius:12px;padding:12px 14px;font-size:14px;font-family:'Rubik',sans-serif;outline:none;box-sizing:border-box"
               onfocus="this.style.borderColor='var(--brand)'" onblur="this.style.borderColor='#eee'" />
      </div>
      <div>
        <label style="font-size:11px;font-weight:800;color:#888;display:block;margin-bottom:5px">رقم الموبايل 📱</label>
        <input id="ep-phone" type="tel" value="${c.phone || ''}" placeholder="01xxxxxxxxx"
               style="width:100%;background:#f5f5f5;border:1.5px solid #eee;border-radius:12px;padding:12px 14px;font-size:14px;font-family:'Rubik',sans-serif;outline:none;box-sizing:border-box;direction:ltr;text-align:right"
               onfocus="this.style.borderColor='var(--brand)'" onblur="this.style.borderColor='#eee'" />
      </div>
      <div>
        <label style="font-size:11px;font-weight:800;color:#888;display:block;margin-bottom:5px">تاريخ الميلاد 🎂</label>
        <input id="ep-birthdate" type="date" value="${c.birthdate || ''}"
               style="width:100%;background:#f5f5f5;border:1.5px solid #eee;border-radius:12px;padding:12px 14px;font-size:14px;font-family:'Rubik',sans-serif;outline:none;box-sizing:border-box"
               onfocus="this.style.borderColor='var(--brand)'" onblur="this.style.borderColor='#eee'" />
      </div>
      <div>
        <label style="font-size:11px;font-weight:800;color:#888;display:block;margin-bottom:5px">منطقتك 📍</label>
        <input id="ep-area" type="text" value="${c.area || ''}" placeholder="مثال: المعادي، الشيخ زايد..."
               style="width:100%;background:#f5f5f5;border:1.5px solid #eee;border-radius:12px;padding:12px 14px;font-size:14px;font-family:'Rubik',sans-serif;outline:none;box-sizing:border-box"
               onfocus="this.style.borderColor='var(--brand)'" onblur="this.style.borderColor='#eee'" />
      </div>
      <div>
        <label style="font-size:11px;font-weight:800;color:#888;display:block;margin-bottom:5px">الجنس</label>
        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('ep-gender').value='male';this.style.background='#fff8f3';this.style.borderColor='var(--brand)';document.getElementById('ep-gender-f').style.background='#f5f5f5';document.getElementById('ep-gender-f').style.borderColor='#eee'"
                  style="flex:1;padding:10px;border-radius:12px;border:1.5px solid ${c.gender==='male'?'var(--brand)':'#eee'};background:${c.gender==='male'?'#fff8f3':'#f5f5f5'};font-size:13px;font-weight:700;cursor:pointer;font-family:'Rubik',sans-serif">👨 ذكر</button>
          <button id="ep-gender-f" onclick="document.getElementById('ep-gender').value='female';this.style.background='#fff8f3';this.style.borderColor='var(--brand)';this.previousElementSibling.style.background='#f5f5f5';this.previousElementSibling.style.borderColor='#eee'"
                  style="flex:1;padding:10px;border-radius:12px;border:1.5px solid ${c.gender==='female'?'var(--brand)':'#eee'};background:${c.gender==='female'?'#fff8f3':'#f5f5f5'};font-size:13px;font-weight:700;cursor:pointer;font-family:'Rubik',sans-serif">👩 أنثى</button>
        </div>
        <input type="hidden" id="ep-gender" value="${c.gender || ''}" />
      </div>
      <p id="ep-error" style="display:none;font-size:12px;color:#ef4444;font-weight:700;padding:8px 12px;background:#fff0f0;border-radius:10px"></p>
    </div>`,
    saveEditProfile, 'حفظ التعديلات'
  )
}

async function saveEditProfile() {
  const name      = document.getElementById('ep-name')?.value.trim()
  const phone     = document.getElementById('ep-phone')?.value.trim()
  const birthdate = document.getElementById('ep-birthdate')?.value || null
  const area      = document.getElementById('ep-area')?.value.trim() || null
  const gender    = document.getElementById('ep-gender')?.value || null

  try {
    const updates = { name: name||null, phone: phone||null, birthdate, area, gender }
    const wasEmpty = field => !S.customer[field]

    const { error } = await db.from('menu_customers').update(updates).eq('id', S.customer.id)
    if (error) throw error

    // منح كوينز للحقول الجديدة
    const coinsMap = { phone:1500, birthdate:1500, gender:1000, area:1000 }
    let bonusCoins = 0
    for (const [f, coins] of Object.entries(coinsMap)) {
      if (wasEmpty(f) && updates[f]) {
        bonusCoins += coins
        await db.from('coin_transactions').insert({
          customer_id: S.customer.id, restaurant_id: S.restaurant.id,
          type: 'profile_complete', amount: coins, note: `إكمال: ${f}`
        })
      }
    }
    if (bonusCoins > 0) {
      const newBal = (S.customer.coins_balance || 0) + bonusCoins
      await db.from('menu_customers').update({ coins_balance: newBal }).eq('id', S.customer.id)
      S.customer.coins_balance = newBal
      showToast(`+${numFmt(bonusCoins)} 🪙 كوينز على إكمال ملفك!`)
      playSuccessSound()
    }
    Object.assign(S.customer, updates)
    closeConfirmSheet()
    renderAccountPage()
    updateWalletBadge()
  } catch(e) {
    const errEl = document.getElementById('ep-error')
    if (errEl) { errEl.textContent = 'خطأ: ' + e.message; errEl.style.display = 'block' }
  }
}

// ── UPDATE SETTINGS DISPLAY ────────────────────────────────────────────
function updateSettingsDisplay() {
  if (!S.customer) return
  const c = S.customer
  const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—' }
  s('setting-name',  c.name)
  s('setting-email', c.email)
  s('setting-phone', c.phone)
  s('setting-area',  c.area)
  // referral
  const refEl = document.getElementById('ref-code-display')
  if (refEl) refEl.textContent = c.referral_code || '------'
  const refRew = document.getElementById('ref-reward-display')
  if (refRew) refRew.innerHTML = `عند أول شراء لصديقك تكسب <span class="ltr-num">${numFmt(S.restaurant?.referral_coins ?? 5000)}</span> كوين 🪙`
}


// ── GOOGLE SIGN IN ────────────────────────────────────────────────────
async function signInWithGoogle() {
  const errEl = document.getElementById('acc-error')
  if (errEl) errEl.style.display = 'none'
  try {
    // احفظ الـ slug قبل الـ redirect
    if (_lastSlug) localStorage.setItem('mnio_last_slug', _lastSlug)
    const redirectTo = window.location.origin + window.location.pathname +
                       (_lastSlug ? '?r=' + _lastSlug : '')
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    })
    if (error) throw error
  } catch(e) {
    if (errEl) { errEl.textContent = 'خطأ: ' + e.message; errEl.style.display = 'block' }
  }
}

// ── PROFILE SCORE ─────────────────────────────────────────────────────
const PROFILE_FIELDS = [
  { key: 'phone',     label: 'رقم الموبايل',    icon: '📱', coins: 1500 },
  { key: 'birthdate', label: 'تاريخ الميلاد',   icon: '🎂', coins: 1500 },
  { key: 'gender',    label: 'الجنس',            icon: '👤', coins: 1000 },
  { key: 'area',      label: 'منطقتك',           icon: '📍', coins: 1000 },
]

function calcProfileScore(customer) {
  if (!customer) return 0
  const filled = PROFILE_FIELDS.filter(f => customer[f.key] && customer[f.key] !== '').length
  return Math.round((filled / PROFILE_FIELDS.length) * 100)
}

const PROFILE_MSGS = [
  { min: 0,   msg: 'ملفك فاضي — ابدأ واكسب مكافآت 🎁' },
  { min: 1,   msg: 'بداية رائعة! كمّل واكسب أكثر ⭐' },
  { min: 50,  msg: 'نص الطريق! الهدايا بتستناك 🔥' },
  { min: 75,  msg: 'تقريباً وصلت! خطوة وخلاص 🚀' },
  { min: 100, msg: '🎉 ملفك مكتمل! استمتع بكل مزاياك' },
]

// ── RENDER ACCOUNT PAGE ───────────────────────────────────────────────
function renderAccountPage() {
  const guest  = document.getElementById('account-guest')
  const logged = document.getElementById('account-logged')
  if (!guest || !logged) return

  if (!S.customer) {
    guest.style.display  = 'block'
    logged.style.display = 'none'
    // لوجو المطعم في hero
    const logoEl = document.getElementById('auth-hero-logo')
    if (logoEl && S.restaurant?.logo_url) {
      logoEl.innerHTML = `<img src="${S.restaurant.logo_url}" style="width:60px;height:60px;border-radius:50%;object-fit:cover">`
    }
    return
  }

  guest.style.display  = 'none'
  logged.style.display = 'block'

  const c = S.customer

  // صورة / أحرف
  const avatarEl = document.getElementById('acc-avatar')
  if (avatarEl) {
    if (c.avatar_url) {
      avatarEl.innerHTML = `<img src="${c.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    } else {
      const initials = (c.name || c.email || '?').charAt(0).toUpperCase()
      avatarEl.textContent = initials
    }
  }
  const nameEl = document.getElementById('acc-logged-name')
  if (nameEl) nameEl.textContent = c.name ? `مرحباً، ${c.name.split(' ')[0]}! 👋` : 'مرحباً! 👋'
  const emailEl = document.getElementById('acc-logged-email')
  if (emailEl) emailEl.textContent = c.email || ''
  const coinsEl = document.getElementById('acc-coins-display')
  if (coinsEl) coinsEl.textContent = numFmt(c.coins_balance || 0)

  // تحديث الإعدادات
  updateSettingsDisplay()
  const score = calcProfileScore(c)
  const barEl = document.getElementById('profile-progress-bar')
  const pctEl = document.getElementById('profile-completion-pct')
  const msgEl = document.getElementById('profile-completion-msg')
  const listEl = document.getElementById('profile-fields-list')

  if (barEl) setTimeout(() => { barEl.style.width = score + '%' }, 100)
  if (pctEl) pctEl.textContent = score + '%'
  if (msgEl) {
    const m = [...PROFILE_MSGS].reverse().find(x => score >= x.min)
    msgEl.textContent = m?.msg || PROFILE_MSGS[0].msg
  }
  if (listEl) {
    listEl.innerHTML = PROFILE_FIELDS.map(f => {
      const done = !!(c[f.key] && c[f.key] !== '')
      return `<div onclick="${done ? '' : `openEditField('${f.key}')`}"
                   style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${done ? '#f0fdf4' : '#fff8f3'};border-radius:12px;border:1.5px solid ${done ? '#bbf7d0' : '#ffe0b2'};cursor:${done ? 'default' : 'pointer'};transition:all 0.2s">
        <span style="font-size:18px">${f.icon}</span>
        <span style="flex:1;font-size:13px;font-weight:700;color:${done ? '#16a34a' : '#cc5500'}">${f.label}</span>
        ${done
          ? `<svg width="16" height="16" fill="none" stroke="#16a34a" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<span style="font-size:11px;font-weight:800;color:var(--brand)">أضف ←</span>`
        }
      </div>`
    }).join('')
  }

  // اخفِ البطاقة لو مكتمل 100%
  const card = document.getElementById('profile-completion-card')
  if (card) card.style.display = score === 100 ? 'none' : 'block'

  // رندر باقي الأقسام
  renderRewardsSection()
  renderVouchersSection()
}

// ── EDIT PROFILE FIELD ────────────────────────────────────────────────
function openEditField(field) {
  const labels = { phone: 'رقم الموبايل 📱', birthdate: 'تاريخ الميلاد 🎂', gender: 'الجنس 👤', area: 'منطقتك 📍' }
  const types  = { phone: 'tel', birthdate: 'date', gender: 'gender', area: 'text' }

  let inputHTML = ''
  if (field === 'gender') {
    inputHTML = `
      <div style="display:flex;gap:10px;margin-top:8px">
        <button onclick="submitEditField('gender','male')" style="flex:1;padding:14px;border-radius:14px;border:2px solid #eee;background:#fff;font-size:18px;cursor:pointer;font-family:'Rubik',sans-serif;font-weight:700">👨 ذكر</button>
        <button onclick="submitEditField('gender','female')" style="flex:1;padding:14px;border-radius:14px;border:2px solid #eee;background:#fff;font-size:18px;cursor:pointer;font-family:'Rubik',sans-serif;font-weight:700">👩 أنثى</button>
      </div>`
  } else {
    inputHTML = `<input id="edit-field-input" type="${types[field]}" value="${S.customer[field] || ''}"
      style="width:100%;background:#f5f5f5;border:1.5px solid #eee;border-radius:14px;padding:14px;font-size:15px;font-family:'Rubik',sans-serif;outline:none;box-sizing:border-box;margin-top:8px"
      onfocus="this.style.borderColor='var(--brand)'" onblur="this.style.borderColor='#eee'" />`
  }

  showConfirmSheet(
    labels[field],
    `<div style="padding:4px 0">
      <p style="font-size:13px;color:#888;margin-bottom:8px">أدخل القيمة الجديدة:</p>
      ${inputHTML}
      ${field !== 'gender' ? `<button onclick="submitEditField('${field}',document.getElementById('edit-field-input').value)"
        style="width:100%;background:linear-gradient(135deg,var(--brand),#ff8c38);color:#fff;font-size:15px;font-weight:900;border-radius:14px;padding:14px;border:none;cursor:pointer;font-family:'Rubik',sans-serif;margin-top:12px">حفظ</button>` : ''}
    </div>`,
    null, null, true
  )
}

async function submitEditField(field, value) {
  if (!value || !S.customer) return
  closeConfirmSheet()

  const coinsMap = { phone: 1500, birthdate: 1500, gender: 1000, area: 1000 }
  const wasEmpty = !S.customer[field]

  try {
    const { error } = await db.from('menu_customers')
      .update({ [field]: value })
      .eq('id', S.customer.id)
    if (error) throw error

    S.customer[field] = value

    // منح الكوينز لو أول مرة
    if (wasEmpty && coinsMap[field]) {
      const coins = coinsMap[field]
      await db.from('menu_customers').update({ coins_balance: (S.customer.coins_balance || 0) + coins }).eq('id', S.customer.id)
      await db.from('coin_transactions').insert({
        customer_id: S.customer.id, restaurant_id: S.restaurant.id,
        type: 'profile_complete', amount: coins,
        note: `إكمال بيانات: ${field}`
      })
      S.customer.coins_balance = (S.customer.coins_balance || 0) + coins
      showToast(`+${numFmt(coins)} 🪙 كوينز على إكمال ملفك!`)
      playSuccessSound()
    }
    renderAccountPage()
    updateWalletBadge()
  } catch(e) {
    showToast('خطأ: ' + e.message)
  }
}

// ── REWARDS SECTION ───────────────────────────────────────────────────
function renderRewardsSection() {
  const el = document.getElementById('rewards-section')
  if (!el || !S.customer || !S.restaurant) return

  const r   = S.restaurant
  const c   = S.customer
  const cpE = r.coins_per_egp ?? 1000

  const rewards = []

  // بونص ترحيبي
  if (r.welcome_coins) {
    const coins  = r.welcome_coins
    const done   = c.welcome_coins_claimed
    rewards.push({
      icon: '🎁', title: 'بونص الترحيب',
      desc: `${(coins / cpE).toFixed(0)} ج.م كوينز عند أول طلب`,
      progress: done ? 100 : 0,
      progressLabel: done ? 'تم الاستلام ✅' : 'اطلب أول مرة',
      done
    })
  }

  // ولاء
  if (r.loyalty_egp) {
    const type   = r.loyalty_type || 'per_order'
    const desc   = type === 'per_order'
      ? `${r.loyalty_egp} ج.م كوينز على كل طلب`
      : `${r.loyalty_egp} ج.م كوينز لكل ${r.loyalty_per_amount || 100} ج.م مشتريات`
    rewards.push({
      icon: '⭐', title: 'كوينز الولاء',
      desc, progress: 100, progressLabel: 'نشط على كل طلب', done: true
    })
  }

  // هدية عيد الميلاد
  if ((r.birthday_gift_enabled ?? false) && r.birthday_coins && c.birthdate) {
    const today    = new Date()
    const bday     = new Date(c.birthdate)
    const isBday   = today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()
    rewards.push({
      icon: '🎂', title: 'هدية عيد الميلاد',
      desc: `${(r.birthday_coins / cpE).toFixed(0)} ج.م كوينز في يوم ميلادك`,
      progress: isBday ? 100 : Math.round(((365 - daysToBirthday(c.birthdate)) / 365) * 100),
      progressLabel: isBday ? '🎉 عيد ميلاد سعيد!' : `بعد ${daysToBirthday(c.birthdate)} يوم`,
      done: isBday
    })
  }

  // إحالة صديق
  if ((r.referral_enabled ?? true) && r.referral_coins) {
    rewards.push({
      icon: '🔗', title: 'شارك واكسب',
      desc: `${(r.referral_coins / cpE).toFixed(0)} ج.م لكل صديق يشترك`,
      progress: 0, progressLabel: 'شارك الآن', done: false,
      action: () => copyReferralLink()
    })
  }

  // توصيل مجاني
  if (r.free_delivery) {
    const minOrder = r.free_delivery_min_order
    rewards.push({
      icon: '🛵', title: 'توصيل مجاني',
      desc: minOrder ? `للطلبات فوق ${minOrder} ج.م` : 'على جميع الطلبات',
      progress: 100, progressLabel: 'نشط ✅', done: true
    })
  }

  if (!rewards.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:32px 16px;background:#fff;border-radius:20px;border:1.5px solid #f0f0f0">
        <div style="font-size:48px;margin-bottom:12px">🛍️</div>
        <p style="font-size:14px;font-weight:800;color:#bbb;margin-bottom:8px">لا توجد مكافآت حالياً</p>
        <p style="font-size:12px;color:#ccc;margin-bottom:16px">اشترِ الآن وابدأ تجمّع كوينز!</p>
        <button onclick="switchPage('home')" style="background:linear-gradient(135deg,var(--brand),#ff8c38);color:#fff;border:none;border-radius:12px;padding:10px 24px;font-size:13px;font-weight:800;cursor:pointer;font-family:'Rubik',sans-serif">تسوّق الآن 🛒</button>
      </div>`
    return
  }

  el.innerHTML = rewards.map((rew, i) => `
    <div style="background:#fff;border-radius:20px;padding:18px;border:1.5px solid #f0f0f0;box-shadow:0 2px 12px rgba(0,0,0,0.04);${rew.action ? 'cursor:pointer' : ''}"
         ${rew.action ? `onclick="copyReferralLink()"` : ''}>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:44px;height:44px;border-radius:14px;background:${rew.done ? '#f0fdf4' : '#fff8f3'};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${rew.icon}</div>
        <div style="flex:1">
          <p style="font-size:14px;font-weight:900;color:#1a1a1a;margin-bottom:2px">${rew.title}</p>
          <p style="font-size:12px;color:#888">${rew.desc}</p>
        </div>
        ${rew.done ? `<svg width="18" height="18" fill="none" stroke="#22c55e" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </div>
      <!-- Progress Track -->
      <div style="background:#f0f0f0;border-radius:10px;height:6px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${rew.progress}%;background:${rew.done ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#ef4444,#FF6B00)'};border-radius:10px;transition:width 1s cubic-bezier(0.34,1.56,0.64,1)"></div>
      </div>
      <p style="font-size:11px;font-weight:700;color:${rew.done ? '#16a34a' : '#cc5500'}">${rew.progressLabel}</p>
    </div>`).join('')

  // تحريك الـ progress bars بعد render
  setTimeout(() => {
    el.querySelectorAll('[style*="width:"]').forEach(b => {
      const w = b.style.width; b.style.width = '0%'
      setTimeout(() => b.style.width = w, 50)
    })
  }, 100)
}

function daysToBirthday(birthdate) {
  const today = new Date()
  const bday  = new Date(birthdate)
  const next  = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.ceil((next - today) / 86400000)
}

// ── VOUCHERS SECTION ──────────────────────────────────────────────────
function renderVouchersSection() {
  const el = document.getElementById('vouchers-section')
  if (!el || !S.customer) return
  el.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:18px;border:1.5px solid #f0f0f0">
      <p style="font-size:13px;color:#888;margin-bottom:12px">أدخل كود القسيمة أو كود الخصم</p>
      <div style="display:flex;gap:8px">
        <input id="voucher-input" type="text" placeholder="XXXX-XXXX"
               style="flex:1;min-width:0;background:#f5f5f5;border:1.5px solid #eee;border-radius:12px;padding:12px 14px;font-size:14px;font-family:'Rubik',sans-serif;outline:none;text-transform:uppercase;letter-spacing:2px;font-weight:700"
               onfocus="this.style.borderColor='var(--brand)'" onblur="this.style.borderColor='#eee'" />
        <button onclick="redeemVoucher()" style="flex-shrink:0;background:linear-gradient(135deg,var(--brand),#ff8c38);color:#fff;border:none;border-radius:12px;padding:12px 18px;font-size:13px;font-weight:900;cursor:pointer;font-family:'Rubik',sans-serif;white-space:nowrap">استرداد</button>
      </div>
      <p id="voucher-msg" style="display:none;font-size:12px;font-weight:700;margin-top:8px;padding:8px 12px;border-radius:10px"></p>
    </div>`
}

async function redeemVoucher() {
  const code  = document.getElementById('voucher-input')?.value.trim().toUpperCase()
  const msgEl = document.getElementById('voucher-msg')
  if (!code || !S.customer || !S.restaurant) return
  msgEl.style.display = 'none'

  const showMsg = (txt, ok) => {
    msgEl.textContent        = txt
    msgEl.style.display      = 'block'
    msgEl.style.background   = ok ? '#f0fdf4' : '#fff0f0'
    msgEl.style.color        = ok ? '#16a34a' : '#ef4444'
  }

  try {
    const { data: dc } = await db.from('discount_codes')
      .select('*')
      .eq('code', code)
      .eq('restaurant_id', S.restaurant.id)
      .eq('is_active', true)
      .single()

    if (!dc) return showMsg('الكود غير موجود أو منتهي الصلاحية ❌', false)
    if (dc.used_count >= dc.max_uses) return showMsg('هذا الكود وصل لأقصى عدد استخدامات ❌', false)
    if (dc.expires_at && new Date(dc.expires_at) < new Date()) return showMsg('الكود منتهي الصلاحية ❌', false)

    // حوّل قيمة الخصم لكوينز
    const cpE   = S.restaurant.coins_per_egp ?? 1000
    const coins = Math.round(dc.amount * cpE)

    await db.from('menu_customers')
      .update({ coins_balance: (S.customer.coins_balance || 0) + coins })
      .eq('id', S.customer.id)
    await db.from('coin_transactions').insert({
      customer_id: S.customer.id, restaurant_id: S.restaurant.id,
      type: 'discount_code', amount: coins, note: `كود: ${code}`
    })
    await db.from('discount_codes').update({ used_count: (dc.used_count || 0) + 1 }).eq('id', dc.id)

    S.customer.coins_balance = (S.customer.coins_balance || 0) + coins
    showMsg(`✅ تم! +${numFmt(coins)} 🪙 أُضيفت لمحفظتك`, true)
    document.getElementById('voucher-input').value = ''
    playSuccessSound()
    updateWalletBadge()
    renderAccountPage()
  } catch(e) {
    showMsg('خطأ: ' + e.message, false)
  }
}

// ── PWA INSTALL ───────────────────────────────────────────────────────
let _deferredInstallPrompt = null

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  _deferredInstallPrompt = e
  const btn = document.getElementById('install-btn')
  if (btn) btn.style.display = 'flex'
})

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('install-btn')
  if (btn) btn.style.display = 'none'
  _deferredInstallPrompt = null
})

function triggerInstall() {
  if (!_deferredInstallPrompt) return
  _deferredInstallPrompt.prompt()
  _deferredInstallPrompt.userChoice.then(() => { _deferredInstallPrompt = null })
}

function showCelebration(coins) {
  document.getElementById('celeb-coins').textContent = numFmt(coins)
  document.getElementById('celebration-overlay').classList.remove('hidden')
  document.documentElement.style.overflow = 'hidden'
  startConfetti()
}
function closeCelebration() {
  document.getElementById('celebration-overlay').classList.add('hidden')
  document.documentElement.style.overflow = ''
  stopConfetti()
}

let _confettiAnim = null
let _confettiParts = []
function startConfetti() {
  const canvas = document.getElementById('confetti-canvas')
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const colors = ['#FF6B00','#FFD700','#22c55e','#3b82f6','#ec4899','#f97316','#a855f7']
  _confettiParts = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
    r: Math.random() * 8 + 4, color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 3 + 1, angle: Math.random() * 360, spin: (Math.random() - 0.5) * 6
  }))
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    _confettiParts.forEach(p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180)
      ctx.fillStyle = p.color; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5); ctx.restore()
      p.y += p.speed; p.angle += p.spin
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width }
    })
    _confettiAnim = requestAnimationFrame(draw)
  }
  draw()
}
function stopConfetti() {
  if (_confettiAnim) { cancelAnimationFrame(_confettiAnim); _confettiAnim = null }
  const canvas = document.getElementById('confetti-canvas')
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
}

