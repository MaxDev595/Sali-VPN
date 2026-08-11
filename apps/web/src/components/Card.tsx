import { HTMLAttributes, ReactNode } from 'react';

export function Card({ children, className = '', ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`bg-sali-gray-950 border border-sali-gray-800 rounded-lg p-5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
