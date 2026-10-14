import React from 'react';

export function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  className = '',
  onClick,
  type = 'button',
  title,
  icon: Icon,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 rounded-sm gap-1.5 h-7',
    md: 'text-sm px-3.5 py-2 rounded gap-2 h-9',
    lg: 'text-base px-4 py-2.5 rounded-md gap-2.5 h-11',
  };

  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-hover shadow-panel border border-transparent',
    secondary: 'bg-sunken text-ink hover:bg-line-strong border border-line',
    outline: 'bg-surface text-ink hover:bg-sunken border border-line-strong hover:border-ink-faint shadow-panel',
    ghost: 'text-ink-soft hover:text-ink hover:bg-sunken border border-transparent',
    danger: 'bg-bad text-white hover:opacity-90 shadow-panel border border-transparent',
    dangerGhost: 'text-bad hover:bg-bad-soft border border-transparent',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant] || variants.primary} ${className}`}
      title={title}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />
      ) : null}
      {children}
    </button>
  );
}
