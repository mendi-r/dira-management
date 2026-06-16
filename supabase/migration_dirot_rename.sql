-- ============================================================
-- מיגרציה: מיפוי עמודות ישנות → חדשות בטבלת dirot
-- בטוח להרצה חוזרת
-- ============================================================

-- 1. העתקת נתונים מעמודות ישנות לחדשות (COALESCE שומר ערך חדש אם כבר קיים)
UPDATE dirot SET
  ktovet               = COALESCE(NULLIF(ktovet,''),  ktovet_naches),
  baalim_shem          = COALESCE(NULLIF(baalim_shem,''), baalim),
  baalim_telefon1      = COALESCE(NULLIF(baalim_telefon1,''), telefon_baalim1),
  baalim_telefon2      = COALESCE(NULLIF(baalim_telefon2,''), telefon_baalim2),
  baalim_email         = COALESCE(NULLIF(baalim_email,''), email_baalim),
  baalim_ktovet_rechov = COALESCE(NULLIF(baalim_ktovet_rechov,''), ktovet_baalim),
  baalim_ktovet_ir     = COALESCE(NULLIF(baalim_ktovet_ir,''), ir_baalim),
  perut_riut           = COALESCE(NULLIF(perut_riut,''), pirtei_riut),
  sheon_mayim_num      = COALESCE(NULLIF(sheon_mayim_num,''), shaon_maim),
  sheon_chashmal_num   = COALESCE(NULLIF(sheon_chashmal_num,''), shaon_chashmal),
  mispar_miklachot     = COALESCE(mispar_miklachot, mispar_michlashot),
  payment_method       = COALESCE(NULLIF(payment_method,''), baalim_emtzai_tashlum),
  payment_day          = COALESCE(payment_day, baalim_yom_chiuv),
  payment_source       = COALESCE(NULLIF(payment_source,''), baalim_makor_tashlum),
  payment_bank_details = COALESCE(NULLIF(payment_bank_details,''), baalim_pratei_tashlum),
  tchilat_schirut      = COALESCE(tchilat_schirut, tchilat_schirot),
  sofit_schirut        = COALESCE(sofit_schirut, sof_schirot),
  ola_schirut_chodshi  = COALESCE(ola_schirut_chodshi, ala_schirot);

-- 2. arnona — בטבלה המקורית הוא TEXT, ממירים ל-NUMERIC בעמודה החדשה
--    (הוספנו עמודת arnona_new כי arnona המקורית היא TEXT)
ALTER TABLE dirot ADD COLUMN IF NOT EXISTS arnona_num NUMERIC(10,2);
UPDATE dirot SET arnona_num = CASE
  WHEN arnona ~ '^\d+(\.\d+)?$' THEN arnona::NUMERIC
  ELSE NULL
END WHERE arnona_num IS NULL;

-- 3. וודא שeמודות חדשות לא יהיו NULL כאשר יש ערך ישן
--    (הכל כבר nullable, כך שאין צורך בשינוי נוסף)

SELECT
  count(*) AS total_dirot,
  count(ktovet) AS with_ktovet,
  count(baalim_shem) AS with_baalim
FROM dirot;
