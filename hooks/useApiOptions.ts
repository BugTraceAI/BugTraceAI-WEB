// hooks/useApiOptions.ts
import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsProvider.tsx';
import { ApiOptions } from '../types.ts';

export const useApiOptions = (): {
    apiOptions: ApiOptions | null;
    isApiKeySet: boolean;
} => {
    const { apiKeys, openRouterModel, providerId } = useSettings();
    const isApiKeySet = !!apiKeys[providerId]?.trim();

    const apiOptions = useMemo(() => {
        if (!isApiKeySet) {
            return null;
        }
        return {
            apiKey: apiKeys[providerId],
            model: openRouterModel,
        };
    }, [isApiKeySet, apiKeys, providerId, openRouterModel]);

    return {
        apiOptions,
        isApiKeySet
    };
};
