# מערכת ניהול דירות ובחורים

## הפעלה ראשונה

```bash
cd dira-management
npm install
npm run dev
```

הפרויקט יפתח בדפדפן בכתובת: http://localhost:5173

## מבנה הפרויקט

```
src/
├── lib/supabase.js          # חיבור Supabase + עזרי תאריך/Storage
├── contexts/AuthContext.jsx  # ניהול Authentication
├── components/
│   ├── Layout.jsx           # מעטפת ראשית
│   ├── Sidebar.jsx          # תפריט צד
│   ├── Header.jsx           # כותרת עליונה
│   └── ui/                  # רכיבי UI שימושיים
│       ├── Modal, Table, Button, Badge
│       ├── FormField (Input/Select/Textarea)
│       ├── Card (StatCard, CardHeader, CardBody)
│       ├── SearchInput, Toast
└── pages/
    ├── Login.jsx      # כניסה למערכת
    ├── Dashboard.jsx  # לוח בקרה
    ├── Bochurim.jsx   # ניהול בחורים + העלאת מסמכים
    ├── Dirot.jsx      # ניהול דירות
    ├── Shibutzim.jsx  # שיבוצים
    ├── Gviya.jsx      # גבייה + סטטיסטיקות
    ├── Tachzuka.jsx   # תחזוקה + פרטי עבודה
    ├── Monim.jsx      # קריאות מונים
    └── Hagdarot.jsx   # הגדרות מערכת
```

## טבלאות Supabase
bochurim · dirot · shibutzim · gviya · tachzuka · tachzuka_pritim · riut · hagdarot
