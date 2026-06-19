'use client'

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

let toastQueue: ToastMessage[] = []
let listeners: Array<(toasts: ToastMessage[]) => void> = []

function notify() {
  for (const l of listeners) l([...toastQueue])
}

export function toast(message: string, type: ToastType = 'success') {
  const id = crypto.randomUUID()
  toastQueue = [...toastQueue, { id, type, message }]
  notify()
  setTimeout(() => {
    toastQueue = toastQueue.filter(t => t.id !== id)
    notify()
  }, 4000)
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

const COLORS: Record<ToastType, string> = {
  success: 'bg-green-800 text-white',
  error: 'bg-red-700 text-white',
  info: 'bg-slate-800 text-white',
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    listeners.push(setToasts)
    return () => {
      listeners = listeners.filter(l => l !== setToasts)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 start-4 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${COLORS[t.type]}`}
        >
          <span>{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
