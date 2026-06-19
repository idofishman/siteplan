'use client'

export function AiSuggestionsButton() {
  return (
    <button
      disabled
      title="בקרוב"
      className="relative flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
      aria-label="הצעות AI — בקרוב"
    >
      <span>✨</span>
      <span>הצעות AI</span>
      <span className="absolute -top-2 -start-1 text-[10px] bg-amber-400 text-amber-900 font-bold px-1 rounded">בקרוב</span>
    </button>
  )
}
