// components/cli/ConfigField.tsx
// Generic configuration field renderer extracted from ConfigurationTab.tsx.
// Renders boolean (toggle), number, and string fields with edit/read-only states.

import React from 'react';
import type { FieldDef } from '../../lib/cliConfigSchema.ts';

// --- Toggle Switch ---

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`relative inline-flex h-5 w-10 flex-shrink-0 rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-coral/20 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${checked ? 'bg-coral shadow-[0_0_12px_rgba(255,127,80,0.3)]' : 'bg-ui-input-bg border-white/5'}`}
        >
            <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
            />
        </button>
    );
}

// --- Config Field ---

interface ConfigFieldProps {
    field: FieldDef;
    value: any;
    editedValue: any;
    onEdit: (key: string, value: any) => void;
}

export const ConfigField: React.FC<ConfigFieldProps> = ({ field, value, editedValue, onEdit }) => {
    const currentValue = editedValue !== undefined ? editedValue : value;
    const isEdited = editedValue !== undefined;
    const isEditable = field.editable;

    return (
        <div className={`group flex items-center justify-between py-2 px-3 rounded-xl transition-all duration-200 ${isEdited ? 'bg-coral/5 border border-coral/10' : 'hover:bg-white/[0.03] border border-transparent'}`}>
            <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-bold tracking-tight ${isEditable ? 'text-ui-text-main' : 'text-ui-text-dim/60'}`}>
                        {field.label}
                    </span>
                    {isEdited && (
                        <span className="badge-mini badge-mini-accent">modified</span>
                    )}
                    {!isEditable && (
                        <span className="badge-mini !bg-white/5">read-only</span>
                    )}
                </div>
                <p className="text-[11px] text-ui-text-muted mt-0.5 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">{field.description}</p>
            </div>

            <div className="flex-shrink-0">
                {field.type === 'boolean' ? (
                    <ToggleSwitch
                        checked={!!currentValue}
                        onChange={(v) => onEdit(field.key, v)}
                        disabled={!isEditable}
                    />
                ) : field.type === 'number' ? (
                    isEditable ? (
                        <input
                            type="number"
                            min={1}
                            value={currentValue ?? ''}
                            onChange={(e) => onEdit(field.key, parseInt(e.target.value) || 0)}
                            className="w-24 px-3 py-1.5 input-premium font-mono"
                        />
                    ) : (
                        <span className="text-xs text-ui-text-dim font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">{String(currentValue ?? '')}</span>
                    )
                ) : (
                    isEditable ? (
                        <input
                            type="text"
                            value={currentValue ?? ''}
                            onChange={(e) => onEdit(field.key, e.target.value)}
                            className="w-64 px-3 py-1.5 input-premium font-mono"
                        />
                    ) : (
                        <span className="text-xs text-ui-text-dim font-mono truncate max-w-[280px] block bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">{String(currentValue ?? '')}</span>
                    )
                )}
            </div>
        </div>
    );
};
