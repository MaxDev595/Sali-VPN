import { ButtonHTMLAttributes, ReactNode } from 'react';
import { telegram } from '../lib/telegram';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
}

export function Button({ children, variant = 'primary', fullWidth = true, className = '', onClick, ...rest }: Props) {
  const base =
    'press-feedback rounded-lg font-semibold text-[15px] py-4 px-6 flex items-center justify-center gap-2 disabled:opacity-40';
  const variants: Record<string, string> = {
    primary: 'bg-white text-black',
    secondary: 'bg-sali-gray-900 text-white border border-sali-gray-700',
    danger: 'bg-sali-gray-900 text-sali-danger border border-sali-gray-700',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      onClick={(e) => {
        telegram.haptic.light();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
