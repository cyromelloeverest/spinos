export function faviconUrl(sourceUrl: string): string | null {
  try {
    const hostname = new URL(sourceUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return null;
  }
}
