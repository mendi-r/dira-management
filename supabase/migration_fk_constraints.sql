-- ============================================================
-- הוספת FK Constraints אם לא קיימים
-- נדרש כדי ש-Supabase יוכל לבצע JOIN בין טבלאות
-- ============================================================

DO $$ BEGIN
  -- shibutzim → bochurim
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shibutzim_bochurim_id_fkey' AND table_name = 'shibutzim'
  ) THEN
    ALTER TABLE shibutzim ADD CONSTRAINT shibutzim_bochurim_id_fkey
      FOREIGN KEY (bochurim_id) REFERENCES bochurim(id) ON DELETE CASCADE;
  END IF;

  -- shibutzim → dirot
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shibutzim_dirot_id_fkey' AND table_name = 'shibutzim'
  ) THEN
    ALTER TABLE shibutzim ADD CONSTRAINT shibutzim_dirot_id_fkey
      FOREIGN KEY (dirot_id) REFERENCES dirot(id) ON DELETE SET NULL;
  END IF;

  -- gviya → bochurim
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'gviya_bochurim_id_fkey' AND table_name = 'gviya'
  ) THEN
    ALTER TABLE gviya ADD CONSTRAINT gviya_bochurim_id_fkey
      FOREIGN KEY (bochurim_id) REFERENCES bochurim(id) ON DELETE CASCADE;
  END IF;

  -- gviya → dirot
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'gviya_dirot_id_fkey' AND table_name = 'gviya'
  ) THEN
    ALTER TABLE gviya ADD CONSTRAINT gviya_dirot_id_fkey
      FOREIGN KEY (dirot_id) REFERENCES dirot(id) ON DELETE SET NULL;
  END IF;

  -- tachzuka → dirot
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tachzuka_dirot_id_fkey' AND table_name = 'tachzuka'
  ) THEN
    ALTER TABLE tachzuka ADD CONSTRAINT tachzuka_dirot_id_fkey
      FOREIGN KEY (dirot_id) REFERENCES dirot(id) ON DELETE SET NULL;
  END IF;
END $$;

-- וידוא — רשימת FK constraints שנוצרו
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('shibutzim','gviya','tachzuka')
ORDER BY tc.table_name, tc.constraint_name;
