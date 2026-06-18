// supabase/functions/send-order-push/index.ts
// يُستدعى تلقائياً عبر Database Webhook عند إضافة طلب جديد (INSERT على جدول orders)
// ويرسل إشعار Push لكل الاشتراكات (push_subscriptions) المرتبطة بنفس المطعم.

import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails(
  'mailto:support@example.com', // يفضّل تستبدله بإيميل حقيقي لاحقاً
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    // شكل الـ payload القادم من Database Webhook الخاص بـ Supabase:
    // { type: 'INSERT', table: 'orders', record: {...}, schema: 'public', old_record: null }
    const order = payload.record
    if (!order || !order.restaurant_id) {
      return new Response(JSON.stringify({ ok: false, error: 'no order/restaurant_id in payload' }), { status: 400 })
    }

    // جلب كل اشتراكات Push الخاصة بهذا المطعم
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?restaurant_id=eq.${order.restaurant_id}&select=id,endpoint,p256dh,auth`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    )
    const subs = await subsRes.json()

    if (!Array.isArray(subs) || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: 'no subscriptions for this restaurant' }), { status: 200 })
    }

    const itemsCount = Array.isArray(order.items) ? order.items.length : 0
    const notificationPayload = JSON.stringify({
      title: '🔔 طلب جديد!',
      body:  `طلب رقم ${order.order_number} — ${itemsCount} عنصر — ${Number(order.total).toFixed(0)} ج.م`,
      orderId: order.id,
      url: './dashboard.html'
    })

    const results = await Promise.allSettled(
      subs.map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notificationPayload
        ).catch(async (err: any) => {
          // لو الاشتراك انتهى أو أصبح غير صالح (410/404)، نحذفه من القاعدة لتنظيف الجدول
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${s.id}`, {
              method: 'DELETE',
              headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
            })
          }
          throw err
        })
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ ok: true, sent, total: subs.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('send-order-push error:', e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 })
  }
})
