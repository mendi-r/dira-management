-- ============================================================
-- טבלת תשלומים לבעלי דירות
-- ============================================================

CREATE TABLE IF NOT EXISTS tashlumim_baalim (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  dirot_id     UUID REFERENCES dirot(id) ON DELETE SET NULL,
  skhum        NUMERIC(10,2) NOT NULL,
  skhum_shulam NUMERIC(10,2) DEFAULT 0,
  taarich      DATE,
  chodesh      TEXT,
  payment_day  INTEGER,
  status       TEXT DEFAULT 'לא שולם',
  heara        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE tashlumim_baalim ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_tashlumim" ON tashlumim_baalim;
CREATE POLICY "users_own_tashlumim" ON tashlumim_baalim
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- FK constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tashlumim_baalim_dirot_id_fkey' AND table_name = 'tashlumim_baalim'
  ) THEN
    ALTER TABLE tashlumim_baalim ADD CONSTRAINT tashlumim_baalim_dirot_id_fkey
      FOREIGN KEY (dirot_id) REFERENCES dirot(id) ON DELETE SET NULL;
  END IF;
END $$;

SELECT 'tashlumim_baalim table ready' AS status;
