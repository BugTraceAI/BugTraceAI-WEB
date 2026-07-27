import React from 'react';
import { XMarkIcon, SwatchIcon } from './Icons.tsx';
import { useSettings } from '../contexts/SettingsProvider.tsx';

interface ThemeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose }) => {
    const { themeId, setThemeId } = useSettings();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} aria-modal="true" role="dialog">
            <div className="card-premium w-full max-w-md overflow-hidden flex flex-col shadow-2xl shadow-purple-500/10" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <header className="flex-shrink-0 p-4 border-b border-ui-border bg-black/20 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-ui-accent/10 border border-ui-accent/20">
                            <SwatchIcon className="h-4 w-4 text-ui-accent" />
                        </div>
                        <div className="flex flex-col">
                            <span className="label-mini !text-ui-accent/70">UI Customization</span>
                            <h2 className="title-standard">Theme Selector</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-ui-text-muted hover:text-white hover:bg-white/10 transition-all active:scale-95 border border-transparent hover:border-white/10">
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </header>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="label-mini mb-4 block">Centralized Theme Engine</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { id: 'theme-night-v3', name: 'Night V3 (Default)', color: '#FF7F50', desc: 'Standard industrial purple and coral' },
                                { id: 'theme-cyber-pink', name: 'Cyber Pink', color: '#ff00ff', desc: 'Deep neon pink and high-contrast darks' },
                                { id: 'theme-forest-hunter', name: 'Forest Hunter', color: '#ff8c00', desc: 'Survival dark green and orange accents' },
                                { id: 'theme-deep-sea', name: 'Deep Sea', color: '#00f2ff', desc: 'Submarine navy and high-vis cyan' },
                                { id: 'theme-industrial-gold', name: 'Industrial Gold', color: '#d4af37', desc: 'Charcoal charcoal and premium gold leaf' },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setThemeId(t.id)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${themeId === t.id
                                        ? 'bg-ui-accent/10 border-ui-accent shadow-lg'
                                        : 'bg-black/20 border-ui-border hover:border-ui-accent/40 hover:bg-black/40'
                                        }`}
                                >
                                    <div
                                        className="w-10 h-10 rounded-xl flex-shrink-0"
                                        style={{ backgroundColor: t.color, boxShadow: `0 0 15px ${t.color}40` }}
                                    />
                                    <div className="flex-1">
                                        <p className={`text-sm font-bold ${themeId === t.id ? 'text-ui-accent' : 'text-ui-text-main'}`}>
                                            {t.name}
                                        </p>
                                        <p className="text-[10px] text-ui-text-dim/60 font-medium">
                                            {t.desc}
                                        </p>
                                    </div>
                                    {themeId === t.id && (
                                        <div className="h-2 w-2 rounded-full bg-ui-accent shadow-glow-coral animate-pulse" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-ui-accent/5 border border-ui-accent/20">
                        <p className="label-mini !text-ui-accent/80 mb-2">Technical Note</p>
                        <p className="text-[11px] text-ui-text-dim italic leading-relaxed">
                            Everything has been centralized via CSS tokens. Themes switch instantly across all components including charts, icons, and gradients.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
