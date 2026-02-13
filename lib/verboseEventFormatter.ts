/**
 * Verbose Event Formatter — maps CLI verbose event types to human-readable log messages.
 *
 * Covers all 148 verbose event types emitted by BugTraceAI-CLI agents.
 * Used by useScanSocket.ts to format events for the ScanConsole.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface FormattedEvent {
  level: LogLevel;
  message: string;
}

// ---------------------------------------------------------------------------
// Template interpolation
// ---------------------------------------------------------------------------

function interp(template: string, d: Record<string, any>): string {
  let result = template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = d[key];
    if (val === undefined || val === null || val === '') return '';
    let s = String(val);
    if (s.length > 80) s = s.substring(0, 77) + '...';
    return s;
  });
  // Clean up artifacts from empty interpolations
  result = result.replace(/ on ''/g, '');
  result = result.replace(/: $/g, '');
  result = result.replace(/— $/g, '').replace(/→ $/g, '');
  result = result.replace(/ {2,}/g, ' ');
  return result.trim();
}

// ---------------------------------------------------------------------------
// Explicit templates: [LogLevel, messageTemplate]
// {field} references event data fields from VerboseEventEmitter payloads
// ---------------------------------------------------------------------------

const T: Record<string, [LogLevel, string]> = {

  // ── Pipeline ──────────────────────────────────────────────────────────

  'pipeline.initializing':       ['INFO',    '[PIPELINE] Initializing scan pipeline'],
  'pipeline.phase_transition':   ['INFO',    '[PIPELINE] → {from_phase} → {to_phase}'],
  'pipeline.checkpoint':         ['INFO',    '[PIPELINE] Checkpoint: {phase} integrity verified'],
  'pipeline.paused':             ['WARNING', '[PIPELINE] Scan paused'],
  'pipeline.resumed':            ['INFO',    '[PIPELINE] Scan resumed'],
  'pipeline.error':              ['ERROR',   '[PIPELINE] Pipeline error: {error}'],
  'pipeline.heartbeat':          ['DEBUG',   '[PIPELINE] Heartbeat: {phase} (uptime {uptime_ms}ms)'],
  'pipeline.completed':          ['INFO',    '[PIPELINE] Pipeline completed ({total_phases} phases)'],

  // ── Reconnaissance ────────────────────────────────────────────────────

  'recon.started':               ['INFO',    '[RECON] Reconnaissance started on {target_url}'],
  'recon.completed':             ['INFO',    '[RECON] Reconnaissance completed — {urls_found} URLs found'],
  'recon.gospider.started':      ['INFO',    '[RECON] GoSpider crawling {target_url}'],
  'recon.gospider.url_found':    ['DEBUG',   '[RECON] GoSpider found: {url}'],
  'recon.gospider.completed':    ['INFO',    '[RECON] GoSpider finished — {urls_found} URLs discovered'],
  'recon.nuclei.started':        ['INFO',    '[RECON] Nuclei scanning {target_url}'],
  'recon.nuclei.match':          ['INFO',    '[RECON] Nuclei match: {template_id} on {url}'],
  'recon.nuclei.completed':      ['INFO',    '[RECON] Nuclei finished — {matches} matches'],
  'recon.auth.started':          ['INFO',    '[RECON] Auth discovery scanning {target_url}'],
  'recon.auth.scanning_url':     ['DEBUG',   '[RECON] Auth scanning: {url}'],
  'recon.auth.jwt_found':        ['INFO',    '[RECON] JWT token found: {algorithm}'],
  'recon.auth.cookie_found':     ['INFO',    '[RECON] Auth cookie found: {cookie_name}'],
  'recon.auth.completed':        ['INFO',    '[RECON] Auth discovery completed'],
  'recon.assets.started':        ['INFO',    '[RECON] Asset discovery started'],
  'recon.assets.dns_found':      ['INFO',    '[RECON] DNS record found: {record}'],
  'recon.assets.ct_results':     ['INFO',    '[RECON] Certificate transparency: {count} results'],
  'recon.assets.wayback_results':['INFO',    '[RECON] Wayback Machine: {count} archived URLs'],
  'recon.assets.cloud_found':    ['INFO',    '[RECON] Cloud asset found: {service}'],
  'recon.assets.sensitive_path': ['INFO',    '[RECON] Sensitive path: {path}'],
  'recon.assets.completed':      ['INFO',    '[RECON] Asset discovery completed'],
  'recon.visual.started':        ['INFO',    '[RECON] Visual reconnaissance started'],
  'recon.visual.completed':      ['INFO',    '[RECON] Visual reconnaissance completed'],

  // ── Discovery (DAST Analysis) ─────────────────────────────────────────

  'discovery.started':                  ['INFO',    '[DAST] Discovery phase started'],
  'discovery.completed':                ['INFO',    '[DAST] Discovery phase completed'],
  'discovery.url.started':              ['INFO',    '[DAST] Analyzing URL {index}/{total}: {url}'],
  'discovery.url.html_captured':        ['DEBUG',   '[DAST] HTML captured ({html_length} bytes)'],
  'discovery.url.frameworks_detected':  ['INFO',    '[DAST] Frameworks detected: {frameworks}'],
  'discovery.url.params_found':         ['INFO',    '[DAST] {params_count} parameters found'],
  'discovery.url.jwt_detected':         ['INFO',    '[DAST] JWT detected: {algorithm}'],
  'discovery.probe.started':            ['INFO',    '[DAST] Probing {total_params} parameters'],
  'discovery.probe.result':             ['DEBUG',   '[DAST] Probe: \'{param}\' reflects={reflects}'],
  'discovery.probe.header_reflection':  ['INFO',    '[DAST] Header reflection: \'{param}\' in {header}'],
  'discovery.probe.completed':          ['INFO',    '[DAST] Probing complete — {reflecting} reflecting, {non_reflecting} filtered'],
  'discovery.sqli_probe.started':       ['INFO',    '[DAST] SQLi probing {params_count} parameters'],
  'discovery.sqli_probe.result':        ['INFO',    '[DAST] SQLi indicator: {technique} on \'{param}\''],
  'discovery.sqli_probe.completed':     ['INFO',    '[DAST] SQLi probing complete — {findings_count} indicators'],
  'discovery.cookie_sqli.started':      ['INFO',    '[DAST] Cookie SQLi probing {cookies_count} cookies'],
  'discovery.cookie_sqli.result':       ['INFO',    '[DAST] Cookie SQLi: {technique} on \'{cookie}\''],
  'discovery.cookie_sqli.completed':    ['INFO',    '[DAST] Cookie SQLi complete — {findings_count} indicators'],
  'discovery.llm.started':              ['INFO',    '[DAST] LLM analysis started (approach {approach})'],
  'discovery.llm.completed':            ['INFO',    '[DAST] LLM analysis complete — {findings_count} findings ({duration_ms}ms)'],
  'discovery.skeptical.started':        ['INFO',    '[DAST] Skeptical review: {findings_to_review} findings'],
  'discovery.skeptical.verdict':        ['INFO',    '[DAST] Skeptic: {type} on \'{param}\' — score {score} ({verdict})'],
  'discovery.consolidation.started':    ['INFO',    '[DAST] Consolidating {raw_count} raw findings'],
  'discovery.consolidation.voting':     ['DEBUG',   '[DAST] Voting: {type} on \'{param}\' — {votes} votes'],
  'discovery.consolidation.fp_filtered':['INFO',    '[DAST] FP filtered: {type} (confidence {fp_confidence})'],
  'discovery.consolidation.completed':  ['INFO',    '[DAST] Consolidated: {raw} raw → {dedup} dedup → {passing} passing'],
  'discovery.url.completed':            ['INFO',    '[DAST] URL complete — {findings_count} findings ({duration_ms}ms)'],
  'discovery.retry.started':            ['INFO',    '[DAST] Retrying {count} URLs'],
  'discovery.retry.url':                ['DEBUG',   '[DAST] Retrying: {url}'],

  // ── Strategy (Thinking Consolidation) ─────────────────────────────────

  'strategy.started':                   ['INFO',    '[STRATEGY] Strategy phase started'],
  'strategy.completed':                 ['INFO',    '[STRATEGY] Strategy phase completed'],
  'strategy.thinking.batch_started':    ['INFO',    '[STRATEGY] Processing batch of {batch_size} findings'],
  'strategy.thinking.batch_completed':  ['INFO',    '[STRATEGY] Batch complete — {processed} processed, {distributed} distributed'],
  'strategy.finding.received':          ['DEBUG',   '[STRATEGY] Finding received: {type} on \'{param}\''],
  'strategy.finding.fp_filtered':       ['WARNING', '[STRATEGY] FP filtered: {type} on \'{param}\''],
  'strategy.finding.duplicate':         ['DEBUG',   '[STRATEGY] Duplicate skipped: {type} on \'{param}\''],
  'strategy.finding.classified':        ['INFO',    '[STRATEGY] Classified: {type} → {specialist} (confidence {confidence})'],
  'strategy.finding.queued':            ['INFO',    '[STRATEGY] Queued for {specialist} (depth: {queue_depth})'],
  'strategy.finding.backpressure':      ['WARNING', '[STRATEGY] Backpressure: {specialist} queue full, retry #{retry}'],
  'strategy.embeddings.result':         ['DEBUG',   '[STRATEGY] Embedding match: {match} (confidence {confidence})'],
  'strategy.distribution_summary':      ['INFO',    '[STRATEGY] Distribution: {received} received → {filtered} filtered → {distributed} dispatched'],
  'strategy.auto_dispatch':             ['INFO',    '[STRATEGY] Auto-dispatch: {specialist} activated for {framework}'],
  'strategy.nuclei_injected':           ['INFO',    '[STRATEGY] Nuclei findings injected: {count}'],

  // ── Exploitation: XSS ────────────────────────────────────────────────

  'exploit.xss.started':                ['INFO',    '[EXPLOITATION] XSS Agent started on {url}'],
  'exploit.xss.completed':              ['INFO',    '[EXPLOITATION] XSS Agent completed — {confirmed_count} confirmed'],
  'exploit.xss.waf_detected':           ['WARNING', '[EXPLOITATION] WAF detected: {waf_type}'],
  'exploit.xss.param.started':          ['INFO',    '[EXPLOITATION] XSS testing param \'{param}\''],
  'exploit.xss.param.completed':        ['INFO',    '[EXPLOITATION] XSS param \'{param}\' done'],
  'exploit.xss.probe.result':           ['INFO',    '[EXPLOITATION] XSS probe: \'{param}\' context={context}'],
  'exploit.xss.llm_payloads':           ['INFO',    '[EXPLOITATION] XSS LLM generated {count} payloads'],
  'exploit.xss.level.started':          ['INFO',    '[EXPLOITATION] XSS Level {level} escalation on \'{param}\''],
  'exploit.xss.level.progress':         ['DEBUG',   '[EXPLOITATION] XSS L{level}: {n} payloads tested on \'{param}\''],
  'exploit.xss.level.completed':        ['INFO',    '[EXPLOITATION] XSS Level {level} completed on \'{param}\''],
  'exploit.xss.go_fuzzer.started':      ['INFO',    '[EXPLOITATION] XSS Go Fuzzer started on \'{param}\''],
  'exploit.xss.go_fuzzer.completed':    ['INFO',    '[EXPLOITATION] XSS Go Fuzzer done — {payloads_tested} payloads'],
  'exploit.xss.manipulator.phase':      ['INFO',    '[EXPLOITATION] XSS Manipulator: {phase}'],
  'exploit.xss.browser.testing':        ['INFO',    '[EXPLOITATION] XSS browser validation on \'{param}\''],
  'exploit.xss.browser.result':         ['INFO',    '[EXPLOITATION] XSS browser result: confirmed={confirmed}'],
  'exploit.xss.interactsh.callback':    ['CRITICAL','[EXPLOITATION] XSS OOB callback received!'],
  'exploit.xss.confirmed':              ['CRITICAL','[EXPLOITATION] XSS CONFIRMED on \'{param}\' — Level {level}'],
  'exploit.xss.dom.started':            ['INFO',    '[EXPLOITATION] DOM XSS testing on {url}'],
  'exploit.xss.dom.result':             ['INFO',    '[EXPLOITATION] DOM XSS result: {dom_xss}'],

  // ── Exploitation: SQLi ───────────────────────────────────────────────

  'exploit.sqli.started':               ['INFO',    '[EXPLOITATION] SQLi Agent started on {url}'],
  'exploit.sqli.completed':             ['INFO',    '[EXPLOITATION] SQLi Agent completed — {confirmed_count} confirmed'],
  'exploit.sqli.param.started':         ['INFO',    '[EXPLOITATION] SQLi testing param \'{param}\''],
  'exploit.sqli.baseline':              ['INFO',    '[EXPLOITATION] SQLi baseline captured for \'{param}\''],
  'exploit.sqli.filters_detected':      ['WARNING', '[EXPLOITATION] SQLi filters detected on \'{param}\''],
  'exploit.sqli.level.started':         ['INFO',    '[EXPLOITATION] SQLi Level {level} on \'{param}\''],
  'exploit.sqli.level.progress':        ['DEBUG',   '[EXPLOITATION] SQLi L{level}: {n} payloads tested on \'{param}\''],
  'exploit.sqli.level.completed':       ['INFO',    '[EXPLOITATION] SQLi Level {level} completed on \'{param}\''],
  'exploit.sqli.error_found':           ['INFO',    '[EXPLOITATION] SQLi error-based: {db_type} detected on \'{param}\''],
  'exploit.sqli.boolean_diff':          ['INFO',    '[EXPLOITATION] SQLi boolean-based diff detected on \'{param}\''],
  'exploit.sqli.union_found':           ['INFO',    '[EXPLOITATION] SQLi UNION found: {columns} columns on \'{param}\''],
  'exploit.sqli.oob.sent':              ['INFO',    '[EXPLOITATION] SQLi OOB payload sent on \'{param}\''],
  'exploit.sqli.oob.callback':          ['CRITICAL','[EXPLOITATION] SQLi OOB callback received on \'{param}\'!'],
  'exploit.sqli.time_delay':            ['INFO',    '[EXPLOITATION] SQLi time-based delay detected on \'{param}\''],
  'exploit.sqli.sqlmap.started':        ['INFO',    '[EXPLOITATION] SQLMap started on \'{param}\''],
  'exploit.sqli.sqlmap.completed':      ['INFO',    '[EXPLOITATION] SQLMap completed on \'{param}\''],
  'exploit.sqli.confirmed':             ['CRITICAL','[EXPLOITATION] SQLi CONFIRMED on \'{param}\' — {technique}'],
  'exploit.sqli.json_testing':          ['INFO',    '[EXPLOITATION] SQLi JSON body testing on \'{param}\''],

  // ── Exploitation: Generic Specialists ─────────────────────────────────

  'exploit.specialist.started':         ['INFO',    '[SPECIALIST] {agent} started on {url}'],
  'exploit.specialist.completed':       ['INFO',    '[SPECIALIST] {agent} completed on {url}'],
  'exploit.specialist.param.started':   ['INFO',    '[SPECIALIST] {agent} testing param \'{param}\''],
  'exploit.specialist.param.completed': ['INFO',    '[SPECIALIST] {agent} param \'{param}\' done'],
  'exploit.specialist.go_fuzzer':       ['INFO',    '[SPECIALIST] {agent} Go Fuzzer on \'{param}\''],
  'exploit.specialist.progress':        ['DEBUG',   '[SPECIALIST] {agent}: {n} payloads tested on \'{param}\''],
  'exploit.specialist.signature_match': ['INFO',    '[SPECIALIST] {agent} signature match on \'{param}\''],
  'exploit.specialist.confirmed':       ['CRITICAL','[SPECIALIST] {agent} CONFIRMED on \'{param}\'!'],

  // Specialist lifecycle (from team.py orchestrator)
  'exploit.specialist.activated':       ['INFO',    '[EXPLOITATION] Specialist activated: {specialist}'],
  'exploit.specialist.queue_progress':  ['INFO',    '[EXPLOITATION] Queue: {active} active, {completed} done, {pending} pending'],
  'exploit.specialist.deactivated':     ['INFO',    '[EXPLOITATION] Specialist deactivated: {specialist}'],
  'exploit.phase_stats':                ['INFO',    '[EXPLOITATION] Phase stats: {total_specialists} specialists, {findings} findings'],

  // ── Validation ───────────────────────────────────────────────────────

  'validation.started':                 ['INFO',    '[VALIDATION] Queue processor started (queue: {queue_size})'],
  'validation.completed':               ['INFO',    '[VALIDATION] Validation complete — {cdp_confirmed} confirmed, {cdp_rejected} rejected, {cache_hits} cached'],
  'validation.finding.received':        ['DEBUG',   '[VALIDATION] Finding received: {type} from {specialist}'],
  'validation.finding.dedup_skipped':   ['DEBUG',   '[VALIDATION] Dedup skipped: {type} on \'{param}\''],
  'validation.finding.queued':          ['INFO',    '[VALIDATION] Queued: {type} on \'{param}\' from {specialist} (depth: {queue_depth})'],
  'validation.finding.started':         ['INFO',    '[VALIDATION] Validating {type} on \'{param}\' — {url}'],
  'validation.payload_loaded':          ['DEBUG',   '[VALIDATION] Full payload loaded: {original_len} → {full_len} chars'],
  'validation.static.result':           ['INFO',    '[VALIDATION] Static XSS validated (CSP safe + reflected)'],
  'validation.cache.hit':               ['INFO',    '[VALIDATION] Cache hit — skipping validation'],
  'validation.cache.miss':              ['DEBUG',   '[VALIDATION] Cache miss — proceeding with validation'],
  'validation.browser.launching':       ['INFO',    '[VALIDATION] Launching browser for {vuln_type} on \'{param}\''],
  'validation.browser.navigating':      ['INFO',    '[VALIDATION] Navigating to {url}'],
  'validation.browser.loaded':          ['INFO',    '[VALIDATION] Page loaded — {console_events} CDP events, alert: {alert}'],
  'validation.cdp.confirmed':           ['CRITICAL','[VALIDATION] CDP CONFIRMED — {events} events, alert: {alert}'],
  'validation.cdp.silent':              ['INFO',    '[VALIDATION] CDP silent — falling back to vision'],
  'validation.vision.started':          ['INFO',    '[VALIDATION] Vision analysis started for {type}'],
  'validation.vision.result':           ['INFO',    '[VALIDATION] Vision result: validated={validated} (confidence {confidence})'],
  'validation.finding.confirmed':       ['CRITICAL','[VALIDATION] VALIDATED: {type} on \'{param}\' (confidence {confidence})'],
  'validation.finding.rejected':        ['WARNING', '[VALIDATION] Rejected: {type} on \'{param}\''],

  // ── Reporting ────────────────────────────────────────────────────────

  'reporting.started':                  ['INFO',    '[REPORTING] Report generation started'],
  'reporting.completed':                ['INFO',    '[REPORTING] Report generation completed'],
  'reporting.file_generated':           ['INFO',    '[REPORTING] File generated: {filename}'],
  'reporting.scan_summary':             ['INFO',    '[REPORTING] Scan summary: {findings_count} findings'],
  'reporting.engagement_data':          ['INFO',    '[REPORTING] Engagement data saved'],
  'reporting.error':                    ['ERROR',   '[REPORTING] Report error: {error}'],
};

// ---------------------------------------------------------------------------
// Auto-formatter fallback for unlisted events
// ---------------------------------------------------------------------------

const CATEGORY_TAGS: Record<string, string> = {
  pipeline: 'PIPELINE',
  recon: 'RECON',
  discovery: 'DAST',
  strategy: 'STRATEGY',
  exploit: 'EXPLOITATION',
  validation: 'VALIDATION',
  reporting: 'REPORTING',
};

const HUMANIZE: Record<string, string> = {
  xss: 'XSS', sqli: 'SQLi', lfi: 'LFI', ssrf: 'SSRF',
  csti: 'CSTI', idor: 'IDOR', rce: 'RCE', xxe: 'XXE', openredirect: 'Open Redirect',
  cdp: 'CDP', llm: 'LLM', dom: 'DOM', waf: 'WAF',
  go_fuzzer: 'Go Fuzzer', oob: 'OOB', fp: 'FP',
  gospider: 'GoSpider', nuclei: 'Nuclei', jwt: 'JWT',
  sqlmap: 'SQLMap',
};

const ACTION_LEVELS: Record<string, LogLevel> = {
  confirmed: 'CRITICAL',
  error: 'ERROR',
  rejected: 'WARNING',
  waf_detected: 'WARNING',
  fp_filtered: 'WARNING',
  backpressure: 'WARNING',
  filters_detected: 'WARNING',
  progress: 'DEBUG',
  heartbeat: 'DEBUG',
};

function humanize(part: string): string {
  return HUMANIZE[part] || part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, ' ');
}

function autoFormat(eventType: string, data: Record<string, any>): FormattedEvent {
  const parts = eventType.split('.');
  const category = parts[0];
  const action = parts[parts.length - 1];
  const tag = CATEGORY_TAGS[category] || category.toUpperCase();
  const level = ACTION_LEVELS[action] || 'INFO';

  // Build detail from middle parts (skip first=category, last=action)
  const middle = parts.slice(1, -1).map(humanize).join(' ');
  const actionLabel = humanize(action);

  // Enrich with data fields
  let suffix = '';
  if (data.param) suffix += ` on '${data.param}'`;
  else if (data.parameter) suffix += ` on '${data.parameter}'`;
  if (data.agent && !middle) suffix = ` ${data.agent}${suffix}`;

  const detail = middle ? `${middle} ` : '';
  return { level, message: `[${tag}] ${detail}${actionLabel}${suffix}` };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function formatVerboseEvent(
  eventType: string,
  data: Record<string, any>,
): FormattedEvent | null {
  // Only format dotted verbose events
  if (!eventType || !eventType.includes('.')) return null;

  const template = T[eventType];
  if (template) {
    const [level, msgTemplate] = template;
    return { level, message: interp(msgTemplate, data) };
  }

  // Auto-format fallback for any unlisted verbose event
  return autoFormat(eventType, data);
}
