/* eslint-disable max-lines -- CLI configuration tab component.
 * Comprehensive security tool configuration interface with 17+ sections.
 * Maps all bugtraceaicli.conf parameters returned by GET /api/config.
 * Form-heavy component with extensive configuration schema - splitting would fragment settings UI.
 */
import { useState, ReactNode } from 'react';
import { useConfigEditor, EDITABLE_KEYS } from '../../hooks/useConfigEditor';

// --- Types ---

interface FieldDef {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string';
  editable: boolean;
}

interface SectionDef {
  id: string;
  title: string;
  icon: ReactNode;
  fields: FieldDef[];
}

// --- Section definitions ---

const CONFIG_SECTIONS: SectionDef[] = [
  {
    id: 'core',
    title: 'Core',
    icon: <CogIcon />,
    fields: [
      { key: 'APP_NAME', label: 'App Name', description: 'Application name', type: 'string', editable: false },
      { key: 'VERSION', label: 'Version', description: 'Current version', type: 'string', editable: false },
      { key: 'ENV', label: 'Environment', description: 'Runtime environment', type: 'string', editable: false },
      { key: 'DEBUG', label: 'Debug Mode', description: 'Verbose output and detailed error tracking', type: 'boolean', editable: false },
      { key: 'SAFE_MODE', label: 'Safe Mode', description: 'Prevents active payload injection; only simulates attacks', type: 'boolean', editable: true },
    ],
  },
  {
    id: 'models',
    title: 'LLM Models',
    icon: <ModelIcon />,
    fields: [
      { key: 'DEFAULT_MODEL', label: 'Default Model', description: 'Primary model for orchestration and reasoning', type: 'string', editable: true },
      { key: 'CODE_MODEL', label: 'Code Model', description: 'Specialized in code analysis and payload generation', type: 'string', editable: true },
      { key: 'ANALYSIS_MODEL', label: 'Analysis Model', description: 'Used for final log analysis and strategy review', type: 'string', editable: true },
      { key: 'MUTATION_MODEL', label: 'Mutation Model', description: 'Payload mutation and WAF bypass generation', type: 'string', editable: true },
      { key: 'SKEPTICAL_MODEL', label: 'Skeptical Model', description: 'Reviews findings to filter false positives', type: 'string', editable: true },
      { key: 'REPORTING_MODEL', label: 'Reporting Model', description: 'PoC enrichment and CVSS scoring', type: 'string', editable: false },
      { key: 'VISION_MODEL', label: 'Vision Model', description: 'Screenshot and UI analysis', type: 'string', editable: false },
      { key: 'OPENROUTER_ONLINE', label: 'OpenRouter Online', description: 'Allow models to access the internet', type: 'boolean', editable: false },
      { key: 'MIN_CREDITS', label: 'Min Credits', description: 'Minimum OpenRouter credit balance to start scan', type: 'number', editable: false },
      { key: 'LLM_REQUEST_TIMEOUT', label: 'LLM Request Timeout', description: 'Timeout in seconds for each LLM API call', type: 'number', editable: false },
      { key: 'PRIMARY_MODELS', label: 'Primary Models', description: 'Ordered model list (shifts if one fails)', type: 'string', editable: false },
      { key: 'WAF_DETECTION_MODELS', label: 'WAF Detection Models', description: 'Models for WAF detection and bypass', type: 'string', editable: false },
      { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', description: 'OpenRouter API key (masked)', type: 'string', editable: false },
      { key: 'GLM_API_KEY', label: 'GLM API Key', description: 'GLM API key (masked)', type: 'string', editable: false },
    ],
  },
  {
    id: 'scan',
    title: 'Scan & Crawling',
    icon: <ScanIcon />,
    fields: [
      { key: 'MAX_DEPTH', label: 'Max Depth', description: 'Maximum depth for the visual crawler (BFS)', type: 'number', editable: true },
      { key: 'MAX_URLS', label: 'Max URLs', description: 'Maximum number of unique URLs to scan', type: 'number', editable: true },
      { key: 'MAX_CONCURRENT_URL_AGENTS', label: 'Max Concurrent URL Agents', description: 'Parallel URL agents (5-10 recommended)', type: 'number', editable: true },
      { key: 'GOSPIDER_NO_REDIRECT', label: 'No Redirect', description: 'Disable redirect following in crawler', type: 'boolean', editable: false },
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
    icon: <BoltIcon />,
    fields: [
      { key: 'MAX_CONCURRENT_REQUESTS', label: 'Max Concurrent Requests', description: 'Maximum concurrent API requests to OpenRouter', type: 'number', editable: true },
      { key: 'MAX_CONCURRENT_DISCOVERY', label: 'Max Concurrent Discovery', description: 'Parallel workers for URL discovery phase', type: 'number', editable: false },
      { key: 'MAX_CONCURRENT_ANALYSIS', label: 'Max Concurrent Analysis', description: 'Parallel workers for analysis phase', type: 'number', editable: false },
      { key: 'MAX_CONCURRENT_SPECIALISTS', label: 'Max Concurrent Specialists', description: 'Parallel specialist agent workers', type: 'number', editable: false },
      { key: 'MAX_CONCURRENT_VALIDATION', label: 'Max Concurrent Validation', description: 'Parallel workers for finding validation', type: 'number', editable: false },
    ],
  },
  {
    id: 'behavior',
    title: 'Scanning Behavior',
    icon: <ShieldIcon />,
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
    icon: <ShieldIcon />,
    fields: [], // Rendered by ThresholdsSection (dict type, not flat fields)
  },
  {
    id: 'authority',
    title: 'Authority & Skeptical',
    icon: <LockIcon />,
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
    icon: <BoltIcon />,
    fields: [
      { key: 'CONDUCTOR_DISABLE_VALIDATION', label: 'Disable Validation', description: 'Skip conductor validation phase', type: 'boolean', editable: false },
      { key: 'CONDUCTOR_CONTEXT_REFRESH_INTERVAL', label: 'Context Refresh', description: 'Interval (s) to refresh conductor context', type: 'number', editable: false },
      { key: 'CONDUCTOR_MIN_CONFIDENCE', label: 'Min Confidence', description: 'Minimum confidence to accept a finding', type: 'number', editable: false },
      { key: 'CONDUCTOR_ENABLE_FP_DETECTION', label: 'FP Detection', description: 'Enable false-positive detection in conductor', type: 'boolean', editable: false },
      { key: 'DAST_ANALYSIS_TIMEOUT', label: 'DAST Analysis Timeout', description: 'Timeout (s) for DAST analysis phase', type: 'number', editable: false },
      { key: 'DAST_MAX_RETRIES', label: 'DAST Max Retries', description: 'Max retry rounds for URLs missing analysis JSON', type: 'number', editable: false },
    ],
  },
  {
    id: 'thinking',
    title: 'Thinking Agent',
    icon: <CogIcon />,
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
    icon: <ModelIcon />,
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
    icon: <GlobeIcon />,
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
    icon: <ScanIcon />,
    fields: [
      { key: 'ANALYSIS_ENABLE', label: 'Enable Analysis', description: 'Enable multi-perspective analysis phase', type: 'boolean', editable: false },
      { key: 'ANALYSIS_PENTESTER_MODEL', label: 'Pentester Model', description: 'LLM model for pentester perspective', type: 'string', editable: false },
      { key: 'ANALYSIS_BUG_BOUNTY_MODEL', label: 'Bug Bounty Model', description: 'LLM model for bug bounty perspective', type: 'string', editable: false },
      { key: 'ANALYSIS_AUDITOR_MODEL', label: 'Auditor Model', description: 'LLM model for auditor perspective', type: 'string', editable: false },
      { key: 'ANALYSIS_RED_TEAM_MODEL', label: 'Red Team Model', description: 'LLM model for red team perspective', type: 'string', editable: false },
      { key: 'ANALYSIS_RESEARCHER_MODEL', label: 'Researcher Model', description: 'LLM model for security researcher perspective', type: 'string', editable: false },
      { key: 'ANALYSIS_CONFIDENCE_THRESHOLD', label: 'Confidence Threshold', description: 'Min confidence for analysis acceptance', type: 'number', editable: false },
      { key: 'ANALYSIS_SKIP_THRESHOLD', label: 'Skip Threshold', description: 'Below this score, skip further analysis', type: 'number', editable: false },
      { key: 'ANALYSIS_CONSENSUS_VOTES', label: 'Consensus Votes', description: 'Required votes for analysis consensus', type: 'number', editable: false },
    ],
  },
  {
    id: 'vision',
    title: 'Vision Validation',
    icon: <EyeIcon />,
    fields: [
      { key: 'VALIDATION_VISION_ENABLED', label: 'Vision Enabled', description: 'Use vision model to validate findings visually', type: 'boolean', editable: false },
      { key: 'VALIDATION_VISION_MODEL', label: 'Vision Model', description: 'Model used for visual validation', type: 'string', editable: false },
      { key: 'VALIDATION_VISION_ONLY_FOR_XSS', label: 'XSS Only', description: 'Restrict vision validation to XSS findings', type: 'boolean', editable: false },
      { key: 'VALIDATION_MAX_VISION_CALLS_PER_URL', label: 'Max Calls/URL', description: 'Max vision API calls per URL', type: 'number', editable: false },
    ],
  },
  {
    id: 'manipulator',
    title: 'Manipulator',
    icon: <WrenchIcon />,
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
    icon: <LockIcon />,
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
    icon: <ShieldIcon />,
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
    icon: <WrenchIcon />,
    fields: [
      { key: 'TRACING_ENABLED', label: 'Tracing Enabled', description: 'Enable out-of-band interaction tracing', type: 'boolean', editable: false },
      { key: 'INTERACTSH_SERVER', label: 'Interactsh Server', description: 'OOB interaction server URL', type: 'string', editable: false },
      { key: 'INTERACTSH_POLL_INTERVAL', label: 'Poll Interval', description: 'OOB server polling interval (s)', type: 'number', editable: false },
    ],
  },
  {
    id: 'report',
    title: 'Report',
    icon: <ReportIcon />,
    fields: [
      { key: 'REPORT_ONLY_VALIDATED', label: 'Only Validated Findings', description: 'Include only findings with evidence in reports', type: 'boolean', editable: true },
    ],
  },
  {
    id: 'ssl',
    title: 'SSL/TLS',
    icon: <LockIcon />,
    fields: [
      { key: 'VERIFY_SSL_CERTIFICATES', label: 'Verify SSL', description: 'Enable SSL certificate verification', type: 'boolean', editable: false },
      { key: 'ALLOW_SELF_SIGNED_CERTS', label: 'Allow Self-Signed', description: 'Allow self-signed certificates for testing', type: 'boolean', editable: false },
    ],
  },
  {
    id: 'lonewolf',
    title: 'Lonewolf Agent',
    icon: <BoltIcon />,
    fields: [
      { key: 'LONEWOLF_ENABLED', label: 'Enabled', description: 'Enable autonomous Lonewolf agent', type: 'boolean', editable: false },
      { key: 'LONEWOLF_MODEL', label: 'Model', description: 'LLM model for Lonewolf reasoning', type: 'string', editable: false },
      { key: 'LONEWOLF_RATE_LIMIT', label: 'Rate Limit', description: 'HTTP requests per second', type: 'number', editable: false },
      { key: 'LONEWOLF_MAX_CONTEXT', label: 'Max Context', description: 'Sliding window size (actions remembered)', type: 'number', editable: false },
      { key: 'LONEWOLF_RESPONSE_TRUNCATE', label: 'Response Truncate', description: 'Max chars kept from HTTP responses', type: 'number', editable: false },
    ],
  },
  {
    id: 'strategy',
    title: 'Analysis Strategy',
    icon: <ScanIcon />,
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
    icon: <GlobeIcon />,
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
    icon: <LockIcon />,
    fields: [
      { key: 'ANTHROPIC_OAUTH_ENABLED', label: 'OAuth Enabled', description: 'Enable direct Claude API via OAuth', type: 'boolean', editable: false },
      { key: 'ANTHROPIC_TOKEN_FILE', label: 'Token File', description: 'Path to OAuth token file', type: 'string', editable: false },
    ],
  },
  {
    id: 'pipeline',
    title: 'Pipeline Orchestration',
    icon: <BoltIcon />,
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
    icon: <CogIcon />,
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
    icon: <CogIcon />,
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
    icon: <CogIcon />,
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
    icon: <EyeIcon />,
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

// All keys that are explicitly mapped in sections (includes dict-type keys handled by custom components)
const MAPPED_KEYS = new Set([...CONFIG_SECTIONS.flatMap(s => s.fields.map(f => f.key)), 'SKEPTICAL_THRESHOLDS']);

// --- Inline icons ---

function CogIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
    </svg>
  );
}

function ModelIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06ZM14.95 3.05a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.06a.75.75 0 0 1 1.06 0ZM3 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 8ZM14 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 14 8ZM7.172 13.828a.75.75 0 0 1-1.061-1.06l1.06-1.062a.75.75 0 0 1 1.062 1.061l-1.06 1.06ZM10 18a8 8 0 1 0 0-16.001A8 8 0 0 0 10 18Z" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.75Z" clipRule="evenodd" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13ZM13.25 9a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Zm-6.5 4a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5a.75.75 0 0 1 .75-.75Zm4-2a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
    </svg>
  );
}

function EllipsisIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M16.555 5.412a8.028 8.028 0 0 0-3.503-2.81 14.899 14.899 0 0 1 1.663 4.472 8.547 8.547 0 0 0 1.84-1.662ZM13.326 7.825a13.43 13.43 0 0 0-2.413-5.773 8.087 8.087 0 0 0-1.826 0 13.43 13.43 0 0 0-2.413 5.773A8.473 8.473 0 0 0 10 8.5c1.18 0 2.304-.24 3.326-.675ZM14.006 9.43a7.962 7.962 0 0 1-3.59 1.043c.04.498.063 1.003.063 1.527 0 2.027-.332 3.933-.945 5.556A8.029 8.029 0 0 0 18 10c0-.68-.084-1.341-.244-1.974a9.99 9.99 0 0 1-3.75 1.404ZM10.063 12c0-.463-.02-.922-.063-1.373a6.976 6.976 0 0 1-5.994 1.404A8.026 8.026 0 0 0 3.75 13.4a9.99 9.99 0 0 1 3.75 1.404C7.168 15.727 6.5 17.127 6.5 18.5A8.029 8.029 0 0 0 10 18c.338-1.62.5-3.403.063-6Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M19 5.5a4.5 4.5 0 0 1-4.791 4.49c-.873-.055-1.808.128-2.368.8l-6.024 7.23a2.724 2.724 0 1 1-3.837-3.837l7.23-6.024c.672-.56.855-1.495.8-2.368A4.5 4.5 0 0 1 14.5 1 3.5 3.5 0 0 0 18 4.5a.75.75 0 0 1 1 1Z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
    </svg>
  );
}

