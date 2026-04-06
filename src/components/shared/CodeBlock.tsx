import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
  className?: string;
}

/**
 * CodeBlock Component
 * A simple, bold, high-contrast code block component for the "Living Room Dashboard" style.
 * Supports language selection and a "Copy Code" button.
 */
const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, filename, className = "" }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  return (
    <div className={`flex flex-col w-full bg-zinc-950 border-[6px] border-zinc-800 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.4)] ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b-[6px] border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-zinc-700" />
            <div className="w-3 h-3 rounded-full bg-zinc-700" />
            <div className="w-3 h-3 rounded-full bg-zinc-700" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
            {filename || `module_${language.toLowerCase()}`}
          </span>
        </div>
        
        <button
          onClick={copyToClipboard}
          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
            copied 
              ? 'bg-primary text-black' 
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
          }`}
        >
          {copied ? 'Copied_Successful' : 'Copy_to_Buffer'}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-6 overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '1rem',
            lineHeight: '1.6',
            fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'inherit',
            }
          }}
        >
          {code.trim()}
        </SyntaxHighlighter>
      </div>

      {/* Footer Branding */}
      <div className="px-6 py-2 border-t-[6px] border-zinc-800/50 bg-zinc-900/30 flex justify-end">
        <span className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.5em]">
          Maiks_YT // Dev_Environment
        </span>
      </div>
    </div>
  );
};

export default CodeBlock;
