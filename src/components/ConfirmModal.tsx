import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
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
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800 text-zinc-100">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl flex-shrink-0 ${
              isDestructive
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-lime-400/10 text-lime-400 border border-lime-400/20'
            }`}
          >
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-white">{title}</h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-zinc-500 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-zinc-900">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 text-xs font-black rounded-xl shadow-md transition-all cursor-pointer ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/30'
                : 'bg-lime-400 hover:bg-lime-300 text-black shadow-lime-400/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
