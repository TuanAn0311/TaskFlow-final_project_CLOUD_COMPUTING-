import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  return octets[0] === 0
    || octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function isPrivateIpv6(hostname) {
  if (!hostname.startsWith('[') || !hostname.endsWith(']')) return false;
  const address = hostname.slice(1, -1).toLowerCase();
  return address === '::'
    || address === '::1'
    || address.startsWith('::ffff:')
    || /^f[cd]/i.test(address)
    || /^fe[89ab]/i.test(address);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = (process.env.VITE_API_URL || env.VITE_API_URL || '').trim();

  if (mode === 'production') {
    if (!apiUrl) {
      throw new Error('VITE_API_URL must be set to the deployed API before building for production.');
    }
    const parsedApiUrl = new URL(/^https?:\/\//i.test(apiUrl) ? apiUrl : `https://${apiUrl}`);
    const hostname = parsedApiUrl.hostname.toLowerCase();
    if (parsedApiUrl.protocol !== 'https:'
      || hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname.endsWith('.local')
      || isPrivateIpv6(hostname)
      || hostname === '10.0.2.2'
      || isPrivateIpv4(hostname)) {
      throw new Error('Production VITE_API_URL must use HTTPS and a publicly reachable API hostname.');
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
  };
});
