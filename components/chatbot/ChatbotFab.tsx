'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { ChatbotPanel } from './ChatbotPanel';

export function ChatbotFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 transition-all flex items-center justify-center group"
      >
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
        )}
      </button>

      {open && <ChatbotPanel onClose={() => setOpen(false)} />}
    </>
  );
}
