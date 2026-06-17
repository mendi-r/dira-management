import React, { useEffect, useState, useCallback } from 'react'
import { PlusCircle, Edit2, Trash2, Wrench, Upload, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, toInputDate, today, currency, logActivity } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { Table } from '../components/ui/Table'
import SearchInput from '../components/ui/SearchInput'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select, Textarea } from '../components/ui/FormField'
import { Tabs } from '../components/ui/Tabs'
import { PhoneCell } from '../components/ui/ContactButtons'
import FileUpload from '../components/ui/FileUpload'
import { useToast } from '../components/ui/Toast'

const EMPTY_T = {
  dirot_id:'', sug:'', teur:'', makom_bedira:'', status:'פתוח',
  adifut:'רגילה', taarich_pgisha:'', taarich_yaad:'',
  assigned_to:'', vendor_id:'', skhum:'', notes:'',
}
const EMPTY_V = { shem:'', tchum:'', telefon:'', avg_cost:'', notes:'' }

const STATUS_COLORS  = { פתוח:'red', 'בטיפול':'yellow', סגור:'green' }
const PRIORITY_COLORS = { גבוהה:'red', בינונית:'yellow', רגילה:'green', נמוכה:'gray' }

const TABS_T = [
  { key:'form',    label:'פרטי קריאה' },
  { key:'pritim',  label:'פרטי עבודה' },
  { key:'docs',    label:'מסמכים' },
]

