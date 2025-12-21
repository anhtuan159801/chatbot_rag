import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const widthClass = fullWidth ? 'w-full' : '';
  const baseClasses = `bg-white border rounded-lg px-4 py-2.5 text-slate-800 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${widthClass} ${className}`;
  const borderClass = error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-200';
  const classes = `${baseClasses} ${borderClass}`;
  
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          {label}
        </label>
      )}
      <input
        className={classes}
        {...props}
      />
      {helperText && !error && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;