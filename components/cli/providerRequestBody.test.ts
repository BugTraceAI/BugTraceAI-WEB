import { describe, expect, it } from 'vitest';
import { buildProviderRequestBody } from './providerRequestBody.ts';
import { getTestUrl } from '../../lib/settingsUtils.ts';

describe('buildProviderRequestBody', () => {
  it('includes region only for the bedrock provider', () => {
    const body = buildProviderRequestBody('bedrock', 'k', 'us-west-2');
    expect(body).toEqual({ provider: 'bedrock', api_key: 'k', region: 'us-west-2' });
  });

  it('omits region for non-bedrock providers', () => {
    const body = buildProviderRequestBody('anthropic', 'sk-ant-xyz');
    expect(body).toEqual({ provider: 'anthropic', api_key: 'sk-ant-xyz' });
    expect('region' in body).toBe(false);
  });

  it('sends an empty region string for bedrock when the region is blank', () => {
    const body = buildProviderRequestBody('bedrock', '', '');
    expect(body).toEqual({ provider: 'bedrock', region: '' });
    expect(body.region).toBe('');
  });

  it('omits api_key when the key is blank or whitespace', () => {
    expect(buildProviderRequestBody('openrouter', '   ')).toEqual({ provider: 'openrouter' });
  });

  it('trims the region before sending it for bedrock', () => {
    expect(buildProviderRequestBody('bedrock', '', '  eu-central-1  ').region).toBe('eu-central-1');
  });

  it('treats an undefined region as an empty string for bedrock', () => {
    expect(buildProviderRequestBody('bedrock', 'k').region).toBe('');
  });

  it('leaves bedrock absent from the WEB chat provider configs', () => {
    expect(getTestUrl('bedrock')).toBeUndefined();
  });
});
