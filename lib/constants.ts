import type { PageStatus } from '@/types'

export const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#F43F5E', '#A855F7', '#0EA5E9', '#22C55E',
  '#64748B',
] as const

export const TEMPLATES = [
  'page', 'hub', 'homepage', 'faculty', 'department', 'degree',
  'blog', 'blog-post', 'course', 'staff', 'staff-directory',
  'research', 'research-center', 'research-network',
  'registration', 'campus', 'student-life', 'portal',
  'event', 'form', 'archive', 'gallery',
] as const

export const STATUS_LABELS: Record<PageStatus, string> = {
  planned:      'מתוכנן',
  existing:     'קיים',
  in_progress:  'בעבודה',
  needs_review: 'ממתין לאישור',
  approved:     'מאושר',
  deprecated:   'מיושן',
  redirect:     'ריידיירקט',
  archived:     'בארכיון',
}

export const STATUS_COLORS: Record<PageStatus, { bg: string; text: string }> = {
  planned:      { bg: '#EFF6FF', text: '#3B82F6' },
  existing:     { bg: '#F0FDF4', text: '#16A34A' },
  in_progress:  { bg: '#FFF7ED', text: '#EA580C' },
  needs_review: { bg: '#FEFCE8', text: '#CA8A04' },
  approved:     { bg: '#F0FDF4', text: '#15803D' },
  deprecated:   { bg: '#F1F5F9', text: '#64748B' },
  redirect:     { bg: '#FDF4FF', text: '#9333EA' },
  archived:     { bg: '#FFF1F2', text: '#E11D48' },
}
