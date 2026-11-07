function configuredOrigin(): string | null {
  const raw = process.env.APP_URL?.trim();

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    return null;
  }

  try {
    const url = new URL(raw);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      (url.pathname !== "" && url.pathname !== "/") ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Validates a browser Origin against the explicitly configured public app URL.
 * Host and forwarded headers are intentionally ignored because they are
 * client-controlled unless a trusted proxy has already normalized them.
 */
export function isAllowedOrigin(request: Request): boolean {
  const requestOrigin = request.headers.get("origin")?.trim();

  if (!requestOrigin) return false;

  let normalizedRequestOrigin: string;
  try {
    const url = new URL(requestOrigin);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return false;
    }

    normalizedRequestOrigin = url.origin;
  } catch {
    return false;
  }

  const allowedOrigin = configuredOrigin();
  const configuredAppUrl = process.env.APP_URL?.trim();

  // A supplied but invalid APP_URL must never silently fall back to the
  // request URL, even in development.
  if (configuredAppUrl && !allowedOrigin) return false;

  if (allowedOrigin) {
    return normalizedRequestOrigin === allowedOrigin;
  }

  // Development/test fallback preserves local behavior. Production fails
  // closed when APP_URL is missing or malformed.
  if (process.env.NODE_ENV === "production") return false;

  try {
    return normalizedRequestOrigin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
