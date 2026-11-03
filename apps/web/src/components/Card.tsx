import { HTMLAttributes, ReactNode } from 'react';

export function Card({ children, className = '', ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`bg-sali-gray-950 border border-sali-gray-800 rounded-xl p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,.6)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
