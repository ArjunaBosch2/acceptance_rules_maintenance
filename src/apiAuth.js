export const getAuthCredentials = () => {
  if (typeof window === 'undefined') return null;
  const user = window.sessionStorage.getItem('authUser') || '';
  const pass = window.sessionStorage.getItem('authPass') || '';
  if (!user || !pass) return null;
  return { user, pass };
};

export const setAuthCredentials = (user, pass) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem('authUser', user);
  window.sessionStorage.setItem('authPass', pass);
  window.dispatchEvent(new CustomEvent('authChange'));
};

export const clearAuthCredentials = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem('authUser');
  window.sessionStorage.removeItem('authPass');
  window.dispatchEvent(new CustomEvent('authChange'));
};

export const getAuthHeader = () => {
  const creds = getAuthCredentials();
  if (!creds) return {};
  const token = btoa(`${creds.user}:${creds.pass}`);
  return { Authorization: `Basic ${token}` };
};
