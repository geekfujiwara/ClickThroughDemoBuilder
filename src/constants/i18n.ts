export type AppLanguage = 'ja' | 'en';

let currentLanguage: AppLanguage = 'en';
const listeners = new Set<(language: AppLanguage) => void>();

export function getCurrentLanguage(): AppLanguage {
  return currentLanguage;
}

export function setCurrentLanguage(language: AppLanguage): void {
  if (currentLanguage === language) return;
  currentLanguage = language;
  listeners.forEach((listener) => listener(language));
}

export function onLanguageChange(listener: (language: AppLanguage) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
