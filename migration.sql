-- ══════════════════════════════════════════════════════════════
-- منجز — Migration: حذف واتساب + سبب الرفض + Push Notifications
-- نفّذ هذا الملف في: Supabase Dashboard → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════

-- 1) عمود سبب رفض الطلب (يظهر للعميل عند رفض المطعم للطلب)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason text;

-- 2) جدول اشتراكات Push Notifications (لكل جهاز/متصفح يسجّل تاجر منه)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_restaurant
  ON push_subscriptions(restaurant_id);

-- تفعيل RLS (الأمان على مستوى الصفوف)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- التاجر يقدر يضيف/يشوف/يمسح اشتراكات مطعمه فقط
DROP POLICY IF EXISTS "Merchants manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "Merchants manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- ══════════════════════════════════════════════════════════════
-- ملاحظة: عمود order_receive_method و whatsapp القديمين لم يُحذفا من الجدول
-- (تركهما لا يسبب أي ضرر، والكود الجديد لا يعتمد عليهما في تدفق الطلبات).
-- عمود whatsapp بقى يُستخدم الآن فقط كرقم تواصل هاتفي عادي للعميل.
-- ══════════════════════════════════════════════════════════════