// --- Toggle Switch ---

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-coral/20 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${checked ? 'bg-coral shadow-[0_0_12px_rgba(255,127,80,0.3)]' : 'bg-ui-input-bg border-white/5'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

// --- Config Field ---

function ConfigField({
  field,
  value,
  editedValue,
  onEdit,
}: {
  field: FieldDef;
  value: any;
  editedValue: any;
  onEdit: (key: string, value: any) => void;
}) {
  const currentValue = editedValue !== undefined ? editedValue : value;
  const isEdited = editedValue !== undefined;
  const isEditable = field.editable;

  return (
    <div className={`group flex items-center justify-between py-2 px-3 rounded-xl transition-all duration-200 ${isEdited ? 'bg-coral/5 border border-coral/10' : 'hover:bg-white/[0.03] border border-transparent'}`}>
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-bold tracking-tight ${isEditable ? 'text-ui-text-main' : 'text-ui-text-dim/60'}`}>
            {field.label}
          </span>
          {isEdited && (
            <span className="badge-mini badge-mini-accent">modified</span>
          )}
          {!isEditable && (
            <span className="badge-mini !bg-white/5">read-only</span>
          )}
        </div>
        <p className="text-[11px] text-ui-text-muted mt-0.5 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">{field.description}</p>
      </div>

      <div className="flex-shrink-0">
        {field.type === 'boolean' ? (
          <ToggleSwitch
            checked={!!currentValue}
            onChange={(v) => onEdit(field.key, v)}
            disabled={!isEditable}
          />
        ) : field.type === 'number' ? (
          isEditable ? (
            <input
              type="number"
              min={1}
              value={currentValue ?? ''}
              onChange={(e) => onEdit(field.key, parseInt(e.target.value) || 0)}
              className="w-24 px-3 py-1.5 input-premium font-mono"
            />
          ) : (
            <span className="text-xs text-ui-text-dim font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">{String(currentValue ?? '')}</span>
          )
        ) : (
          isEditable ? (
            <input
              type="text"
              value={currentValue ?? ''}
              onChange={(e) => onEdit(field.key, e.target.value)}
              className="w-64 px-3 py-1.5 input-premium font-mono"
            />
          ) : (
            <span className="text-xs text-ui-text-dim font-mono truncate max-w-[280px] block bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">{String(currentValue ?? '')}</span>
          )
        )}
      </div>
    </div>
  );
}

// --- Config Section ---

function ConfigSection({
  section,
  config,
  editedFields,
  onEdit,
  defaultOpen,
}: {
  section: SectionDef;
  config: Record<string, any>;
  editedFields: Record<string, any>;
  onEdit: (key: string, value: any) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? true);
  const visibleFields = section.fields.filter(f => config[f.key] !== undefined);
  const editedCount = visibleFields.filter(f => editedFields[f.key] !== undefined).length;

  if (visibleFields.length === 0) return null;

  return (
    <div className="card-premium overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-all duration-300"
      >
        <div className="p-2 rounded-xl bg-coral/5 border border-coral/10 text-coral group-hover:scale-110 transition-transform">
          {section.icon}
        </div>
        <span className="title-standard flex-1">{section.title}</span>
        {editedCount > 0 && (
          <span className="badge-mini badge-mini-accent">
            {editedCount} pending changes
          </span>
        )}
        <div className="flex items-center gap-3">
          <span className="label-mini opacity-40">{visibleFields.length} fields</span>
          <div className={`text-ui-text-dim transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronIcon open={false} />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-2 pb-3 space-y-0.5">
          {visibleFields.map(field => (
            <ConfigField
              key={field.key}
              field={field}
              value={config[field.key]}
              editedValue={editedFields[field.key]}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Skeptical Thresholds Section (dict type) ---

const THRESHOLD_META: Record<string, { label: string; description: string; severity: 'critical' | 'high' | 'medium' }> = {
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

const SEVERITY_COLORS = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
};

function ThresholdsSection({ config, defaultOpen }: { config: Record<string, any>; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);
  const thresholds: Record<string, number> | undefined = config.SKEPTICAL_THRESHOLDS;

  if (!thresholds || typeof thresholds !== 'object') return null;

  const entries = Object.entries(thresholds);

  return (
    <div className="card-premium overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-all duration-300"
      >
        <div className="p-2 rounded-xl bg-coral/5 border border-coral/10 text-coral">
          <ShieldIcon />
        </div>
        <span className="title-standard flex-1">Skeptical Thresholds</span>
        <div className="flex items-center gap-3">
          <span className="label-mini opacity-40">{entries.length} thresholds</span>
          <div className={`text-ui-text-dim transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronIcon open={false} />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-2 pb-3">
          <p className="text-[11px] text-ui-text-muted px-3 pb-3 leading-relaxed opacity-60">
            Minimum confidence score (0-10) for findings to pass to specialist agents. Lower = more permissive, Higher = stricter.
          </p>
          <div className="space-y-0.5">
            {entries.map(([key, value]) => {
              const meta = THRESHOLD_META[key];
              const severityColor = meta ? SEVERITY_COLORS[meta.severity] : 'text-ui-text-dim';
              return (
                <div key={key} className="group flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/[0.03] border border-transparent">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-bold tracking-tight ${severityColor}`}>
                        {meta?.label ?? key}
                      </span>
                      <span className="badge-mini !bg-white/5">read-only</span>
                    </div>
                    <p className="text-[11px] text-ui-text-muted mt-0.5 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                      {meta?.description ?? key}
                    </p>
                  </div>
                  <span className="text-xs text-ui-text-dim font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export function ConfigurationTab() {
  const {
    config,
    editedFields,
    isLoading,
    isSaving,
    saveMessage,
    version,
    hasChanges,
    handleEdit,
    handleSave,
    handleReload,
  } = useConfigEditor();

  // Build "Other Settings" section from unmapped keys
  const unmappedKeys = Object.keys(config).filter(k => !MAPPED_KEYS.has(k));
  const otherSection: SectionDef | null = unmappedKeys.length > 0 ? {
    id: 'other',
    title: 'Other Settings',
    icon: <EllipsisIcon />,
    fields: unmappedKeys.map(key => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: '',
      type: (typeof config[key] === 'boolean' ? 'boolean' : typeof config[key] === 'number' ? 'number' : 'string') as FieldDef['type'],
      editable: EDITABLE_KEYS.has(key),
    })),
  } : null;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-purple-gray">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar - Standard Super Bar */}
      <div className="flex-shrink-0 flex justify-between items-center p-3 m-4 card-premium !rounded-3xl border-white/10">
        <div className="flex items-center gap-4 ml-3">
          <div className="flex flex-col">
            <span className="label-mini label-mini-accent">Kernel Configuration</span>
            <span className="title-standard">bugtraceaicli.conf</span>
          </div>
          {hasChanges && (
            <span className="badge-mini badge-mini-accent animate-pulse shadow-[0_0_10px_rgba(255,127,80,0.2)]">
              {Object.keys(editedFields).length} Pending Changes
            </span>
          )}
          {version && (
            <span className="badge-mini opacity-50">v{version}</span>
          )}
        </div>
        <div className="flex items-center gap-3 pr-1">
          {saveMessage && (
            <span className={`label-mini px-3 py-1.5 rounded-lg border ${saveMessage.type === 'success'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20'
              }`}>
              {saveMessage.text}
            </span>
          )}
          <button
            onClick={handleReload}
            className="btn-mini btn-mini-secondary h-9 px-5"
          >
            Reload Intel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="btn-mini btn-mini-primary h-9 px-6 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
          >
            {isSaving ? 'Synchronizing...' : 'Commit Changes'}
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {CONFIG_SECTIONS.map((section, i) =>
          section.id === 'skeptical_thresholds' ? (
            <ThresholdsSection key={section.id} config={config} defaultOpen={i < 5} />
          ) : (
            <ConfigSection
              key={section.id}
              section={section}
              config={config}
              editedFields={editedFields}
              onEdit={handleEdit}
              defaultOpen={i < 5}
            />
          )
        )}

        {otherSection && (
          <ConfigSection
            section={otherSection}
            config={config}
            editedFields={editedFields}
            onEdit={handleEdit}
            defaultOpen={false}
          />
        )}
      </div>
    </div>
  );
}
