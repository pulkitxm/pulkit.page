function parseJson(text: string | null): unknown {
  return text === null ? undefined : JSON.parse(text);
}

export function readStoredJson(key: string): unknown {
  let stored: unknown;
  try {
    stored = parseJson(localStorage.getItem(key));
  } catch {}
  return stored;
}

export function writeStoredJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
