// lib/cliConfigSchema.ts
// Pure data: CLI configuration section definitions extracted from ConfigurationTab.tsx.
// No React, no JSX, no I/O — just typed schema data.

export interface FieldDef {
    key: string;
    label: string;
    description: string;
    type: 'boolean' | 'number' | 'string';
    editable: boolean;
}

export interface SectionDef {
    id: string;
    title: string;
    iconName: string; // Icon component name (resolved at render time)
    fields: FieldDef[];
}

export const CONFIG_SECTIONS: SectionDef[] = [
    {
        id: 'core',
        title: 'Core',
        iconName: 'CogIcon',
        fields: [
            { key: 'APP_NAME', label: 'App Name', description: 'Application name', type: 'string', editable: false },
            { key: 'VERSION', label: 'Version', description: 'Current version', type: 'string', editable: false },
            { key: 'ENV', label: 'Environment', description: 'Runtime environment', type: 'string', editable: false },
            { key: 'DEBUG', label: 'Debug Mode', description: 'Verbose output and detailed error tracking', type: 'boolean', editable: false },
            { key: 'SAFE_MODE', label: 'Safe Mode', description: 'Prevents active payload injection; only simulates attacks', type: 'boolean', editable: true },
        ],
    },
    {
        id: 'llm',
        title: 'LLM Settings',
        iconName: 'ModelIcon',
        fields: [
            { key: 'PROVIDER', label: 'Active Provider', description: 'Current LLM provider (managed in Provider tab)', type: 'string', editable: false },
            { key: 'MIN_CREDITS', label: 'Min Credits', description: 'Minimum OpenRouter credit balance to start scan', type: 'number', editable: false },
            { key: 'LLM_REQUEST_TIMEOUT', label: 'LLM Request Timeout', description: 'Timeout in seconds for each LLM API call', type: 'number', editable: false },
            { key: 'MAX_CONCURRENT_REQUESTS', label: 'Max Concurrent LLM Requests', description: 'Maximum concurrent API requests to LLM provider', type: 'number', editable: true },
            { key: 'OPENROUTER_ONLINE', label: 'OpenRouter Online', description: 'Allow models to access the internet (OpenRouter only)', type: 'boolean', editable: false },
        ],
    },
    {
        id: 'scan',
        title: 'Scan & Crawling',
        iconName: 'ScanIcon',
        fields: [
            { key: 'MAX_DEPTH', label: 'Max Depth', description: 'Maximum depth for the visual crawler (BFS)', type: 'number', editable: true },
            { key: 'MAX_URLS', label: 'Max URLs', description: 'Maximum number of unique URLs to scan', type: 'number', editable: true },
            { key: 'MAX_CONCURRENT_URL_AGENTS', label: 'Max Concurrent URL Agents', description: 'Parallel URL agents (5-10 recommended)', type: 'number', editable: true },
            { key: 'GOSPIDER_NO_REDIRECT', label: 'No Redirect', description: 'Disable redirect following in crawler', type: 'boolean', editable: false },
            { key: 'URL_PATTERN_DEDUP', label: 'URL Pattern Dedup', description: 'Collapse URLs with same path pattern (e.g. /products/1 and /products/2)', type: 'boolean', editable: false },
            { key: 'URL_PRIORITIZATION_ENABLED', label: 'URL Prioritization', description: 'Score and prioritize URLs by potential vuln surface', type: 'boolean', editable: false },
            { key: 'URL_PRIORITIZATION_LOG_SCORES', label: 'Log Priority Scores', description: 'Log priority scores for each URL', type: 'boolean', editable: false },
            { key: 'URL_PRIORITIZATION_CUSTOM_PATHS', label: 'Custom Priority Paths', description: 'Custom high-priority paths (comma-separated)', type: 'string', editable: false },
            { key: 'URL_PRIORITIZATION_CUSTOM_PARAMS', label: 'Custom Priority Params', description: 'Custom high-priority params (comma-separated)', type: 'string', editable: false },
            { key: 'MAX_QUEUE_SIZE', label: 'Max Queue Size', description: 'Maximum items in crawler queue', type: 'number', editable: false },
            { key: 'CRAWLER_EXCLUDE_EXTENSIONS', label: 'Exclude Extensions', description: 'File extensions to exclude from crawling', type: 'string', editable: false },
            { key: 'CRAWLER_INCLUDE_EXTENSIONS', label: 'Include Extensions', description: 'File extensions to include (empty = all not excluded)', type: 'string', editable: false },
        ],
    },
    {
        id: 'parallelization',
        title: 'Parallelization',
        iconName: 'BoltIcon',
        fields: [
            { key: 'MAX_CONCURRENT_DISCOVERY', label: 'Max Concurrent Discovery', description: 'Parallel workers for URL discovery phase', type: 'number', editable: false },
            { key: 'MAX_CONCURRENT_ANALYSIS', label: 'Max Concurrent Analysis', description: 'Parallel workers for analysis phase', type: 'number', editable: false },
            { key: 'MAX_CONCURRENT_SPECIALISTS', label: 'Max Concurrent Specialists', description: 'Parallel specialist agent workers', type: 'number', editable: false },
            { key: 'MAX_CONCURRENT_VALIDATION', label: 'Max Concurrent Validation', description: 'Parallel workers for finding validation', type: 'number', editable: false },
        ],
    },
    {
        id: 'behavior',
        title: 'Scanning Behavior',
        iconName: 'ShieldIcon',
        fields: [
            { key: 'STOP_ON_CRITICAL', label: 'Stop on Critical', description: 'Stop scan when a critical vulnerability is validated', type: 'boolean', editable: true },
            { key: 'CRITICAL_TYPES', label: 'Critical Types', description: 'Vulnerability types considered critical (comma-separated)', type: 'string', editable: false },
            { key: 'EARLY_EXIT_ON_FINDING', label: 'Early Exit on Finding', description: 'Stop testing remaining params after first vuln found', type: 'boolean', editable: true },
            { key: 'HEADLESS_BROWSER', label: 'Headless Browser', description: 'Run browser without visible window', type: 'boolean', editable: true },
            { key: 'MANDATORY_SQLMAP_VALIDATION', label: 'Mandatory SQLMap', description: 'Require sqlmap validation for SQL injection findings', type: 'boolean', editable: false },
            { key: 'SKIP_VALIDATED_PARAMS', label: 'Skip Validated Params', description: 'Skip parameters already validated in previous scans', type: 'boolean', editable: false },
            { key: 'SCAN_DEPTH', label: 'Scan Depth', description: 'Exploitation depth: quick (L0-L1), standard (L0-L3), thorough (L0-L4 + SQLMap)', type: 'string', editable: false },
        ],
    },
    {
        id: 'skeptical_thresholds',
        title: 'Skeptical Thresholds',
        iconName: 'ShieldIcon',
        fields: [], // Rendered by ThresholdsSection (dict type, not flat fields)
    },
    {
        id: 'authority',
        title: 'Authority & Skeptical',
        iconName: 'LockIcon',
        fields: [
            { key: 'ENABLE_SELF_VALIDATION', label: 'Self Validation', description: 'Enable self-validation of findings before report', type: 'boolean', editable: false },
            { key: 'XSS_SELF_VALIDATE', label: 'XSS Self-Validate', description: 'Self-validate XSS findings with browser', type: 'boolean', editable: false },
            { key: 'SQLI_SELF_VALIDATE', label: 'SQLi Self-Validate', description: 'Self-validate SQL injection findings', type: 'boolean', editable: false },
            { key: 'RCE_SELF_VALIDATE', label: 'RCE Self-Validate', description: 'Self-validate RCE findings', type: 'boolean', editable: false },
            { key: 'CONSENSUS_VOTES', label: 'Consensus Votes', description: 'Number of LLM votes required for finding consensus', type: 'number', editable: false },
            { key: 'FP_CONFIDENCE_THRESHOLD', label: 'FP Confidence Threshold', description: 'Minimum confidence to flag as false positive', type: 'number', editable: false },
            { key: 'FP_SKEPTICAL_WEIGHT', label: 'FP Skeptical Weight', description: 'Weight of skeptical review in FP scoring', type: 'number', editable: false },
            { key: 'FP_VOTES_WEIGHT', label: 'FP Votes Weight', description: 'Weight of consensus votes in FP scoring', type: 'number', editable: false },
            { key: 'FP_EVIDENCE_WEIGHT', label: 'FP Evidence Weight', description: 'Weight of evidence quality in FP scoring', type: 'number', editable: false },
        ],
    },
    {
        id: 'conductor',
        title: 'Conductor',
        iconName: 'BoltIcon',
        fields: [
            { key: 'CONDUCTOR_DISABLE_VALIDATION', label: 'Disable Validation', description: 'Skip conductor validation phase', type: 'boolean', editable: false },
            { key: 'CONDUCTOR_CONTEXT_REFRESH_INTERVAL', label: 'Context Refresh', description: 'Interval (s) to refresh conductor context', type: 'number', editable: false },
            { key: 'CONDUCTOR_MIN_CONFIDENCE', label: 'Min Confidence', description: 'Minimum confidence to accept a finding', type: 'number', editable: false },
            { key: 'CONDUCTOR_ENABLE_FP_DETECTION', label: 'FP Detection', description: 'Enable false-positive detection in conductor', type: 'boolean', editable: false },
            { key: 'DAST_ANALYSIS_TIMEOUT', label: 'DAST Analysis Timeout', description: 'Timeout (s) for DAST analysis phase', type: 'number', editable: false },
            { key: 'DAST_MAX_RETRIES', label: 'DAST Max Retries', description: 'Max retry rounds for URLs missing analysis JSON', type: 'number', editable: false },
            { key: 'DAST_CONSECUTIVE_TIMEOUT_LIMIT', label: 'Consecutive Timeout Limit', description: 'Auto-pause after N consecutive timeouts (target may be down)', type: 'number', editable: false },
            { key: 'DAST_TIMEOUT_PERCENT_LIMIT', label: 'Timeout Percent Limit', description: 'Auto-pause if this % of URLs timeout', type: 'number', editable: false },
            { key: 'DAST_AUTO_RESUME_DELAY', label: 'Auto Resume Delay', description: 'Seconds to wait before auto-resuming after pause (0 = manual)', type: 'number', editable: false },
        ],
    },
    {
        id: 'thinking',
        title: 'Thinking Agent',
        iconName: 'CogIcon',
        fields: [
            { key: 'THINKING_MODE', label: 'Mode', description: 'Thinking agent operation mode', type: 'string', editable: false },
            { key: 'THINKING_BATCH_SIZE', label: 'Batch Size', description: 'Max items per thinking batch', type: 'number', editable: false },
            { key: 'THINKING_BATCH_TIMEOUT', label: 'Batch Timeout', description: 'Timeout (s) for each thinking batch', type: 'number', editable: false },
            { key: 'THINKING_DEDUP_WINDOW', label: 'Dedup Window', description: 'Time window (s) for deduplication', type: 'number', editable: false },
            { key: 'THINKING_FP_THRESHOLD', label: 'FP Threshold', description: 'False positive threshold for thinking agent', type: 'number', editable: false },
            { key: 'THINKING_BACKPRESSURE_RETRIES', label: 'Backpressure Retries', description: 'Retries before applying backpressure', type: 'number', editable: false },
            { key: 'THINKING_BACKPRESSURE_DELAY', label: 'Backpressure Delay', description: 'Delay (s) between backpressure retries', type: 'number', editable: false },
            { key: 'THINKING_EMIT_EVENTS', label: 'Emit Events', description: 'Emit thinking events to WebSocket', type: 'boolean', editable: false },
        ],
    },
    {
        id: 'embeddings',
        title: 'Embeddings Classification',
        iconName: 'ModelIcon',
        fields: [
            { key: 'USE_EMBEDDINGS_CLASSIFICATION', label: 'Enable Embeddings', description: 'Use embeddings for vulnerability classification', type: 'boolean', editable: false },
            { key: 'EMBEDDINGS_CONFIDENCE_THRESHOLD', label: 'Confidence Threshold', description: 'Min confidence for embeddings classification', type: 'number', editable: false },
            { key: 'EMBEDDINGS_MANUAL_REVIEW_THRESHOLD', label: 'Manual Review Threshold', description: 'Below this confidence, flag for manual review', type: 'number', editable: false },
            { key: 'EMBEDDINGS_LOG_CONFIDENCE', label: 'Log Confidence', description: 'Log classification confidence scores', type: 'boolean', editable: false },
        ],
    },
    {
        id: 'browser',
        title: 'Browser & CDP',
        iconName: 'GlobeIcon',
        fields: [
            { key: 'CDP_ENABLED', label: 'CDP Enabled', description: 'Use Chrome DevTools Protocol for validation', type: 'boolean', editable: false },
            { key: 'CDP_PORT', label: 'CDP Port', description: 'Chrome DevTools Protocol port', type: 'number', editable: false },
            { key: 'CDP_TIMEOUT', label: 'CDP Timeout', description: 'CDP connection timeout (s)', type: 'number', editable: false },
            { key: 'USER_AGENT', label: 'User Agent', description: 'Browser user agent string', type: 'string', editable: false },
            { key: 'VIEWPORT_WIDTH', label: 'Viewport Width', description: 'Browser viewport width (px)', type: 'number', editable: false },
            { key: 'VIEWPORT_HEIGHT', label: 'Viewport Height', description: 'Browser viewport height (px)', type: 'number', editable: false },
            { key: 'TIMEOUT_MS', label: 'Page Timeout', description: 'Page load timeout (ms)', type: 'number', editable: false },
            { key: 'SPA_WAIT_MS', label: 'SPA Wait', description: 'Wait time (ms) for SPA rendering', type: 'number', editable: false },
            { key: 'JWT_RATE_LIMIT_DELAY', label: 'JWT Rate Limit', description: 'Seconds between JWT attack requests', type: 'number', editable: false },
            { key: 'DOM_CLICK_MAX_LINKS', label: 'DOM Click Max Links', description: 'Maximum link elements to click during DOM exploration', type: 'number', editable: false },
            { key: 'DOM_CLICK_MAX_TEXT_LINKS', label: 'DOM Click Max Text Links', description: 'Maximum text-based links to click during DOM exploration', type: 'number', editable: false },
            { key: 'DOM_CLICK_WAIT_SEC', label: 'DOM Click Wait', description: 'Seconds to wait after each DOM click action', type: 'number', editable: false },
            { key: 'DOM_CLICK_INITIAL_WAIT_SEC', label: 'DOM Click Initial Wait', description: 'Seconds to wait before starting DOM click exploration', type: 'number', editable: false },
        ],
    },
    {
        id: 'analysis',
        title: 'Analysis',
        iconName: 'ScanIcon',
        fields: [
            { key: 'ANALYSIS_ENABLE', label: 'Enable Analysis', description: 'Enable multi-perspective analysis phase', type: 'boolean', editable: false },
            { key: 'ANALYSIS_CONFIDENCE_THRESHOLD', label: 'Confidence Threshold', description: 'Min confidence for analysis acceptance', type: 'number', editable: false },
            { key: 'ANALYSIS_SKIP_THRESHOLD', label: 'Skip Threshold', description: 'Below this score, skip further analysis', type: 'number', editable: false },
            { key: 'ANALYSIS_CONSENSUS_VOTES', label: 'Consensus Votes', description: 'Required votes for analysis consensus', type: 'number', editable: false },
        ],
    },
    {
        id: 'vision',
        title: 'Vision Validation',
        iconName: 'EyeIcon',
        fields: [
            { key: 'VALIDATION_VISION_ENABLED', label: 'Vision Enabled', description: 'Use vision model to validate findings visually', type: 'boolean', editable: false },
            { key: 'VALIDATION_VISION_ONLY_FOR_XSS', label: 'XSS Only', description: 'Restrict vision validation to XSS findings', type: 'boolean', editable: false },
            { key: 'VALIDATION_MAX_VISION_CALLS_PER_URL', label: 'Max Calls/URL', description: 'Max vision API calls per URL', type: 'number', editable: false },
        ],
    },
    {
        id: 'manipulator',
        title: 'Manipulator',
        iconName: 'WrenchIcon',
        fields: [
            { key: 'MANIPULATOR_GLOBAL_RATE_LIMIT', label: 'Global Rate Limit', description: 'Max requests/second for payload delivery', type: 'number', editable: false },
            { key: 'MANIPULATOR_USE_GLOBAL_RATE_LIMITER', label: 'Use Rate Limiter', description: 'Enable global rate limiting for manipulator', type: 'boolean', editable: false },
            { key: 'MANIPULATOR_ENABLE_LLM_EXPANSION', label: 'LLM Expansion', description: 'Use LLM to generate additional payload variants', type: 'boolean', editable: false },
            { key: 'MANIPULATOR_ENABLE_AGENTIC_FALLBACK', label: 'Agentic Fallback', description: 'Fallback to agentic mode when static payloads fail', type: 'boolean', editable: false },
            { key: 'MANIPULATOR_BREAKOUT_PRIORITY_LEVEL', label: 'Breakout Priority', description: 'Priority level for context-breakout payloads', type: 'number', editable: false },
            { key: 'MANIPULATOR_MAX_LLM_PAYLOADS', label: 'Max LLM Payloads', description: 'Maximum payloads generated by LLM per context', type: 'number', editable: false },
        ],
    },
    {
        id: 'idor',
        title: 'IDOR Agent',
        iconName: 'LockIcon',
        fields: [
            { key: 'IDOR_ID_RANGE', label: 'ID Range', description: 'Range of IDs to test (e.g. "1-100")', type: 'string', editable: false },
            { key: 'IDOR_CUSTOM_IDS', label: 'Custom IDs', description: 'Custom ID values to test', type: 'string', editable: false },
            { key: 'IDOR_QUEUE_BATCH_SIZE', label: 'Queue Batch Size', description: 'Batch size for IDOR request queue', type: 'number', editable: false },
            { key: 'IDOR_QUEUE_MAX_WAIT', label: 'Queue Max Wait', description: 'Max wait time (s) for queue batching', type: 'number', editable: false },
            { key: 'IDOR_ENABLE_COOKIE_TAMPERING', label: 'Cookie Tampering', description: 'Test cookie-based IDOR', type: 'boolean', editable: false },
            { key: 'IDOR_SMART_ID_DETECTION', label: 'Smart ID Detection', description: 'Auto-detect ID patterns in responses', type: 'boolean', editable: false },
            { key: 'IDOR_ENABLE_LLM_PREDICTION', label: 'LLM Prediction', description: 'Use LLM to predict valid ID values', type: 'boolean', editable: false },
            { key: 'IDOR_LLM_PREDICTION_COUNT', label: 'Prediction Count', description: 'Number of IDs to predict per endpoint', type: 'number', editable: false },
            { key: 'IDOR_PREDICTION_PRIORITY', label: 'Prediction Priority', description: 'Priority of LLM-predicted IDs vs sequential', type: 'string', editable: false },
            { key: 'IDOR_ENABLE_LLM_VALIDATION', label: 'LLM Validation', description: 'Use LLM to validate IDOR findings', type: 'boolean', editable: false },
            { key: 'IDOR_ENABLE_DEEP_EXPLOITATION', label: 'Deep Exploitation', description: 'Enable deep IDOR exploitation after detection', type: 'boolean', editable: false },
            { key: 'IDOR_EXPLOITER_MODE', label: 'Exploiter Mode', description: 'Exploitation mode (e.g. read, write, delete)', type: 'string', editable: false },
            { key: 'IDOR_EXPLOITER_ENABLE_WRITE_TESTS', label: 'Write Tests', description: 'Test write operations in IDOR exploitation', type: 'boolean', editable: false },
            { key: 'IDOR_EXPLOITER_ENABLE_DELETE_TESTS', label: 'Delete Tests', description: 'Test delete operations in IDOR exploitation', type: 'boolean', editable: false },
            { key: 'IDOR_EXPLOITER_MAX_HORIZONTAL_ENUM', label: 'Max Horizontal Enum', description: 'Maximum horizontal enumeration attempts', type: 'number', editable: false },
            { key: 'IDOR_EXPLOITER_SEVERITY_THRESHOLD', label: 'Severity Threshold', description: 'Min severity to trigger exploitation', type: 'string', editable: false },
            { key: 'IDOR_EXPLOITER_RATE_LIMIT', label: 'Exploiter Rate Limit', description: 'Requests/second for exploitation', type: 'number', editable: false },
            { key: 'IDOR_EXPLOITER_TIMEOUT', label: 'Exploiter Timeout', description: 'Timeout (s) for exploitation attempts', type: 'number', editable: false },
        ],
    },
    {
        id: 'waf',
        title: 'WAF Q-Learning',
        iconName: 'ShieldIcon',
        fields: [
            { key: 'WAF_QLEARNING_INITIAL_EPSILON', label: 'Initial Epsilon', description: 'Initial exploration rate for WAF bypass', type: 'number', editable: false },
            { key: 'WAF_QLEARNING_MIN_EPSILON', label: 'Min Epsilon', description: 'Minimum exploration rate', type: 'number', editable: false },
            { key: 'WAF_QLEARNING_DECAY_RATE', label: 'Decay Rate', description: 'Epsilon decay rate per iteration', type: 'number', editable: false },
            { key: 'WAF_QLEARNING_UCB_CONSTANT', label: 'UCB Constant', description: 'Upper confidence bound exploration constant', type: 'number', editable: false },
            { key: 'WAF_QLEARNING_MAX_BACKUPS', label: 'Max Backups', description: 'Maximum Q-table backup files to retain', type: 'number', editable: false },
        ],
    },
    {
        id: 'tracing',
        title: 'Tracing & OOB',
        iconName: 'WrenchIcon',
        fields: [
            { key: 'TRACING_ENABLED', label: 'Tracing Enabled', description: 'Enable out-of-band interaction tracing', type: 'boolean', editable: false },
            { key: 'INTERACTSH_SERVER', label: 'Interactsh Server', description: 'OOB interaction server URL', type: 'string', editable: false },
            { key: 'INTERACTSH_POLL_INTERVAL', label: 'Poll Interval', description: 'OOB server polling interval (s)', type: 'number', editable: false },
        ],
    },
    {
        id: 'report',
        title: 'Report',
        iconName: 'ReportIcon',
        fields: [
            { key: 'REPORT_ONLY_VALIDATED', label: 'Only Validated Findings', description: 'Include only findings with evidence in reports', type: 'boolean', editable: true },
        ],
    },
    {
        id: 'ssl',
        title: 'SSL/TLS',
        iconName: 'LockIcon',
        fields: [
            { key: 'VERIFY_SSL_CERTIFICATES', label: 'Verify SSL', description: 'Enable SSL certificate verification', type: 'boolean', editable: false },
            { key: 'ALLOW_SELF_SIGNED_CERTS', label: 'Allow Self-Signed', description: 'Allow self-signed certificates for testing', type: 'boolean', editable: false },
        ],
    },
    {
        id: 'lonewolf',
        title: 'Lonewolf Agent',
        iconName: 'BoltIcon',
        fields: [
            { key: 'LONEWOLF_ENABLED', label: 'Enabled', description: 'Enable autonomous Lonewolf agent', type: 'boolean', editable: false },
            { key: 'LONEWOLF_RATE_LIMIT', label: 'Rate Limit', description: 'HTTP requests per second', type: 'number', editable: false },
            { key: 'LONEWOLF_MAX_CONTEXT', label: 'Max Context', description: 'Sliding window size (actions remembered)', type: 'number', editable: false },
            { key: 'LONEWOLF_RESPONSE_TRUNCATE', label: 'Response Truncate', description: 'Max chars kept from HTTP responses', type: 'number', editable: false },
        ],
    },
    {
        id: 'strategy',
        title: 'Analysis Strategy',
        iconName: 'ScanIcon',
        fields: [
            { key: 'RAW_REFLECTIONS_IN_STRATEGY', label: 'Raw Reflections', description: 'Include raw reflection probes in analysis reports', type: 'boolean', editable: false },
            { key: 'ACTIVE_RECON_PROBES', label: 'Active Recon Probes', description: 'Run active recon probes before LLM analysis', type: 'boolean', editable: false },
            { key: 'OMNI_PROBE_MARKER', label: 'Omni-Probe Marker', description: 'Unique marker string for detecting reflections', type: 'string', editable: false },
            { key: 'REQUIRE_EVIDENCE_IN_ANALYSIS', label: 'Require Evidence', description: 'Prohibit vague statements in analysis reports', type: 'boolean', editable: false },
        ],
    },
    {
        id: 'asset_discovery',
        title: 'Asset Discovery',
        iconName: 'GlobeIcon',
        fields: [
            { key: 'ENABLE_ASSET_DISCOVERY', label: 'Enable Discovery', description: 'Enable subdomain enumeration and asset reconnaissance', type: 'boolean', editable: false },
            { key: 'ENABLE_DNS_ENUMERATION', label: 'DNS Enumeration', description: 'DNS bruteforce for subdomain discovery', type: 'boolean', editable: false },
            { key: 'ENABLE_CERTIFICATE_TRANSPARENCY', label: 'Certificate Transparency', description: 'Search CT logs for subdomains', type: 'boolean', editable: false },
            { key: 'ENABLE_WAYBACK_DISCOVERY', label: 'Wayback Discovery', description: 'Search Wayback Machine for hidden endpoints', type: 'boolean', editable: false },
            { key: 'ENABLE_CLOUD_STORAGE_ENUM', label: 'Cloud Storage Enum', description: 'Detect S3, Azure, GCP buckets', type: 'boolean', editable: false },
            { key: 'ENABLE_COMMON_PATHS', label: 'Common Paths', description: 'Discover common hidden paths and directories', type: 'boolean', editable: false },
            { key: 'MAX_SUBDOMAINS', label: 'Max Subdomains', description: 'Maximum subdomains to test', type: 'number', editable: false },
        ],
    },
    {
        id: 'anthropic',
        title: 'Anthropic OAuth',
        iconName: 'LockIcon',
        fields: [
            { key: 'ANTHROPIC_OAUTH_ENABLED', label: 'OAuth Enabled', description: 'Enable direct Claude API via OAuth', type: 'boolean', editable: false },
            { key: 'ANTHROPIC_TOKEN_FILE', label: 'Token File', description: 'Path to OAuth token file', type: 'string', editable: false },
        ],
    },
    {
        id: 'pipeline',
        title: 'Pipeline Orchestration',
        iconName: 'BoltIcon',
        fields: [
            { key: 'PIPELINE_PHASE_TIMEOUT', label: 'Phase Timeout', description: 'Max seconds per pipeline phase', type: 'number', editable: false },
            { key: 'PIPELINE_DRAIN_TIMEOUT', label: 'Drain Timeout', description: 'Seconds to drain queues on shutdown', type: 'number', editable: false },
            { key: 'PIPELINE_PAUSE_CHECK_INTERVAL', label: 'Pause Check', description: 'Pause check frequency (seconds)', type: 'number', editable: false },
            { key: 'PIPELINE_DISCOVERY_COMPLETION_DELAY', label: 'Discovery Delay', description: 'Wait time for late findings (seconds)', type: 'number', editable: false },
            { key: 'PIPELINE_AUTO_TRANSITION', label: 'Auto Transition', description: 'Automatic phase transitions', type: 'boolean', editable: false },
        ],
    },
    {
        id: 'batch',
        title: 'Batch Processing',
        iconName: 'CogIcon',
        fields: [
            { key: 'BATCH_PROCESSING_ENABLED', label: 'Batch Processing', description: 'Enable batch DAST mode', type: 'boolean', editable: false },
            { key: 'BATCH_DAST_CONCURRENCY', label: 'DAST Concurrency', description: 'Max concurrent DAST agents', type: 'number', editable: false },
            { key: 'BATCH_QUEUE_DRAIN_TIMEOUT', label: 'Queue Drain Timeout', description: 'Seconds to wait for queues to drain', type: 'number', editable: false },
            { key: 'BATCH_QUEUE_CHECK_INTERVAL', label: 'Queue Check Interval', description: 'Seconds between queue depth checks', type: 'number', editable: false },
        ],
    },
    {
        id: 'workers',
        title: 'Worker Pool',
        iconName: 'CogIcon',
        fields: [
            { key: 'WORKER_POOL_DEFAULT_SIZE', label: 'Default Pool Size', description: 'Default workers per specialist', type: 'number', editable: false },
            { key: 'WORKER_POOL_XSS_SIZE', label: 'XSS Pool Size', description: 'XSS-specific workers (high volume)', type: 'number', editable: false },
            { key: 'WORKER_POOL_SQLI_SIZE', label: 'SQLi Pool Size', description: 'SQLi-specific workers', type: 'number', editable: false },
            { key: 'WORKER_POOL_SHUTDOWN_TIMEOUT', label: 'Shutdown Timeout', description: 'Max seconds to drain on shutdown', type: 'number', editable: false },
            { key: 'WORKER_POOL_DEQUEUE_TIMEOUT', label: 'Dequeue Timeout', description: 'Seconds to wait for queue item', type: 'number', editable: false },
            { key: 'WORKER_POOL_EMIT_EVENTS', label: 'Emit Events', description: 'Emit vulnerability_detected events', type: 'boolean', editable: false },
        ],
    },
    {
        id: 'queue',
        title: 'Queue Configuration',
        iconName: 'CogIcon',
        fields: [
            { key: 'QUEUE_PERSISTENCE_MODE', label: 'Persistence Mode', description: 'Queue mode: memory or redis', type: 'string', editable: false },
            { key: 'QUEUE_DEFAULT_MAX_DEPTH', label: 'Max Queue Depth', description: 'Maximum items per queue', type: 'number', editable: false },
            { key: 'QUEUE_DEFAULT_RATE_LIMIT', label: 'Rate Limit', description: 'Max items/second (0 = unlimited)', type: 'number', editable: false },
            { key: 'QUEUE_REDIS_URL', label: 'Redis URL', description: 'Redis connection URL', type: 'string', editable: false },
        ],
    },
    {
        id: 'performance',
        title: 'Performance Metrics',
        iconName: 'EyeIcon',
        fields: [
            { key: 'VALIDATION_METRICS_ENABLED', label: 'Validation Metrics', description: 'Track validation load metrics', type: 'boolean', editable: false },
            { key: 'CDP_LOAD_TARGET', label: 'CDP Load Target', description: 'Target % findings going to CDP validation', type: 'number', editable: false },
            { key: 'VALIDATION_LOG_INTERVAL', label: 'Validation Log Interval', description: 'Log metrics every N findings', type: 'number', editable: false },
            { key: 'PERF_CDP_LOG_ENABLED', label: 'CDP Log', description: 'Log CDP reduction summary after scans', type: 'boolean', editable: false },
            { key: 'PERF_CDP_LOG_INTERVAL', label: 'CDP Log Interval', description: 'Log CDP metrics every N findings', type: 'number', editable: false },
            { key: 'PERF_DEDUP_LOG_ENABLED', label: 'Dedup Log', description: 'Log deduplication metrics', type: 'boolean', editable: false },
            { key: 'PERF_DEDUP_LOG_INTERVAL', label: 'Dedup Log Interval', description: 'Log dedup stats every N duplicates', type: 'number', editable: false },
            { key: 'PERF_PARALLEL_LOG_ENABLED', label: 'Parallel Log', description: 'Log parallelization metrics', type: 'boolean', editable: false },
            { key: 'PERF_PARALLEL_LOG_INTERVAL', label: 'Parallel Log Interval', description: 'Log parallel stats every N ops', type: 'number', editable: false },
        ],
    },
];

