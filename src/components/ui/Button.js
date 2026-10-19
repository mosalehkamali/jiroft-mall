'use client';

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  className = '',
  disabled = false,
  type = 'button'
}) {
  const baseStyles = 'font-medium transition-all duration-300 border-2';
  
  const variants = {
    primary: 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white hover:bg-transparent hover:text-[var(--color-primary)] rounded-[var(--radius)]',
    secondary: 'bg-[var(--color-secondary)] border-[var(--color-secondary)] text-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-secondary)]',
    outline: 'bg-transparent border-black/20 hover:bg-[var(--color-text)] hover:text-[#fff]',
    ghost: 'bg-transparent border-transparent hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {children}
    </button>
  );
}
