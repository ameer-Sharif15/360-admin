/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        'ws',
        'bufferutil',
        'utf-8-validate',
      ];
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;



