import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-98';

  const sizeStyles = {
    xs: 'px-2.5 py-1 text-[11px] font-bold gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs hover:shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:-translate-y-0.5 focus:ring-indigo-500',
    secondary: 'bg-sky-500 hover:bg-sky-400 text-white shadow-xs hover:shadow-[0_0_20px_rgba(14,165,233,0.45)] hover:-translate-y-0.5 focus:ring-sky-400',
    outline: 'border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:-translate-y-0.5 focus:ring-indigo-400',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs hover:shadow-[0_0_20px_rgba(239,68,68,0.45)] hover:-translate-y-0.5 focus:ring-rose-500',
    ghost: 'hover:bg-slate-100/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white focus:ring-slate-400 hover:shadow-[0_0_12px_rgba(99,102,241,0.15)]',
    subtle: 'bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100/90 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-800/60 hover:shadow-[0_0_15px_rgba(99,102,241,0.25)] hover:-translate-y-0.5 focus:ring-indigo-400',
  };

  return (
    <button
      className={twMerge(
        clsx(
          baseStyles,
          sizeStyles[size],
          variantStyles[variant],
          fullWidth && 'w-full',
          className
        )
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
