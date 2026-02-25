// hooks/useConfigEditor.ts
import { useState, useEffect, useCallback } from 'react';
import { cliApi } from '../lib/cliApi';

// Editable configuration keys
export const EDITABLE_KEYS = new Set([
  'SAFE_MODE', 'MAX_DEPTH', 'MAX_URLS', 'MAX_CONCURRENT_URL_AGENTS',
  'MAX_CONCURRENT_REQUESTS', 'DEFAULT_MODEL', 'CODE_MODEL', 'ANALYSIS_MODEL',
  'MUTATION_MODEL', 'SKEPTICAL_MODEL', 'HEADLESS_BROWSER', 'EARLY_EXIT_ON_FINDING',
  'STOP_ON_CRITICAL', 'REPORT_ONLY_VALIDATED',
]);

interface SaveMessage {
  type: 'success' | 'error';
  text: string;
}

export function useConfigEditor() {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
  const [version, setVersion] = useState('');

  const hasChanges = Object.keys(editedFields).length > 0;

  // Load configuration from API
  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await cliApi.getConfig();
      let cfg = response.config;
      if (typeof cfg === 'string') {
        try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
      }
      setConfig(cfg);
      setEditedFields({});
      setVersion(response.version || '');
      setSaveMessage(null);
    } catch (error) {
      console.error('Failed to load config:', error);
      setSaveMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear save message after timeout
  useEffect(() => {
    if (saveMessage) {
      const t = setTimeout(() => setSaveMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [saveMessage]);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Handle field edit
  const handleEdit = useCallback((key: string, value: any) => {
    if (!EDITABLE_KEYS.has(key)) return;

    // If value matches original, remove from edited
    if (value === config[key]) {
      setEditedFields(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setEditedFields(prev => ({ ...prev, [key]: value }));
    }
  }, [config]);

  // Save changes to API
  const handleSave = useCallback(async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      await cliApi.updateConfig(editedFields);
      // Merge edits into config state
      setConfig(prev => ({ ...prev, ...editedFields }));
      const changedCount = Object.keys(editedFields).length;
      setEditedFields({});
      setSaveMessage({ type: 'success', text: `Updated ${changedCount} field(s)` });
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.message || 'Failed to save configuration' });
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, editedFields]);

  // Reload configuration (with confirmation if unsaved changes)
  const handleReload = useCallback(() => {
    if (hasChanges && !window.confirm('Discard unsaved changes?')) return;
    loadConfig();
  }, [hasChanges, loadConfig]);

  return {
    config,
    editedFields,
    isLoading,
    isSaving,
    saveMessage,
    version,
    hasChanges,
    handleEdit,
    handleSave,
    handleReload,
  };
}
