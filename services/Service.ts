// @author: Albert C | @yz9yt | github.com/yz9yt
// services/Service.ts
// Backward-compatible re-export facade.
// All existing imports of `import { X } from '../services/Service'` continue to work.

// --- API Client (I/O layer) ---
export { testApi, getProviderInfo, invalidateProviderCache } from './apiClient.ts';

// --- Analysis functions ---
export {
    analyzeCode,
    performSastDeepAnalysis,
    analyzeJsCode,
    analyzeUrl,
    validateVulnerability,
    consolidateReports,
    performDeepAnalysis,
    analyzeFileUpload,
    analyzeJwt,
    analyzeHeaders,
    findPrivescExploits,
    analyzeDomXss,
} from './analysisService.ts';

// --- Payload generation ---
export {
    generateXssPayload,
    generateSqlmapCommand,
    forgePayloads,
    generateSstiPayloads,
} from './payloadService.ts';

// --- Chat functions ---
export {
    startExploitChat,
    startSqlExploitChat,
    continueExploitChat,
    startGeneralChat,
    continueGeneralChat,
} from './chatService.ts';
