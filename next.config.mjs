import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  compress: true,
  poweredByHeader: false,
  images: {},
  async headers() {
    // Only cache static assets in production. In dev mode chunks are not
    // content-hashed so setting immutable causes the browser to permanently
    // cache stale JS bundles across HMR rebuilds.
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  // Prevent Next.js from bundling pdf-parse — it pulls in @napi-rs/canvas
  // which is a native module and breaks the module evaluation at compile time.
  serverExternalPackages: ["pdf-parse"],

  webpack: (config) => {
    // pdfjs-dist v5's pdf.mjs ships its own internal webpack runtime that
    // declares `var __webpack_exports__ = {}` at module scope.  Because `var`
    // is hoisted, this shadows webpack 5's own __webpack_exports__ PARAMETER
    // before it is assigned, leaving it `undefined` when webpack calls
    // Object.defineProperty on it → "Object.defineProperty called on
    // non-object".  The custom loader below renames the single conflicting
    // declaration so the outer parameter is no longer shadowed.
    config.module.rules.push({
      test: /node_modules[\\/]pdfjs-dist[\\/]build[\\/]pdf\.mjs$/,
      use: [
        {
          loader: resolve(
            __dirname,
            "./lib/webpack-loaders/pdfjs-compat-loader.js",
          ),
        },
      ],
    });

    // pdfjs uses an optional canvas package; exclude it from the browser build.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };

    return config;
  },
};

export default nextConfig;
