export type BadgeVariant = 'amber' | 'red' | 'gold' | 'green' | 'navy' | 'slate'

interface BadgeProps {
  label: string
  variant: BadgeVariant
  className?: string
}

// Small reusable pill. Kept generic (label + color variant) so both the Cola tipo badges
// (Task 13) and the Maestro fuente/metodo badges (Task 14) can share it.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  amber: 'bg-amber/15 text-amber',
  red: 'bg-red/10 text-red',
  gold: 'bg-gold/25 text-ink',
  green: 'bg-green/10 text-green',
  navy: 'bg-navy/10 text-navy',
  slate: 'bg-line text-slate',
}

export default function Badge({ label, variant, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {label}
    </span>
  )
}
