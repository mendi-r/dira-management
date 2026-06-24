-- ============================================================
-- SECURITY HARDENING MIGRATION
-- הרץ בסדר הזה בSupabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. תיקון Storage RLS
--    הבעיה: policy קיימת מאפשרת לכל יוזר מחובר לגשת לקבצים
--    של יוזרים אחרים (auth.role() = 'authenticated' בלבד)
--    התיקון: owner = auth.uid() OR role in (admin/super_admin)
-- ============================================================
DROP POLICY IF EXISTS "storage_bochurim_policy" ON storage.objects;

CREATE POLICY "storage_own_objects" ON storage.objects
  FOR ALL
  USING (
    bucket_id IN ('bochurim-docs', 'dirot-docs', 'tachzuka-docs')
    AND auth.role() = 'authenticated'
    AND (
      owner::text = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.users_roles
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'super_admin')
      )
    )
  )
  WITH CHECK (
    bucket_id IN ('bochurim-docs', 'dirot-docs', 'tachzuka-docs')
    AND auth.role() = 'authenticated'
    AND (
      owner::text = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.users_roles
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'super_admin')
      )
    )
  );

-- ============================================================
-- 2. חיזוק users_roles — הפרדת פעולות SELECT / INSERT / UPDATE / DELETE
--    הבעיה: policy אחת ל-FOR ALL עם OR created_by מאפשרת
--    לכל יוזר שיצר משתמש לעדכן ולמחוק אותו ללא הגבלה
-- ============================================================
DROP POLICY IF EXISTS "users_roles_policy" ON users_roles;

-- כל יוזר רואה רק את שורת הרול שלו
CREATE POLICY "users_roles_select" ON users_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users_roles ur2
      WHERE ur2.user_id = auth.uid()
        AND ur2.role IN ('admin', 'super_admin')
    )
  );

-- רק admin/super_admin יכולים ליצור רולים חדשים
CREATE POLICY "users_roles_insert" ON users_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- רק super_admin יכול לשנות רולים
CREATE POLICY "users_roles_update" ON users_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- רק super_admin יכול למחוק רולים, ולא את שורת עצמו
CREATE POLICY "users_roles_delete" ON users_roles
  FOR DELETE USING (
    user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ============================================================
-- 3. CHECK CONSTRAINTS — מניעת ערכים לא חוקיים ב-DB
-- ============================================================

-- גבייה — סטטוס חוקי בלבד
ALTER TABLE gviya DROP CONSTRAINT IF EXISTS gviya_status_check;
ALTER TABLE gviya ADD CONSTRAINT gviya_status_check
  CHECK (status IN ('שולם', 'לא שולם', 'חלקי'));

-- גבייה — סכום חיובי
ALTER TABLE gviya DROP CONSTRAINT IF EXISTS gviya_skhum_check;
ALTER TABLE gviya ADD CONSTRAINT gviya_skhum_check
  CHECK (skhum >= 0);

ALTER TABLE gviya DROP CONSTRAINT IF EXISTS gviya_skhum_shulam_check;
ALTER TABLE gviya ADD CONSTRAINT gviya_skhum_shulam_check
  CHECK (skhum_shulam >= 0);

-- תשלומים לבעלים — סטטוס חוקי
ALTER TABLE tashlumim_baalim DROP CONSTRAINT IF EXISTS tashlumim_status_check;
ALTER TABLE tashlumim_baalim ADD CONSTRAINT tashlumim_status_check
  CHECK (status IN ('שולם', 'לא שולם', 'חלקי'));

ALTER TABLE tashlumim_baalim DROP CONSTRAINT IF EXISTS tashlumim_skhum_check;
ALTER TABLE tashlumim_baalim ADD CONSTRAINT tashlumim_skhum_check
  CHECK (skhum >= 0);

-- תחזוקה — ערכי עדיפות + סטטוס חוקיים
ALTER TABLE tachzuka DROP CONSTRAINT IF EXISTS tachzuka_status_check;
ALTER TABLE tachzuka ADD CONSTRAINT tachzuka_status_check
  CHECK (status IN ('פתוח', 'בטיפול', 'סגור'));

ALTER TABLE tachzuka DROP CONSTRAINT IF EXISTS tachzuka_adifut_check;
ALTER TABLE tachzuka ADD CONSTRAINT tachzuka_adifut_check
  CHECK (adifut IN ('גבוהה', 'בינונית', 'רגילה', 'נמוכה'));

-- שיבוצים — סטטוס חוקי
ALTER TABLE shibutzim DROP CONSTRAINT IF EXISTS shibutzim_status_check;
ALTER TABLE shibutzim ADD CONSTRAINT shibutzim_status_check
  CHECK (status IN ('פעיל', 'הסתיים', 'בהמתנה'));

-- ============================================================
-- 4. UNIQUE CONSTRAINT — מניעת כפילות שיבוצים פעילים
--    בחור אחד לא יכול להיות בשתי דירות בו-זמנית
-- ============================================================
ALTER TABLE shibutzim DROP CONSTRAINT IF EXISTS shibutzim_unique_active;
CREATE UNIQUE INDEX IF NOT EXISTS shibutzim_unique_active_idx
  ON shibutzim (bochurim_id, owner_id)
  WHERE status = 'פעיל';

-- ============================================================
-- 5. הגבלת RPC get_users_with_roles — רק לadmin/super_admin
--    הוספת בדיקה פנימית בפונקציה
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE (
  user_id     UUID,
  email       TEXT,
  role        TEXT,
  created_at  TIMESTAMPTZ,
  banned_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- רק admin/super_admin יכולים לקרוא לפונקציה זו
  IF NOT EXISTS (
    SELECT 1 FROM users_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    au.email,
    ur.role,
    ur.created_at,
    au.banned_until
  FROM users_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  ORDER BY ur.created_at DESC;
END;
$$;

-- ============================================================
-- 6. בדיקת get_dashboard_stats — ודא ב-Supabase Dashboard
-- ============================================================
-- אל תריץ CREATE OR REPLACE על הפונקציה הזו כאן —
-- הגרסה הפרודקשן שלה מורכבת יותר ומחייבת owner_id scoping.
--
-- מה שצריך לוודא ידנית ב-Supabase Dashboard → Database → Functions:
--   1. get_dashboard_stats מוגדרת כ-SECURITY DEFINER
--   2. p_owner_id שונה מ-auth.uid() נגיש רק ל-super_admin
--   3. כל שאילתה מסוננת לפי owner_id = v_owner_id (לא auth.uid() ישיר)
--
-- אם יש ספק, הרץ את הבדיקה הבאה:
SELECT prosrc FROM pg_proc WHERE proname = 'get_dashboard_stats' LIMIT 1;

-- ============================================================
-- 7. הגדרת search_path בטוחה לכל הפונקציות הקיימות
-- ============================================================
ALTER FUNCTION public.get_effective_owner_id() SET search_path = public;

-- ============================================================
-- 8. ביקורת: הדפסת כל פוליסיות RLS פעילות
-- ============================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY tablename, policyname;