/** All keys explicitly mapped in sections (includes dict-type keys). */
export const MAPPED_KEYS = new Set([
    ...CONFIG_SECTIONS.flatMap(s => s.fields.map(f => f.key)),
    'SKEPTICAL_THRESHOLDS',
]);

/** Skeptical threshold metadata for rendering. */
export const THRESHOLD_META: Record<string, { label: string; description: string; severity: 'critical' | 'high' | 'medium' }> = {
    RCE: { label: 'RCE', description: 'Remote Code Execution', severity: 'critical' },
    SQL: { label: 'SQLi', description: 'SQL Injection', severity: 'critical' },
    XXE: { label: 'XXE', description: 'XML External Entity', severity: 'high' },
    SSRF: { label: 'SSRF', description: 'Server-Side Request Forgery', severity: 'high' },
    LFI: { label: 'LFI', description: 'Local File Inclusion', severity: 'high' },
    XSS: { label: 'XSS', description: 'Cross-Site Scripting', severity: 'medium' },
    CSTI: { label: 'CSTI', description: 'Client-Side Template Injection', severity: 'medium' },
    SSTI: { label: 'SSTI', description: 'Server-Side Template Injection', severity: 'high' },
    TEMPLATE: { label: 'Template', description: 'Template Injection (catch-all)', severity: 'medium' },
    JWT: { label: 'JWT', description: 'JSON Web Token attacks', severity: 'medium' },
    FILE_UPLOAD: { label: 'File Upload', description: 'Unrestricted file upload', severity: 'medium' },
    IDOR: { label: 'IDOR', description: 'Insecure Direct Object Reference', severity: 'medium' },
    DEFAULT: { label: 'Default', description: 'Fallback for unknown types', severity: 'medium' },
};

export const THRESHOLD_SEVERITY_COLORS: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
};
