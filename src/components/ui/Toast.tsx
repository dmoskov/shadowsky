import React, { useEffect, createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

// Create context for toast management
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast provider component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);
  
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  
  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

// Toast component
const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('ToastItem must be used within ToastProvider');
  const { removeToast } = context;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration || 5000);
    
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);
  
  const icons = {
    success: <CheckCircle size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />,
    warning: <AlertTriangle size={20} />,
  };
  
  const colorClasses = {
    success: 'bg-green-900/90 border-green-500 text-green-400',
    error: 'bg-red-900/90 border-red-500 text-red-400',
    info: 'bg-blue-900/90 border-blue-500 text-blue-400',
    warning: 'bg-yellow-900/90 border-yellow-500 text-yellow-400',
  };
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.5 }}
      className={`relative flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg ${colorClasses[toast.type]}`}
    >
      <div className="flex-shrink-0">
        {icons[toast.type]}
      </div>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        onClick={() => removeToast(toast.id)}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

// Toast container component
export const ToastContainer: React.FC = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('ToastContainer must be used within ToastProvider');
  const { toasts } = context;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook for easy toast usage
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  const { addToast } = context;
  
  return {
    success: (message: string, duration?: number) => 
      addToast({ message, type: 'success', duration }),
    error: (message: string, duration?: number) => 
      addToast({ message, type: 'error', duration }),
    info: (message: string, duration?: number) => 
      addToast({ message, type: 'info', duration }),
    warning: (message: string, duration?: number) => 
      addToast({ message, type: 'warning', duration }),
  };
};