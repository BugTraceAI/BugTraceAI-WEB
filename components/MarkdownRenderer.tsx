// components/MarkdownRenderer.tsx
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import React, { useEffect, useMemo, useRef } from 'react';
import { normalizeMarkdownDocument, protectQuotedValues } from '../lib/markdownTransformers';
import { copyText } from '../lib/clipboard.ts';

// Configure marked options once
marked.setOptions({
  gfm: true, // Enable GitHub Flavored Markdown
  breaks: true, // Use GFM line breaks
  pedantic: false, // Don't be strict about syntax
});

interface MarkdownRendererProps {
  content: string;
  /** Finding data quoted inside `content`; fenced before render so it survives marked. */
  protectValues?: Array<string | null | undefined>;
}

// Inlined styles to replace Tailwind's @tailwindcss/typography (prose) plugin,
// which doesn't work with dynamically generated content from a CDN build.
// This ensures that markdown content is always styled correctly.
const markdownStyles = `
.markdown-content ul,
.markdown-content ol {
    list-style: revert;
    margin-left: 2em;
    margin-block-start: 1em;
    margin-block-end: 1em;
    padding-inline-start: 1.5em;
}
.markdown-content li {
    margin-block-start: 0.5em;
    margin-block-end: 0.5em;
}
.markdown-content strong,
.markdown-content b {
    font-weight: 600;
}
.markdown-content p {
    margin-block-start: 0.8em;
    margin-block-end: 0.8em;
}
.markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4 {
    color: #FF7F50; /* coral accent */
    border-bottom: 1px solid var(--color-glass-border, #5D4B7F);
    padding-bottom: 0.3em;
    margin-block-start: 1.5em;
    margin-block-end: 1em;
}
.markdown-content h1 { font-size: 1.5em; }
.markdown-content h2 { font-size: 1.25em; }
.markdown-content h3 { font-size: 1.1em; }
.markdown-content h4 { font-size: 1.0em; }

.markdown-content code {
    background-color: rgba(45, 27, 77, 0.6);
    color: #FF9B70; /* coral-hover accent */
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    border-radius: 6px;
    font-family: 'Fira Code', 'Courier New', monospace;
    word-wrap: break-word;
}

.markdown-content pre {
    background-color: transparent;
    border: 0;
    border-radius: 0;
    padding: 0.8em;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: 0.9rem;
}

.markdown-content pre code {
    background-color: transparent;
    padding: 0;
    font-size: 100%;
    color: inherit;
    border: none;
}
.markdown-content .btai-code-block { margin-block: 1em; }
.markdown-content .btai-code-toolbar { min-height: 2rem; }

.markdown-content a {
    color: #FF7F50; /* coral accent */
    text-decoration: underline;
}

.markdown-content blockquote {
    padding-inline-start: 1em;
    border-inline-start: 0.25em solid var(--control-border);
    color: var(--text-secondary);
    font-style: italic;
    margin-block: 1em;
    margin-inline: 0;
}

.markdown-content table {
    width: 100%;
    border-collapse: collapse;
    margin-block: 1em;
    table-layout: fixed;
    word-wrap: break-word;
    overflow-wrap: break-word;
}
.markdown-content th,
.markdown-content td {
    border: 1px solid var(--color-glass-border, #5D4B7F);
    padding: 0.5em 0.75em;
    text-align: left;
    font-size: 0.85rem;
    overflow-wrap: break-word;
    word-break: break-word;
}
.markdown-content th {
    background-color: rgba(45, 27, 77, 0.6);
    color: #FF7F50;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.markdown-content tr:nth-child(even) {
    background-color: rgba(45, 27, 77, 0.2);
}
.markdown-content tr:hover {
    background-color: rgba(45, 27, 77, 0.4);
}
`;

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, protectValues }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const markdownRenderer = useMemo(() => {
        const renderer = new marked.Renderer();
        const defaultCode = new marked.Renderer();
        renderer.code = (code, infostring, escaped) => {
            const language = (infostring || '').trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9_+#.-]/g, '').slice(0, 32) || 'CODE';
            const renderedCode = defaultCode.code(code, infostring, escaped);
            return `<div class="btai-code-block"><div class="btai-code-toolbar"><span class="btai-code-language">${language}</span><button type="button" class="btai-code-copy" aria-label="Copy code"><span aria-hidden="true">⧉</span> Copy</button></div>${renderedCode}</div>\n`;
        };
        return renderer;
    }, []);

    const parsedHtml = useMemo(() => {
        if (!content) return '';
        // Fence any finding data the prose quotes inline BEFORE marked parses it: the
        // payload's own backticks would otherwise be read as code-span delimiters and
        // deleted, handing the reader a payload that no longer fires.
        const safe = protectValues?.length
            ? protectQuotedValues(content, protectValues)
            : content;
        const rawHtml = marked.parse(normalizeMarkdownDocument(safe), { renderer: markdownRenderer }) as string;
        const clean = DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
                'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'strong', 'em', 'b', 'i', 'a', 'del', 'sup', 'sub', 'button',
                'span', 'div', 'img',
            ],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'type', 'aria-label', 'aria-hidden'],
            ALLOW_DATA_ATTR: false,
        });
        // Open all links in new tab
        return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
    }, [content, markdownRenderer, protectValues]);

    useEffect(() => {
        const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('.btai-code-copy');
        if (!buttons) return;
        const cleanups: Array<() => void> = [];
        buttons.forEach(button => {
            const original = button.innerHTML;
            const handleCopy = async () => {
                const value = button.closest('.btai-code-block')?.querySelector('pre code')?.textContent || '';
                try {
                    await copyText(value);
                    button.innerHTML = '<span aria-hidden="true">✓</span> Copied';
                    window.setTimeout(() => { button.innerHTML = original; }, 1800);
                } catch {
                    button.innerHTML = '<span aria-hidden="true">!</span> Retry';
                    window.setTimeout(() => { button.innerHTML = original; }, 2200);
                }
            };
            button.addEventListener('click', handleCopy);
            cleanups.push(() => button.removeEventListener('click', handleCopy));
        });
        return () => cleanups.forEach(cleanup => cleanup());
    }, [parsedHtml]);

    return (
        <>
            <style>{markdownStyles}</style>
            <div ref={rootRef}
                className="markdown-content max-w-none text-current break-words"
                dangerouslySetInnerHTML={{ __html: parsedHtml }} 
            />
        </>
    );
};
