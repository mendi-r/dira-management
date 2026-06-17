-- ============================================================
-- DIRA MANAGEMENT — SQL SECURITY & PERFORMANCE SETUP
-- הרץ את כל הקובץ ב: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. INDEXES — ביצועים על עמודות נפוצות
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bochurim_user     ON bochurim(user_id);
CREATE INDEX IF NOT EXISTS idx_dirot_user        ON dirot(user_id);
CREATE INDEX IF NOT EXISTS idx_shibutzim_user    ON shibutzim(user_id);
CREATE INDEX IF NOT EXISTS idx_shibutzim_dirot   ON shibutzim(dirot_id);
CREATE INDEX IF NOT EXISTS idx_shibutzim_bochur  ON shibutzim(bochurim_id);
CREATE INDEX IF NOT EXISTS idx_shibutzim_status  ON shibutzim(status);
CREATE INDEX IF NOT EXISTS idx_gviya_user        ON gviya(user_id);
CREATE INDEX IF NOT EXISTS idx_gviya_bochur      ON gviya(bochurim_id);
CREATE INDEX IF NOT EXISTS idx_gviya_dirot       ON gviya(dirot_id);
CREATE INDEX IF NOT EXISTS idx_gviya_status      ON gviya(status);
CREATE INDEX IF NOT EXISTS idx_gviya_chodesh     ON gviya(chodesh);
CREATE INDEX IF NOT EXISTS idx_tashlumim_dirot   ON tashlumim_baalim(dirot_id);
CREATE INDEX IF NOT EXISTS idx_tashlumim_chodesh ON tashlumim_baalim(chodesh);
CREATE INDEX IF NOT EXISTS idx_chozim_dirot      ON chozim(dirot_id);
CREATE INDEX IF NOT EXISTS idx_tachzuka_dirot    ON tachzuka(dirot_id);
CREATE INDEX IF NOT EXISTS idx_activity_user     ON activity_log(user_id);

-- ============================================================
-- 2. RLS — Row Level Security לכל הטבלאות
-- ============================================================

-- bochurim
ALTER TABLE bochurim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bochurim_user_policy ON bochurim;
CREATE POLICY bochurim_user_policy ON bochurim
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- dirot
ALTER TABLE dirot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dirot_user_policy ON dirot;
CREATE POLICY dirot_user_policy ON dirot
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- shibutzim
ALTER TABLE shibutzim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shibutzim_user_policy ON shibutzim;
CREATE POLICY shibutzim_user_policy ON shibutzim
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- gviya
ALTER TABLE gviya ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gviya_user_policy ON gviya;
CREATE POLICY gviya_user_policy ON gviya
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tashlumim_baalim
ALTER TABLE tashlumim_baalim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tashlumim_baalim_user_policy ON tashlumim_baalim;
CREATE POLICY tashlumim_baalim_user_policy ON tashlumim_baalim
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- chozim
ALTER TABLE chozim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chozim_user_policy ON chozim;
CREATE POLICY chozim_user_policy ON chozim
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tachzuka
ALTER TABLE tachzuka ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tachzuka_user_policy ON tachzuka;
CREATE POLICY tachzuka_user_policy ON tachzuka
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tachzuka_pritim
ALTER TABLE tachzuka_pritim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tachzuka_pritim_user_policy ON tachzuka_pritim;
CREATE POLICY tachzuka_pritim_user_policy ON tachzuka_pritim
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- riut (מונים)
ALTER TABLE riut ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS riut_user_policy ON riut;
CREATE POLICY riut_user_policy ON riut
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS documents_user_policy ON documents;
CREATE POLICY documents_user_policy ON documents
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_log_user_policy ON activity_log;
CREATE POLICY activity_log_user_policy ON activity_log
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- hagdarot
ALTER TABLE hagdarot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hagdarot_user_policy ON hagdarot;
CREATE POLICY hagdarot_user_policy ON hagdarot
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendors_user_policy ON vendors;
CREATE POLICY vendors_user_policy ON vendors
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. DEFAULT auth.uid() לכל הטבלאות
-- ============================================================
ALTER TABLE bochurim        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE dirot           ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE shibutzim       ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE gviya           ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE tashlumim_baalim ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE chozim          ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE tachzuka        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE tachzuka_pritim ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE riut            ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE documents       ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE activity_log    ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE hagdarot        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE vendors         ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ============================================================
-- 4. POINT-IN-TIME RECOVERY
-- הפעל ידנית ב: Supabase Dashboard → Settings → Addons
-- (זמין בתוכנית Pro בלבד)
-- ============================================================

-- ============================================================
-- 5. בדיקת סטטוס RLS — הרץ אחרי ההתקנה לוודא
-- ============================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
