import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  variant?: 'default' | 'overlay';
}

const Loading: React.FC<LoadingProps> = ({ size = 'md', text, variant = 'default' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const spinnerClasses = `animate-spin rounded-full border-t-2 border-b-2 border-blue-500 ${sizeClasses[size]}`;

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className={spinnerClasses}></div>
          {text && <p className="mt-4 text-slate-700 font-medium">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={spinnerClasses}></div>
      {text && <p className="mt-2 text-slate-600 text-sm">{text}</p>}
    </div>
  );
};

export default Loading;