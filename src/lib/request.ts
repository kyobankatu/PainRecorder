export function getClientIp(headers?: Headers | Record<string, string | string[] | undefined>) {
  if (!headers) {
    return 'unknown';
  }

  const forwardedFor = getHeader(headers, 'x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return getHeader(headers, 'x-real-ip') || 'unknown';
}

function getHeader(headers: Headers | Record<string, string | string[] | undefined>, name: string) {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
