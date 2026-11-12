import type { NextConfig } from 'next';

// API_ORIGIN is a public service address, not a secret. Inline it into the
// Next.js server bundle because Netlify build-time vars are not automatically
// present in the runtime environment of deployed Functions.
const apiOrigin = (
  process.env.API_ORIGIN ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
).replace(/\/+$/, '');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    API_ORIGIN: apiOrigin,
  },
};

export default nextConfig;
