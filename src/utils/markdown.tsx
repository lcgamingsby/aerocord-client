import React from 'react';
import DOMPurify from 'dompurify';

export const renderMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;

  // Split lines to handle block elements like quotes and code blocks
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';

  lines.forEach((line, lineIndex) => {
    // Code block check
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // close code block
        elements.push(
          <div key={`code-${lineIndex}`} className="my-2 p-3 rounded-md bg-[#1e1f22] border border-[#111214] font-mono text-xs overflow-x-auto text-[#23a55a]">
            {codeBlockLang && <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{codeBlockLang}</div>}
            <pre className="whitespace-pre">{codeBlockContent.join('\n')}</pre>
          </div>
        );
        codeBlockContent = [];
        inCodeBlock = false;
        codeBlockLang = '';
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Quote block check
    if (line.startsWith('> ')) {
      elements.push(
        <div key={`quote-${lineIndex}`} className="border-l-4 border-[#4e5058] pl-3 py-0.5 my-1 text-[#949ba4] italic">
          {parseInlineMarkdown(line.substring(2))}
        </div>
      );
      return;
    }

    // Regular line with inline markdown
    elements.push(
      <div key={`line-${lineIndex}`} className="min-h-[1.2em]">
        {parseInlineMarkdown(line)}
      </div>
    );
  });

  return <div className="space-y-0.5 break-words">{elements}</div>;
};

// Helper for inline styles
const parseInlineMarkdown = (text: string): React.ReactNode => {
  // Sanitize first
  const sanitized = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });

  // Tokenize regex for bold, italic, strike, code, link, mention
  // Matches: `code`, **bold**, *italic*, ~~strike~~, http://..., @username
  const parts: React.ReactNode[] = [];
  let remaining = sanitized;
  let keyIdx = 0;

  const patterns = [
    { type: 'code', regex: /^`([^`]+)`/ },
    { type: 'bold', regex: /^\*\*([^*]+)\*\*/ },
    { type: 'italic', regex: /^\*([^*]+)\*/ },
    { type: 'strike', regex: /^~~([^~]+)~~/ },
    { type: 'url', regex: /^(https?:\/\/[^\s]+)/ },
    { type: 'mention', regex: /^(@[a-zA-Z0-9_-]+)/ }
  ];

  while (remaining.length > 0) {
    let matched = false;

    for (const p of patterns) {
      const match = remaining.match(p.regex);
      if (match) {
        const fullMatch = match[0];
        const content = match[1] || fullMatch;

        if (p.type === 'code') {
          parts.push(
            <code key={`code-${keyIdx++}`} className="px-1.5 py-0.5 rounded bg-[#1e1f22] text-[#f23f43] font-mono text-[13px]">
              {content}
            </code>
          );
        } else if (p.type === 'bold') {
          parts.push(<strong key={`b-${keyIdx++}`} className="font-bold text-[#f2f3f5]">{content}</strong>);
        } else if (p.type === 'italic') {
          parts.push(<em key={`i-${keyIdx++}`} className="italic">{content}</em>);
        } else if (p.type === 'strike') {
          parts.push(<span key={`s-${keyIdx++}`} className="line-through text-gray-400">{content}</span>);
        } else if (p.type === 'url') {
          parts.push(
            <a key={`u-${keyIdx++}`} href={content} target="_blank" rel="noopener noreferrer" className="text-[#00a8fc] hover:underline cursor-pointer">
              {content}
            </a>
          );
        } else if (p.type === 'mention') {
          parts.push(
            <span key={`m-${keyIdx++}`} className="px-1 py-0.5 rounded bg-[#5865f2]/20 text-[#c9cdfb] font-medium hover:bg-[#5865f2]/40 transition-colors cursor-pointer">
              {content}
            </span>
          );
        }

        remaining = remaining.slice(fullMatch.length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Find index of next potential token
      const nextSpecial = remaining.search(/[`*_~h@]/);
      if (nextSpecial === -1) {
        parts.push(<span key={`text-${keyIdx++}`}>{remaining}</span>);
        break;
      } else if (nextSpecial === 0) {
        parts.push(<span key={`text-${keyIdx++}`}>{remaining[0]}</span>);
        remaining = remaining.slice(1);
      } else {
        parts.push(<span key={`text-${keyIdx++}`}>{remaining.slice(0, nextSpecial)}</span>);
        remaining = remaining.slice(nextSpecial);
      }
    }
  }

  return <>{parts}</>;
};
