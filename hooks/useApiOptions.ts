// hooks/useApiOptions.ts
import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsProvider.tsx';
import { ApiOptions } from '../types.ts';
import { OPEN_ROUTER_MODELS } from '../constants.ts';
import { resolveModel } from '../lib/settingsUtils.ts';

export const useApiOptions = (): {
    apiOptions: ApiOptions | null;
    isApiKeySet: boolean;
    providerId: string;
} => {
    const { apiKeys, openRouterModel, providerId } = useSettings();
    const isApiKeySet = !!apiKeys[providerId]?.trim();

    const apiOptions = useMemo(() => {
        if (!isApiKeySet) {
            return null;
        }
        return {
            apiKey: apiKeys[providerId],
            model: resolveModel(providerId, openRouterModel, [], OPEN_ROUTER_MODELS),
        };
    }, [isApiKeySet, apiKeys, providerId, openRouterModel]);

    return {
        apiOptions,
        isApiKeySet,
        providerId
    };
};
