import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface ExportButtonProps {
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export function ExportButton({ onExportCSV, onExportPDF }: ExportButtonProps) {
  const { isDarkMode } = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
          isDarkMode 
            ? 'bg-white/5 text-gray-300 hover:bg-white/10' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <DownloadIcon size={18} />
        Exportar
      </button>

      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)} 
          />
          <div className={`absolute right-0 mt-2 w-40 rounded-xl border shadow-lg z-50 ${
            isDarkMode 
              ? 'bg-slate-800 border-white/10' 
              : 'bg-white border-gray-200'
          }`}>
            <button
              onClick={() => { onExportCSV(); setShowMenu(false); }}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors rounded-t-xl ${
                isDarkMode 
                  ? 'text-gray-300 hover:bg-white/5' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ExcelIcon size={18} />
              Excel (CSV)
            </button>
            <button
              onClick={() => { onExportPDF(); setShowMenu(false); }}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors rounded-b-xl ${
                isDarkMode 
                  ? 'text-gray-300 hover:bg-white/5' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <PDFIcon size={18} />
              PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DownloadIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExcelIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function PDFIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15v-2h2a1 1 0 1 1 0 2H9z" />
    </svg>
  );
}