export default function Tachzuka() {
  const toast = useToast()
  const [rows, setRows]       = useState([])
  const [dirot, setDirot]     = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [adifutFilter, setAdifutFilter] = useState('')
  const [modal, setModal]     = useState(false)
  const [activeTab, setActiveTab] = useState('form')
  const [form, setForm]       = useState(EMPTY_T)
  const [saving, setSaving]   = useState(false)
  const [pritim, setPritim]   = useState([])
  const [pritForm, setPritForm] = useState({ teur:'', skhum:'', vendor_id:'' })
  // Vendors management
  const [vendorModal, setVendorModal] = useState(false)
  const [vendorForm, setVendorForm]   = useState(EMPTY_V)
  const [vSaving, setVSaving]         = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    // select('*') בלי join — join client-side כדי למנוע שגיאות FK
    let q = supabase.from('tachzuka')
      .select('*')
      .order('id', { ascending: false })
    if (statusFilter) q = q.eq('status', statusFilter)
    if (adifutFilter) q = q.eq('adifut', adifutFilter)
    const [{ data: t, error: tErr }, { data: d }, { data: v }] = await Promise.all([
      q,
      supabase.from('dirot').select('id,ktovet,ir').order('ktovet'),
      supabase.from('vendors').select('*').order('shem'),
    ])
    if (tErr) console.error('tachzuka load error:', tErr)
    setRows(t ?? []); setDirot(d ?? []); setVendors(v ?? [])
    setLoading(false)
  }, [statusFilter, adifutFilter])

  useEffect(() => { load() }, [load] )

  async function loadPritim(id) {
    const { data } = await supabase.from('tachzuka_pritim')
      .select('*, vendors(shem,telefon)')
      .eq('tachzuka_id', id)
    setPritim(data??[])
  }

  // client-side: מחפש כתובת דירה מהמערך המקומי
  function getDiraLabel(dirotId) {
    const d = dirot.find(d => d.id === dirotId)
    return d ? `${d.ktovet}${d.ir ? ', ' + d.ir : ''}` : '—'
  }

  const filtered = rows.filter(r =>
    `${r.teur??''} ${r.sug??''} ${r.assigned_to??''} ${getDiraLabel(r.dirot_id)} ${r.makom_bedira??''}`
      .toLowerCase().includes(search.toLowerCase())
  )

  function openNew()  { setForm({ ...EMPTY_T, taarich_pgisha: today() }); setActiveTab('form'); setPritim([]); setModal(true) }
  function openEdit(r){
    setForm({ ...EMPTY_T, ...r, taarich_pgisha: toInputDate(r.taarich_pgisha), taarich_yaad: toInputDate(r.taarich_yaad) })
    setActiveTab('form')
    if (r.id) loadPritim(r.id)
    setModal(true)
  }

  function set(f) { return e => setForm(fm=>({...fm,[f]:e.target.value})) }

  async function save() {
    if (!form.dirot_id) { toast('יש לבחור דירה','error'); return }
    setSaving(true)
    const payload = {
      dirot_id: form.dirot_id, sug: form.sug, teur: form.teur, makom_bedira: form.makom_bedira,
      status: form.status, adifut: form.adifut, assigned_to: form.assigned_to,
      vendor_id: form.vendor_id||null, notes: form.notes,
      skhum: form.skhum ? Number(form.skhum) : null,
      taarich_pgisha: form.taarich_pgisha||null, taarich_yaad: form.taarich_yaad||null,
    }
    const isNew = !form.id
    const { data, error } = isNew
      ? await supabase.from('tachzuka').insert(payload).select().single()
      : await supabase.from('tachzuka').update(payload).eq('id', form.id).select().single()
    setSaving(false)
    if (error) { toast(error.message,'error'); return }
    logActivity(isNew?'INSERT':'UPDATE','tachzuka',data.id,form.teur)
    toast(isNew?'קריאה נוספה':'עודכן')

    // WhatsApp לאיש הקשר / ספק אם קריאה חדשה
    if (isNew && form.vendor_id) {
      const vendor = vendors.find(v => v.id === form.vendor_id)
      if (vendor?.telefon) {
        const dira = getDiraLabel(form.dirot_id)
        const msg = encodeURIComponent(
          `שלום ${vendor.shem || ''},\nקריאת תחזוקה חדשה:\nדירה: ${dira}\nסוג: ${form.sug || ''}\nתיאור: ${form.teur || ''}\nאדיפות: ${form.adifut || ''}`
        )
        const phone = vendor.telefon.replace(/\D/g, '').replace(/^0/, '972')
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
      }
    }

    if (isNew) { setForm(f=>({...f,id:data.id})); setActiveTab('pritim') }
    load(true)
  }

  async function addPritat() {
    if (!pritForm.teur || !form.id) return
    await supabase.from('tachzuka_pritim').insert({
      tachzuka_id: form.id,
      teur: pritForm.teur,
      skhum: pritForm.skhum ? Number(pritForm.skhum) : null,
      vendor_id: pritForm.vendor_id || null,
    })
    setPritForm({ teur:'', skhum:'', vendor_id:'' })
    loadPritim(form.id); toast('פריט נוסף')
  }

  async function removePritat(id) {
    await supabase.from('tachzuka_pritim').delete().eq('id', id)
    loadPritim(form.id); toast('נמחק')
  }

  async function remove(id) {
    if (!await confirm('למחוק קריאה?', { danger: true })) return
    await supabase.from('tachzuka').delete().eq('id', id)
    toast('נמחק'); load(true)
  }

  // Vendor CRUD
  async function saveVendor() {
    if (!vendorForm.shem) { toast('שם חובה','error'); return }
    setVSaving(true)
    const payload = { ...vendorForm, avg_cost: vendorForm.avg_cost ? Number(vendorForm.avg_cost) : null }
    const isNew = !vendorForm.id
    delete payload.id; delete payload.created_at; delete payload.user_id
    const { error } = isNew
      ? await supabase.from('vendors').insert(payload)
      : await supabase.from('vendors').update(payload).eq('id', vendorForm.id)
    setVSaving(false)
    if (error) { toast(error.message,'error'); return }
    toast(isNew?'ספק נוסף':'עודכן'); setVendorModal(false); load(true)
  }

  const totalCost = pritim.reduce((s,p) => s + Number(p.skhum??0), 0)

  const columns = [
    { key:'dirot_id',    label:'דירה',    render:v=>getDiraLabel(v) },
    { key:'makom_bedira',label:'מיקום' },
    { key:'sug',         label:'סוג' },
    { key:'teur',        label:'תיאור', render:v=><span className="max-w-[200px] truncate block">{v??'—'}</span> },
    { key:'adifut',      label:'עדיפות', render:v=><Badge color={PRIORITY_COLORS[v]??'gray'}>{v??'—'}</Badge> },
    { key:'assigned_to', label:'אחזקה' },
    { key:'taarich_yaad',label:'יעד',    render:v=>formatDate(v) },
    { key:'skhum',       label:'עלות',   render:v=>currency(v) },
    { key:'status',      label:'סטטוס',  render:v=><Badge color={STATUS_COLORS[v]??'gray'}>{v??'—'}</Badge> },
    { key:'actions',     label:'', width:80, render:(_,row)=>(
      <div className="flex gap-1">
        <button onClick={e=>{e.stopPropagation();openEdit(row)}} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14}/></button>
        <button onClick={e=>{e.stopPropagation();remove(row.id)}} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="תיאור, סוג, דירה, אחזקה..."/></div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הסטטוסים</option>
          <option value="פתוח">פתוח</option>
          <option value="בטיפול">בטיפול</option>
          <option value="סגור">סגור</option>
        </select>
        <select value={adifutFilter} onChange={e=>setAdifutFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל העדיפויות</option>
          <option value="גבוהה">גבוהה</option>
          <option value="בינונית">בינונית</option>
          <option value="רגילה">רגילה</option>
          <option value="נמוכה">נמוכה</option>
        </select>
        <Button variant="secondary" icon={Wrench} onClick={()=>{ setVendorForm(EMPTY_V); setVendorModal(true) }}>ספקים</Button>
        <Button icon={PlusCircle} onClick={openNew}>קריאה חדשה</Button>
      </div>

      <p className="text-sm text-slate-400">{filtered.length} קריאות</p>
      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו קריאות" onRowClick={openEdit}/>

      {/* Tachzuka Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={form.id?'עריכת קריאה':'קריאה חדשה'} size="xl">
        <Tabs tabs={TABS_T} active={activeTab} onChange={setActiveTab}/>

        {/* ── Form ── */}
        {activeTab==='form' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="דירה" required>
              <Select value={form.dirot_id??''} onChange={set('dirot_id')}>
                <option value="">-- בחר דירה --</option>
                {dirot.map(d=><option key={d.id} value={d.id}>{d.ktovet}{d.ir?`, ${d.ir}`:''}</option>)}
              </Select>
            </FormField>
            <FormField label="סוג תקלה">
              <Select value={form.sug??''} onChange={set('sug')}>
                <option value="">-- בחר סוג --</option>
                {['אינסטלציה','חשמל','צביעה','מזגן','ריהוט','דלתות','חלונות','אחר'].map(s=><option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>
            <FormField label="מיקום בדירה"><Input value={form.makom_bedira??''} onChange={set('makom_bedira')} placeholder="סלון, חדר שינה..."/></FormField>
            <FormField label="עדיפות">
              <Select value={form.adifut??'רגילה'} onChange={set('adifut')}>
                <option value="גבוהה">גבוהה</option>
                <option value="בינונית">בינונית</option>
                <option value="רגילה">רגילה</option>
                <option value="נמוכה">נמוכה</option>
              </Select>
            </FormField>
            <FormField label="תאריך דיווח"><Input type="date" value={form.taarich_pgisha??''} onChange={set('taarich_pgisha')}/></FormField>
            <FormField label="תאריך יעד לטיפול"><Input type="date" value={form.taarich_yaad??''} onChange={set('taarich_yaad')}/></FormField>
            <FormField label="הקצה לאיש אחזקה"><Input value={form.assigned_to??''} onChange={set('assigned_to')} placeholder="שם איש אחזקה"/></FormField>
            <FormField label="ספק קבוע">
              <Select value={form.vendor_id??''} onChange={set('vendor_id')}>
                <option value="">-- ללא ספק --</option>
                {vendors.map(v=><option key={v.id} value={v.id}>{v.shem} ({v.tchum})</option>)}
              </Select>
            </FormField>
            <FormField label="עלות משוערת (₪)"><Input type="number" min="0" value={form.skhum??''} onChange={set('skhum')}/></FormField>
            <FormField label="סטטוס">
              <Select value={form.status??'פתוח'} onChange={set('status')}>
                <option value="פתוח">פתוח</option>
                <option value="בטיפול">בטיפול</option>
                <option value="סגור">סגור</option>
              </Select>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="תיאור הליקוי"><Textarea value={form.teur??''} onChange={set('teur')} placeholder="תאר את הבעיה..." rows={3}/></FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="הערות"><Textarea value={form.notes??''} onChange={set('notes')} rows={2}/></FormField>
            </div>
          </div>
        )}

        {/* ── Pritim ── */}
        {activeTab==='pritim' && (
          <div className="space-y-4">
            {pritim.length>0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-right text-slate-500 border-b">
                    <th className="pb-2 font-medium">תיאור</th>
                    <th className="pb-2 font-medium">ספק</th>
                    <th className="pb-2 font-medium">עלות</th>
                    <th/>
                  </tr></thead>
                  <tbody>
                    {pritim.map((p,i)=>(
                      <tr key={p.id??i} className="border-b border-slate-100">
                        <td className="py-2">{p.teur}</td>
                        <td className="py-2">{p.vendors?.shem??'—'}</td>
                        <td className="py-2">{currency(p.skhum)}</td>
                        <td className="py-2 text-left">
                          <button onClick={()=>removePritat(p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold text-teal-700">
                      <td colSpan={2} className="pt-2">סיכום</td>
                      <td className="pt-2">{currency(totalCost)}</td>
                      <td/>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Input value={pritForm.teur} onChange={e=>setPritForm(f=>({...f,teur:e.target.value}))} placeholder="תיאור פריט"/>
              <Select value={pritForm.vendor_id} onChange={e=>setPritForm(f=>({...f,vendor_id:e.target.value}))}>
                <option value="">-- ספק --</option>
                {vendors.map(v=><option key={v.id} value={v.id}>{v.shem}</option>)}
              </Select>
              <Input type="number" value={pritForm.skhum} onChange={e=>setPritForm(f=>({...f,skhum:e.target.value}))} placeholder="עלות ₪"/>
            </div>
            <Button variant="secondary" onClick={addPritat}>+ הוסף פריט</Button>
            {!form.id && <p className="text-xs text-amber-600">שמור את הקריאה תחילה להוספת פרטים</p>}
          </div>
        )}

        {/* ── Docs ── */}
        {activeTab==='docs' && (
          <FileUpload entityType="tachzuka" entityId={form.id} bucket="tachzuka-docs"/>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={()=>setModal(false)}>סגור</Button>
          {activeTab==='form' && <Button loading={saving} onClick={save}>שמור</Button>}
        </div>
      </Modal>

      {/* Vendor Modal */}
      <Modal open={vendorModal} onClose={()=>setVendorModal(false)} title="ספקים קבועים" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="שם ספק"><Input value={vendorForm.shem??''} onChange={e=>setVendorForm(f=>({...f,shem:e.target.value}))}/></FormField>
            <FormField label="תחום">
              <Select value={vendorForm.tchum??''} onChange={e=>setVendorForm(f=>({...f,tchum:e.target.value}))}>
                <option value="">-- בחר --</option>
                {['חשמלאי','אינסטלטור','מזגנאי','צייר','נגר','מסגר','ניקיון','אחר'].map(s=><option key={s}>{s}</option>)}
              </Select>
            </FormField>
            <FormField label="טלפון"><Input value={vendorForm.telefon??''} onChange={e=>setVendorForm(f=>({...f,telefon:e.target.value}))}/></FormField>
            <FormField label="עלות ממוצעת (₪)"><Input type="number" value={vendorForm.avg_cost??''} onChange={e=>setVendorForm(f=>({...f,avg_cost:e.target.value}))}/></FormField>
            <div className="sm:col-span-2">
              <FormField label="הערות"><Input value={vendorForm.notes??''} onChange={e=>setVendorForm(f=>({...f,notes:e.target.value}))}/></FormField>
            </div>
          </div>
          <Button loading={vSaving} onClick={saveVendor}>הוסף / עדכן ספק</Button>

          {/* Vendors List */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-2">
              <thead><tr className="text-right text-slate-500 border-b">
                <th className="pb-2 font-medium">שם</th><th className="pb-2 font-medium">תחום</th>
                <th className="pb-2 font-medium">טלפון</th><th className="pb-2 font-medium">עלות ממוצעת</th><th/>
                           </tr></thead>
              <tbody>
                {vendors.map(v=>(
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="py-1.5">{v.shem}</td>
                    <td>{v.tchum}</td>
                    <td>{v.telefon}</td>
                    <td>{v.avg_cost ? `₪${v.avg_cost}` : '—'}</td>
                    <td>
                      <button onClick={()=>removeVendor(v.id)} className="p-1 text-slate-400 hover:text-red-500">
                        <Trash2 size={13}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="secondary" onClick={()=>setVendorModal(false)}>סגור</Button>
        </div>
      </Modal>
    </div>
  )
}
