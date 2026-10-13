export const buildProviderRequestBody = (
    provider: string,
    apiKey: string,
    region?: string,
): Record<string, string> => {
    const body: Record<string, string> = { provider };
    if (apiKey.trim()) body.api_key = apiKey.trim();
    if (provider === 'bedrock') body.region = (region ?? '').trim();
    return body;
};

export const providerFormActions = (state: {
    selectedProvider: string;
    activeProvider: string;
    presetProvider?: string;
    apiKey: string;
    region: string;
    activeRegion: string;
    selectedHasKey: boolean;
    activeHasKey: boolean;
    keyValidated: boolean;
    isTesting: boolean;
}) => {
    const bedrock = state.selectedProvider === 'bedrock';
    const ready = !bedrock || state.presetProvider === 'bedrock';
    const newKey = state.apiKey.trim().length > 0;
    const switching = state.selectedProvider !== state.activeProvider;
    const regionChanged = bedrock && state.region.trim() !== state.activeRegion.trim();
    const hasChanges = switching || newKey || regionChanged;
    return {
        hasChanges,
        hasNewKey: newKey,
        canSave: ready && !state.isTesting && hasChanges && (
            (switching && !newKey && state.selectedHasKey && !regionChanged) ||
            ((newKey || bedrock) && state.keyValidated)
        ),
        canTest: ready && !state.isTesting && (
            newKey || (!switching && state.activeHasKey) || bedrock
        ),
    };
};
