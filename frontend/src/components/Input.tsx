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
  id,
  ...props
}) => {
  const widthClass = fullWidth ? 'w-full' : '';
  const baseClasses = `bg-white border rounded-lg px-4 py-2.5 text-slate-800 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${widthClass} ${className}`;
  const borderClass = error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-200';
  const classes = `${baseClasses} ${borderClass}`;
  
  // Generate a unique ID if none is provided
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700 mb-2">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={classes}
        aria-invalid={!!error}
        aria-describedby={error || helperText ? `${inputId}-feedback` : undefined}
        {...props}
      />
      {(helperText || error) && (
        <p 
          id={`${inputId}-feedback`}
          className={`mt-1 text-xs ${error ? 'text-red-600 flex items-center gap-1' : 'text-slate-500'}`}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export default Input;