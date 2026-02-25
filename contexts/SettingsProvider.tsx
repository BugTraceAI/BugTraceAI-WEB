// contexts/SettingsProvider.tsx
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ApiKeys } from '../types.ts';
import { OPEN_ROUTER_MODELS } from '../constants.ts';
import { DEFAULT_CLI_URL } from '../services/cliConnector.ts';

interface SettingsContextType {
    themeId: string;
    setThemeId: (id: string) => void;
    apiKeys: ApiKeys;
    setApiKeys: (keys: ApiKeys) => void;
    openRouterModel: string;
    setOpenRouterModel: (model: string) => void;
    saveApiKeys: boolean;
    setSaveApiKeys: (save: boolean) => void;
    // Provider
    providerId: string;
    setProviderId: (id: string) => void;
    // CLI Connection
    cliUrl: string;
    setCliUrl: (url: string) => void;
    cliConnected: boolean;
    cliStatus: 'healthy' | 'degraded' | 'unreachable' | null;
    cliVersion: string | undefined;
    cliDockerAvailable: boolean | undefined;
    setCli: (state: {
        connected: boolean;
        status: 'healthy' | 'degraded' | 'unreachable' | null;
        version?: string;
        dockerAvailable?: boolean;
    }) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [themeId, setThemeId] = useState<string>('theme-night-v3');
    const [apiKeys, setApiKeys] = useState<ApiKeys>({ openrouter: '' });
    const [openRouterModel, setOpenRouterModel] = useState<string>(OPEN_ROUTER_MODELS[0]);
    const [saveApiKeys, setSaveApiKeys] = useState<boolean>(false);

    // Provider selection (synced from CLI API)
    const [providerId, setProviderId] = useState<string>('openrouter');

    // CLI Connection state
    const [cliUrl, setCliUrl] = useState<string>(DEFAULT_CLI_URL);
    const [cliConnected, setCliConnected] = useState(false);
    const [cliStatus, setCliStatus] = useState<'healthy' | 'degraded' | 'unreachable' | null>(null);
    const [cliVersion, setCliVersion] = useState<string | undefined>(undefined);
    const [cliDockerAvailable, setCliDockerAvailable] = useState<boolean | undefined>(undefined);

    const setCli = useCallback((state: {
        connected: boolean;
        status: 'healthy' | 'degraded' | 'unreachable' | null;
        version?: string;
        dockerAvailable?: boolean;
    }) => {
        setCliConnected(state.connected);
        setCliStatus(state.status);
        setCliVersion(state.version);
        setCliDockerAvailable(state.dockerAvailable);
    }, []);

    useEffect(() => {
        try {
            const savedTheme = localStorage.getItem('themeId');
            if (savedTheme) {
                setThemeId(savedTheme);
            }

            const savedSavePref = localStorage.getItem('saveApiKeys') === 'true';
            setSaveApiKeys(savedSavePref);

            if (savedSavePref) {
                const savedKeys = localStorage.getItem('apiKeys');
                if (savedKeys) {
                    try { setApiKeys(JSON.parse(savedKeys)); }
                    catch { localStorage.removeItem('apiKeys'); }
                }
            }

            const savedModel = localStorage.getItem('openRouterModel');
            if (savedModel) setOpenRouterModel(savedModel);

            const savedProvider = localStorage.getItem('providerId');
            if (savedProvider) setProviderId(savedProvider);

            // Load CLI URL — env var wins when set (Docker proxy mode)
            const envCliUrl = import.meta.env.VITE_CLI_API_URL;
            if (envCliUrl) {
                setCliUrl(envCliUrl);
                // Clear stale localStorage to prevent future conflicts
                localStorage.removeItem('cliApiUrl');
            } else {
                const savedCliUrl = localStorage.getItem('cliApiUrl');
                if (savedCliUrl) setCliUrl(savedCliUrl);
            }

        } catch (e) { console.error("Could not load settings:", e); }
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        // Remove all possible theme classes
        const themes = ['theme-night-v3', 'theme-cyber-pink', 'theme-forest-hunter', 'theme-deep-sea', 'theme-industrial-gold'];
        themes.forEach(t => root.classList.remove(t));

        root.classList.add(themeId);
        try { localStorage.setItem('themeId', themeId); }
        catch (e) { console.error("Could not save theme:", e); }
    }, [themeId]);

    useEffect(() => {
        try {
            localStorage.setItem('saveApiKeys', String(saveApiKeys));
            if (saveApiKeys) {
                localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
            } else {
                localStorage.removeItem('apiKeys');
            }
        } catch (e) { console.error("Could not save API key settings:", e); }
    }, [saveApiKeys, apiKeys]);

    useEffect(() => {
        try { localStorage.setItem('openRouterModel', openRouterModel); }
        catch (e) { console.error("Could not save model:", e); }
    }, [openRouterModel]);

    useEffect(() => {
        try { localStorage.setItem('providerId', providerId); }
        catch (e) { console.error("Could not save provider:", e); }
    }, [providerId]);

    useEffect(() => {
        // Don't persist CLI URL in Docker mode (env var is the source of truth)
        if (!import.meta.env.VITE_CLI_API_URL) {
            try { localStorage.setItem('cliApiUrl', cliUrl); }
            catch (e) { console.error("Could not save CLI URL:", e); }
        }
    }, [cliUrl]);

    const value = useMemo(() => ({
        themeId, setThemeId,
        apiKeys, setApiKeys,
        openRouterModel, setOpenRouterModel,
        saveApiKeys, setSaveApiKeys,
        providerId, setProviderId,
        cliUrl, setCliUrl,
        cliConnected, cliStatus, cliVersion, cliDockerAvailable,
        setCli,
    }), [themeId, setThemeId, apiKeys, openRouterModel, saveApiKeys, providerId, cliUrl, cliConnected, cliStatus, cliVersion, cliDockerAvailable, setCli]);

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};