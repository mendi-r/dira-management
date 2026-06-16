-- ============================================================
-- מיגרציה מלאה - מערכת ניהול דירות ובחורים
-- להריץ ב-Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. הוספת user_id ועמודות חדשות לטבלאות קיימות
-- ============================================================

-- === bochurim ===
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS user_id        UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS mispar_darkon  TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS mekorot        TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS shem_horim     TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS telefon_av     TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS telefon_em     TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS ktovet         TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS kvutza_yeshiva TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS status_viza    TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS tokef_viza     DATE;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS ish_ksheret_shem    TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS ish_ksheret_telefon TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS amla_chodshit  NUMERIC(10,2);
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS drive_link     TEXT;

-- === dirot ===
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS user_id               UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_shem           TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_telefon1       TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_telefon2       TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_email          TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_ktovet_rechov  TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_ktovet_ir      TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mispar_mitot          INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mispar_sherutim       INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mispar_miklachot      INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS perut_riut            TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS sheon_mayim_num       TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS sheon_chashmal_num    TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS sheon_gaz_num         TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS arnona                NUMERIC(10,2);
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS ola_schirut_chodshi   NUMERIC(10,2);
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS tchilat_schirut       DATE;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mispar_chodashim      INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS sofit_schirut         DATE; -- מחושב
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS payment_method        TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS payment_day           INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS payment_source        TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS payment_bank_details  TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS bituach_chevra        TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS bituach_polisa        TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS bituach_chadush       DATE;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS google_maps_link      TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS drive_link            TEXT;

-- === shibutzim ===
ALTER TABLE shibutzim ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE shibutzim ADD COLUMN IF NOT EXISTS ola_lebach   NUMERIC(10,2); -- חלק מהשכירות לבחור

-- === gviya ===
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS payment_method  TEXT;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS billing_day     INTEGER;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS chodesh         TEXT; -- YYYY-MM
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS is_amla         BOOLEAN DEFAULT FALSE;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS skhum_shulam    NUMERIC(10,2) DEFAULT 0;

-- === tachzuka ===
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS makom_bedira  TEXT;
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS assigned_to   TEXT;
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS adifut        TEXT DEFAULT 'רגילה';
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS taarich_yaad  DATE;
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS vendor_id     UUID;

-- === tachzuka_pritim ===
ALTER TABLE tachzuka_pritim ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE tachzuka_pritim ADD COLUMN IF NOT EXISTS vendor_id  UUID;

-- === riut (מונים) ===
ALTER TABLE riut ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE riut ADD COLUMN IF NOT EXISTS is_kria_ptika   BOOLEAN DEFAULT FALSE;

-- === hagdarot ===
ALTER TABLE hagdarot ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- ============================================================
-- 2. יצירת טבלאות חדשות
-- ============================================================

-- ספקים
CREATE TABLE IF NOT EXISTS vendors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  shem        TEXT NOT NULL,
  tchum       TEXT,
  telefon     TEXT,
  avg_cost    NUMERIC(10,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- מסמכים
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  entity_type  TEXT NOT NULL, -- 'bochurim' | 'dirot' | 'tachzuka'
  entity_id    UUID NOT NULL,
  doc_name     TEXT,
  doc_type     TEXT, -- 'darkon' | 'viza' | 'chozeh' | 'acher'
  file_url     TEXT,
  drive_link   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- הוצאות נוספות
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  dirot_id    UUID REFERENCES dirot(id) ON DELETE SET NULL,
  sug         TEXT NOT NULL, -- 'bituach' | 'tivut' | 'misrad' | 'acher'
  teur        TEXT,
  skhum       NUMERIC(10,2) NOT NULL,
  taarich     DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- לוג פעילות
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  peula       TEXT NOT NULL, -- INSERT | UPDATE | DELETE
  shm_jadal   TEXT NOT NULL,
  record_id   UUID,
  teur        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- הרשאות משתמשים
CREATE TABLE IF NOT EXISTS users_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin', -- 'admin' | 'maintenance' | 'accountant'
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. הפעלת RLS
-- ============================================================

ALTER TABLE bochurim        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dirot           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shibutzim       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gviya           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tachzuka        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tachzuka_pritim ENABLE ROW LEVEL SECURITY;
ALTER TABLE riut            ENABLE ROW LEVEL SECURITY;
ALTER TABLE hagdarot        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_roles     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies
-- ============================================================

DO $$ BEGIN

  -- bochurim
  DROP POLICY IF EXISTS "bochurim_policy" ON bochurim;
  CREATE POLICY "bochurim_policy" ON bochurim
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- dirot
  DROP POLICY IF EXISTS "dirot_policy" ON dirot;
  CREATE POLICY "dirot_policy" ON dirot
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- shibutzim
  DROP POLICY IF EXISTS "shibutzim_policy" ON shibutzim;
  CREATE POLICY "shibutzim_policy" ON shibutzim
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- gviya
  DROP POLICY IF EXISTS "gviya_policy" ON gviya;
  CREATE POLICY "gviya_policy" ON gviya
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- tachzuka
  DROP POLICY IF EXISTS "tachzuka_policy" ON tachzuka;
  CREATE POLICY "tachzuka_policy" ON tachzuka
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- tachzuka_pritim
  DROP POLICY IF EXISTS "tachzuka_pritim_policy" ON tachzuka_pritim;
  CREATE POLICY "tachzuka_pritim_policy" ON tachzuka_pritim
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- riut
  DROP POLICY IF EXISTS "riut_policy" ON riut;
  CREATE POLICY "riut_policy" ON riut
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- hagdarot
  DROP POLICY IF EXISTS "hagdarot_policy" ON hagdarot;
  CREATE POLICY "hagdarot_policy" ON hagdarot
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- vendors
  DROP POLICY IF EXISTS "vendors_policy" ON vendors;
  CREATE POLICY "vendors_policy" ON vendors
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- documents
  DROP POLICY IF EXISTS "documents_policy" ON documents;
  CREATE POLICY "documents_policy" ON documents
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- expenses
  DROP POLICY IF EXISTS "expenses_policy" ON expenses;
  CREATE POLICY "expenses_policy" ON expenses
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- activity_log (read own only)
  DROP POLICY IF EXISTS "activity_log_policy" ON activity_log;
  CREATE POLICY "activity_log_policy" ON activity_log
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- users_roles
  DROP POLICY IF EXISTS "users_roles_policy" ON users_roles;
  CREATE POLICY "users_roles_policy" ON users_roles
    USING (user_id = auth.uid() OR created_by = auth.uid());

END $$;

-- ============================================================
-- 5. Trigger: הרשמת משתמש חדש -> role = admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. Storage buckets (להריץ כ-SQL או ב-dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('bochurim-docs', 'bochurim-docs', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('dirot-docs', 'dirot-docs', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('tachzuka-docs', 'tachzuka-docs', false) ON CONFLICT DO NOTHING;

-- הכנסת הגדרות ברירת מחדל (לאחר הריצה הראשונה)
-- INSERT INTO hagdarot (mafteach, erech, sug, teur) VALUES
--   ('yamim_hatara_chozeh', '30', 'התראות', 'ימי התראה לפני סיום חוזה'),
--   ('yamim_hatara_viza', '60', 'התראות', 'ימי התראה לפני פקיעת ויזה'),
--   ('yamim_hatara_bituach', '30', 'התראות', 'ימי התראה לפני חידוש ביטוח')
-- ON CONFLICT DO NOTHING;

SELECT 'Migration completed successfully!' AS status;
