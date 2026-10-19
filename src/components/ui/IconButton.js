'use client';

export default function IconButton({ 
  children, 
  onClick, 
  className = '',
  ariaLabel,
  variant = 'default'
}) {
  const variants = {
    default: 'hover:bg-black/20',
    primary: 'hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary)]',
    ghost: 'hover:scale-110',
  };
  
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`p-2 rounded transition-all duration-300 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
