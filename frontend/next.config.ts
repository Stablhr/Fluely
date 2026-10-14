import type {NextConfig} from 'next';

/**
 * Where same-origin `/api/*` requests are forwarded.
 *
 * The browser talks only to this app, and these rewrites forward the request to
 * the auth API. That keeps the API same-site with the page, so the session
 * cookies are first-party: third-party-cookie blocking cannot silently drop
 * them, which is what signed people out on browsers that enforce it.
 *
 * Local development does not use this -- it sets NEXT_PUBLIC_API_URL to the
 * absolute backend URL and calls it directly. Set API_PROXY_ORIGIN to forward
 * elsewhere (e.g. http://localhost:5000) if a same-origin dev setup is wanted.
 */
const API_PROXY_ORIGIN =
  process.env.API_PROXY_ORIGIN ?? 'https://fluelylogin.vercel.app';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_ORIGIN}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
