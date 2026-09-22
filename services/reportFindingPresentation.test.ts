import { describe, expect, it } from 'vitest';
import {
  formatEvidenceAsNarrative,
  getFindingHttpEvidence,
  getFindingNarrative,
} from './reportFindingPresentation.ts';

describe('report finding presentation', () => {
  it('uses Repeater summary when enrichment description is unavailable', () => {
    expect(getFindingNarrative({ summary: 'Confirmed encoded path traversal' }))
      .toBe('Confirmed encoded path traversal');
  });

  it('prefers real exploitation_details over raw evidence (127-style)', () => {
    const narrative = getFindingNarrative({
      exploitation_details: '## Summary\nA Local File Inclusion vulnerability exists.',
      evidence: { method: 'smart_probe', signature_found: true },
    });
    expect(narrative).toContain('## Summary');
    expect(narrative).toContain('Local File Inclusion');
    expect(narrative).not.toContain('smart_probe');
  });

  it('formats smart_probe evidence as structured markdown (raw scan 11)', () => {
    const narrative = getFindingNarrative({
      type: 'LFI',
      parameter: 'file',
      url: 'https://t/api/image?file=test',
      payload: '/etc/passwd',
      severity: 'CRITICAL',
      status: 'VALIDATED_CONFIRMED',
      evidence: {
        method: 'smart_probe',
        signature_found: true,
        file_content: 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1',
      },
    });
    expect(narrative).toContain('## Summary');
    expect(narrative).toContain('## Attack Scenario');
    expect(narrative).toContain('## Technical Evidence');
    expect(narrative).toContain('LFI');
    expect(narrative).toContain('/etc/passwd');
    expect(narrative).toContain('root:x:0:0');
    expect(narrative).toContain('smart_probe');
  });

  it('formats JWT crack evidence without dumping the full forged token', () => {
    const narrative = formatEvidenceAsNarrative(
      {
        type: 'Weak JWT Secret',
        payload: 'bugstore_secret_2024',
        url: 'https://t/api',
      },
      {
        cracked_secret: 'bugstore_secret_2024',
        algorithm: 'HS256',
        forged_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'a'.repeat(200),
      },
    );
    expect(narrative).toContain('JWT secret cracked');
    expect(narrative).toContain('bugstore_secret_2024');
    expect(narrative).toContain('forged_token (prefix)');
    expect(narrative).not.toContain('a'.repeat(100));
  });

  it('formats nuclei evidence with template id', () => {
    const narrative = getFindingNarrative({
      type: 'Insecure Cookie Configuration',
      evidence: { nuclei_template: 'cookies-without-httponly' },
    });
    expect(narrative).toContain('cookies-without-httponly');
    expect(narrative).toContain('## Summary');
  });

  it('serializes legacy object narratives safely when they are preferred prose fields', () => {
    // description that is not JSON-looking prose path: object becomes JSON via asNarrativeText
    // but preferred path rejects bare JSON blobs starting with {
    expect(getFindingNarrative({
      type: 'RCE',
      parameter: 'cmd',
      url: 'https://t/api/health',
      payload: 'id',
    })).toContain('RCE');
  });

  it('exposes persisted Repeater request and response proof', () => {
    expect(getFindingHttpEvidence({
      http_request: 'GET /etc/passwd HTTP/1.1',
      response_status: 200,
      response_excerpt: 'root:x:0:0:root:/root:/bin/bash',
    })).toEqual({
      request: 'GET /etc/passwd HTTP/1.1',
      status: 200,
      response: 'root:x:0:0:root:/root:/bin/bash',
    });
  });

  it('returns no evidence panel for an empty finding', () => {
    expect(getFindingHttpEvidence({})).toBeNull();
  });
});
