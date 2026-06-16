-- ============================================================
-- FULL MIGRATION v2 — מערכת ניהול דירות ובחורים
-- בטוח להרצה חוזרת: משתמש ב-IF NOT EXISTS בכל מקום
-- להריץ ב-Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. יצירת כל הטבלאות מאפס (אם לא קיימות)
-- ============================================================

-- === bochurim ===
CREATE TABLE IF NOT EXISTS bochurim (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  shem                  TEXT NOT NULL,
  mishpacha             TEXT,
  mispar_darkon         TEXT,
  mekorot               TEXT,
  taarich_lida          DATE,
  ir_megurim            TEXT,
  ktovet                TEXT,
  status                TEXT DEFAULT 'פעיל',
  telefon               TEXT,
  email                 TEXT,
  shem_horim            TEXT,
  telefon_av            TEXT,
  telefon_em            TEXT,
  kvutza_yeshiva        TEXT,
  status_viza           TEXT,
  tokef_viza            DATE,
  ish_ksheret_shem      TEXT,
  ish_ksheret_telefon   TEXT,
  amla_chodshit         NUMERIC(10,2),
  drive_link            TEXT,
  heara                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- === dirot ===
CREATE TABLE IF NOT EXISTS dirot (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  ktovet                TEXT NOT NULL,
  ir                    TEXT,
  mishkan               TEXT,
  mazkir                TEXT,
  mispar_chadarim       INTEGER,
  mispar_mitot          INTEGER,
  mispar_sherutim       INTEGER,
  mispar_miklachot      INTEGER,
  perut_riut            TEXT,
  sheon_mayim_num       TEXT,
  sheon_chashmal_num    TEXT,
  sheon_gaz_num         TEXT,
  arnona                NUMERIC(10,2),
  status                TEXT DEFAULT 'פעיל',
  heara                 TEXT,
  baalim_shem           TEXT,
  baalim_telefon1       TEXT,
  baalim_telefon2       TEXT,
  baalim_email          TEXT,
  baalim_ktovet_rechov  TEXT,
  baalim_ktovet_ir      TEXT,
  ola_schirut_chodshi   NUMERIC(10,2),
  tchilat_schirut       DATE,
  mispar_chodashim      INTEGER,
  sofit_schirut         DATE,
  payment_method        TEXT,
  payment_day           INTEGER,
  payment_source        TEXT,
  payment_bank_details  TEXT,
  bituach_chevra        TEXT,
  bituach_polisa        TEXT,
  bituach_chadush       DATE,
  google_maps_link      TEXT,
  drive_link            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- === shibutzim ===
CREATE TABLE IF NOT EXISTS shibutzim (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  bochurim_id     UUID REFERENCES bochurim(id) ON DELETE CASCADE,
  dirot_id        UUID REFERENCES dirot(id) ON DELETE SET NULL,
  taarich_tchila  DATE,
  taarich_siyum   DATE,
  status          TEXT DEFAULT 'פעיל',
  ola_lebach      NUMERIC(10,2),
  heara           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- === gviya ===
CREATE TABLE IF NOT EXISTS gviya (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  bochurim_id     UUID REFERENCES bochurim(id) ON DELETE CASCADE,
  dirot_id        UUID REFERENCES dirot(id) ON DELETE SET NULL,
  skhum           NUMERIC(10,2) NOT NULL,
  skhum_shulam    NUMERIC(10,2) DEFAULT 0,
  taarich         DATE,
  chodesh         TEXT,
  sug             TEXT DEFAULT 'שכר דירה',
  payment_method  TEXT,
  billing_day     INTEGER,
  is_amla         BOOLEAN DEFAULT FALSE,
  status          TEXT DEFAULT 'לא שולם',
  heara           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- === tachzuka ===
CREATE TABLE IF NOT EXISTS tachzuka (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  dirot_id        UUID REFERENCES dirot(id) ON DELETE SET NULL,
  sug             TEXT,
  teur            TEXT,
  makom_bedira    TEXT,
  status          TEXT DEFAULT 'פתוח',
  adifut          TEXT DEFAULT 'רגילה',
  taarich_pgisha  DATE,
  taarich_yaad    DATE,
  assigned_to     TEXT,
  vendor_id       UUID,
  skhum           NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- === tachzuka_pritim ===
CREATE TABLE IF NOT EXISTS tachzuka_pritim (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  tachzuka_id   UUID REFERENCES tachzuka(id) ON DELETE CASCADE,
  vendor_id     UUID,
  teur          TEXT,
  skhum         NUMERIC(10,2),
  taarich       DATE,
  status        TEXT DEFAULT 'ממתין',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- === riut (מונים) ===
CREATE TABLE IF NOT EXISTS riut (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  dirot_id        UUID REFERENCES dirot(id) ON DELETE CASCADE,
  sug             TEXT NOT NULL,
  kriah_kodem     NUMERIC(12,3),
  kriah_nochchi   NUMERIC(12,3),
  taarich         DATE,
  is_kria_ptika   BOOLEAN DEFAULT FALSE,
  heara           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- === hagdarot ===
CREATE TABLE IF NOT EXISTS hagdarot (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  mafteach    TEXT NOT NULL,
  erech       TEXT,
  sug         TEXT DEFAULT 'כללי',
  teur        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- === vendors (ספקים) ===
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

-- === documents (מסמכים) ===
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  doc_name     TEXT,
  doc_type     TEXT,
  file_url     TEXT,
  drive_link   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- === expenses (הוצאות) ===
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  dirot_id    UUID REFERENCES dirot(id) ON DELETE SET NULL,
  sug         TEXT NOT NULL,
  teur        TEXT,
  skhum       NUMERIC(10,2) NOT NULL,
  taarich     DATE,
  chodesh     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- === activity_log ===
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  peula       TEXT NOT NULL,
  shm_jadal   TEXT NOT NULL,
  record_id   UUID,
  teur        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- === users_roles ===
CREATE TABLE IF NOT EXISTS users_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin',
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. הוספת עמודות חסרות לטבלאות קיימות (לשדרוג ממצב ישן)
-- ============================================================

-- bochurim — עמודות שנוספו בגרסאות שונות
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS user_id               UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS mishpacha             TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS mispar_darkon         TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS mekorot               TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS taarich_lida          DATE;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS ir_megurim            TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS ktovet                TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS status                TEXT DEFAULT 'פעיל';
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS shem_horim            TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS telefon_av            TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS telefon_em            TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS kvutza_yeshiva        TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS status_viza           TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS tokef_viza            DATE;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS ish_ksheret_shem      TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS ish_ksheret_telefon   TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS amla_chodshit         NUMERIC(10,2);
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS drive_link            TEXT;
ALTER TABLE bochurim ADD COLUMN IF NOT EXISTS heara                 TEXT;

-- dirot
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS user_id               UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS ir                    TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mishkan               TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mazkir                TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mispar_chadarim       INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mispar_mitot          INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mispar_sherutim       INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mispar_miklachot      INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS perut_riut            TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS sheon_mayim_num       TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS sheon_chashmal_num    TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS sheon_gaz_num         TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS arnona                NUMERIC(10,2);
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS status                TEXT DEFAULT 'פעיל';
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS heara                 TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_shem           TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_telefon1       TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_telefon2       TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_email          TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_ktovet_rechov  TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS baalim_ktovet_ir      TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS ola_schirut_chodshi   NUMERIC(10,2);
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS tchilat_schirut       DATE;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS mispar_chodashim      INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS sofit_schirut         DATE;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS payment_method        TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS payment_day           INTEGER;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS payment_source        TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS payment_bank_details  TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS bituach_chevra        TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS bituach_polisa        TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS bituach_chadush       DATE;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS google_maps_link      TEXT;
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS drive_link            TEXT;

-- shibutzim
ALTER TABLE shibutzim ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE shibutzim ADD COLUMN IF NOT EXISTS ola_lebach    NUMERIC(10,2);
ALTER TABLE shibutzim ADD COLUMN IF NOT EXISTS heara         TEXT;

-- gviya
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS dirot_id        UUID REFERENCES dirot(id) ON DELETE SET NULL;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS payment_method  TEXT;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS billing_day     INTEGER;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS chodesh         TEXT;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS is_amla         BOOLEAN DEFAULT FALSE;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS skhum_shulam   NUMERIC(10,2) DEFAULT 0;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS heara           TEXT;
ALTER TABLE gviya ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'לא שולם';

-- tachzuka
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS makom_bedira  TEXT;
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS assigned_to   TEXT;
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS adifut        TEXT DEFAULT 'רגילה';
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS taarich_pgisha DATE;
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS taarich_yaad  DATE;
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS vendor_id     UUID;
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS skhum         NUMERIC(10,2);
ALTER TABLE tachzuka ADD COLUMN IF NOT EXISTS notes         TEXT;

-- tachzuka_pritim
ALTER TABLE tachzuka_pritim ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE tachzuka_pritim ADD COLUMN IF NOT EXISTS vendor_id  UUID;
ALTER TABLE tachzuka_pritim ADD COLUMN IF NOT EXISTS skhum      NUMERIC(10,2);
ALTER TABLE tachzuka_pritim ADD COLUMN IF NOT EXISTS taarich    DATE;
ALTER TABLE tachzuka_pritim ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'ממתין';
ALTER TABLE tachzuka_pritim ADD COLUMN IF NOT EXISTS notes      TEXT;

-- riut
ALTER TABLE riut ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE riut ADD COLUMN IF NOT EXISTS is_kria_ptika   BOOLEAN DEFAULT FALSE;
ALTER TABLE riut ADD COLUMN IF NOT EXISTS heara           TEXT;

-- hagdarot
ALTER TABLE hagdarot ADD COLUMN IF NOT EXISTS user_id   UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE hagdarot ADD COLUMN IF NOT EXISTS mafteach  TEXT;
ALTER TABLE hagdarot ADD COLUMN IF NOT EXISTS erech     TEXT;
ALTER TABLE hagdarot ADD COLUMN IF NOT EXISTS sug       TEXT DEFAULT 'כללי';
ALTER TABLE hagdarot ADD COLUMN IF NOT EXISTS teur      TEXT;

-- expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS chodesh TEXT;

-- ============================================================
-- 3. הפעלת RLS על כל הטבלאות
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
-- 4. מדיניות RLS — מחיקה ויצירה מחדש
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

  -- activity_log
  DROP POLICY IF EXISTS "activity_log_policy" ON activity_log;
  CREATE POLICY "activity_log_policy" ON activity_log
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- users_roles
  DROP POLICY IF EXISTS "users_roles_policy" ON users_roles;
  CREATE POLICY "users_roles_policy" ON users_roles
    USING (user_id = auth.uid() OR created_by = auth.uid());

END $$;

-- ============================================================
-- 5. Trigger: הרשמת משתמש חדש → role = admin
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
-- 6. Storage Buckets (להריץ פעם אחת)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('bochurim-docs', 'bochurim-docs', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('dirot-docs', 'dirot-docs', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('tachzuka-docs', 'tachzuka-docs', false) ON CONFLICT DO NOTHING;

-- Storage RLS
DO $$ BEGIN
  DROP POLICY IF EXISTS "storage_bochurim_policy" ON storage.objects;
  CREATE POLICY "storage_bochurim_policy" ON storage.objects
    FOR ALL USING (bucket_id IN ('bochurim-docs','dirot-docs','tachzuka-docs') AND auth.role() = 'authenticated');
END $$;

-- ============================================================
-- 7. הגדרות ברירת מחדל
-- ============================================================
INSERT INTO hagdarot (mafteach, erech, sug, teur) VALUES
  ('yamim_hatara_chozeh', '30', 'התראות', 'ימי התראה לפני סיום חוזה'),
  ('yamim_hatara_viza', '60', 'התראות', 'ימי התראה לפני פקיעת ויזה'),
  ('yamim_hatara_bituach', '30', 'התראות', 'ימי התראה לפני חידוש ביטוח')
ON CONFLICT DO NOTHING;

SELECT 'Migration v2 completed successfully!' AS status;
