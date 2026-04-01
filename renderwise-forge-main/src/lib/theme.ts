export function getTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('dgat-theme') as 'dark' | 'light') || 'dark';
}

export function setTheme(theme: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('dgat-theme', theme);
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

// Initialize theme on load
export function initTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
}
