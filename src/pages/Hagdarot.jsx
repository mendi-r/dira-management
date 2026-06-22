import React, { useEffect, useState, useCallback } from 'react'
import { PlusCircle, Edit2, Trash2, Settings, AlertTriangle, Download, Gauge } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { confirm } from '../lib/confirm'
import { Table } from '../components/ui/Table'
import SearchInput from '../components/ui/SearchInput'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select, Textarea } from '../components/ui/FormField'
import { useToast } from '../components/ui/Toast'
import { Card, CardHeader, CardBody } from '../components/ui/Card'

const EMPTY = { mafteach: '', erech: '', sug: 'כללי', teur: '' }

export default function Hagdarot() {
  const toast = useToast()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [sugFilter, setSugFilter] = useState('')
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('hagdarot').select('*').order('mafteach')
    if (sugFilter) q = q.eq('sug', sugFilter)
    const { data } = await q
    setRows(data ?? [])
    // חשב מחירי מונים מהנתונים שכבר נטענו — ללא שאילתה נוספת
    const pm = {}
    ;(data ?? []).filter(h => ['PRICE_HASHMAL','PRICE_MAYIM','PRICE_GAZ'].includes(h.mafteach))
      .forEach(h => { pm[h.mafteach] = h.erech })
    setMoneimPrices({ hashmal: pm['PRICE_HASHMAL'] ?? '', mayim: pm['PRICE_MAYIM'] ?? '', gaz: pm['PRICE_GAZ'] ?? '' })
    setLoading(false)
  }, [sugFilter])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r =>
    `${r.mafteach ?? ''} ${r.erech ?? ''} ${r.teur ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const sugs = [...new Set(rows.map(r => r.sug).filter(Boolean))]

  function openNew()  { setForm(EMPTY); setModal(true) }
  function openEdit(r){ setForm({ ...EMPTY, ...r }); setModal(true) }

  async function save() {
    if (!form.mafteach) { toast('מפתח חובה', 'error'); return }
    setSaving(true)
    const { error } = form.id
      ? await supabase.from('hagdarot').update(form).eq('id', form.id)
      : await supabase.from('hagdarot').insert(form)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(form.id ? 'עודכן' : 'נוסף')
    setModal(false)
    load()
  }

  async function remove(id) {
    if (!await confirm('למחוק הגדרה זו?', { danger: true })) return
    await supabase.from('hagdarot').delete().eq('id', id)
    toast('נמחק')
    load()
  }

  const [moneimPrices, setMoneimPrices]   = useState({ hashmal: '', mayim: '', gaz: '' })
  const [pricesSaving, setPricesSaving]   = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  async function saveMoneimPrices() {
    setPricesSaving(true)
    const { error } = await supabase.rpc('save_monim_prices', {
      p_hashmal: String(moneimPrices.hashmal ?? '0'),
      p_mayim:   String(moneimPrices.mayim   ?? '0'),
      p_gaz:     String(moneimPrices.gaz     ?? '0'),
    })
    setPricesSaving(false)
    if (error) { toast('שגיאה: ' + error.message, 'error'); return }
    toast('מחירי מונים עודכנו ✓')
    await load()
  }

  async function exportAll() {
    setExportLoading(true)
    const tables = [
      'bochurim','dirot','shibutzim','gviya','tashlumim_baalim',
      'chozim','tachzuka','tachzuka_pritim','riut','documents',
      'activity_log','hagdarot','vendors',
    ]
    const result = {}
    for (const t of tables) {
      const { data } = await supabase.from(t).select('*')
      result[t] = data ?? []
    }
    result._exported_at = new Date().toISOString()
    result._version = '1.0'
    const json = JSON.stringify(result, null, 2)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dira-backup-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    setExportLoading(false)
    toast(`ייצוא הושלם — ${Object.values(result).filter(Array.isArray).reduce((s,a)=>s+a.length,0)} רשומות`)
  }

  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteStep, setDeleteStep]   = useState(1) // 1=confirm, 2=type, 3=deleting
  const [deleteInput, setDeleteInput] = useState('')
  const DELETE_PHRASE = 'מחק הכל'

  async function deleteAllData() {
    setDeleteStep(3)
    const tables = [
      'gviya',
      'tashlumim_baalim',
      'shibutzim',
      'tachzuka_pritim',
      'tachzuka',
      'riut',
      'documents',
      'activity_log',
      'bochurim',
      'dirot',
      'vendors',
      'hagdarot',
    ]
    const errors = []
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().not('id', 'is', null)
      if (error && !error.message.includes('does not exist')) errors.push(`${table}: ${error.message}`)
    }
    setDeleteModal(false)
    setDeleteStep(1)
    setDeleteInput('')
    if (errors.length) {
      toast(`שגיאות: ${errors.join(' | ')}`, 'error')
    } else {
      toast('כל הנתונים נמחקו בהצלחה')
      load()
    }
  }

  const columns = [
    { key: 'mafteach', label: 'מפתח', render: v => <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">{v}</code> },
    { key: 'erech',    label: 'ערך' },
    { key: 'sug',      label: 'קטגוריה', render: v => <Badge color="teal">{v ?? '—'}</Badge> },
    { key: 'teur',     label: 'תיאור' },
    {
      key: 'actions', label: '', width: 80,
      render: (_, row) => (
        <div className="flex gap-1">
          <button onClick={e => { e.stopPropagation(); openEdit(row) }} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14} /></button>
          <button onClick={e => { e.stopPropagation(); remove(row.id) }} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-6 fade-in">
      {/* Info Card */}
      <Card className="bg-teal-50 border-teal-200">
        <CardBody>
          <div className="flex items-start gap-3">
            <Settings size={20} className="text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-teal-800">הגדרות מערכת</p>
              <p className="text-sm text-teal-600 mt-0.5">ניהול פרמטרים גלובליים של המערכת, כולל תעריפים, ברירות מחדל וקטגוריות.</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="חיפוש לפי מפתח, ערך..." />
        </div>
        <select
          value={sugFilter}
          onChange={e => setSugFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <option value="">כל הקטגוריות</option>
          {sugs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button icon={PlusCircle} onClick={openNew}>הגדרה חדשה</Button>
      </div>

      <p className="text-sm text-slate-400">{filtered.length} הגדרות</p>

      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו הגדרות" onRowClick={openEdit} />

      {/* מחירי מונים */}
      <div className="border border-teal-200 rounded-2xl overflow-hidden">
        <div className="bg-teal-50 px-5 py-3 border-b border-teal-200 flex items-center gap-2">
          <Gauge size={16} className="text-teal-600"/>
          <span className="font-semibold text-teal-700 text-sm">מחירי מונים</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">מחירים אלו ישמשו לחישוב אוטומטי של סכום לתשלום בקריאות מונים.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="חשמל (₪ לקוט״ש)">
              <Input type="number" step="0.01" value={moneimPrices.hashmal}
                onChange={e => setMoneimPrices(p => ({...p, hashmal: e.target.value}))} placeholder="0.00"/>
            </FormField>
            <FormField label="מים (₪ לקוב)">
              <Input type="number" step="0.01" value={moneimPrices.mayim}
                onChange={e => setMoneimPrices(p => ({...p, mayim: e.target.value}))} placeholder="0.00"/>
            </FormField>
            <FormField label="גז (₪ למ״ק)">
              <Input type="number" step="0.01" value={moneimPrices.gaz}
                onChange={e => setMoneimPrices(p => ({...p, gaz: e.target.value}))} placeholder="0.00"/>
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button loading={pricesSaving} onClick={saveMoneimPrices}>שמור מחירים</Button>
          </div>
        </div>
      </div>

      {/* ייצוא מלא */}
      <div className="border border-teal-200 rounded-2xl overflow-hidden">
        <div className="bg-teal-50 px-5 py-3 border-b border-teal-200 flex items-center gap-2">
          <Download size={16} className="text-teal-600"/>
          <span className="font-semibold text-teal-700 text-sm">גיבוי וייצוא</span>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-800 text-sm">ייצוא מלא של כל הנתונים</p>
            <p className="text-xs text-slate-500 mt-0.5">מוריד קובץ JSON עם כל הטבלאות — בחורים, דירות, שיבוצים, גבייה, תשלומים וכל שאר הנתונים.</p>
          </div>
          <Button icon={Download} loading={exportLoading} onClick={exportAll} className="flex-shrink-0 mr-4">
            ייצוא מלא
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-2xl overflow-hidden">
        <div className="bg-red-50 px-5 py-3 border-b border-red-200 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600"/>
          <span className="font-semibold text-red-700 text-sm">אזור מסוכן</span>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-800 text-sm">מחיקת כל הנתונים</p>
            <p className="text-xs text-slate-500 mt-0.5">ימחקו לצמיתות: בחורים, דירות, שיבוצים, גבייה, תשלומים, תחזוקה, מונים וכל שאר הנתונים.</p>
          </div>
          <button
            onClick={() => { setDeleteModal(true); setDeleteStep(1); setDeleteInput('') }}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex-shrink-0 mr-4">
            מחק את כל הנתונים
          </button>
        </div>
      </div>

      {/* Delete All Modal */}
      <Modal open={deleteModal} onClose={() => { if (deleteStep !== 3) { setDeleteModal(false); setDeleteStep(1); setDeleteInput('') } }} title="מחיקת כל הנתונים" size="md">
        {deleteStep === 1 && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="font-semibold text-red-800">פעולה בלתי הפיכה!</p>
                <p className="text-sm text-red-700 mt-1">כל הנתונים ימחקו לצמיתות — בחורים, דירות, שיבוצים, גבייה, תשלומים לבעלים, תחזוקה, קריאות מונים, מסמכים, ויומן פעילות.</p>
                <p className="text-sm text-red-700 mt-1 font-medium">לא ניתן לשחזר את הנתונים לאחר המחיקה!</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDeleteModal(false)}>ביטול</Button>
              <button onClick={() => setDeleteStep(2)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg">
                אני מבין, המשך
              </button>
            </div>
          </div>
        )}

        {deleteStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              כדי לאשר, הקלד <span className="font-bold text-red-600 font-mono">{DELETE_PHRASE}</span> בשדה למטה:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={DELETE_PHRASE}
              dir="rtl"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteModal(false)}>ביטול</Button>
              <button
                onClick={deleteAllData}
                disabled={deleteInput !== DELETE_PHRASE}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                         deleteInput === DELETE_PHRASE
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-red-200 cursor-not-allowed'
                }`}>
                מחק את כל הנתונים
              </button>
            </div>
          </div>
        )}
        {deleteStep === 3 && (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-500 border-t-transparent"/>
            <p className="text-sm text-slate-600">מוחק נתונים... אנא המתן</p>
          </div>
        )}
      </Modal>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'עריכת הגדרה' : 'הגדרה חדשה'}>
        <div className="space-y-4">
          <FormField label="מפתח" required>
            <Input value={form.mafteach ?? ''} onChange={e => setForm(f => ({ ...f, mafteach: e.target.value }))} placeholder="SETTING_KEY" className="font-mono"/>
          </FormField>
          <FormField label="ערך">
            <Input value={form.erech ?? ''} onChange={e => setForm(f => ({ ...f, erech: e.target.value }))} placeholder="ערך"/>
          </FormField>
          <FormField label="קטגוריה">
            <Input value={form.sug ?? ''} onChange={e => setForm(f => ({ ...f, sug: e.target.value }))} placeholder="כללי"/>
          </FormField>
          <FormField label="תיאור">
            <Textarea value={form.teur ?? ''} onChange={e => setForm(f => ({ ...f, teur: e.target.value }))} placeholder="תיאור ההגדרה..." rows={2}/>
          </FormField>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>ביטול</Button>
          <Button loading={saving} onClick={save}>שמור</Button>
        </div>
      </Modal>
    </div>
  )
}
