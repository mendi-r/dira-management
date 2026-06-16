import React, { useEffect, useState, useCallback } from 'react'
import { PlusCircle, Edit2, Trash2, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
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
    if (!confirm('למחוק הגדרה זו?')) return
    await supabase.from('hagdarot').delete().eq('id', id)
    toast('נמחק')
    load()
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

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'עריכת הגדרה' : 'הגדרה חדשה'}>
        <div className="space-y-4">
          <FormField label="מפתח" required>
            <Input
              value={form.mafteach ?? ''}
              onChange={e => setForm(f => ({ ...f, mafteach: e.target.value }))}
              placeholder="SETTING_KEY"
              className="font-mono"
            />
          </FormField>
          <FormField label="ערך">
            <Input value={form.erech ?? ''} onChange={e => setForm(f => ({ ...f, erech: e.target.value }))} placeholder="ערך" />
          </FormField>
          <FormField label="קטגוריה">
            <Input value={form.sug ?? ''} onChange={e => setForm(f => ({ ...f, sug: e.target.value }))} placeholder="כללי" />
          </FormField>
          <FormField label="תיאור">
            <Textarea value={form.teur ?? ''} onChange={e => setForm(f => ({ ...f, teur: e.target.value }))} placeholder="תיאור ההגדרה..." rows={2} />
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
