import en from "./locales/en.json" with { type: "json" };

type Dict = Record<string, string>;

/**
 * Registered locale dictionaries. `en` is the source of truth and the fallback.
 * Add more by importing the JSON and assigning it here (e.g. `de: deDict`).
 */
const LOCALES: Record<string, Dict> = {
  en: en as Dict,
};

export const SUPPORTED_LANGUAGES = Object.keys(LOCALES);

export function isSupportedLanguage(lang: string): boolean {
  return lang in LOCALES;
}

/**
 * Translate a key for a language, interpolating {name} vars.
 * Falls back to English, then to the raw key.
 */
export function t(
  key: string,
  lang = "en",
  vars: Record<string, string | number> = {},
): string {
  const dict = LOCALES[lang] ?? LOCALES.en!;
  const template = dict[key] ?? LOCALES.en![key] ?? key;
  return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (whole, name: string) => {
    const v = vars[name];
    return v === undefined ? whole : String(v);
  });
}
