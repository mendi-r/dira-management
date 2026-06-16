import React from 'react'
import { Phone, Mail, MessageCircle } from 'lucide-react'
import { waUrl } from '../../lib/utils'

/** כפתורי יצירת קשר - WhatsApp, טלפון, מייל */
export function ContactButtons({ phone, email, size = 15 }) {
  const wa = waUrl(phone)
  return (
    <div className="flex items-center gap-1">
      {phone && (
        <>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            title={`WhatsApp: ${phone}`}
            onClick={e => e.stopPropagation()}
            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            <MessageCircle size={size} />
          </a>
          <a
            href={`tel:${phone}`}
            title={`טלפון: ${phone}`}
            onClick={e => e.stopPropagation()}
            className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Phone size={size} />
          </a>
        </>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          title={`מייל: ${email}`}
          onClick={e => e.stopPropagation()}
          className="p-1 rounded text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Mail size={size} />
        </a>
      )}
    </div>
  )
}

/** תצוגת טלפון עם כפתורים */
export function PhoneCell({ phone }) {
  if (!phone) return <span className="text-slate-300">—</span>
  return (
    <div className="flex items-center gap-1">
      <span className="text-slate-700 text-sm">{phone}</span>
      <ContactButtons phone={phone} size={13} />
    </div>
  )
}

/** תצוגת מייל עם כפתור */
export function EmailCell({ email }) {
  if (!email) return <span className="text-slate-300">—</span>
  return (
    <div className="flex items-center gap-1">
      <span className="text-slate-700 text-sm truncate max-w-[160px]">{email}</span>
      <ContactButtons email={email} size={13} />
    </div>
  )
}

/** כפתור WhatsApp עם הודעה מוכנה */
export function WhatsAppTemplate({ phone, message }) {
  const wa = waUrl(phone)
  if (!wa) return null
  const encoded = encodeURIComponent(message)
  return (
    <a
      href={`${wa}?text=${encoded}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700
                 text-white text-xs font-medium rounded-lg transition-colors"
    >
      <MessageCircle size={13} />
      שלח תזכורת WhatsApp
    </a>
  )
}
