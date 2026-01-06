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
  const url = new URL(path, window.location.origin);
  const env = envOverride || getApiEnv();
  if (env) {
    url.searchParams.set('env', env);
  }
  return `${url.pathname}${url.search}`;
};
