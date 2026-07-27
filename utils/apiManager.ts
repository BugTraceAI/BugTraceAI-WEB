// utils/apiManager.ts
// Centralized module for managing aggregate API state like rate limiting, call counts, and cancellation.

const RATE_LIMIT_MS = 500; // 0.5 seconds = 2 requests per second
const MAX_CONTINUOUS_FAILURES = 10;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30 seconds
// Hard per-request timeout. If a provider/model never responds (hung or unavailable), the request
// is aborted so it REJECTS instead of hanging forever and deadlocking the chat's send button.
const API_REQUEST_TIMEOUT_MS = 120000; // 2 minutes — generous for a long completion, but bounded
// Sentinel abort reason so the UI can tell a timeout (show an error) from a user stop (silent).
export const TIMEOUT_ABORT_REASON = 'BUGTRACE_REQUEST_TIMEOUT';

let nextAllowedApiCallTimestamp = 0;
let continuousFailureCount = 0;
let circuitBreakerCooldownUntil = 0;


// --- Circuit Breaker ---
const checkCircuitBreaker = () => {
    const now = Date.now();
    if (circuitBreakerCooldownUntil > now) {
        const timeLeft = ((circuitBreakerCooldownUntil - now) / 1000).toFixed(1);
        throw new Error(`Circuit breaker active due to repeated failures. Please wait ${timeLeft}s.`);
    }
};

const tripCircuitBreaker = () => {
    circuitBreakerCooldownUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(`Circuit breaker tripped. API calls suspended for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000} seconds.`);
};

const incrementContinuousFailureCount = () => {
    continuousFailureCount++;
    if (continuousFailureCount >= MAX_CONTINUOUS_FAILURES) {
        tripCircuitBreaker();
    }
};

const resetContinuousFailureCount = () => {
    continuousFailureCount = 0;
    circuitBreakerCooldownUntil = 0; // Also reset cooldown if a call succeeds
};


// --- Rate Limiting ---
export const enforceRateLimit = async () => {
    const now = Date.now();
    const reservedSlot = Math.max(now, nextAllowedApiCallTimestamp);
    nextAllowedApiCallTimestamp = reservedSlot + RATE_LIMIT_MS;

    if (reservedSlot > now) {
        const delay = reservedSlot - now;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
};

export const updateRateLimitTimestamp = () => {
    nextAllowedApiCallTimestamp = Math.max(nextAllowedApiCallTimestamp, Date.now());
};

// --- API Call Counter (Pub/Sub) ---
let apiCallCount = 0;
const countListeners: Set<(count: number) => void> = new Set();

export const getApiCallCount = () => apiCallCount;

export const incrementApiCallCount = () => {
    apiCallCount++;
    countListeners.forEach(listener => listener(apiCallCount));
};

export const subscribeToApiCallCount = (callback: (count: number) => void): (() => void) => {
    countListeners.add(callback);
    return () => countListeners.delete(callback); // Unsubscribe function
};

// --- Request Cancellation (AbortController) & Status ---
type RequestStatus = 'idle' | 'active' | 'stopping';

const activeAbortControllers: Set<AbortController> = new Set();
// Per-controller timeout timers, so finishApiRequest can cancel the timer once a request settles.
const requestTimeouts: Map<AbortController, ReturnType<typeof setTimeout>> = new Map();
let requestStatus: RequestStatus = 'idle';
const statusListeners: Set<(status: RequestStatus) => void> = new Set();

export const getRequestStatus = () => requestStatus;

const notifyRequestStatus = (status: RequestStatus) => {
    requestStatus = status;
    statusListeners.forEach(listener => listener(requestStatus));
}

const syncRequestStatus = () => {
    if (activeAbortControllers.size === 0) {
        notifyRequestStatus('idle');
    } else if (requestStatus !== 'stopping') {
        notifyRequestStatus('active');
    }
};

export const setRequestStatus = (status: RequestStatus) => {
    notifyRequestStatus(status);
}

export const subscribeToRequestStatus = (callback: (status: RequestStatus) => void): (() => void) => {
    statusListeners.add(callback);
    return () => statusListeners.delete(callback);
}

export const beginApiRequest = (): AbortController => {
    checkCircuitBreaker();
    const controller = new AbortController();
    activeAbortControllers.add(controller);
    // Arm the hard timeout: a hung/unavailable model aborts (with a distinct reason) instead of
    // hanging forever. finishApiRequest clears this the moment the request settles.
    const timer = setTimeout(() => controller.abort(TIMEOUT_ABORT_REASON), API_REQUEST_TIMEOUT_MS);
    requestTimeouts.set(controller, timer);
    notifyRequestStatus('active');
    return controller;
};

export const finishApiRequest = (controller: AbortController) => {
    const timer = requestTimeouts.get(controller);
    if (timer) clearTimeout(timer);
    requestTimeouts.delete(controller);
    activeAbortControllers.delete(controller);
    syncRequestStatus();
};

// True when a controller was aborted by the hard timeout (vs. the user's stop button). Lets the
// I/O layer surface a real error for a timeout while keeping an intentional cancel silent.
export const isTimeoutAbort = (controller: AbortController): boolean =>
    controller.signal.reason === TIMEOUT_ABORT_REASON;

export const getNewAbortSignal = (): AbortSignal => {
    return beginApiRequest().signal;
};

export const abortCurrentRequest = () => {
    if (activeAbortControllers.size > 0) {
        notifyRequestStatus('stopping');
        activeAbortControllers.forEach(controller => {
            controller.abort("Request explicitly cancelled by user via stop button.");
        });
    }
};

export const clearAbortController = () => {
    requestTimeouts.forEach(timer => clearTimeout(timer));
    requestTimeouts.clear();
    activeAbortControllers.clear();
    syncRequestStatus();
};

// Export failure handlers for use in Service.ts
export { incrementContinuousFailureCount, resetContinuousFailureCount };
