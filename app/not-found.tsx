import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-700">
      <p className="text-lg font-medium">הדף לא נמצא</p>
      <Link href="/app" className="text-sm text-blue-600 hover:underline">חזור למפה</Link>
    </div>
  )
}
