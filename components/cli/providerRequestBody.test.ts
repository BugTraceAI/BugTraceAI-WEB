import { describe, expect, it } from 'vitest';
import { buildProviderRequestBody, providerFormActions } from './providerRequestBody.ts';

describe('buildProviderRequestBody', () => {
    it('includes a trimmed Bedrock region for test and save requests', () => {
        expect(buildProviderRequestBody('bedrock', '', '  eu-west-1  ')).toEqual({
            provider: 'bedrock',
            region: 'eu-west-1',
        });
    });

    it('sends an empty Bedrock region to clear an override and use AWS profile config', () => {
        expect(buildProviderRequestBody('bedrock', '  ', '  ')).toEqual({ provider: 'bedrock', region: '' });
    });

    it('does not send region for other providers', () => {
        expect(buildProviderRequestBody('anthropic', ' sk-ant-test ')).toEqual({
            provider: 'anthropic',
            api_key: 'sk-ant-test',
        });
    });
});

describe('Bedrock provider form actions', () => {
    const state = {
        selectedProvider: 'bedrock', activeProvider: 'bedrock', presetProvider: 'bedrock',
        apiKey: '', region: 'eu-west-1', activeRegion: 'us-east-1',
        selectedHasKey: false, activeHasKey: false, keyValidated: false, isTesting: false,
    };

    it('allows a region-only edit with IAM credentials after a successful connection test', () => {
        expect(providerFormActions(state)).toMatchObject({ canTest: true, canSave: false });
        expect(providerFormActions({ ...state, keyValidated: true })).toMatchObject({ canTest: true, canSave: true });
    });

    it('does not allow saving unchanged settings or a test still in flight', () => {
        expect(providerFormActions({ ...state, region: state.activeRegion, keyValidated: true }).canSave).toBe(false);
        expect(providerFormActions({ ...state, keyValidated: true, isTesting: true })).toMatchObject({ canTest: false, canSave: false });
    });

    it('requires the Bedrock preset and validates a changed region even when a key is stored', () => {
        expect(providerFormActions({ ...state, presetProvider: 'anthropic', keyValidated: true })).toMatchObject({ canTest: false, canSave: false });
        expect(providerFormActions({ ...state, activeProvider: 'anthropic', selectedHasKey: true }).canSave).toBe(false);
    });

    it('preserves switching to another provider with its existing key', () => {
        expect(providerFormActions({ ...state, selectedProvider: 'anthropic', selectedHasKey: true }).canSave).toBe(true);
        expect(providerFormActions({ ...state, selectedProvider: 'anthropic', selectedHasKey: false }).canSave).toBe(false);
    });
});
