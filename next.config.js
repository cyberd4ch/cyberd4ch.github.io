/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tells Next.js to build a static HTML site in the /out directory
  output: 'export',

  // Emit /path/index.html so directory URLs resolve on GitHub Pages
  trailingSlash: true,
  
  images: {
    // Disables server-side image optimization
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
    ],
  },
}

module.exports = nextConfig