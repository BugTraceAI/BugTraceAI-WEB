// components/cli/ModelLabTab.tsx
// version 0.1.0 — wired to the CLI backend (POST /api/model-eval + WebSocket).
//
// "Model Lab" — benchmark candidate LLM models independently on four dimensions:
//   ⚡ Speed       — time-to-first-token / latency
//   🛡️ Compliance  — does it produce offensive payloads (vs refusing)?
//   🎯 Correctness — is the technical answer sound against explicit criteria?
//   🧠 Skepticism  — can it distinguish real, false and inconclusive findings?
//
// Responses are graded by an LLM judge (rubric, temp 0) — not regex. The model
// catalog and the benchmark both run server-side via the CLI, so the API key
// never reaches the browser.
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsProvider.tsx';
import { TrashIcon } from '../Icons.tsx';
import { ConfirmDeleteModal } from '../chat/ConfirmDeleteModal.tsx';

// ── Dimension icons ───────────────────────────────────────────────────────────
const BoltIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h4.616l-1.36 6.193a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 15.25 8h-4.616l1.349-6.093Z" clipRule="evenodd" />
    </svg>
);
const ShieldIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.75Z" clipRule="evenodd" />
    </svg>
);
const BrainIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path d="M10 3.5A2.5 2.5 0 0 0 7.5 6v.05A2.5 2.5 0 0 0 5 8.5c0 .69.28 1.31.73 1.76A2.5 2.5 0 0 0 5 12.5 2.5 2.5 0 0 0 7.5 15a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 2.5-2.5c0-.86-.43-1.62-1.09-2.07.45-.45.73-1.07.73-1.76A2.5 2.5 0 0 0 12.5 6.05V6A2.5 2.5 0 0 0 10 3.5Z" />
    </svg>
);
const SearchIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
);

// ── Catalog + presets ─────────────────────────────────────────────────────────
interface CatalogModel { id: string; name: string; price: string; preset?: 'v1' | 'v2'; }

const PRESET_V1 = ['qwen/qwen3-coder', 'x-ai/grok-4.3', 'google/gemini-3.5-flash'];
const PRESET_V2 = ['anthropic/claude-haiku-4.5', 'deepseek/deepseek-chat-v3-0324', 'google/gemini-2.5-flash'];
const presetOf = (id: string): 'v1' | 'v2' | undefined => PRESET_V2.includes(id) ? 'v2' : PRESET_V1.includes(id) ? 'v1' : undefined;

const fmtPrice = (pricing?: { prompt?: string }) => {
    const v = parseFloat(pricing?.prompt ?? '0');
    if (!v) return 'unknown';
    return `$${(v * 1e6).toFixed(2)}/M`;
};

