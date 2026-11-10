export function shouldUseSecureSessionCookie(
  environment: NodeJS.ProcessEnv = process.env
) {
  const explicitValue = environment.SESSION_COOKIE_SECURE?.trim().toLowerCase();

  if (explicitValue === "true") return true;
  if (explicitValue === "false") return false;

  const appUrl = environment.APP_URL?.trim();

  try {
    if (appUrl && new URL(appUrl).protocol === "http:") {
     return false;
    }
  } catch {
    // An absent or malformed public URL must not weaken production cookies.
  }

  return environment.NODE_ENV === "production";
}
