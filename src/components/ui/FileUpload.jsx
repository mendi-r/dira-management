import React, { useState, useEffect } from 'react'
import { Upload, FileText, Trash2, ExternalLink, Loader2, Link as LinkIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from './Toast'
import { Input, FormField } from './FormField'
import { confirm } from '../../lib/confirm'
import Button from './Button'

/**
 * FileUpload — component for uploading files and linking to Google Drive
 * Props:
 *   entityType: 'bochurim' | 'dirot' | 'tachzuka'
 *   entityId: UUID
 *   bucket: string (Supabase storage bucket)
 */
export default function FileUpload({ entityType, entityId, bucket = 'documents' }) {
  const toast = useToast()
  const [docs, setDocs]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [driveLink, setDriveLink] = useState('')
  const [driveName, setDriveName] = useState('')
  const [docType, setDocType]     = useState('acher')

  useEffect(() => {
    if (entityId) loadDocs()
  }, [entityId])

  async function loadDocs() {
    setLoading(true)
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
    setLoading(false)
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !entityId) return
    setUploading(true)
    try {
      const path = `${entityType}/${entityId}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
      await supabase.from('documents').insert({
        entity_type: entityType,
        entity_id: entityId,
        doc_name: file.name,
        doc_type: docType,
        file_url: urlData.publicUrl,
      })
      toast('הקובץ הועלה בהצלחה')
      loadDocs()
    } catch (err) {
      toast(err.message, 'error')
    }
    setUploading(false)
    e.target.value = ''
  }

  async function addDriveLink() {
    if (!driveLink || !entityId) return
    await supabase.from('documents').insert({
      entity_type: entityType,
      entity_id: entityId,
      doc_name: driveName || 'קישור Google Drive',
      doc_type: 'drive',
      drive_link: driveLink,
    })
    setDriveLink(''); setDriveName('')
    toast('הקישור נוסף')
    loadDocs()
  }

  async function removeDoc(doc) {
    if (!await confirm('למחוק מסמך זה?', { danger: true })) return
    if (doc.file_url) {
      // extract path from URL
      const parts = doc.file_url.split(`/${bucket}/`)
      if (parts[1]) await supabase.storage.from(bucket).remove([parts[1]])
    }
    await supabase.from('documents').delete().eq('id', doc.id)
    toast('נמחק')
    loadDocs()
  }

  const DOC_TYPES = [
    { value: 'darkon',  label: 'דרכון' },
    { value: 'viza',    label: 'ויזה' },
    { value: 'chozeh',  label: 'חוזה' },
    { value: 'bituach', label: 'ביטוח' },
    { value: 'acher',   label: 'אחר' },
  ]

  return (
    <div className="space-y-4">
      {/* Upload file */}
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="סוג מסמך">
          <select
            value={docType}
            onChange={e => setDocType(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 w-32"
          >
            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </FormField>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-teal-300
          bg-teal-50 cursor-pointer hover:bg-teal-100 text-sm text-teal-700 transition-colors
          ${(!entityId || uploading) ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'מעלה...' : 'העלה קובץ'}
          <input type="file" className="hidden" onChange={handleFileUpload} disabled={!entityId || uploading} />
        </label>
        {!entityId && <p className="text-xs text-slate-400">שמור תחילה להפעלת העלאה</p>}
      </div>

      {/* Google Drive link */}
      <div className="flex flex-wrap items-end gap-2">
        <FormField label="שם הקישור" className="flex-1 min-w-32">
          <Input value={driveName} onChange={e => setDriveName(e.target.value)} placeholder="שם לתצוגה" />
        </FormField>
        <FormField label="קישור Google Drive" className="flex-2 min-w-48">
          <Input value={driveLink} onChange={e => setDriveLink(e.target.value)} placeholder="https://drive.google.com/..." />
        </FormField>
        <Button variant="secondary" icon={LinkIcon} onClick={addDriveLink} className="mb-0.5">הוסף קישור</Button>
      </div>

      {/* Documents list */}
      {loading ? (
        <p className="text-sm text-slate-400">טוען מסמכים...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate-400">אין מסמכים</p>
      ) : (
        <ul className="space-y-2">
          {docs.map(doc => (
            <li key={doc.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              {doc.file_url
                ? <FileText size={16} className="text-blue-500 flex-shrink-0" />
                : <LinkIcon size={16} className="text-emerald-500 flex-shrink-0" />
              }
              <span className="text-sm flex-1 truncate">{doc.doc_name}</span>
              <span className="text-xs text-slate-400">{DOC_TYPES.find(t => t.value === doc.doc_type)?.label ?? doc.doc_type}</span>
              {(doc.file_url || doc.drive_link) && (
                <a
                  href={doc.file_url || doc.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                >
                  <ExternalLink size={14} />
                </a>
              )}
              <button onClick={() => removeDoc(doc)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
