import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
})

export const IconToday = (p: IconProps) => (
  <svg {...base(p)}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
)
export const IconPlan = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 14h3M8 17h6" /></svg>
)
export const IconFood = (p: IconProps) => (
  <svg {...base(p)}><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 2-3 4-3 7h3v11M17 3v18" /></svg>
)
export const IconProgress = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 20h18M5 16l4-5 4 3 6-8" /><path d="M15 6h4v4" /></svg>
)
export const IconProfile = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
)
export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
)
export const IconChevron = ({ direction = 'right', ...p }: IconProps & { direction?: 'left' | 'right' }) => (
  <svg {...base(p)}><path d={direction === 'right' ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} /></svg>
)
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={3}><path d="M5 12.5 10 17 19 7" /></svg>
)
export const IconClose = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
