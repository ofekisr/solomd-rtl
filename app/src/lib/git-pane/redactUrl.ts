const CREDENTIALS_IN_URL = /^([a-z][a-z0-9+.-]*:\/\/)[^@/]+@/i

export function redactUrl(url: string): string {
  return url.replace(CREDENTIALS_IN_URL, '$1')
}
