/**
 * Canonical resume upload limit, shared by the browser and every server route.
 *
 * Why 4 MB: Netlify synchronous functions reject request payloads over 6 MB,
 * and binary bodies are base64-encoded on the way in (about +33%). 4 MB of
 * file plus multipart overhead stays under that ceiling. The Python
 * extractor is configured with the same value (MAX_UPLOAD_MB in render.yaml
 * and its config default) so a file accepted here is never rejected there.
 */
export const RESUME_MAX_UPLOAD_MB = 4;
export const RESUME_MAX_UPLOAD_BYTES = RESUME_MAX_UPLOAD_MB * 1024 * 1024;
