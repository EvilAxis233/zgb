import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';

export interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface DialogState {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'danger' | 'warning' | 'info';
  isAlert: boolean;
  resolve: (value: boolean) => void;
}

interface DialogContextValue {
  showConfirm: (options: DialogOptions | string) => Promise<boolean>;
  showAlert: (options: DialogOptions | string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  const showConfirm = useCallback((options: DialogOptions | string) => {
    const opts: DialogOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setDialogState({
        title: opts.title || '操作确认',
        message: opts.message,
        confirmText: opts.confirmText || '确定',
        cancelText: opts.cancelText || '取消',
        type: opts.type || 'danger',
        isAlert: false,
        resolve,
      });
    });
  }, []);

  const showAlert = useCallback((options: DialogOptions | string) => {
    const opts: DialogOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setDialogState({
        title: opts.title || '提示',
        message: opts.message,
        confirmText: opts.confirmText || '确定',
        cancelText: '',
        type: opts.type || 'info',
        isAlert: true,
        resolve,
      });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (dialogState) {
      dialogState.resolve(result);
      setDialogState(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dialogState) return;
      if (e.key === 'Escape') {
        handleClose(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleClose(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState]);

  return (
    <DialogContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      {dialogState && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => handleClose(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm sm:max-w-md bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header */}
            <header className="bg-[#121212] text-white px-5 py-3 flex items-center justify-between border-b-2 border-[#121212] select-none">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 inline-block ${
                    dialogState.type === 'danger'
                      ? 'bg-[#D62828]'
                      : dialogState.type === 'warning'
                      ? 'bg-[#F4A261]'
                      : 'bg-[#004E98]'
                  }`}
                />
                <h3 className="text-sm font-black tracking-wider">{dialogState.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="w-7 h-7 flex items-center justify-center bg-[#222] hover:bg-[#D62828] text-white font-bold cursor-pointer transition-colors border border-[#444]"
                aria-label="关闭弹窗"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Body */}
            <div className="p-6 bg-[#FAF9F5] flex items-start gap-3.5">
              {dialogState.type === 'danger' ? (
                <AlertTriangle className="w-5 h-5 text-[#D62828] shrink-0 mt-0.5" />
              ) : dialogState.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-[#F4A261] shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-[#004E98] shrink-0 mt-0.5" />
              )}
              <div className="text-sm font-bold text-[#121212] leading-relaxed break-words flex-1">
                {dialogState.message}
              </div>
            </div>

            {/* Footer Buttons */}
            <footer className="px-5 py-3 bg-white border-t-2 border-[#121212] flex items-center justify-end gap-3 select-none">
              {!dialogState.isAlert && (
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="bauhaus-btn bg-white hover:bg-[#F2F0E8] text-[#121212] px-4 py-1.5 text-xs font-bold"
                >
                  {dialogState.cancelText}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => handleClose(true)}
                className={`bauhaus-btn text-white px-5 py-1.5 text-xs font-black shadow-[3px_3px_0px_#121212] ${
                  dialogState.type === 'danger'
                    ? 'bg-[#D62828] hover:bg-[#b01f1f]'
                    : dialogState.type === 'warning'
                    ? 'bg-[#F4A261] !text-[#121212] hover:bg-[#e09151]'
                    : 'bg-[#004E98] hover:bg-[#003d77]'
                }`}
              >
                {dialogState.confirmText}
              </button>
            </footer>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
