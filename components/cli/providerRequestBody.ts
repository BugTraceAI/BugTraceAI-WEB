// components/cli/providerRequestBody.ts
// PURE helper for the WEB/CLI provider panel request bodies.
// No React, no hooks, no state, no DOM, no fetch — shared by handleTestKey and
// handleSave so the POST /api/provider/test and PUT /api/provider bodies gate
// their fields identically.

/**
 * Build the request body sent to the CLI provider test/save endpoints.
 *
 * Always includes `provider`. Adds `api_key` only when a non-empty key is
 * supplied. Adds `region` only for the Bedrock provider; the trimmed value is
 * sent as-is (an empty string is allowed — the CLI falls back to
 * settings.BEDROCK_REGION), and `region` is never emitted as undefined.
 */
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
