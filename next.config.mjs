/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    '0.0.0.0:3000',
  ],

  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 80, 85, 90, 100],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'dummyimage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },

  async rewrites() {
    const isVercel = Boolean(process.env.VERCEL);
    // In non-Vercel environments (local dev, Cloud Run, Docker containers), Next.js proxies
    // /api/* requests directly to the co-located Express backend server on port 5000.
    const apiProxy = !isVercel
      ? [
          {
            source: '/api/:path*',
            destination: `http://127.0.0.1:${process.env.BACKEND_PORT || 5000}/api/:path*`,
          },
        ]
      : [];

    return {
      beforeFiles: [
        ...apiProxy,
      ],
      afterFiles: [
        // Admin
        { source: '/admin/produk', destination: '/admin/products' },
        { source: '/admin/produk/:path*', destination: '/admin/products/:path*' },

        { source: '/admin/kategori', destination: '/admin/categories' },
        { source: '/admin/kategori/:path*', destination: '/admin/categories/:path*' },

        { source: '/admin/pesanan', destination: '/admin/orders' },
        { source: '/admin/pesanan/:path*', destination: '/admin/orders/:path*' },

        { source: '/admin/galeri', destination: '/admin/gallery' },
        { source: '/admin/galeri/:path*', destination: '/admin/gallery/:path*' },

        { source: '/admin/pelanggan', destination: '/admin/customers' },
        { source: '/admin/pelanggan/:path*', destination: '/admin/customers/:path*' },

        { source: '/admin/pengaturan', destination: '/admin/settings' },
        { source: '/admin/pengaturan/:path*', destination: '/admin/settings/:path*' },

        { source: '/admin/ulasan', destination: '/admin/reviews' },
        { source: '/admin/ulasan/:path*', destination: '/admin/reviews/:path*' },

        { source: '/admin/analitik', destination: '/admin/analytics' },
        { source: '/admin/analitik/:path*', destination: '/admin/analytics/:path*' },

        { source: '/admin/stok', destination: '/admin/stock' },
        { source: '/admin/stok/:path*', destination: '/admin/stock/:path*' },

        { source: '/admin/keranjang', destination: '/admin/cart' },
        { source: '/admin/keranjang/:path*', destination: '/admin/cart/:path*' },

        { source: '/admin/kontak', destination: '/admin/contacts' },
        { source: '/admin/kontak/:path*', destination: '/admin/contacts/:path*' },

        { source: '/admin/beranda', destination: '/admin/homepage' },
        { source: '/admin/beranda/:path*', destination: '/admin/homepage/:path*' },

        { source: '/admin/profil', destination: '/admin/profile' },
        { source: '/admin/profil/:path*', destination: '/admin/profile/:path*' },

        { source: '/admin/hero-banners', destination: '/admin/homepage' },
        { source: '/admin/hero-banners/:path*', destination: '/admin/homepage/:path*' },

        { source: '/admin/hero-benefits', destination: '/admin/homepage' },
        { source: '/admin/hero-benefits/:path*', destination: '/admin/homepage/:path*' },

        // Public
        { source: '/tentang', destination: '/about' },
        { source: '/tentang/:path*', destination: '/about/:path*' },
        { source: '/tentang-kami', destination: '/about' },
        { source: '/tentang-kami/:path*', destination: '/about/:path*' },

        { source: '/hubungi-kami', destination: '/contact' },
        { source: '/hubungi-kami/:path*', destination: '/contact/:path*' },
        { source: '/kontak', destination: '/contact' },
        { source: '/kontak/:path*', destination: '/contact/:path*' },

        { source: '/produk', destination: '/products' },
        { source: '/produk/:path*', destination: '/products/:path*' },

        { source: '/kategori', destination: '/categories' },
        { source: '/kategori/:path*', destination: '/categories/:path*' },

        { source: '/basis-pengetahuan', destination: '/knowledge-base' },
        { source: '/basis-pengetahuan/:path*', destination: '/knowledge-base/:path*' },

        { source: '/cart', destination: '/keranjang' },
        { source: '/cart/:path*', destination: '/keranjang/:path*' },

        { source: '/pesanan', destination: '/account/transactions' },
        { source: '/pesanan/:id', destination: '/account/transactions/:id' },
        { source: '/pesanan/:path*', destination: '/account/transactions/:path*' },
        { source: '/transaksi', destination: '/account/transactions' },
        { source: '/transaksi/:id', destination: '/account/transactions/:id' },
        { source: '/transaksi/:path*', destination: '/account/transactions/:path*' },

        { source: '/akun', destination: '/account' },
        { source: '/akun/transaksi', destination: '/account/transactions' },
        { source: '/akun/transaksi/:id', destination: '/account/transactions/:id' },
        { source: '/akun/transaksi/:path*', destination: '/account/transactions/:path*' },
        { source: '/akun/:path*', destination: '/account/:path*' },

        { source: '/profil', destination: '/account' },
        { source: '/profil/:path*', destination: '/account/:path*' },

        { source: '/profile', destination: '/account' },
        { source: '/profile/:path*', destination: '/account/:path*' },
      ],
      fallback: []
    };
  },
};

export default nextConfig;