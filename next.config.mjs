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
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
  },
];

const nextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist", "mammoth", "@electric-sql/pglite", "postgres", "tesseract.js", "tesseract.js-core"],
  // pdf.js loads these at runtime from a computed path (pdfjsAssetDir in
  // document-parser-service.ts), which file tracing cannot see, so they are
  // listed explicitly for the resume routes. OCR (tesseract + model) never
  // runs inside Next functions (scanned PDFs go to the Python extractor);
  // tracing still picks those files up because the shared parser module
  // references them for the benchmark scripts, but no route executes that code.
  outputFileTracingIncludes: {
    // cmaps (*.bcmap) are not picked up by this mechanism in local builds;
    // they are added for Netlify via included_files in netlify.toml.
    "/api/resume/**": ["./node_modules/pdfjs-dist/standard_fonts/*"],
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
