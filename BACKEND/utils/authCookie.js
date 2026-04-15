const isProduction = process.env.NODE_ENV === 'production';

const normalizeSameSite = (value) => {
  const candidate = (value || '').toLowerCase();
  if (candidate === 'strict' || candidate === 'lax' || candidate === 'none') {
    return candidate;
  }
  return isProduction ? 'none' : 'lax';
};

const sameSite = normalizeSameSite(process.env.COOKIE_SAME_SITE);
const secureOverride = process.env.COOKIE_SECURE;
const secure =
  sameSite === 'none'
    ? true
    : secureOverride === 'true'
      ? true
      : secureOverride === 'false'
        ? false
        : isProduction;

const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;

export const getTokenCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure,
  sameSite,
  maxAge,
  path: '/',
  ...(domain ? { domain } : {}),
});

export const getTokenClearCookieOptions = () => ({
  httpOnly: true,
  secure,
  sameSite,
  path: '/',
  ...(domain ? { domain } : {}),
});
