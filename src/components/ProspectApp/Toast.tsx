import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ToastData } from './types';

interface Props {
  toast: ToastData | null;
  onDismiss: () => void;
}

export default function Toast({ toast, onDismiss }: Props) {
  useEffect(() => {
    if (!toast) return;
    if (toast.type === 'success') {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  if (!toast) return null;

  const bgColor = toast.type === 'success' ? '#10b981' : '#ef4444';

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-slide-up">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-[10px] text-sm font-medium text-white shadow-lg"
        style={{ backgroundColor: bgColor }}
      >
        <span>{toast.message}</span>
        <button onClick={onDismiss} className="opacity-80 hover:opacity-100 transition-opacity cursor-pointer">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
