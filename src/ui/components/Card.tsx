import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export default function Card({ children, className = '' }: CardProps) {
  return <div className={`bg-panel border border-line rounded-lg p-5 ${className}`}>{children}</div>
}
