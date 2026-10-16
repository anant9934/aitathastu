/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https:; frame-ancestors 'none';",
  },
];

const nextConfig = {
  // Lets a local verification server (pointed at the test database) build
  // beside a running dev server without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist", "mammoth", "@electric-sql/pglite", "postgres", "tesseract.js", "tesseract.js-core"],
  // pdf.js loads these at runtime from a computed path (pdfjsAssetDir in
  // lib/resume/document-text.ts), which file tracing cannot see, so they are
  // listed explicitly for the resume routes. OCR never runs inside Next
  // functions: scanned PDFs go to the Python extractor.
  outputFileTracingIncludes: {
    "/api/resume/**": [
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
    ],
  },
  // Lint gates the production build (npm run build fails on lint errors).
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    webpackBuildWorker: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

};

export default nextConfig;
