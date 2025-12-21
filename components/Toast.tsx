import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration?: number; // Optional custom duration
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 5000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    // Auto dismiss after specified duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border backdrop-blur-xl transition-all duration-300 animate-slide-up min-w-[320px] ${
              toast.type === 'success' ? 'bg-white/90 border-green-200 text-green-800' :
              toast.type === 'error' ? 'bg-white/90 border-red-200 text-red-800' :
              toast.type === 'warning' ? 'bg-white/90 border-amber-200 text-amber-800' :
              'bg-white/90 border-blue-200 text-blue-800'
            }`}
          >
            <div className={`shrink-0 p-1.5 rounded-full ${
                 toast.type === 'success' ? 'bg-green-100' :
                 toast.type === 'error' ? 'bg-red-100' :
                 toast.type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
            }`}>
                {toast.type === 'success' && <CheckCircle size={18} className="text-green-600" />}
                {toast.type === 'error' && <AlertCircle size={18} className="text-red-600" />}
                {toast.type === 'warning' && <AlertTriangle size={18} className="text-amber-600" />}
                {toast.type === 'info' && <Info size={18} className="text-blue-600" />}
            </div>
            <span className="text-sm font-semibold flex-1">{toast.message}</span>
            <button
                onClick={() => removeToast(toast.id)}
                className="opacity-40 hover:opacity-100 transition-opacity p-1 hover:bg-black/5 rounded-full"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};