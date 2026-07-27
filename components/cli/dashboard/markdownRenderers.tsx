// components/cli/dashboard/markdownRenderers.tsx
// Custom markdown renderer components extracted from ReportMarkdownViewer.tsx.
// Reusable table, code block, and heading renderers for CLI report display.

import React from 'react';

/** Styled table wrapper for markdown-rendered tables. */
export const MarkdownTable: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, ...props }) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-white/10">
        <table className="w-full text-xs" {...props}>
            {children}
        </table>
    </div>
);

/** Table head with dark background styling. */
export const MarkdownTHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, ...props }) => (
    <thead className="bg-black/30 text-ui-text-dim uppercase text-[10px] tracking-wider" {...props}>
        {children}
    </thead>
);

/** Table body with alternating row colors. */
export const MarkdownTBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, ...props }) => (
    <tbody className="divide-y divide-white/5" {...props}>
        {children}
    </tbody>
);

/** Table row with hover highlight. */
export const MarkdownTR: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, ...props }) => (
    <tr className="hover:bg-white/[0.03] transition-colors" {...props}>
        {children}
    </tr>
);

/** Table header cell. */
export const MarkdownTH: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, ...props }) => (
    <th className="px-3 py-2 text-left font-semibold" {...props}>
        {children}
    </th>
);

/** Table data cell. */
export const MarkdownTD: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, ...props }) => (
    <td className="px-3 py-2 text-ui-text-main" {...props}>
        {children}
    </td>
);

/** Severity badge for inline severity labels in report text. */
export const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
    const colors: Record<string, string> = {
        critical: 'bg-red-500/20 text-red-400 border-red-500/30',
        high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        info: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    const colorClass = colors[severity.toLowerCase()] || colors.info;
    return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
            {severity}
        </span>
    );
};

/** Code block with copy button and syntax highlighting wrapper. */
export const MarkdownCodeBlock: React.FC<{ language?: string; children: string }> = ({ language, children }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="relative group my-3 rounded-lg overflow-hidden border border-white/10">
            {language && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/5">
                    <span className="text-[10px] text-ui-text-muted uppercase tracking-wider">{language}</span>
                    <button
                        onClick={handleCopy}
                        className="text-[10px] text-ui-text-dim hover:text-ui-text-main transition-colors"
                    >
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            )}
            <pre className="p-3 bg-black/20 overflow-x-auto">
                <code className="text-xs text-ui-text-main font-mono leading-relaxed">{children}</code>
            </pre>
            {!language && (
                <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] text-ui-text-dim hover:text-ui-text-main bg-black/50 px-2 py-1 rounded transition-all"
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            )}
        </div>
    );
};

/** Markdown heading with anchor-like styling. */
export const MarkdownHeading: React.FC<{ level: 1 | 2 | 3 | 4 | 5 | 6; children: React.ReactNode }> = ({ level, children }) => {
    const styles: Record<number, string> = {
        1: 'text-xl font-bold text-ui-text-main mt-6 mb-3 pb-2 border-b border-white/10',
        2: 'text-lg font-bold text-ui-text-main mt-5 mb-2 pb-1.5 border-b border-white/5',
        3: 'text-base font-semibold text-ui-text-main mt-4 mb-2',
        4: 'text-sm font-semibold text-ui-text-dim mt-3 mb-1.5',
        5: 'text-xs font-semibold text-ui-text-dim mt-2 mb-1',
        6: 'text-xs font-medium text-ui-text-muted mt-2 mb-1',
    };
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return <Tag className={styles[level]}>{children}</Tag>;
};
