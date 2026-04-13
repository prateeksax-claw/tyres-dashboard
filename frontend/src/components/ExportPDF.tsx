import { FileDown } from 'lucide-react';

export function ExportPDF({ title }: { title?: string }) {
  const handleExport = () => {
    const originalTitle = document.title;
    if (title) document.title = title;
    window.print();
    document.title = originalTitle;
  };

  return (
    <button
      onClick={handleExport}
      className="print:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs text-gray-500 hover:border-teal-300 hover:text-teal-600 transition-all bg-white/60 dark:bg-slate-800/60"
      title="Export as PDF"
    >
      <FileDown className="w-3.5 h-3.5" />
      <span>PDF</span>
    </button>
  );
}
