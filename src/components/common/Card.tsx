import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'highlight' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  padding = 'md',
  interactive = false,
  ...props
}) => {
  const baseStyles = 'bg-white rounded-2xl transition-all duration-300 backdrop-blur-md';

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  const variantStyles = {
    default: 'border border-slate-200/80 shadow-xs hover:border-indigo-400/50 hover:shadow-md hover:shadow-indigo-500/10',
    flat: 'bg-slate-50/80 border border-slate-100',
    highlight: 'border border-indigo-200/80 bg-indigo-50/30 shadow-xs shadow-indigo-500/10',
    bordered: 'border-2 border-slate-200',
  };

  return (
    <div
      className={twMerge(
        clsx(
          baseStyles,
          paddingStyles[padding],
          variantStyles[variant],
          interactive && 'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/15 hover:border-indigo-500/60 cursor-pointer',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={twMerge('flex items-center justify-between pb-4 border-b border-slate-100', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  ...props
}) => (
  <h3 className={twMerge('text-base font-semibold text-slate-900 tracking-tight', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className,
  ...props
}) => (
  <p className={twMerge('text-xs sm:text-sm text-slate-500 mt-0.5', className)} {...props}>
    {children}
  </p>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={twMerge('pt-4', className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={twMerge('pt-4 mt-4 border-t border-slate-100 flex items-center justify-between', className)} {...props}>
    {children}
  </div>
);
