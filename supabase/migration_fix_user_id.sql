-- ============================================================
-- תיקון user_id = NULL בשורות ישנות
-- שורות עם user_id=NULL חסומות על ידי RLS ולא מופיעות בממשק
-- ============================================================

-- עדכון כל הטבלאות — שורות בלי user_id יקבלו את המשתמש הנוכחי
UPDATE bochurim  SET user_id = auth.uid() WHERE user_id IS NULL;
UPDATE dirot     SET user_id = auth.uid() WHERE user_id IS NULL;
UPDATE shibutzim SET user_id = auth.uid() WHERE user_id IS NULL;
UPDATE gviya     SET user_id = auth.uid() WHERE user_id IS NULL;
UPDATE tachzuka  SET user_id = auth.uid() WHERE user_id IS NULL;
UPDATE hagdarot  SET user_id = auth.uid() WHERE user_id IS NULL;

-- וידוא — כמה שורות בכל טבלה מוצגות למשתמש הנוכחי
SELECT 'bochurim'  AS tbl, count(*) FROM bochurim  WHERE user_id = auth.uid() UNION ALL
SELECT 'dirot',    count(*) FROM dirot     WHERE user_id = auth.uid() UNION ALL
SELECT 'shibutzim',count(*) FROM shibutzim WHERE user_id = auth.uid() UNION ALL
SELECT 'gviya',    count(*) FROM gviya     WHERE user_id = auth.uid();
