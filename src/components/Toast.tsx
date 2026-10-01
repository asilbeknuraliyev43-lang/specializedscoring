import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-lg backdrop-blur-md flex items-start space-x-3 transition-all transform animate-in slide-in-from-bottom-3 duration-200 ${
              isSuccess
                ? 'bg-emerald-950/90 text-emerald-100 border-emerald-700/80 shadow-emerald-950/20'
                : isError
                ? 'bg-rose-950/90 text-rose-100 border-rose-700/80 shadow-rose-950/20'
                : isWarning
                ? 'bg-amber-950/90 text-amber-100 border-amber-700/80 shadow-amber-950/20'
                : 'bg-slate-900/90 text-slate-100 border-slate-700/80 shadow-slate-950/20'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-blue-400" />}
            </div>

            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold leading-tight">{t.title}</h5>
              {t.message && (
                <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed break-words whitespace-pre-wrap">
                  {t.message}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 p-1 opacity-70 hover:opacity-100 hover:bg-white/10 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Tasdiqlash',
  cancelText = 'Bekor qilish',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
            isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
          }`}
        >
          {isDestructive ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
        </div>

        <div>
          <h4 className="text-base font-bold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</p>
        </div>

        <div className="flex space-x-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
