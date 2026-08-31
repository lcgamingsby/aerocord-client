import React, { useState } from 'react';
import { Check, Copy, Code } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'text' }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple syntax colorizer for keywords, strings, comments, numbers
  const highlightSyntax = (raw: string) => {
    const lines = raw.split('\n');
    return lines.map((line, lineIdx) => {
      // Tokens highlight via regex
      const formatted = line
        .replace(/(import|export|from|const|let|var|function|return|if|else|switch|case|default|class|extends|interface|type|async|await|try|catch|new|for|while|in|of|def|elif|lambda|self|fn|pub|mut|struct|enum|impl|package|func|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN)\b/g, '<span class="text-indigo-400 font-semibold">$1</span>')
        .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="text-emerald-300">$1</span>')
        .replace(/(\/\/.*|\/\*.*\*\/|#.*|--.*)/g, '<span class="text-slate-500 italic">$1</span>')
        .replace(/\b(\d+)\b/g, '<span class="text-amber-400">$1</span>')
        .replace(/\b(true|false|null|undefined|None|True|False|nil)\b/g, '<span class="text-cyan-400 font-bold">$1</span>');

      return (
        <div key={lineIdx} className="table-row">
          <span className="table-cell pr-4 text-right select-none text-slate-600 text-[11px] font-mono w-8">
            {lineIdx + 1}
          </span>
          <span
            className="table-cell text-slate-200 font-mono text-xs whitespace-pre"
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        </div>
      );
    });
  };

  return (
    <div className="my-2 rounded-2xl overflow-hidden border border-white/10 bg-[#0d0f14] shadow-xl max-w-full">
      {/* Code Header */}
      <div className="px-4 py-2 bg-[#13161f] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code size={14} className="text-indigo-400" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
            {language || 'code'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
            copied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
          }`}
          title="Salin ke papan klip"
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Tersalin!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono">
        <div className="table w-full">
          {highlightSyntax(code.trim())}
        </div>
      </div>
    </div>
  );
};
