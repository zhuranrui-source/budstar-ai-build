export function adminSessionRedirect(
  hasVerifiedSession: boolean,
  loginOnly: boolean,
): '/login' | '/' | null {
  if (!hasVerifiedSession && !loginOnly) return '/login';
  if (hasVerifiedSession && loginOnly) return '/';
  return null;
}
