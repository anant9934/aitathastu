/**
 * AI TATHASTU — SAFE API RESPONSE PARSER V4.2
 *
 * Universal, robust client-side response parser for all resume and onboarding APIs.
 *
 * Architectural Guarantees:
 * 1. NEVER throws SyntaxError: Unexpected token 'A' or unhandled JSON parse exceptions.
 * 2. Correctly inspects response.ok, status code, and Content-Type.
 * 3. Handles HTML and plain-text proxy error pages (e.g. Vercel / Cloudflare 504 Gateway Timeout,
 *    502 Bad Gateway, 500 Internal Error "An error occurred with this application...").
 * 4. Normalizes errors to a consistent contract:
 *    { ok: false, code: string, message: string, retryable: boolean, requestId?: string }
 * 5. Masks raw server stack traces and exposes polite, student-safe error messages.
 */

export interface SafeApiError {
  code: string;
  message: string;
  retryable: boolean;
  requestId?: string;
  status: number;
}

export interface SafeApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: SafeApiError;
  requestId?: string;
  status: number;
}

/**
 * Standard friendly fallback messages by HTTP status code.
 */
const STATUS_MESSAGE_MAP: Record<number, { code: string; message: string; retryable: boolean }> = {
  400: {
    code: "BAD_REQUEST",
    message: "Invalid file or request format. Please choose a valid PDF or DOCX file.",
    retryable: true,
  },
  401: {
    code: "UNAUTHORIZED",
    message: "Your session expired. Please refresh the page to continue.",
    retryable: true,
  },
  403: {
    code: "FORBIDDEN",
    message: "You do not have permission to perform this action.",
    retryable: false,
  },
  413: {
    code: "FILE_TOO_LARGE",
    message: "Your resume exceeds the 5 MB limit. Please use a smaller file or enter details manually.",
    retryable: true,
  },
  415: {
    code: "UNSUPPORTED_MEDIA_TYPE",
    message: "Please choose a PDF or DOCX file, or enter your details manually.",
    retryable: true,
  },
  422: {
    code: "UNPROCESSABLE_ENTITY",
    message: "We couldn't read enough text from this file. It may be scanned or protected. You can enter details manually.",
    retryable: true,
  },
  429: {
    code: "RATE_LIMITED",
    message: "Too many upload requests. Please wait a minute before trying again.",
    retryable: true,
  },
  500: {
    code: "SERVER_ERROR",
    message: "A temporary processing error occurred. Please retry or enter details manually.",
    retryable: true,
  },
  502: {
    code: "BAD_GATEWAY",
    message: "The server is temporarily unavailable. Please try again or enter details manually.",
    retryable: true,
  },
  503: {
    code: "SERVICE_UNAVAILABLE",
    message: "Resume processing is temporarily unavailable. Please try again or enter details manually.",
    retryable: true,
  },
  504: {
    code: "GATEWAY_TIMEOUT",
    message: "Reading your resume took longer than expected. Please try again or continue with manual entry.",
    retryable: true,
  },
};

/**
 * Safely parses any fetch Response into a strongly-typed SafeApiResponse<T>.
 * Guarantees zero unhandled JSON parse exceptions.
 */
export async function parseSafeJsonResponse<T = Record<string, unknown>>(
  response: Response,
  defaultErrorMessage = "Could not process your resume. Please try again or enter details manually."
): Promise<SafeApiResponse<T>> {
  const status = response.status;
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const requestId = response.headers.get("x-request-id") || undefined;

  let rawBodyText = "";
  try {
    rawBodyText = await response.text();
  } catch {
    rawBodyText = "";
  }

  // Handle completely empty responses
  if (!rawBodyText || rawBodyText.trim().length === 0) {
    if (response.ok) {
      return {
        ok: true,
        data: {} as T,
        requestId,
        status,
      };
    }
    const mapped = STATUS_MESSAGE_MAP[status] || {
      code: `HTTP_${status}`,
      message: defaultErrorMessage,
      retryable: status >= 500 || status === 429,
    };
    return {
      ok: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        retryable: mapped.retryable,
        requestId,
        status,
      },
      requestId,
      status,
    };
  }

  // Try JSON parsing safely
  let parsedJson: Record<string, unknown> | null = null;
  const isLikelyJson = contentType.includes("application/json") || rawBodyText.trim().startsWith("{") || rawBodyText.trim().startsWith("[");

  if (isLikelyJson) {
    try {
      parsedJson = JSON.parse(rawBodyText) as Record<string, unknown>;
    } catch {
      parsedJson = null;
    }
  }

  // Case 1: Response is OK and valid JSON
  if (response.ok && parsedJson !== null) {
    // If the server returned an explicit ok: false inside a 200 response
    if (parsedJson.ok === false) {
      const code = typeof parsedJson.code === "string" ? parsedJson.code : `API_ERROR`;
      const message = typeof parsedJson.message === "string" ? parsedJson.message : (typeof parsedJson.error === "string" ? parsedJson.error : defaultErrorMessage);
      const retryable = typeof parsedJson.retryable === "boolean" ? parsedJson.retryable : true;
      const respReqId = typeof parsedJson.requestId === "string" ? parsedJson.requestId : requestId;
      return {
        ok: false,
        error: { code, message, retryable, requestId: respReqId, status },
        requestId: respReqId,
        status,
      };
    }

    return {
      ok: true,
      data: parsedJson as T,
      requestId: typeof parsedJson.requestId === "string" ? parsedJson.requestId : requestId,
      status,
    };
  }

  // Case 2: Response failed, but has JSON error payload
  if (parsedJson !== null) {
    const code = typeof parsedJson.code === "string" ? parsedJson.code : (STATUS_MESSAGE_MAP[status]?.code || `HTTP_${status}`);
    const message =
      typeof parsedJson.message === "string"
        ? parsedJson.message
        : typeof parsedJson.error === "string"
        ? parsedJson.error
        : STATUS_MESSAGE_MAP[status]?.message || defaultErrorMessage;
    const retryable = typeof parsedJson.retryable === "boolean" ? parsedJson.retryable : status >= 500 || status === 429;
    const respReqId = typeof parsedJson.requestId === "string" ? parsedJson.requestId : requestId;

    return {
      ok: false,
      error: { code, message, retryable, requestId: respReqId, status },
      requestId: respReqId,
      status,
    };
  }

  // Case 3: Non-JSON body (e.g. HTML 504 / 502 / 500 error page starting with "An error occurred...")
  const mapped = STATUS_MESSAGE_MAP[status] || {
    code: `HTTP_${status}`,
    message: defaultErrorMessage,
    retryable: status >= 500 || status === 429,
  };

  return {
    ok: false,
    error: {
      code: mapped.code,
      message: mapped.message,
      retryable: mapped.retryable,
      requestId,
      status,
    },
    requestId,
    status,
  };
}
