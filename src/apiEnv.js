const getApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (!configured) return window.location.origin;
  return configured.endsWith('/') ? configured.slice(0, -1) : configured;
};

export const getApiEnv = () => {
  if (typeof window === 'undefined') return 'production';
  return window.localStorage.getItem('apiEnv') || 'production';
};

export const setApiEnv = (env) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('apiEnv', env);
    window.dispatchEvent(new CustomEvent('apiEnvChange', { detail: env }));
  }
};

export const withApiEnv = (path, envOverride) => {
  const url = new URL(path, getApiBaseUrl());
  const env = envOverride || getApiEnv();
  if (env) {
    url.searchParams.set('env', env);
  }
  if (!import.meta.env.VITE_API_BASE_URL) {
    return `${url.pathname}${url.search}`;
  }
  return `${url.origin}${url.pathname}${url.search}`;
};
