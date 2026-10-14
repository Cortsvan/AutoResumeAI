import React from 'react';

export function Badge({ children, variant = 'neutral', size = 'sm', className = '' }) {
  const variants = {
    neutral: 'bg-sunken text-ink-soft border-line',
    accent: 'bg-accent-soft text-accent border-accent-line',
    ok: 'bg-ok-soft text-ok border-ok-line',
    warn: 'bg-warn-soft text-warn border-warn-line',
    bad: 'bg-bad-soft text-bad border-bad-line',
  };

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5 rounded-sm font-medium',
    sm: 'text-xs px-2 py-0.5 rounded font-medium',
    md: 'text-xs px-2.5 py-1 rounded font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center border ${variants[variant] || variants.neutral} ${
        sizes[size]
      } ${className}`}
    >
      {children}
    </span>
  );
}
