/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // qz-tray usa WebSocket y window — solo válido en el cliente, no bundlear en servidor
    serverComponentsExternalPackages: ['qz-tray'],
  },
}

export default nextConfig
