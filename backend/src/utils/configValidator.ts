import ini from 'ini';

export interface ValidationError {
  line?: number;
  message: string;
}

export interface ValidationWarning {
  section: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// Required sections in bugtraceaicli.conf
const REQUIRED_SECTIONS = ['CORE', 'LLM_MODELS', 'SCAN'];

// Valid keys per section (subset for validation)
const VALID_KEYS: Record<string, string[]> = {
  CORE: ['DEBUG', 'SAFE_MODE'],
  LLM_MODELS: ['DEFAULT_MODEL', 'CODE_MODEL', 'MUTATION_MODEL', 'MIN_CREDITS'],
  SCAN: ['MAX_DEPTH', 'MAX_URLS', 'MAX_CONCURRENT_URL_AGENTS'],
  SCANNING: ['STOP_ON_CRITICAL', 'MANDATORY_SQLMAP_VALIDATION'],
  ASSET_DISCOVERY: ['ENABLE_ASSET_DISCOVERY'],
  BROWSER: ['HEADLESS'],
};

// Numeric range validations
const NUMERIC_RANGES: Record<string, { min: number; max: number }> = {
  'SCAN.MAX_DEPTH': { min: 1, max: 20 },
  'SCAN.MAX_URLS': { min: 10, max: 1000 },
  'LLM_MODELS.MIN_CREDITS': { min: 0, max: 100 },
};

export function validateConfig(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Try to parse INI
  let parsed: Record<string, any>;
  try {
    parsed = ini.parse(content);
  } catch (error: any) {
    errors.push({
      message: `Parse error: ${error.message}`,
    });
    return { valid: false, errors, warnings };
  }

  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!parsed[section]) {
      errors.push({
        message: `Missing required section: [${section}]`,
      });
    }
  }

  // Validate known keys and values
  for (const [section, values] of Object.entries(parsed)) {
    if (typeof values !== 'object') continue;

    for (const [key, value] of Object.entries(values)) {
      const fullKey = `${section}.${key}`;

      // Check numeric ranges
      if (NUMERIC_RANGES[fullKey]) {
        const numValue = Number(value);
        const { min, max } = NUMERIC_RANGES[fullKey];
        if (isNaN(numValue) || numValue < min || numValue > max) {
          errors.push({
            message: `${fullKey}: Value must be between ${min} and ${max}`,
          });
        }
      }

      // Check boolean values
      if (key === 'DEBUG' || key === 'SAFE_MODE' || key === 'HEADLESS' ||
          key === 'STOP_ON_CRITICAL' || key === 'MANDATORY_SQLMAP_VALIDATION' ||
          key === 'ENABLE_ASSET_DISCOVERY') {
        const strValue = String(value).toLowerCase();
        if (strValue !== 'true' && strValue !== 'false') {
          errors.push({
            message: `${fullKey}: Must be True or False`,
          });
        }
      }
    }

    // Warn about unknown sections
    if (!VALID_KEYS[section] && !['SKEPTICAL_THRESHOLDS', 'OPENROUTER', 'CONDUCTOR',
        'BROWSER_ADVANCED', 'CRAWLER', 'ANALYSIS', 'PATHS', 'VALIDATION', 'REPORT',
        'OPTIMIZATION', 'WAF_BYPASS', 'QLEARNING', 'PARALLELIZATION',
        'URL_PRIORITIZATION', 'THINKING', 'SCANNING', 'ASSET_DISCOVERY',
        'AUTHORITY', 'MANIPULATOR', 'LONEWOLF', 'ANTHROPIC'].includes(section)) {
      warnings.push({
        section,
        message: `Unknown section: [${section}]`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