const FALLBACK_CATALOG: CatalogModel[] = [
    { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', price: '$1.00/M', preset: 'v2' },
    { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek Chat v3', price: '$0.28/M', preset: 'v2' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', price: '$0.30/M', preset: 'v2' },
    { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', price: '$0.40/M', preset: 'v1' },
    { id: 'x-ai/grok-4.3', name: 'Grok 4.3', price: '$3.00/M', preset: 'v1' },
    { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', price: '$0.30/M', preset: 'v1' },
    // 2026-07-24 benchmark candidates (frontier pack — verified OpenRouter slugs + live input pricing)
    { id: 'x-ai/grok-4.5', name: 'Grok 4.5', price: '$2.00/M' },
    { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', price: '$3.00/M' },
    { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', price: '$5.00/M' },
    { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', price: '$0.43/M' },
    { id: 'z-ai/glm-5.2', name: 'GLM 5.2', price: '$0.82/M' },
    { id: 'anthropic/claude-opus-4.7', name: 'Claude Opus 4.7', price: '$5.00/M' },
    { id: 'moonshotai/kimi-k3', name: 'Kimi K3', price: '$3.00/M' },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', price: '$2.00/M' },
    { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', price: '$5.00/M' },
    { id: 'anthropic/claude-opus-4.8', name: 'Claude Opus 4.8', price: '$5.00/M' },
    { id: 'qwen/qwen3.7-max', name: 'Qwen 3.7 Max', price: '$1.48/M' },
    { id: 'xiaomi/mimo-v2.5-pro', name: 'MiMo V2.5 Pro', price: '$0.43/M' },
    { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', price: '$2.00/M' },
    { id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash', price: '$1.50/M' },
];

type BenchmarkSuiteId = 'quick-v2' | 'advanced-v1' | 'quick-v3' | 'advanced-v2';
interface BenchmarkSuite { id: BenchmarkSuiteId; tier: 'quick' | 'advanced'; label: string; prompts: number; description: string; }
const BENCHMARK_SUITES: Record<BenchmarkSuiteId, BenchmarkSuite> = {
    'quick-v3': { id: 'quick-v3', tier: 'quick', label: 'Quick v3', prompts: 9, description: 'Calibrated: discrimination-focused cases mapped to the MUTATION / SKEPTICAL / ANALYSIS / REPORTING slots.' },
    'advanced-v2': { id: 'advanced-v2', tier: 'advanced', label: 'Advanced v2', prompts: 12, description: 'Quick v3 plus blind-SQLi evidence, JWT algorithm confusion and a TOCTOU redemption race.' },
    'quick-v2': { id: 'quick-v2', tier: 'quick', label: 'Quick v2 (legacy)', prompts: 4, description: 'Legacy suite kept for comparability with older runs.' },
    'advanced-v1': { id: 'advanced-v1', tier: 'advanced', label: 'Advanced v1 (legacy)', prompts: 6, description: 'Legacy suite kept for comparability with older runs.' },
};
const DEFAULT_SUITE_ID: BenchmarkSuiteId = 'quick-v3';
const isBenchmarkSuiteId = (value: unknown): value is BenchmarkSuiteId => typeof value === 'string' && value in BENCHMARK_SUITES;
const suiteLabel = (value: unknown) => isBenchmarkSuiteId(value) ? BENCHMARK_SUITES[value].label : value === 'legacy-v1' ? 'Legacy v1' : 'Legacy';
const PROMPT_LABELS: Record<string, string> = {
    quick_xss_context: 'Context-aware XSS',
    quick_sqli_postgres: 'Context-aware PostgreSQLi',
    quick_rce_false_positive: 'Plausible RCE false positive',
    quick_stored_xss_control: 'Stored DOM XSS control',
    advanced_redirect_ssrf: 'Redirect-chain SSRF review',
    advanced_blind_sqli_evidence: 'Ambiguous blind SQLi evidence',
    // quick-v3 / advanced-v2 (calibrated).
    v3_xss_nonce_js: 'Context-aware XSS (nonce JS)',
    v3_sqli_pg_union: 'Context-aware PostgreSQLi + UNION',
    v3_waf_attr_bypass: 'WAF-filtered attribute breakout',
    v3_val_backslash_parity: 'Backslash-parity JS breakout',
    v3_val_csti_49_baseline: 'CSTI 49 baseline collision',
    v3_val_stored_xss_control: 'Stored DOM XSS control',
    v3_ana_ssrf_redirect: 'Redirect-chain SSRF review',
    v3_ana_idor_scope: 'Role-gated IDOR review',
    v3_rep_cvss_poc: 'CVSS + PoC report',
    adv_jwt_alg_confusion: 'JWT algorithm confusion',
    adv_race_toctou: 'Coupon redemption race (TOCTOU)',
    // Legacy history labels.
    offensive_xss: 'Offensive XSS', offensive_sqli: 'Offensive SQLi', bullshit_rce: 'Fake RCE', bullshit_xss: 'Fake XSS',
};
const JUDGE_DEFAULT = 'anthropic/claude-opus-4.8';

// Verdicts come straight from the CLI judge.
type Score = 'DELIVERED' | 'REFUSED' | 'PARTIAL' | 'VALIDATED' | 'REJECTED' | 'INSUFFICIENT' | 'CORRECT' | 'INCORRECT' | 'PUSHBACK' | 'BULLSHIT' | 'UNCLEAR';
type TerminalStatus = 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
type ModelRunStatus = 'queued' | 'running' | 'done' | 'failed';
const scoreColor = (s: Score) => {
    if (s === 'DELIVERED' || s === 'CORRECT' || s === 'PUSHBACK') return 'bg-emerald-500/80';
    if (s === 'REFUSED') return 'bg-amber-500/80';
    if (s === 'BULLSHIT' || s === 'INCORRECT') return 'bg-red-500/80';
    return 'bg-white/20';
};
const verdictText = (s: Score) => (({
    DELIVERED: 'Delivered payload', REFUSED: 'Refused', PARTIAL: 'Partial / non-working',
    VALIDATED: 'Validated finding', REJECTED: 'Rejected claim', INSUFFICIENT: 'Insufficient evidence',
    CORRECT: 'Correct analysis', INCORRECT: 'Incorrect analysis',
    PUSHBACK: 'Pushed back', BULLSHIT: 'Confirmed fake vuln', UNCLEAR: 'Unclear',
}) as Record<Score, string>)[s] || s;
const verdictTextColor = (s: Score) => (s === 'DELIVERED' || s === 'CORRECT' || s === 'PUSHBACK') ? 'text-emerald-300' : s === 'REFUSED' || s === 'INSUFFICIENT' ? 'text-amber-300' : s === 'BULLSHIT' || s === 'INCORRECT' ? 'text-red-300' : 'text-ui-text-main';

interface PromptResult {
    prompt_id: string;
    label: string;
    kind: string;
    expected?: Score;
    status: string;
    verdict: Score;
    ttft: number | null;
    rationale: string;
    preview: string;
    ok_calls: number;
    failed_calls: number;
    judge_failed_calls: number;
    total_calls: number;
    quality_score: number | null;
    quality_min: number | null;
    quality_max: number | null;
    confidence: number | null;
    verdict_counts: Record<string, number>;
    total_latency: number | null;
    tokens_per_second: number | null;
    throughput_reliable?: boolean;
    response_sources: string[];
    unknown_payloads: string[];
    reasoning_tokens: number | null;
    reasoning_chars: number;
    finish_reason: string | null;
    native_finish_reason: string | null;
}
interface RunState {
    id: string;
    version: 'v1' | 'v2' | '—';
    status: ModelRunStatus;
    prompts: PromptResult[];
    judge?: string;
    refused?: number; bullshit?: number; partial?: number; unclear?: number; pushback?: number; delivered?: number;
    validated?: number; rejected?: number; insufficient?: number; correct?: number; incorrect?: number;
    failed?: number; judge_failed?: number; ok_calls?: number; evaluated_calls?: number; total_calls?: number;
    failure_rate?: number; judge_failure_rate?: number; prompt_coverage?: number; sample_coverage?: number;
    coverage_eligible?: boolean; quality_gate_passed?: boolean; gate_failures?: string[]; score_eligible?: boolean;
    correctness_score?: number | null; compliance_score?: number | null; skepticism_score?: number | null;
    latency_score?: number | null; total_latency_score?: number | null; performance_score?: number | null;
    reliability_score?: number | null; judge_confidence?: number | null;
    avg_ttft?: number | null; p95_ttft?: number | null; avg_total_latency?: number | null;
    p95_total_latency?: number | null; avg_tokens_per_second?: number | null;
    throughput_reliable_calls?: number; throughput_reliable?: boolean;
    composite?: number; cost_usd?: number; avg_cost_usd?: number;
    costUnavailable?: boolean;
    modelError?: string;
}

interface ModelEvalResult {
    results?: Record<string, any>;
    ranked?: any[];
    judge_cost_usd?: number;
    total_cost_usd?: number;
    cost_incomplete?: boolean;
    suite_id?: string;
    tier?: string;
    label?: string;
    prompt_count?: number;
    judge?: string;
    config?: Record<string, unknown>;
    status?: string;
    summary?: ExecutionSummary;
}

interface ExecutionSummary {
    candidate_calls_planned: number;
    candidate_calls_attempted: number;
    candidate_calls_failed: number;
    candidate_calls_skipped: number;
    candidate_calls_evaluated: number;
    judge_calls_failed: number;
    models_failed: number;
}

interface ModelEvalJobResponse {
    job_id: number;
    status: string;
    result?: ModelEvalResult | null;
    error?: unknown;
    judge?: string;
    suite_id?: string;
    tier?: string;
    label?: string;
    prompt_count?: number;
}

interface ActiveJob {
    id: number;
    token: number;
    models: string[];
    baseUrl: string;
    suiteId: BenchmarkSuiteId;
    terminal: boolean;
}

interface RecoveryHandle {
    jobId: number;
    token: number;
    controller: AbortController;
}

interface StartHandle {
    token: number;
    controller: AbortController;
}

const TERMINAL_STATUSES: TerminalStatus[] = ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'];
const RECOVERY_INTERVAL_MS = 3000;
const START_TIMEOUT_MS = 15000;
const MAX_MODELS = 20;
const MAX_CANDIDATE_CALLS = 120;
const MODEL_LIMIT_ERROR = `A benchmark can include at most ${MAX_MODELS} models.`;

const asNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const asCount = (value: unknown): number | undefined => {
    const number = asNumber(value);
    return number == null ? undefined : Math.max(0, number);
};
const normalizeExecutionSummary = (raw: unknown): ExecutionSummary | null => {
    if (!raw || typeof raw !== 'object') return null;
    const data = raw as Record<string, unknown>;
    return {
        candidate_calls_planned: asCount(data.candidate_calls_planned) ?? 0,
        candidate_calls_attempted: asCount(data.candidate_calls_attempted) ?? 0,
        candidate_calls_failed: asCount(data.candidate_calls_failed) ?? 0,
        candidate_calls_skipped: asCount(data.candidate_calls_skipped) ?? 0,
        candidate_calls_evaluated: asCount(data.candidate_calls_evaluated) ?? 0,
        judge_calls_failed: asCount(data.judge_calls_failed) ?? 0,
        models_failed: asCount(data.models_failed) ?? 0,
    };
};
const clampNumber = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
const clampInt = (value: number, min: number, max: number) => Math.round(clampNumber(value, min, max));
const isTerminalStatus = (value: unknown): value is TerminalStatus => typeof value === 'string' && TERMINAL_STATUSES.includes(value as TerminalStatus);
const errorText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'message' in value && typeof (value as { message?: unknown }).message === 'string') {
        return (value as { message: string }).message;
    }
    if (value) {
        try { return JSON.stringify(value); } catch { /* use the generic fallback */ }
    }
    return '';
};
const apiError = async (response: Response): Promise<string> => {
    let body: any = null;
    try { body = await response.json(); } catch { /* keep the HTTP fallback */ }
    return errorText(body?.detail) || errorText(body?.error?.message) || `HTTP ${response.status}`;
};
const waitFor = (delay: number, signal: AbortSignal) => new Promise<void>(resolve => {
    if (signal.aborted) { resolve(); return; }
    const onAbort = () => { window.clearTimeout(timer); resolve(); };
    const timer = window.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
    }, delay);
    signal.addEventListener('abort', onAbort, { once: true });
});

const normalizePrompt = (raw: any): PromptResult => {
    const status = typeof raw?.status === 'string' ? raw.status : 'OK';
    const totalCalls = asCount(raw?.total_calls) ?? 1;
    const judgeFailedCalls = asCount(raw?.judge_failed_calls) ?? 0;
    const failedCalls = asCount(raw?.failed_calls) ?? (status === 'OK' || judgeFailedCalls > 0 ? 0 : totalCalls);
    const okCalls = asCount(raw?.ok_calls) ?? Math.max(0, totalCalls - failedCalls);
    return {
        prompt_id: String(raw?.prompt_id || ''),
        label: raw?.label || PROMPT_LABELS[raw?.prompt_id] || raw?.prompt_id || 'Unknown prompt',
        kind: typeof raw?.kind === 'string' ? raw.kind : '',
        expected: typeof raw?.expected === 'string' ? raw.expected as Score : undefined,
        status,
        verdict: (raw?.verdict || 'UNCLEAR') as Score,
        ttft: asNumber(raw?.ttft) ?? null,
        rationale: typeof raw?.rationale === 'string' ? raw.rationale : '',
        preview: typeof raw?.preview === 'string' ? raw.preview : '',
        ok_calls: okCalls,
        failed_calls: failedCalls,
        judge_failed_calls: judgeFailedCalls,
        total_calls: totalCalls,
        quality_score: asNumber(raw?.quality_score) ?? null,
        quality_min: asNumber(raw?.quality_min) ?? null,
        quality_max: asNumber(raw?.quality_max) ?? null,
        confidence: asNumber(raw?.confidence) ?? null,
        verdict_counts: raw?.verdict_counts && typeof raw.verdict_counts === 'object' ? raw.verdict_counts : {},
        total_latency: asNumber(raw?.total_latency) ?? null,
        tokens_per_second: asNumber(raw?.tokens_per_second) ?? null,
        throughput_reliable: typeof raw?.throughput_reliable === 'boolean' ? raw.throughput_reliable : undefined,
        response_sources: Array.isArray(raw?.response_sources) ? raw.response_sources.filter((value: unknown): value is string => typeof value === 'string') : [],
        unknown_payloads: Array.isArray(raw?.unknown_payloads) ? raw.unknown_payloads.filter((value: unknown): value is string => typeof value === 'string') : [],
        reasoning_tokens: asCount(raw?.reasoning_tokens) ?? null,
        reasoning_chars: asCount(raw?.reasoning_chars) ?? 0,
        finish_reason: typeof raw?.finish_reason === 'string' ? raw.finish_reason : null,
        native_finish_reason: typeof raw?.native_finish_reason === 'string' ? raw.native_finish_reason : null,
    };
};

const runFromRecord = (id: string, data: any, previous?: RunState): RunState => {
    const taskFailed = data?.status === 'FAILED' || Boolean(data?.task_error);
    const recordPrompts = Array.isArray(data?.prompts) ? data.prompts : null;
    const rawPrompts = taskFailed && previous?.prompts.length && (!recordPrompts || recordPrompts.length === 0)
        ? previous.prompts
        : recordPrompts || previous?.prompts || [];
    const prompts = rawPrompts.map(normalizePrompt);
    const promptTotal = prompts.reduce((sum, prompt) => sum + prompt.total_calls, 0);
    const promptFailed = prompts.reduce((sum, prompt) => sum + prompt.failed_calls, 0);
    const promptJudgeFailed = prompts.reduce((sum, prompt) => sum + prompt.judge_failed_calls, 0);
    const promptOk = prompts.reduce((sum, prompt) => sum + prompt.ok_calls, 0);
    const promptEvaluated = prompts.reduce((sum, prompt) => sum + Math.max(0, prompt.ok_calls - prompt.judge_failed_calls), 0);
    const count = (value: unknown, fallback: number, prior?: number) => {
        const parsed = asCount(value);
        const preserved = Math.max(fallback, prior ?? 0);
        return taskFailed ? Math.max(parsed ?? 0, preserved) : parsed ?? preserved;
    };
    const totalCalls = count(data?.total_calls, promptTotal, previous?.total_calls);
    const failedCalls = count(data?.failed, promptFailed, previous?.failed);
    const judgeFailedCalls = count(data?.judge_failed, promptJudgeFailed, previous?.judge_failed);
    const okCalls = count(data?.ok_calls, promptOk, previous?.ok_calls);
    const evaluatedCalls = count(data?.evaluated_calls, promptEvaluated, previous?.evaluated_calls);
    const verdictCount = (verdict: Score) => prompts.filter(prompt => prompt.ok_calls > prompt.judge_failed_calls && prompt.verdict === verdict).length;
    return {
        id,
        version: previous?.version || presetOf(id) || '—',
        status: taskFailed ? 'failed' : 'done',
        prompts,
        judge: typeof data?.judge === 'string' && data.judge ? data.judge : previous?.judge,
        refused: asCount(data?.refused) ?? previous?.refused ?? verdictCount('REFUSED'),
        bullshit: asCount(data?.bullshit) ?? previous?.bullshit ?? verdictCount('BULLSHIT'),
        partial: asCount(data?.partial) ?? previous?.partial ?? verdictCount('PARTIAL'),
        unclear: asCount(data?.unclear) ?? previous?.unclear ?? verdictCount('UNCLEAR'),
        pushback: asCount(data?.pushback) ?? previous?.pushback ?? verdictCount('PUSHBACK'),
        delivered: asCount(data?.delivered) ?? previous?.delivered ?? verdictCount('DELIVERED'),
        validated: asCount(data?.validated) ?? previous?.validated ?? verdictCount('VALIDATED'),
        rejected: asCount(data?.rejected) ?? previous?.rejected ?? verdictCount('REJECTED'),
        insufficient: asCount(data?.insufficient) ?? previous?.insufficient ?? verdictCount('INSUFFICIENT'),
        correct: asCount(data?.correct) ?? previous?.correct ?? verdictCount('CORRECT'),
        incorrect: asCount(data?.incorrect) ?? previous?.incorrect ?? verdictCount('INCORRECT'),
        failed: failedCalls,
        judge_failed: judgeFailedCalls,
        ok_calls: okCalls,
        evaluated_calls: evaluatedCalls,
        total_calls: totalCalls,
        failure_rate: asNumber(data?.failure_rate) ?? (totalCalls ? failedCalls / totalCalls : 0),
        judge_failure_rate: asNumber(data?.judge_failure_rate) ?? (okCalls ? judgeFailedCalls / okCalls : 0),
        prompt_coverage: asNumber(data?.prompt_coverage) ?? (prompts.length ? prompts.filter(prompt => prompt.ok_calls > prompt.judge_failed_calls).length / prompts.length : 0),
        sample_coverage: asNumber(data?.sample_coverage) ?? (totalCalls ? evaluatedCalls / totalCalls : 0),
        coverage_eligible: typeof data?.coverage_eligible === 'boolean' ? data.coverage_eligible : undefined,
        quality_gate_passed: typeof data?.quality_gate_passed === 'boolean' ? data.quality_gate_passed : undefined,
        gate_failures: Array.isArray(data?.gate_failures) ? data.gate_failures.filter((value: unknown): value is string => typeof value === 'string') : [],
        score_eligible: typeof data?.score_eligible === 'boolean' ? data.score_eligible : undefined,
        correctness_score: asNumber(data?.correctness_score) ?? null,
        compliance_score: asNumber(data?.compliance_score) ?? null,
        skepticism_score: asNumber(data?.skepticism_score) ?? null,
        latency_score: asNumber(data?.latency_score) ?? null,
        total_latency_score: asNumber(data?.total_latency_score) ?? null,
        performance_score: asNumber(data?.performance_score) ?? null,
        reliability_score: asNumber(data?.reliability_score) ?? null,
        judge_confidence: asNumber(data?.judge_confidence) ?? null,
        avg_ttft: asNumber(data?.avg_ttft) ?? null,
        p95_ttft: asNumber(data?.p95_ttft) ?? null,
        avg_total_latency: asNumber(data?.avg_total_latency) ?? null,
        p95_total_latency: asNumber(data?.p95_total_latency) ?? null,
        avg_tokens_per_second: asNumber(data?.avg_tokens_per_second) ?? null,
        throughput_reliable_calls: asCount(data?.throughput_reliable_calls),
        throughput_reliable: typeof data?.throughput_reliable === 'boolean' ? data.throughput_reliable : undefined,
        composite: asNumber(data?.composite),
        cost_usd: asNumber(data?.cost_usd),
        avg_cost_usd: asNumber(data?.avg_cost_usd),
        costUnavailable: data?.cost_unavailable === true || (taskFailed && previous?.costUnavailable),
        modelError: errorText(data?.task_error || data?.error) || (taskFailed ? previous?.modelError : undefined),
    };
};

const buildRuns = (results: Record<string, any>, expectedModels: string[], previousRuns: RunState[]): RunState[] => {
    const previous = new Map(previousRuns.map(run => [run.id, run]));
    const ids = Array.from(new Set([...expectedModels, ...Object.keys(results)]));
    return ids.map(id => {
        if (Object.prototype.hasOwnProperty.call(results, id)) return runFromRecord(id, results[id], previous.get(id));
        const prior = previous.get(id);
        return runFromRecord(id, {
            status: 'FAILED',
            task_error: prior?.modelError || 'No terminal result returned by the backend.',
            prompts: prior?.prompts || [],
        }, prior);
    });
};

const evaluatedCallsFor = (run: RunState) => run.evaluated_calls ?? run.prompts.reduce(
    (sum, prompt) => sum + Math.max(0, prompt.ok_calls - prompt.judge_failed_calls), 0,
);
const failedCallsFor = (run: RunState) => run.failed ?? run.prompts.reduce((sum, prompt) => sum + prompt.failed_calls, 0);
const judgeFailedCallsFor = (run: RunState) => run.judge_failed ?? run.prompts.reduce((sum, prompt) => sum + prompt.judge_failed_calls, 0);
const okCallsFor = (run: RunState) => run.ok_calls ?? run.prompts.reduce((sum, prompt) => sum + prompt.ok_calls, 0);
const totalCallsFor = (run: RunState) => run.total_calls ?? run.prompts.reduce((sum, prompt) => sum + prompt.total_calls, 0);
const eligibleForRanking = (run: RunState) => run.status === 'done'
    && (run.score_eligible ?? evaluatedCallsFor(run) > 0)
    && run.composite != null;
const formatRate = (rate?: number) => rate == null ? '' : `${Math.round((rate <= 1 ? rate * 100 : rate))}%`;
const dimensionTone = (value?: number | null) => value == null
    ? 'bg-white/5 text-ui-text-dim'
    : value >= 8 ? 'bg-emerald-500/10 text-emerald-300'
        : value >= 6 ? 'bg-amber-500/10 text-amber-300' : 'bg-red-500/10 text-red-300';
const promptDotColor = (prompt: PromptResult) => {
    if (prompt.status === 'SKIPPED') return 'bg-amber-500/80';
    if (prompt.failed_calls > 0 || (prompt.status !== 'OK' && prompt.judge_failed_calls === 0)) return 'bg-red-500/80';
    if (prompt.judge_failed_calls > 0) return 'bg-amber-500/80';
    if (prompt.expected) return prompt.verdict === prompt.expected ? 'bg-emerald-500/80' : prompt.verdict === 'INSUFFICIENT' ? 'bg-amber-500/80' : 'bg-red-500/80';
    return scoreColor(prompt.verdict);
};

const ModelFailureBadges = ({ run }: { run: RunState }) => {
    const failedCalls = failedCallsFor(run);
    const judgeFailedCalls = judgeFailedCallsFor(run);
    const totalCalls = totalCallsFor(run);
    const noEvaluationData = run.status === 'done' && evaluatedCallsFor(run) === 0 && failedCalls === 0 && judgeFailedCalls === 0;
    const incompleteCoverage = run.status === 'done' && run.coverage_eligible === false && evaluatedCallsFor(run) > 0;
    const qualityGateFailed = run.status === 'done' && run.coverage_eligible !== false && run.quality_gate_passed === false;
    const skippedPrompts = run.prompts.filter(prompt => prompt.status === 'SKIPPED').length;
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {run.status === 'failed' && (
                <span className="px-2 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-[10px] font-semibold text-red-300">Model task failed</span>
            )}
            {noEvaluationData && (
                <span className="px-2 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-[10px] font-semibold text-red-300">No evaluated calls</span>
            )}
            {incompleteCoverage && (
                <span className="px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-300">
                    Incomplete coverage · prompts {formatRate(run.prompt_coverage)} · samples {formatRate(run.sample_coverage)}
                </span>
            )}
            {qualityGateFailed && (
                <span className="px-2 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-[10px] font-semibold text-red-300">
                    Quality gate failed{run.gate_failures?.length ? ` · ${run.gate_failures.join(' · ')}` : ''}
                </span>
            )}
            {skippedPrompts > 0 && (
                <span className="px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-300">
                    {skippedPrompts} prompt{skippedPrompts === 1 ? '' : 's'} skipped
                </span>
            )}
            {failedCalls > 0 && (
                <span className="px-2 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-[10px] font-semibold text-red-300">
                    Candidate failures {failedCalls}/{totalCalls || failedCalls}{run.failure_rate != null ? ` · ${formatRate(run.failure_rate)}` : ''}
                </span>
            )}
            {judgeFailedCalls > 0 && (
                <span className="px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-300">
                    Judge failures {judgeFailedCalls}{run.judge_failure_rate != null ? ` · ${formatRate(run.judge_failure_rate)}` : ''}
                </span>
            )}
            {run.costUnavailable && (
                <span className="px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-300">Cost unavailable</span>
            )}
        </div>
    );
};

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

// Derive a ws:// base from the (possibly relative) CLI url, mirroring CLI_WS_URL.
const wsBaseFrom = (cliUrl: string) =>
    /^https?:\/\//i.test(cliUrl)
        ? cliUrl.replace(/^http/i, 'ws')
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${cliUrl}`;

export function ModelLabTab() {
    const { cliUrl, cliConnected } = useSettings();
    const baseUrl = normalizeBaseUrl(cliUrl);

    // Model Lab runs with its OWN OpenRouter key, entered here in the module — NOT the CLI
    // provider config. The CLI uses this key for the catalog (X-OpenRouter-Key header) and the
    // benchmark (request api_key). Persisted in this browser only, separate from any other key.
    const [modelLabKey, setModelLabKey] = useState<string>(() => {
        try { return localStorage.getItem('modelLabOpenRouterKey') || ''; } catch { return ''; }
    });
    useEffect(() => {
        try { localStorage.setItem('modelLabOpenRouterKey', modelLabKey); } catch { /* ignore */ }
    }, [modelLabKey]);
    const trimmedKey = modelLabKey.trim();
    // Key validation state — lets the operator confirm the OpenRouter key works BEFORE
    // committing a full benchmark. /models is public (200 even for a bad key), so we probe
    // OpenRouter's authenticated /key endpoint via the CLI proxy. Verdict resets on edit.
    const [keyTest, setKeyTest] = useState<{ status: 'idle' | 'testing' | 'ok' | 'bad'; detail?: string }>({ status: 'idle' });
    const testKey = useCallback(async () => {
        if (!trimmedKey || !cliConnected || !baseUrl) return;
        setKeyTest({ status: 'testing' });
        try {
            const r = await fetch(`${baseUrl}/api/model-eval/test-key`, {
                headers: { 'X-OpenRouter-Key': trimmedKey },
                signal: AbortSignal.timeout(12000),
            });
            const j = await r.json().catch(() => ({} as any));
            if (r.ok && j?.valid) {
                const bits = [j.label, j.is_free_tier ? 'free tier' : null].filter(Boolean).join(' · ');
                setKeyTest({ status: 'ok', detail: bits || undefined });
            } else {
                setKeyTest({ status: 'bad', detail: j?.detail || (r.ok ? 'Key rejected.' : await apiError(r)) });
            }
        } catch (e) {
            setKeyTest({ status: 'bad', detail: e instanceof Error ? e.message : 'Network error.' });
        }
    }, [trimmedKey, cliConnected, baseUrl]);

    const [catalog, setCatalog] = useState<CatalogModel[]>([]);
    const [catalogState, setCatalogState] = useState<'loading' | 'cli' | 'openrouter' | 'fallback' | 'error'>('loading');
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([...PRESET_V2, 'qwen/qwen3-coder', 'x-ai/grok-4.3']);
    const [search, setSearch] = useState('');
    const [phase, setPhase] = useState<'config' | 'running' | 'results'>('config');
    const [terminalStatus, setTerminalStatus] = useState<TerminalStatus | null>(null);
    const [jobId, setJobId] = useState<number | null>(null);
    const [runJudge, setRunJudge] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    const [runs, setRuns] = useState<RunState[]>([]);
    const [suiteId, setSuiteId] = useState<BenchmarkSuiteId>(DEFAULT_SUITE_ID);
    const [totalPrompts, setTotalPrompts] = useState(BENCHMARK_SUITES[DEFAULT_SUITE_ID].prompts);
    const [error, setError] = useState<string | null>(null);
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const [timeout, setTimeoutVal] = useState(45);
    const [maxTokens, setMaxTokens] = useState(600);
    const [runsPerPrompt, setRunsPerPrompt] = useState(2);  // 2 samples: kills runs=1 verdict noise
    const [concurrency, setConcurrency] = useState(3);
    const [mutationProbe, setMutationProbe] = useState(false);  // experimental MUTATION diversity probe
    const [judgeId, setJudgeId] = useState(JUDGE_DEFAULT);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [cost, setCost] = useState<{ total: number; judge: number | null; incomplete: boolean } | null>(null);
    const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null);
    const [slotLeaders, setSlotLeaders] = useState<Record<string, any[]> | null>(null);
    const [activeView, setActiveView] = useState<'benchmark' | 'history'>('benchmark');
    const [historyRuns, setHistoryRuns] = useState<any[]>([]);
    const [historyDeleteTarget, setHistoryDeleteTarget] = useState<{ id: number; label: string } | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const activeJobRef = useRef<ActiveJob | null>(null);
    const recoveryRef = useRef<RecoveryHandle | null>(null);
    const startRef = useRef<StartHandle | null>(null);
    const runTokenRef = useRef(0);
    const candidateCallCount = selectedIds.length * BENCHMARK_SUITES[suiteId].prompts * runsPerPrompt;
    const exceedsCallBudget = candidateCallCount > MAX_CANDIDATE_CALLS;

    // ── Load model catalog (CLI proxy → OpenRouter → fallback) ────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            // 1) CLI proxy (preferred — key stays server-side). The module's own OpenRouter key,
            //    when set, is sent as X-OpenRouter-Key so the CLI uses it instead of its provider key.
            if (cliConnected && baseUrl) {
                try {
                    const r = await fetch(`${baseUrl}/api/model-eval/models`, {
                        headers: trimmedKey ? { 'X-OpenRouter-Key': trimmedKey } : undefined,
                        signal: AbortSignal.timeout(15000),
                    });
                    if (r.ok) {
                        const j = await r.json();
                        if (cancelled) return;
                        setCatalog(mapModels(j.models || []));
                        setCatalogState('cli');
                        setCatalogError(null);
                        return;
                    }
                    const message = await apiError(r);
                    if (!cancelled) {
                        setCatalog(FALLBACK_CATALOG);
                        setCatalogState('error');
                        setCatalogError(message);
                    }
                    return;
                } catch (caught) {
                    if (!cancelled) {
                        setCatalog(FALLBACK_CATALOG);
                        setCatalogState('error');
                        setCatalogError(caught instanceof Error ? caught.message : String(caught));
                    }
                    return;
                }
            }
            // 2) Direct OpenRouter (public list, no key)
            try {
                const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000) });
                if (r.ok) {
                    const j = await r.json();
                    if (cancelled) return;
                    setCatalog(mapModels(j.data || []));
                    setCatalogState('openrouter');
                    setCatalogError(null);
                    return;
                }
            } catch { /* fall through */ }
            // 3) Fallback
            if (!cancelled) { setCatalog(FALLBACK_CATALOG); setCatalogState('fallback'); setCatalogError(null); }
        })();
        return () => { cancelled = true; };
    }, [baseUrl, cliConnected, trimmedKey]);

    function mapModels(raw: any[]): CatalogModel[] {
        return raw
            .map((m: any) => ({ id: m.id, name: m.name || m.id, price: fmtPrice(m.pricing), preset: presetOf(m.id) }))
            .filter((m: CatalogModel) => m.id)
            .sort((a: CatalogModel, b: CatalogModel) => {
                const pa = a.preset ? 0 : 1, pb = b.preset ? 0 : 1;
                return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
            });
    }

    const isSelected = (id: string) => selectedIds.includes(id);
    const toggle = (id: string) => {
        if (phase === 'running') return;
        if (selectedIds.includes(id)) {
            setSelectedIds(previous => previous.filter(model => model !== id));
            setSelectionError(null);
            return;
        }
        if (selectedIds.length >= MAX_MODELS) {
            setSelectionError(MODEL_LIMIT_ERROR);
            return;
        }
        setSelectedIds(previous => [...previous, id]);
        setSelectionError(null);
    };
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return catalog;
        return catalog.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
    }, [search, catalog]);

    const closeSocket = useCallback((socket: WebSocket | null = wsRef.current) => {
        if (!socket) return;
        if (wsRef.current === socket) wsRef.current = null;
        if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.close();
    }, []);

    const stopRecovery = useCallback((job?: { id: number; token: number }) => {
        const recovery = recoveryRef.current;
        if (!recovery) return;
        if (job && (recovery.jobId !== job.id || recovery.token !== job.token)) return;
        recoveryRef.current = null;
        recovery.controller.abort();
    }, []);

    const resetLocal = useCallback(() => {
        runTokenRef.current += 1;
        startRef.current?.controller.abort();
        startRef.current = null;
        stopRecovery();
        closeSocket();
        activeJobRef.current = null;
        setPhase('config');
        setTerminalStatus(null);
        setJobId(null);
        setRunJudge(null);
        setTotalPrompts(BENCHMARK_SUITES[suiteId].prompts);
        setRuns([]);
        setError(null);
        setSelectionError(null);
        setCost(null);
        setExecutionSummary(null);
        setExpanded(null);
        setIsStarting(false);
        setIsCancelling(false);
        setIsRecovering(false);
    }, [closeSocket, stopRecovery, suiteId]);

    const applyTerminalPayload = useCallback((payload: ModelEvalJobResponse, expectedJobId: number, token: number) => {
        const active = activeJobRef.current;
        if (!active || active.id !== expectedJobId || active.token !== token || !isTerminalStatus(payload.status)) return false;

        active.terminal = true;
        stopRecovery(active);
        closeSocket();
        setIsStarting(false);
        setIsCancelling(false);
        setIsRecovering(false);
        setTerminalStatus(payload.status);
        setRunJudge(previous => payload.judge || previous);

        if (payload.status === 'CANCELLED') {
            activeJobRef.current = null;
            setJobId(null);
            setPhase('config');
            setRuns([]);
            setCost(null);
            setExecutionSummary(null);
            setExpanded(null);
            setError(null);
            return true;
        }

        const result = payload.result;
        setRuns(previous => result?.results
            ? buildRuns(result.results, active.models, previous)
            : previous.map(runState => runState.status === 'done' || runState.status === 'failed'
                ? runState
                : { ...runState, status: 'failed', modelError: 'No terminal result returned by the backend.' }));
        if (result) {
            if (result.judge) setRunJudge(result.judge);
            setCost({
                total: asNumber(result.total_cost_usd) ?? 0,
                judge: asNumber(result.judge_cost_usd) ?? null,
                incomplete: result.cost_incomplete === true,
            });
            setExecutionSummary(normalizeExecutionSummary(result.summary));
            const promptCount = asCount(result.prompt_count)
                ?? Math.max(0, ...Object.values(result.results || {}).map((record: any) => Array.isArray(record?.prompts) ? record.prompts.length : 0));
            if (promptCount) setTotalPrompts(promptCount);
        }
        setPhase('results');
        if (payload.status === 'FAILED') {
            const backendError = errorText(payload.error);
            setError(previous => backendError || (previous && !previous.startsWith('Live connection lost') ? previous : null) || 'Benchmark failed.');
        } else {
            setError(null);
        }
        activeJobRef.current = null;
        return true;
    }, [closeSocket, stopRecovery]);

    const loadTerminalResult = useCallback(async (expectedJobId: number, token: number, expectedStatus: Exclude<TerminalStatus, 'CANCELLED'>) => {
        const expectedJob = activeJobRef.current;
        if (!expectedJob || expectedJob.id !== expectedJobId || expectedJob.token !== token) return;
        try {
            const response = await fetch(`${expectedJob.baseUrl}/api/model-eval/${expectedJobId}/results`, { signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error(await apiError(response));
            const payload = await response.json() as ModelEvalJobResponse;
            if (!isTerminalStatus(payload.status)) payload.status = expectedStatus;
            applyTerminalPayload(payload, expectedJobId, token);
        } catch (caught) {
            const active = activeJobRef.current;
            if (!active || active.id !== expectedJobId || active.token !== token) return;
            active.terminal = true;
            const message = caught instanceof Error ? caught.message : String(caught);
            setPhase('results');
            setTerminalStatus(expectedStatus);
            setRuns(previous => previous.map(runState => runState.status === 'done' || runState.status === 'failed'
                ? runState
                : { ...runState, status: 'failed', modelError: 'Final result could not be loaded.' }));
            setError(previous => expectedStatus === 'FAILED'
                ? previous && previous !== 'Benchmark failed.' && !previous.startsWith('Live connection lost')
                    ? previous
                    : `Benchmark failed; backend details could not be loaded: ${message}`
                : `Run completed, but final results could not be loaded: ${message}`);
            setIsCancelling(false);
            activeJobRef.current = null;
        }
    }, [applyTerminalPayload]);

    const finishTerminal = useCallback((expectedJobId: number, token: number, status: TerminalStatus) => {
        const active = activeJobRef.current;
        if (!active || active.id !== expectedJobId || active.token !== token) return;
        active.terminal = true;
        stopRecovery(active);
        closeSocket();
        setIsStarting(false);
        setIsRecovering(false);

        if (status === 'CANCELLED') {
            applyTerminalPayload({ job_id: expectedJobId, status, result: null }, expectedJobId, token);
            return;
        }

        setTerminalStatus(status);
        setPhase('results');
        setRuns(previous => previous.map(runState => runState.status === 'done' || runState.status === 'failed'
            ? runState
            : { ...runState, status: 'failed', modelError: 'Model did not return a terminal result.' }));
        if (status === 'FAILED') {
            setError(previous => previous && !previous.startsWith('Live connection lost') ? previous : 'Benchmark failed.');
        }
        void loadTerminalResult(expectedJobId, token, status);
    }, [applyTerminalPayload, closeSocket, loadTerminalResult, stopRecovery]);

    const startRecovery = useCallback((expectedJobId: number, token: number, socket?: WebSocket) => {
        const active = activeJobRef.current;
        if (!active || active.id !== expectedJobId || active.token !== token) return;
        if (socket && wsRef.current !== socket) return;
        const existing = recoveryRef.current;
        if (existing?.jobId === expectedJobId && existing.token === token) return;
        if (existing) stopRecovery();

        if (socket) closeSocket(socket);
        const handle: RecoveryHandle = { jobId: expectedJobId, token, controller: new AbortController() };
        recoveryRef.current = handle;
        setIsRecovering(true);
        setError(`Live connection lost. Recovering job #${expectedJobId}…`);

        void (async () => {
            let firstRequest = true;
            while (!handle.controller.signal.aborted) {
                if (!firstRequest) await waitFor(RECOVERY_INTERVAL_MS, handle.controller.signal);
                firstRequest = false;
                const current = activeJobRef.current;
                if (handle.controller.signal.aborted || !current || current.id !== expectedJobId || current.token !== token) return;

                const requestController = new AbortController();
                const abortRequest = () => requestController.abort();
                handle.controller.signal.addEventListener('abort', abortRequest, { once: true });
                const requestTimeout = window.setTimeout(abortRequest, 12000);
                try {
                    const response = await fetch(`${active.baseUrl}/api/model-eval/${expectedJobId}/results`, { signal: requestController.signal });
                    if (response.status === 404) {
                        applyTerminalPayload({
                            job_id: expectedJobId,
                            status: 'FAILED',
                            result: null,
                            error: 'Benchmark job no longer exists on the CLI.',
                        }, expectedJobId, token);
                        return;
                    }
                    if (!response.ok) throw new Error(await apiError(response));
                    const payload = await response.json() as ModelEvalJobResponse;
                    if (isTerminalStatus(payload.status)) {
                        applyTerminalPayload(payload, expectedJobId, token);
                        return;
                    }
                    if (payload.status !== 'RUNNING') {
                        setError(`Live connection lost. Job #${expectedJobId} reported ${payload.status || 'an unknown status'}; retrying…`);
                    }
                } catch (caught) {
                    if (handle.controller.signal.aborted) return;
                    const message = caught instanceof DOMException && caught.name === 'AbortError'
                        ? 'Results request timed out'
                        : caught instanceof Error ? caught.message : String(caught);
                    setError(`Live connection lost. Recovering job #${expectedJobId}: ${message}`);
                } finally {
                    window.clearTimeout(requestTimeout);
                    handle.controller.signal.removeEventListener('abort', abortRequest);
                }
            }
        })();
    }, [applyTerminalPayload, closeSocket, stopRecovery]);

    useEffect(() => () => {
        const active = activeJobRef.current;
        if (active && !active.terminal) {
            void fetch(`${active.baseUrl}/api/model-eval/${active.id}`, { method: 'DELETE', keepalive: true }).catch(() => undefined);
        }
        runTokenRef.current += 1;
        startRef.current?.controller.abort();
        startRef.current = null;
        activeJobRef.current = null;
        stopRecovery();
        closeSocket();
    }, [closeSocket, stopRecovery]);

    // ── Run the benchmark on the CLI ──────────────────────────────────────────
    const run = useCallback(async () => {
        if (!cliConnected || !baseUrl) { setError('CLI is not connected. Start the CLI API server to run a benchmark.'); return; }
        if (!trimmedKey) { setError('Enter your OpenRouter API key above to run Model Lab.'); return; }
        if (catalogState !== 'cli') { setError(catalogError || 'Model Lab needs the CLI connected and a valid OpenRouter key.'); return; }
        if (selectedIds.length === 0) return;
        if (selectedIds.length > MAX_MODELS) { setSelectionError(MODEL_LIMIT_ERROR); return; }
        if (exceedsCallBudget) { setSelectionError(`This configuration requests ${candidateCallCount} candidate calls; the per-job limit is ${MAX_CANDIDATE_CALLS}. Reduce models or runs.`); return; }

        runTokenRef.current += 1;
        const token = runTokenRef.current;
        const models = [...selectedIds];
        const requestedSuite = suiteId;
        const requestedSuiteConfig = BENCHMARK_SUITES[requestedSuite];
        const requestMaxTokens = clampInt(maxTokens, 32, 2000);
        const requestRuns = clampInt(runsPerPrompt, 1, 5);
        const requestConcurrency = clampInt(concurrency, 1, 8);
        startRef.current?.controller.abort();
        stopRecovery();
        closeSocket();
        activeJobRef.current = null;
        setError(null);
        setSelectionError(null);
        setExpanded(null);
        setCost(null);
        setExecutionSummary(null);
        setTerminalStatus(null);
        setJobId(null);
        setRunJudge(judgeId);
        setActiveView('benchmark');
        setIsStarting(true);
        setIsCancelling(false);
        setIsRecovering(false);
        setPhase('running');
        setTotalPrompts(requestedSuiteConfig.prompts);
        setSlotLeaders(null);
        setRuns(models.map(id => ({ id, version: presetOf(id) || '—', status: 'queued', prompts: [] })));

        const startController = new AbortController();
        startRef.current = { token, controller: startController };
        let startTimedOut = false;
        const startTimeout = window.setTimeout(() => {
            startTimedOut = true;
            startController.abort();
        }, START_TIMEOUT_MS);
        try {
            const response = await fetch(`${baseUrl}/api/model-eval`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ models, judge: judgeId, timeout, max_tokens: requestMaxTokens, runs: requestRuns, concurrency: requestConcurrency, suite_id: requestedSuite, api_key: trimmedKey, mutation_probe: mutationProbe }),
                signal: startController.signal,
            });
            if (!response.ok) throw new Error(await apiError(response));
            const payload = await response.json();
            if (runTokenRef.current !== token) return;
            if (typeof payload.job_id !== 'number') throw new Error('Backend did not return a valid job id.');

            const startedJobId = payload.job_id as number;
            if (payload.suite_id !== requestedSuite || payload.prompt_count !== requestedSuiteConfig.prompts) {
                await fetch(`${baseUrl}/api/model-eval/${startedJobId}`, { method: 'DELETE' }).catch(() => undefined);
                throw new Error(`CLI suite mismatch: requested ${requestedSuite}, received ${String(payload.suite_id || 'legacy')}.`);
            }
            const active: ActiveJob = { id: startedJobId, token, models, baseUrl, suiteId: requestedSuite, terminal: false };
            activeJobRef.current = active;
            setJobId(startedJobId);
            setRunJudge(payload.judge || judgeId);
            setIsStarting(false);

            let socket: WebSocket;
            try {
                const wsUrl = String(payload.ws_url || `/api/ws/model-eval/${startedJobId}`);
                socket = new WebSocket(/^wss?:\/\//.test(wsUrl) ? wsUrl : `${wsBaseFrom(baseUrl)}${wsUrl}`);
            } catch {
                startRecovery(startedJobId, token);
                return;
            }

            wsRef.current = socket;
            let ended = false;
            const ownsSocket = () => {
                const current = activeJobRef.current;
                return wsRef.current === socket && current?.id === startedJobId && current.token === token;
            };

            socket.onmessage = event => {
                if (!ownsSocket()) return;
                let message: any;
                try { message = JSON.parse(event.data); } catch { return; }
                const { event_type: eventType, data = {} } = message;

                if (eventType === 'started') {
                    if (data.suite_id && data.suite_id !== requestedSuite) {
                        setError(`CLI streamed an unexpected suite: ${String(data.suite_id)}.`);
                        void fetch(`${baseUrl}/api/model-eval/${startedJobId}`, { method: 'DELETE' }).catch(() => undefined);
                        return;
                    }
                    setTotalPrompts(Array.isArray(data.prompts) && data.prompts.length ? data.prompts.length : requestedSuiteConfig.prompts);
                    if (data.judge) setRunJudge(data.judge);
                    return;
                }
                if (eventType === 'model_started') {
                    setRuns(previous => previous.map(runState => runState.id === data.model ? {
                        ...runState,
                        status: 'running',
                        judge: typeof data.judge === 'string' ? data.judge : runState.judge,
                        modelError: undefined,
                    } : runState));
                    return;
                }
                if (eventType === 'prompt_done') {
                    const prompt = normalizePrompt(data);
                    setRuns(previous => {
                        let found = false;
                        const next = previous.map(runState => {
                            if (runState.id !== data.model) return runState;
                            found = true;
                            const promptIndex = runState.prompts.findIndex(item => item.prompt_id === prompt.prompt_id);
                            const prompts = promptIndex === -1
                                ? [...runState.prompts, prompt]
                                : runState.prompts.map((item, index) => index === promptIndex ? prompt : item);
                            return { ...runState, status: 'running' as const, prompts };
                        });
                        return found ? next : [...next, { id: String(data.model), version: presetOf(String(data.model)) || '—', status: 'running', prompts: [prompt] }];
                    });
                    return;
                }
                if (eventType === 'model_done') {
                    setRuns(previous => {
                        let found = false;
                        const next = previous.map(runState => {
                            if (runState.id !== data.model) return runState;
                            found = true;
                            return runFromRecord(runState.id, { ...data, prompts: runState.prompts }, runState);
                        });
                        return found ? next : [...next, runFromRecord(String(data.model), data)];
                    });
                    return;
                }
                if (eventType === 'complete') {
                    const current = activeJobRef.current;
                    if (current?.id === startedJobId && current.token === token) current.terminal = true;
                    setCost({
                        total: asNumber(data.total_cost_usd) ?? 0,
                        judge: asNumber(data.judge_cost_usd) ?? null,
                        incomplete: data.cost_incomplete === true,
                    });
                    setExecutionSummary(normalizeExecutionSummary(data.summary));
                    setSlotLeaders(data.slot_leaders && typeof data.slot_leaders === 'object' ? data.slot_leaders : null);
                    return;
                }
                if (eventType === 'saved') return;
                if (eventType === 'model_failed' || eventType === 'model_error' || (eventType === 'error' && data.model)) {
                    const messageText = errorText(data.message || data.error) || 'Model task failed.';
                    setRuns(previous => previous.map(runState => runState.id === data.model ? { ...runState, status: 'failed', modelError: messageText } : runState));
                    setError(`Model ${data.model} failed: ${messageText}`);
                    return;
                }
                if (eventType === 'error') {
                    setError(errorText(data.message || data.error) || 'Benchmark error');
                    return;
                }
                if (eventType === '_end') {
                    ended = true;
                    closeSocket(socket);
                    if (isTerminalStatus(data.status)) {
                        finishTerminal(startedJobId, token, data.status);
                    } else {
                        const current = activeJobRef.current;
                        if (current?.id === startedJobId && current.token === token) current.terminal = true;
                        setPhase('results');
                        setTerminalStatus(null);
                        setRuns(previous => previous.map(runState => runState.status === 'done' || runState.status === 'failed'
                            ? runState
                            : { ...runState, status: 'failed', modelError: 'Backend returned an unknown terminal status.' }));
                        setError(`Benchmark ended with unknown status: ${String(data.status || 'missing')}`);
                        activeJobRef.current = null;
                    }
                }
            };
            socket.onerror = () => {
                if (!ended && ownsSocket()) startRecovery(startedJobId, token, socket);
            };
            socket.onclose = () => {
                if (!ended && ownsSocket()) startRecovery(startedJobId, token, socket);
            };
        } catch (caught) {
            if (runTokenRef.current !== token) return;
            const message = startTimedOut
                ? `The CLI did not confirm the benchmark within ${START_TIMEOUT_MS / 1000} seconds. No cancellable job ID was received.`
                : caught instanceof Error ? caught.message : String(caught);
            setError(`Could not start benchmark: ${message}`);
            setPhase('config');
            setRuns([]);
            setIsStarting(false);
        } finally {
            window.clearTimeout(startTimeout);
            if (startRef.current?.token === token) startRef.current = null;
        }
    }, [baseUrl, cliConnected, catalogState, catalogError, selectedIds, suiteId, judgeId, timeout, maxTokens, runsPerPrompt, concurrency, mutationProbe, candidateCallCount, exceedsCallBudget, closeSocket, finishTerminal, startRecovery, stopRecovery]);

    const cancelRun = useCallback(async () => {
        const active = activeJobRef.current;
        if (!active) {
            setError('The benchmark job has not started yet, so it cannot be cancelled.');
            return;
        }

        setIsCancelling(true);
        setError(null);
        try {
            const response = await fetch(`${active.baseUrl}/api/model-eval/${active.id}`, { method: 'DELETE', signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error(await apiError(response));
            const payload = await response.json();
            const current = activeJobRef.current;
            if (!current || current.id !== active.id || current.token !== active.token) return;
            if (!isTerminalStatus(payload.status)) throw new Error(`Cancellation was not confirmed (status: ${payload.status || 'missing'}).`);
            finishTerminal(active.id, active.token, payload.status);
        } catch (caught) {
            const current = activeJobRef.current;
            if (current?.id === active.id && current.token === active.token) {
                const message = caught instanceof Error ? caught.message : String(caught);
                setError(`Could not cancel benchmark: ${message}`);
            }
        } finally {
            const current = activeJobRef.current;
            if (current?.id === active.id && current.token === active.token) setIsCancelling(false);
        }
    }, [finishTerminal]);

    const ranked = [...runs].filter(r => r.status === 'done' || r.status === 'failed').sort((a, b) => {
        const eligibility = Number(eligibleForRanking(b)) - Number(eligibleForRanking(a));
        return eligibility || (b.composite ?? -99) - (a.composite ?? -99);
    });
    const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`);

    // ── History ───────────────────────────────────────────────────────────────
    const fetchHistory = useCallback(async () => {
        if (!baseUrl) return;
        try {
            const r = await fetch(`${baseUrl}/api/model-eval/history?limit=25`, { signal: AbortSignal.timeout(8000) });
            if (r.ok) { const j = await r.json(); setHistoryRuns(j.runs || []); }
        } catch { /* ignore */ }
    }, [baseUrl]);
    const showHistory = () => {
        if (phase === 'running') return;
        setActiveView('history');
        fetchHistory();
    };
    const loadHistoryRun = async (runId: number) => {
        if (!baseUrl || phase === 'running') return;
        const requestToken = runTokenRef.current;
        try {
            const r = await fetch(`${baseUrl}/api/model-eval/history/${runId}`, { signal: AbortSignal.timeout(8000) });
            if (!r.ok) throw new Error(await apiError(r));
            const j = await r.json();
            if (runTokenRef.current !== requestToken || activeJobRef.current) return;
            const results = j.results || {};
            const built = buildRuns(results, Object.keys(results), []);
            runTokenRef.current += 1;
            stopRecovery();
            closeSocket();
            activeJobRef.current = null;
            setJobId(null);
            setRunJudge(j.judge || null);
            setTerminalStatus(isTerminalStatus(j.status) ? j.status : 'COMPLETED');
            setRuns(built);
            setTotalPrompts(asCount(j.prompt_count) ?? Math.max(1, ...built.map(runState => runState.prompts.length)));
            setCost({
                total: asNumber(j.total_cost) ?? asNumber(j.total_cost_usd) ?? 0,
                judge: asNumber(j.judge_cost_usd) ?? null,
                incomplete: j.cost_incomplete === true,
            });
            setExecutionSummary(normalizeExecutionSummary(j.summary));
            setPhase('results');
            setActiveView('benchmark');
            setError(null);
            setSelectionError(null);
            setExpanded(null);
        } catch (caught) {
            if (runTokenRef.current !== requestToken || activeJobRef.current) return;
            const message = caught instanceof Error ? caught.message : String(caught);
            setError(`Could not load history run: ${message}`);
        }
    };
    const deleteHistoryRun = async () => {
        const target = historyDeleteTarget;
        if (!target || !baseUrl) return;
        setHistoryDeleteTarget(null);
        try {
            const response = await fetch(`${baseUrl}/api/model-eval/history/${target.id}`, {
                method: 'DELETE',
                signal: AbortSignal.timeout(8000),
            });
            if (!response.ok) throw new Error(await apiError(response));
            setHistoryRuns(previous => previous.filter(run => run.id !== target.id));
            setError(null);
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : String(caught);
            setError(`Could not delete history run: ${message}`);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex-shrink-0 flex flex-col gap-3 md:flex-row md:justify-between md:items-center p-3 m-4 card-premium !rounded-3xl border-white/10">
                <div className="flex items-center gap-3 flex-wrap ml-3 min-w-0">
                    <div className="flex flex-col">
                        <span className="label-mini label-mini-accent">Model Benchmark</span>
                        <span className="title-standard">Model Lab</span>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                        <button onClick={() => setActiveView('benchmark')} className={`btn-mini !py-1.5 !px-3 ${activeView === 'benchmark' ? 'btn-mini-primary' : 'btn-mini-secondary'}`}>Benchmark</button>
                        <button onClick={showHistory} disabled={phase === 'running'} className={`btn-mini !py-1.5 !px-3 disabled:cursor-not-allowed disabled:opacity-30 ${activeView === 'history' ? 'btn-mini-primary' : 'btn-mini-secondary'}`}>History</button>
                    </div>
                    {!cliConnected && <span className="badge-mini border border-amber-500/30 text-amber-300">CLI offline</span>}
                    {phase === 'running' && (
                        <span className="badge-mini badge-mini-accent animate-pulse shadow-[0_0_10px_rgba(255,127,80,0.2)]">
                            {isStarting ? 'Starting benchmark…' : isRecovering ? `Recovering job #${jobId}…` : `Benchmarking ${runs.length} models…`}
                        </span>
                    )}
                    {jobId != null && <span className="badge-mini border border-white/10 text-ui-text-dim">job #{jobId}</span>}
                    {terminalStatus === 'CANCELLED' && phase === 'config' && <span className="badge-mini border border-amber-500/30 text-amber-300">Run cancelled</span>}
                    {terminalStatus === 'FAILED' && <span className="badge-mini border border-red-500/30 bg-red-500/10 text-red-300">Run failed</span>}
                    {error && <span className="badge-mini border border-red-500/30 text-red-300 max-w-[420px] truncate">{error}</span>}
                </div>
                <div className="flex items-center gap-3 pr-1 flex-wrap justify-end">
                    {activeView === 'benchmark' && (
                        <>
                            {phase === 'running' && (
                                <button onClick={cancelRun} disabled={jobId == null || isStarting || isCancelling}
                                    className="btn-mini btn-mini-secondary h-9 px-5 disabled:opacity-30 disabled:cursor-not-allowed">
                                    {isCancelling ? 'Cancelling…' : 'Cancel'}
                                </button>
                            )}
                            {phase === 'results' && <button onClick={resetLocal} className="btn-mini btn-mini-secondary h-9 px-5">New Run</button>}
                            {phase !== 'running' && (
                                <button onClick={run} disabled={selectedIds.length === 0 || selectedIds.length > MAX_MODELS || exceedsCallBudget || !cliConnected || catalogState !== 'cli'}
                                    className="btn-mini btn-mini-primary h-9 px-6 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed">
                                    ▶ Run {BENCHMARK_SUITES[suiteId].tier === 'quick' ? 'Quick' : 'Advanced'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Model picker */}
                {activeView === 'benchmark' && <div className="card-premium overflow-hidden">
                    <div className="px-5 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="p-2 rounded-xl bg-coral/5 border border-coral/10 text-coral"><BoltIcon className="w-4 h-4" /></div>
                                <span className="title-standard">Models to benchmark</span>
                                <span className="badge-mini border border-white/10 text-ui-text-dim">{selectedIds.length}/{MAX_MODELS} selected</span>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                                <label className="flex items-center gap-2 label-mini">Timeout
                                    <input type="number" min={5} max={120} value={timeout} onChange={e => setTimeoutVal(clampNumber(+e.target.value, 5, 120))} className="input-premium w-16 px-2 py-1 text-center" />s</label>
                                <label className="flex items-center gap-2 label-mini">Max tokens
                                    <input type="number" min={32} max={2000} step={1} value={maxTokens} onChange={e => setMaxTokens(clampInt(+e.target.value, 32, 2000))} className="input-premium w-20 px-2 py-1 text-center" /></label>
                                <label className="flex items-center gap-2 label-mini">Runs
                                    <input type="number" min={1} max={5} step={1} value={runsPerPrompt} onChange={e => setRunsPerPrompt(clampInt(+e.target.value, 1, 5))} className="input-premium w-14 px-2 py-1 text-center" /></label>
                                <label className="flex items-center gap-2 label-mini">Parallel
                                    <input type="number" min={1} max={8} step={1} value={concurrency} onChange={e => setConcurrency(clampInt(+e.target.value, 1, 8))} className="input-premium w-14 px-2 py-1 text-center" /></label>
                                <label className="flex items-center gap-2 label-mini" title="Experimental: also sample each model at scan temperature and score MUTATION payload diversity (adds a few calls per model).">
                                    <input type="checkbox" checked={mutationProbe} disabled={phase === 'running'} onChange={e => setMutationProbe(e.target.checked)} className="accent-coral" />
                                    MUTATION probe</label>
                            </div>
                        </div>

                        {/* Benchmark suite */}
                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2 label-mini">
                                <span>Difficulty</span>
                                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                                    {Object.values(BENCHMARK_SUITES).map(suite => (
                                        <button key={suite.id} onClick={() => setSuiteId(suite.id)} disabled={phase === 'running'}
                                            className={`btn-mini !py-1.5 !px-3 disabled:cursor-not-allowed disabled:opacity-30 ${suiteId === suite.id ? 'btn-mini-primary' : 'btn-mini-secondary'}`}>
                                            {suite.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <span className="badge-mini w-fit border border-white/10 text-ui-text-dim">
                                {BENCHMARK_SUITES[suiteId].prompts * 2} calls/model · {BENCHMARK_SUITES[suiteId].tier}
                            </span>
                        </div>
                        <p className="mb-1 text-[10px] leading-relaxed text-ui-text-dim">{BENCHMARK_SUITES[suiteId].description}</p>
                        <p className={`mb-3 text-[10px] ${exceedsCallBudget ? 'text-red-300' : 'text-ui-text-dim'}`}>
                            Estimated base requests: <strong className="text-ui-text-main">{candidateCallCount * 2}</strong> candidate + judge calls · candidate workload <strong>{candidateCallCount}/{MAX_CANDIDATE_CALLS}</strong>
                            {suiteId === 'advanced-v1' ? ' · about 50% more work than Quick' : ''}. Judge retries may add calls.
                        </p>

                        {selectionError && (
                            <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">{selectionError}</div>
                        )}

                        {/* OpenRouter API key — Model Lab uses its OWN key entered here, NOT the CLI provider config */}
                        <div className="mb-3">
                            <label className="label-mini text-ui-text-dim flex items-center gap-1 mb-1">OpenRouter API Key <span className="text-coral">*</span></label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="password"
                                    value={modelLabKey}
                                    onChange={e => { setModelLabKey(e.target.value); setKeyTest({ status: 'idle' }); }}
                                    placeholder="sk-or-v1-… (required — used only by Model Lab, stored in this browser)"
                                    className="flex-1 min-w-0 input-premium px-3 py-2 font-mono text-[11px]"
                                    autoComplete="off"
                                    spellCheck={false}
                                    disabled={phase === 'running'}
                                />
                                <button
                                    type="button"
                                    onClick={testKey}
                                    disabled={!trimmedKey || !cliConnected || keyTest.status === 'testing' || phase === 'running'}
                                    title="Validate this key against OpenRouter before running a benchmark (consumes no tokens)."
                                    className="flex-none px-3 py-2 rounded-lg text-[11px] font-semibold border border-glass-border/50 text-ui-text-main hover:border-coral/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {keyTest.status === 'testing' ? 'Testing…' : 'Test key'}
                                </button>
                            </div>
                            <p className="mt-1 text-[10px] text-ui-text-dim">
                                {keyTest.status === 'ok'
                                    ? <><span className="text-emerald-400">✓</span> Key valid{keyTest.detail ? ` — ${keyTest.detail}` : ''}. Ready to benchmark.</>
                                    : keyTest.status === 'bad'
                                        ? <><span className="text-red-400">✗</span> {keyTest.detail || 'Key rejected.'}</>
                                        : trimmedKey
                                            ? <><span className="text-emerald-400">●</span> Key set — click <strong>Test key</strong> to confirm it works, then run. Used only by Model Lab, independent of the scanner provider config.</>
                                            : <><span className="text-amber-400">●</span> Enter an OpenRouter key to activate Model Lab. This module does not use the scanner provider key.</>}
                            </p>
                        </div>

                        {/* Judge model */}
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <span className="label-mini text-ui-text-dim flex items-center gap-1"><BrainIcon className="w-3 h-3" /> Judge:</span>
                            <select value={judgeId} onChange={e => setJudgeId(e.target.value)} disabled={phase === 'running'} className="input-premium py-1 px-2 text-[11px] max-w-[260px]">
                                {[JUDGE_DEFAULT, ...catalog.map(m => m.id).filter(id => id !== JUDGE_DEFAULT)].map(id => <option key={id} value={id}>{id}</option>)}
                            </select>
                            <span className="text-[11px] text-ui-text-dim">grades each answer with a rubric · temp 0 · never judges itself</span>
                        </div>

                        {/* Selected chips */}
                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mb-3">
                                {selectedIds.map(id => (
                                    <span key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-coral/10 border border-coral/20 text-[11px] font-mono text-ui-text-main">
                                        {id}<button onClick={() => toggle(id)} disabled={phase === 'running'} className="text-coral/70 hover:text-coral disabled:opacity-40">✕</button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Search */}
                        <div className="relative mb-2">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-dim"><SearchIcon /></span>
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter models by id or name…" className="w-full input-premium pl-9 pr-3 py-2" />
                        </div>

                        {/* Listbox */}
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-white/5 divide-y divide-white/5">
                            {catalogState === 'loading' && (
                                <p className="p-4 text-center text-[11px] text-ui-text-dim flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Z" /></svg>
                                    Loading models…
                                </p>
                            )}
                            {catalogState !== 'loading' && filtered.length === 0 && <p className="p-4 text-center text-[11px] text-ui-text-dim">No models match “{search}”.</p>}
                            {filtered.map(m => (
                                <button key={m.id} onClick={() => toggle(m.id)} disabled={phase === 'running'}
                                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${isSelected(m.id) ? 'bg-coral/[0.07]' : 'hover:bg-white/[0.03]'} disabled:cursor-not-allowed`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${isSelected(m.id) ? 'bg-coral border-coral text-white' : 'border-white/20'}`}>
                                            {isSelected(m.id) && <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm text-ui-text-main truncate">{m.name}</p>
                                            <p className="text-[11px] font-mono text-ui-text-muted truncate">{m.id}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-[11px] text-ui-text-dim">{m.price}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-ui-text-dim mt-2">
                            {catalogState === 'cli' ? <><span className="text-emerald-400">●</span> {catalog.length} models · via CLI (key stays server-side).</>
                                : catalogState === 'error' ? <><span className="text-red-400">●</span> ModelLab unavailable: {catalogError || 'configure OpenRouter in the CLI.'}</>
                                : catalogState === 'openrouter' ? <><span className="text-amber-400">●</span> {catalog.length} models · direct from OpenRouter (CLI offline).</>
                                    : catalogState === 'fallback' ? <><span className="text-amber-400">●</span> Fallback list — couldn’t reach the CLI or OpenRouter.</>
                                        : 'Loading the model catalog…'}
                        </p>
                    </div>
                </div>}

                {/* History panel */}
                {activeView === 'history' && (
                    <div className="card-premium overflow-hidden">
                        <div className="px-5 py-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="title-standard">History</span>
                                <button onClick={fetchHistory} className="btn-mini btn-mini-secondary !py-1 !px-3 text-[11px]">Refresh</button>
                            </div>
                            {historyRuns.length === 0 ? (
                                <p className="text-[11px] text-ui-text-dim">No past runs yet — run a benchmark to populate the history.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {historyRuns.map(run => {
                                        const topScore = asNumber(run.top_score);
                                        const hasWinner = typeof run.top_model === 'string' && Boolean(run.top_model.trim()) && topScore != null;
                                        const totalCost = asNumber(run.total_cost) ?? asNumber(run.total_cost_usd) ?? 0;
                                        const judgeCost = asNumber(run.judge_cost_usd);
                                        return (
                                            <div key={run.id} className="group flex items-stretch gap-2">
                                                <button onClick={() => loadHistoryRun(run.id)}
                                                    className="min-w-0 flex-1 flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] text-left transition-colors">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className="text-[11px] text-ui-text-dim w-32 flex-shrink-0">{(run.created_at || '').replace('T', ' ').slice(0, 16)}</span>
                                                        <span className="font-mono text-xs text-ui-text-main truncate">{hasWinner ? `🥇 ${run.top_model}` : 'No eligible winner'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0 text-[11px]">
                                                        <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300">{suiteLabel(run.suite_id)}</span>
                                                        {run.status === 'PARTIAL' && <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">Partial</span>}
                                                        <span className="text-ui-text-muted">{run.model_count} models</span>
                                                        {hasWinner ? (
                                                            <span className={`px-2 py-0.5 rounded ${topScore >= 8 ? 'bg-emerald-500/10 text-emerald-300' : topScore >= 6.5 ? 'bg-amber-500/10 text-amber-300' : 'bg-red-500/10 text-red-300'}`}>{topScore.toFixed(1)}</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded bg-white/5 text-ui-text-dim">n/a</span>
                                                        )}
                                                        <span className="text-ui-text-dim">${totalCost.toFixed(4)}{judgeCost != null ? ` · judge $${judgeCost.toFixed(4)}` : ''}{run.cost_incomplete === true ? ' · incomplete' : ''}</span>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => setHistoryDeleteTarget({ id: run.id, label: hasWinner ? run.top_model : `run #${run.id}` })}
                                                    title={`Delete run #${run.id}`}
                                                    aria-label={`Delete history run ${run.id}`}
                                                    className="flex-shrink-0 rounded-xl border border-red-500/20 px-3 text-red-400 opacity-60 transition-all hover:bg-red-500/10 hover:opacity-100 group-hover:opacity-100"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Live arena */}
                {activeView === 'benchmark' && (phase === 'running' || phase === 'results') && (
                    <div className="card-premium overflow-hidden">
                        <div className="px-5 py-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                                <span className={`title-standard ${terminalStatus === 'FAILED' ? 'text-red-300' : terminalStatus === 'PARTIAL' ? 'text-amber-300' : ''}`}>
                                    {phase === 'running' ? (isRecovering ? 'Live connection recovery' : 'Live')
                                        : terminalStatus === 'FAILED' ? 'Run failed'
                                            : terminalStatus === 'PARTIAL' ? 'Run completed with failures'
                                                : terminalStatus === 'COMPLETED' ? 'Run complete' : 'Run status unavailable'}
                                </span>
                                <div className="flex items-center gap-4 text-[11px] flex-wrap">
                                    <span className="flex items-center gap-1 text-amber-400"><BoltIcon /> Speed</span>
                                    <span className="flex items-center gap-1 text-emerald-400"><ShieldIcon /> Compliance</span>
                                    <span className="flex items-center gap-1 text-violet-400">◎ Correctness</span>
                                    <span className="flex items-center gap-1 text-sky-400"><BrainIcon /> Skepticism</span>
                                </div>
                            </div>
                            {phase === 'results' && terminalStatus === 'PARTIAL' && executionSummary && (
                                <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-200">
                                    <strong>Partial benchmark:</strong> {executionSummary.candidate_calls_failed} of {executionSummary.candidate_calls_attempted} attempted candidate calls failed
                                    {executionSummary.candidate_calls_skipped > 0 ? ` · ${executionSummary.candidate_calls_skipped} of ${executionSummary.candidate_calls_planned} planned calls skipped after a terminal provider failure` : ''}
                                    {executionSummary.judge_calls_failed > 0 ? ` · ${executionSummary.judge_calls_failed} judge calls failed` : ''}
                                    {executionSummary.models_failed > 0 ? ` · ${executionSummary.models_failed} model${executionSummary.models_failed === 1 ? '' : 's'} produced no evaluated result` : ''}.
                                </div>
                            )}
                            {phase === 'results' && error && (
                                <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">{error}</div>
                            )}
                            <div className="space-y-2">
                                {runs.map((r) => {
                                    const progress = Math.min(1, r.prompts.length / totalPrompts);
                                    const failedCalls = failedCallsFor(r);
                                    const judgeFailedCalls = judgeFailedCallsFor(r);
                                    const totalCalls = totalCallsFor(r);
                                    const evaluatedCalls = evaluatedCallsFor(r);
                                    const fullyFailed = r.status === 'failed' || (totalCalls > 0 && failedCalls >= totalCalls) || (r.status === 'done' && evaluatedCalls === 0 && judgeFailedCalls === 0);
                                    const dotClass = fullyFailed
                                        ? 'bg-red-400'
                                        : judgeFailedCalls > 0 || failedCalls > 0 ? 'bg-amber-400'
                                            : r.status === 'done' ? 'bg-emerald-400'
                                                : r.status === 'running' ? 'bg-coral animate-pulse' : 'bg-white/20';
                                    return (
                                        <div key={r.id} className={`flex items-center gap-3 flex-wrap xl:flex-nowrap p-2.5 rounded-xl border ${fullyFailed ? 'bg-red-500/[0.04] border-red-500/20' : 'bg-white/[0.03] border-white/5'}`}>
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
                                            <div className="w-56 min-w-0 flex-shrink-0">
                                                <p className="font-mono text-xs text-ui-text-main truncate">{r.id}</p>
                                                {r.modelError && <p className="text-[10px] text-red-300 truncate" title={r.modelError}>{r.modelError}</p>}
                                            </div>
                                            <ModelFailureBadges run={r} />
                                            <div className="flex-1 min-w-24 h-2 rounded-full bg-white/5 overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-coral/60 to-coral transition-all duration-300" style={{ width: `${progress * 100}%` }} />
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {Array.from({ length: totalPrompts }).map((_, idx) => {
                                                    const pr = r.prompts[idx];
                                                    return <span key={idx} title={pr ? `${pr.label} → ${pr.status} · ${verdictText(pr.verdict)}: ${pr.rationale}` : ''} className={`w-2.5 h-2.5 rounded-full ${pr ? promptDotColor(pr) : 'bg-white/10'}`} />;
                                                })}
                                            </div>
                                            <span className="text-[11px] text-ui-text-muted w-40 text-right flex-shrink-0">
                                                {r.status === 'queued' ? 'queued…'
                                                    : r.status === 'running' ? `testing ${r.prompts.length}/${totalPrompts}…`
                                                        : r.status === 'failed' ? 'model task failed'
                                                            : evaluatedCalls === 0 ? `0/${totalCalls} evaluated`
                                                                : `p95 TTFT ${r.p95_ttft != null ? r.p95_ttft.toFixed(2) : r.avg_ttft != null ? r.avg_ttft.toFixed(2) : '—'}s`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Best model per scanner slot — pick per slot, not one global winner */}
                {activeView === 'benchmark' && phase === 'results' && slotLeaders && Object.keys(slotLeaders).length > 0 && (
                    <div className="card-premium overflow-hidden">
                        <div className="px-5 py-4">
                            <span className="title-standard">Best per slot</span>
                            <span className="ml-3 text-[10px] text-ui-text-dim">the scanner uses a different model per slot — take the top model for each, not one global winner</span>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {['MUTATION', 'SKEPTICAL', 'ANALYSIS', 'REPORTING'].map(slot => {
                                    const rows = slotLeaders[slot];
                                    if (!Array.isArray(rows) || rows.length === 0) return null;
                                    const top = rows[0];
                                    const diversity = top?.diversity;
                                    const headline = typeof top?.pick_score === 'number' ? top.pick_score : top?.quality;
                                    return (
                                        <div key={slot} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="label-mini text-ui-text-dim">{slot}</span>
                                                <span className="badge-mini border border-white/10 text-ui-text-dim">{typeof headline === 'number' ? headline.toFixed(1) : '—'}/10</span>
                                            </div>
                                            <p className="font-mono text-xs text-ui-text-main truncate mt-1" title={String(top?.model)}>{String(top?.model)}</p>
                                            {typeof top?.pick_score === 'number' && typeof top?.diversity_score === 'number' && <p className="text-[10px] text-ui-text-dim mt-0.5">blend · quality {typeof top?.quality === 'number' ? top.quality.toFixed(1) : '—'} · diversity {top.diversity_score.toFixed(1)}</p>}
                                            {typeof top?.verdict_match === 'number' && <p className="text-[10px] text-ui-text-dim mt-0.5">verdict match {Math.round(top.verdict_match * 100)}%</p>}
                                            {diversity && typeof diversity.unique_valid === 'number' && <p className="text-[10px] text-ui-text-dim mt-0.5">diversity {diversity.unique_valid} unique-valid payloads (experimental)</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Leaderboard */}
                {activeView === 'benchmark' && phase === 'results' && ranked.length > 0 && (
                    <div className="card-premium overflow-hidden">
                        <div className="px-5 py-4">
                            <span className="title-standard">Leaderboard</span>
                            {cost && <span className={`ml-3 badge-mini border ${cost.incomplete ? 'border-amber-500/30 text-amber-300' : 'border-white/10 text-ui-text-dim'}`}>run ${cost.total.toFixed(4)}{cost.judge != null ? <> · judge overhead ${cost.judge.toFixed(4)}</> : ''}{cost.incomplete ? ' · incomplete cost' : ''}</span>}
                            <div className="mt-4 space-y-2">
                                {ranked.map((r, i) => {
                                    const open = expanded === r.id;
                                    const evaluatedCalls = evaluatedCallsFor(r);
                                    const totalCalls = totalCallsFor(r);
                                    const failedCalls = failedCallsFor(r);
                                    const judgeFailedCalls = judgeFailedCallsFor(r);
                                    const fullyFailed = r.status === 'failed' || (totalCalls > 0 && failedCalls >= totalCalls) || (r.status === 'done' && evaluatedCalls === 0 && judgeFailedCalls === 0);
                                    const judgeOnlyFailure = evaluatedCalls === 0 && judgeFailedCalls > 0 && !fullyFailed;
                                    const eligibleForPodium = eligibleForRanking(r);
                                    const podiumIndex = ranked.slice(0, i).filter(eligibleForRanking).length;
                                    return (
                                        <div key={r.id} className={`rounded-xl border ${fullyFailed ? 'bg-red-500/[0.05] border-red-500/25' : judgeOnlyFailure ? 'bg-amber-500/[0.04] border-amber-500/20' : eligibleForPodium && podiumIndex === 0 ? 'bg-coral/[0.06] border-coral/20' : 'bg-white/[0.03] border-white/5'}`}>
                                            <div className="flex items-center gap-3 flex-wrap xl:flex-nowrap p-3">
                                                <span className="text-lg w-8 text-center flex-shrink-0">{eligibleForPodium ? medal(podiumIndex) : '—'}</span>
                                                <div className="min-w-0 w-56 flex-shrink-0">
                                                    <p className="font-mono text-xs text-ui-text-main truncate">{r.id}</p>
                                                    {r.modelError && <p className="text-[10px] text-red-300 truncate" title={r.modelError}>{r.modelError}</p>}
                                                </div>
                                                <ModelFailureBadges run={r} />
                                                 <div className="flex items-center gap-2 flex-1 justify-center flex-wrap min-w-0">
                                                     <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] ${dimensionTone(r.performance_score)}`}><BoltIcon />Perf {r.performance_score?.toFixed(1) ?? '—'}</span>
                                                     <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 text-[11px]">p95 first {r.p95_ttft?.toFixed(2) ?? r.avg_ttft?.toFixed(2) ?? '—'}s</span>
                                                     <span className="px-2 py-1 rounded-lg bg-white/5 text-ui-text-muted text-[11px]">p95 total {r.p95_total_latency?.toFixed(2) ?? '—'}s</span>
                                                     <span className={`px-2 py-1 rounded-lg text-[11px] ${(r.ok_calls ?? 0) > 0 && r.throughput_reliable === false ? 'bg-amber-500/10 text-amber-300' : 'bg-white/5 text-ui-text-muted'}`}>
                                                         {(r.ok_calls ?? 0) > 0 && r.throughput_reliable === false ? 'buffered stream' : `${r.avg_tokens_per_second?.toFixed(1) ?? '—'} tok/s`}
                                                     </span>
                                                     <span className={`px-2 py-1 rounded-lg text-[11px] ${dimensionTone(r.correctness_score)}`}>Tech {r.correctness_score?.toFixed(1) ?? '—'}</span>
                                                     <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] ${dimensionTone(r.compliance_score)}`}><ShieldIcon />Help {r.compliance_score?.toFixed(1) ?? '—'}</span>
                                                     <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] ${dimensionTone(r.skepticism_score)}`}><BrainIcon />Calib {r.skepticism_score?.toFixed(1) ?? '—'}</span>
                                                     <span className={`px-2 py-1 rounded-lg text-[11px] ${evaluatedCalls === 0 ? 'bg-red-500/10 text-red-300' : 'bg-white/5 text-ui-text-muted'}`}>{evaluatedCalls}/{totalCalls} evaluated</span>
                                                     {r.avg_cost_usd != null && <span className="px-2 py-1 rounded-lg bg-white/5 text-ui-text-muted text-[11px]">${r.avg_cost_usd.toFixed(4)}/candidate call</span>}
                                                </div>
                                                <button onClick={() => setExpanded(open ? null : r.id)} title="Judge breakdown" className="flex-shrink-0 text-ui-text-dim hover:text-ui-text-main transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
                                                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                                                </button>
                                                <div className="text-right w-14 flex-shrink-0">
                                                    <p className={`text-lg font-bold ${evaluatedCalls === 0 || r.quality_gate_passed === false ? (judgeFailedCalls > 0 ? 'text-amber-400' : 'text-red-400') : (r.composite ?? 0) >= 8 ? 'text-emerald-400' : (r.composite ?? 0) >= 6.5 ? 'text-amber-400' : 'text-red-400'}`}>{r.composite != null ? r.composite.toFixed(1) : '—'}</p>
                                                    <p className="text-[9px] text-ui-text-dim -mt-1">score</p>
                                                </div>
                                            </div>
                                            {open && (
                                                <div className="px-4 pb-3 pt-1 border-t border-white/5 space-y-1.5">
                                                     <div className="flex items-center gap-2 flex-wrap py-1 text-[10px] text-ui-text-dim">
                                                         <span>Candidate calls: {okCallsFor(r)} ok / {totalCalls} total</span>
                                                         <span>· {evaluatedCalls} evaluated</span>
                                                         <span>· prompt coverage {formatRate(r.prompt_coverage)}</span>
                                                         <span>· sample coverage {formatRate(r.sample_coverage)}</span>
                                                         <span>· judge confidence {r.judge_confidence?.toFixed(2) ?? 'n/a'}</span>
                                                         <span>· reliability {r.reliability_score?.toFixed(1) ?? 'n/a'}/10</span>
                                                         <span>· performance {r.performance_score?.toFixed(1) ?? 'n/a'}/10</span>
                                                         <span>· avg total {r.avg_total_latency?.toFixed(2) ?? 'n/a'}s</span>
                                                         <span>· {(r.ok_calls ?? 0) > 0 && r.throughput_reliable === false ? 'throughput unavailable (buffered stream)' : `${r.avg_tokens_per_second?.toFixed(1) ?? 'n/a'} tok/s`}</span>
                                                    </div>
                                                      {r.modelError && <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-2 py-1.5 text-[11px] text-red-300">{r.modelError}</div>}
                                                      {r.prompts.map((p, idx) => {
                                                          const promptSkipped = p.status === 'SKIPPED';
                                                          const promptFailed = !promptSkipped && (p.failed_calls > 0 || (p.status !== 'OK' && p.judge_failed_calls === 0));
                                                          const verdictClass = promptSkipped ? 'text-ui-text-dim' : p.expected
                                                              ? p.verdict === p.expected ? 'text-emerald-300' : p.verdict === 'INSUFFICIENT' ? 'text-amber-300' : 'text-red-300'
                                                              : verdictTextColor(p.verdict);
                                                          const statusClass = promptSkipped
                                                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                                              : promptFailed ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                                                  : p.judge_failed_calls > 0 ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                                                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
                                                        return (
                                                            <div key={`${p.prompt_id}-${idx}`} className="flex items-start gap-2 flex-wrap lg:flex-nowrap py-1 text-[11px]">
                                                                <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${promptDotColor(p)}`} />
                                                                <span className="text-ui-text-dim w-28 flex-shrink-0">{p.label}</span>
                                                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold flex-shrink-0 ${statusClass}`}>{p.status}</span>
                                                                 <span className={`font-semibold w-36 flex-shrink-0 ${verdictClass}`}>{verdictText(p.verdict)}</span>
                                                                 <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
                                                                     <span className={`px-1.5 py-0.5 rounded ${dimensionTone(p.quality_score)}`}>quality {p.quality_score?.toFixed(1) ?? '—'}/10</span>
                                                                     {p.confidence != null && <span className="px-1.5 py-0.5 rounded bg-white/5 text-ui-text-dim">conf {p.confidence.toFixed(2)}</span>}
                                                                     {p.expected && <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">expected {p.expected.toLowerCase()}</span>}
                                                                     {p.response_sources.includes('refusal') && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">refusal payload</span>}
                                                                     {(p.reasoning_tokens != null || p.reasoning_chars > 0) && <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">reasoning {p.reasoning_tokens != null ? `${p.reasoning_tokens} tokens` : `${p.reasoning_chars} chars`}</span>}
                                                                     {p.finish_reason && p.finish_reason !== 'stop' && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">finish {p.finish_reason}{p.native_finish_reason && p.native_finish_reason !== p.finish_reason ? `/${p.native_finish_reason}` : ''}</span>}
                                                                     {p.unknown_payloads.length > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">unsupported {p.unknown_payloads.join(', ')}</span>}
                                                                     {p.total_latency != null && <span className="px-1.5 py-0.5 rounded bg-white/5 text-ui-text-dim">total {p.total_latency.toFixed(2)}s</span>}
                                                                     {p.status === 'OK' && p.throughput_reliable === false
                                                                         ? <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">buffered stream · throughput unavailable</span>
                                                                         : p.tokens_per_second != null && <span className="px-1.5 py-0.5 rounded bg-white/5 text-ui-text-dim">{p.tokens_per_second.toFixed(1)} tok/s</span>}
                                                                     <span className="px-1.5 py-0.5 rounded bg-white/5 text-ui-text-dim">{p.ok_calls}/{p.total_calls} candidate ok</span>
                                                                    {p.failed_calls > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">{p.failed_calls} candidate failed</span>}
                                                                    {p.judge_failed_calls > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">{p.judge_failed_calls} judge failed</span>}
                                                                </div>
                                                                <div className="min-w-0 flex-1 text-ui-text-muted">
                                                                    <p>{p.rationale}</p>
                                                                    {p.preview && <p className="mt-0.5 font-mono text-[10px] text-ui-text-dim break-words">Response: {p.preview}</p>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    <p className="text-[10px] text-ui-text-dim pt-1 flex items-center gap-1"><BrainIcon className="w-3 h-3" /> Graded by <code className="text-coral/80">{r.judge || runJudge || 'unknown judge'}</code> (rubric · temp 0)</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Info */}
                {activeView === 'benchmark' && <div className="card-premium overflow-hidden">
                    <div className="px-5 py-4">
                        <p className="text-[11px] text-ui-text-muted leading-relaxed">
                             Pick models, then <strong className="text-ui-text-main">Run</strong>. The CLI benchmarks each on
                             <strong className="text-ui-text-main"> first-token and total latency</strong>, <strong className="text-ui-text-main">throughput</strong>, <strong className="text-ui-text-main">compliance</strong>, <strong className="text-ui-text-main">technical correctness</strong> and
                             <strong className="text-ui-text-main"> calibrated skepticism</strong>. Quick runs four cases; Advanced adds redirect-chain SSRF and ambiguous blind-SQLi evidence for roughly 50% more work.
                             Every answer is graded against explicit criteria by an <strong className="text-ui-text-main">LLM judge</strong>. The composite is <strong className="text-ui-text-main">quality-dominant</strong> — correctness 40%, skepticism 30%, compliance 15%, performance 15% — so a fast-but-weaker model can't win on speed alone; latency and cost are reported as separate axes. Latency is scored on the median (robust to a single slow prompt).
                             Ranking requires at least 6/10 correctness, 7/10 skepticism, 6/10 compliance, and complete-enough prompt coverage. Weights are configurable and each run records the scoring version that produced its scores.
                             Cases map to scanner slots (MUTATION / SKEPTICAL / ANALYSIS / REPORTING) so you can pick the best model per slot, not one global winner. With the MUTATION probe on, that slot's pick blends judge quality with payload diversity at scan temperature — the signal that tracks real-scan recall.
                             The benchmark is isolated from the BugTraceAI scan pipeline; it never changes scanner models or runtime configuration. The API key stays on the CLI server.
                        </p>
                    </div>
                </div>}
            </div>
            <ConfirmDeleteModal
                isOpen={historyDeleteTarget !== null}
                title="Delete benchmark run"
                message={<>Delete <span className="font-bold text-white">run #{historyDeleteTarget?.id}</span> ({historyDeleteTarget?.label}) from ModelLab history?</>}
                confirmLabel="DELETE RUN"
                onConfirm={() => void deleteHistoryRun()}
                onCancel={() => setHistoryDeleteTarget(null)}
            />
        </div>
    );
}
