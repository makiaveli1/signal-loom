type EnvLike = Record<string, string | undefined>;

export type RuntimeConfigTone = 'ok' | 'warn' | 'danger' | 'neutral';

export type RuntimeConfigIssue = {
  code: 'invalid_api_url' | 'non_loopback_api_url' | 'missing_token' | 'legacy_token_source' | 'public_api_url_source';
  tone: Exclude<RuntimeConfigTone, 'ok' | 'neutral'>;
  message: string;
};

export type RuntimeConfigResolution = {
  apiUrl: string;
  apiUrlSource: string;
  apiUrlValid: boolean;
  apiUrlLoopback: boolean;
  token: string;
  tokenSource: string | null;
  mockDataEnabled: boolean;
  installEnabled: boolean;
  issues: RuntimeConfigIssue[];
};

export type RuntimeConfigTruth = {
  api: {
    url: string;
    source: string;
    valid: boolean;
    loopback: boolean;
  };
  auth: {
    tokenPresent: boolean;
    tokenSource: string | null;
    acceptedSources: string[];
  };
  flags: {
    mockDataEnabled: boolean;
    installEnabled: boolean;
  };
  issues: RuntimeConfigIssue[];
};

const API_URL_KEYS = [
  'HERMES_API_URL',
  'NEXT_PUBLIC_HERMES_API_URL',
  'NEXT_PUBLIC_OPENCLAW_GATEWAY_URL',
] as const;

const TOKEN_KEYS = [
  'HERMES_API_KEY',
  'API_SERVER_KEY',
  'OPENCLAW_GATEWAY_TOKEN',
] as const;

const DEFAULT_API_URL = 'http://127.0.0.1:8642';

function firstPresent(env: EnvLike, keys: readonly string[], fallback: string) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return { key, value };
  }
  return { key: 'default', value: fallback };
}

function firstToken(env: EnvLike) {
  for (const key of TOKEN_KEYS) {
    const value = env[key]?.trim();
    if (value) return { key, value };
  }
  return { key: null, value: '' };
}

function normalizeApiUrl(raw: string) {
  return raw.trim().replace(/\/+$/, '') || DEFAULT_API_URL;
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === '0.0.0.0'
    || normalized === '::1'
    || normalized === '[::1]'
    || normalized.startsWith('127.');
}

function booleanEnv(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

function inspectApiUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl);
    const validProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    return {
      valid: validProtocol,
      loopback: validProtocol && isLoopbackHostname(parsed.hostname),
    };
  } catch {
    return { valid: false, loopback: false };
  }
}

function displaySafeApiUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl);
    if (parsed.username) parsed.username = '[redacted]';
    if (parsed.password) parsed.password = '[redacted]';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/(key|token|secret|authorization|auth|password)/i.test(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return apiUrl;
  }
}

export function resolveSignalLoomRuntimeConfig(env: EnvLike = process.env): RuntimeConfigResolution {
  const api = firstPresent(env, API_URL_KEYS, DEFAULT_API_URL);
  const token = firstToken(env);
  const apiUrl = normalizeApiUrl(api.value);
  const apiInspection = inspectApiUrl(apiUrl);
  const issues: RuntimeConfigIssue[] = [];

  if (!apiInspection.valid) {
    issues.push({
      code: 'invalid_api_url',
      tone: 'danger',
      message: 'Hermes API URL must be a valid http:// or https:// URL.',
    });
  } else if (!apiInspection.loopback) {
    issues.push({
      code: 'non_loopback_api_url',
      tone: 'warn',
      message: 'Hermes API URL is not loopback. Keep Signal Loom pointed at a trusted local runtime unless you add authentication review.',
    });
  }

  if (!token.key) {
    issues.push({
      code: 'missing_token',
      tone: 'warn',
      message: 'No Hermes API token env var is set. Read-only checks may work, but chat send can fail if the API requires auth.',
    });
  } else if (token.key === 'OPENCLAW_GATEWAY_TOKEN') {
    issues.push({
      code: 'legacy_token_source',
      tone: 'warn',
      message: 'Using legacy OPENCLAW_GATEWAY_TOKEN. Prefer HERMES_API_KEY or API_SERVER_KEY for new Signal Loom setups.',
    });
  }

  if (api.key !== 'HERMES_API_URL' && api.key !== 'default') {
    issues.push({
      code: 'public_api_url_source',
      tone: 'warn',
      message: 'Server routes are using a NEXT_PUBLIC API URL fallback. Prefer private HERMES_API_URL so runtime configuration has one server-side source of truth.',
    });
  }

  return {
    apiUrl,
    apiUrlSource: api.key,
    apiUrlValid: apiInspection.valid,
    apiUrlLoopback: apiInspection.loopback,
    token: token.value,
    tokenSource: token.key,
    mockDataEnabled: booleanEnv(env.NEXT_PUBLIC_USE_MOCK_DATA),
    installEnabled: booleanEnv(env.SIGNAL_LOOM_ENABLE_INSTALL),
    issues,
  };
}

export function buildRuntimeConfigTruth(env: EnvLike = process.env): RuntimeConfigTruth {
  const config = resolveSignalLoomRuntimeConfig(env);
  return {
    api: {
      url: displaySafeApiUrl(config.apiUrl),
      source: config.apiUrlSource,
      valid: config.apiUrlValid,
      loopback: config.apiUrlLoopback,
    },
    auth: {
      tokenPresent: Boolean(config.token),
      tokenSource: config.tokenSource,
      acceptedSources: [...TOKEN_KEYS],
    },
    flags: {
      mockDataEnabled: config.mockDataEnabled,
      installEnabled: config.installEnabled,
    },
    issues: config.issues,
  };
}
