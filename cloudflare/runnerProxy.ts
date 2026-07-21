export interface RunnerProxyEnvironment {
  STUDIO_RUNNER_ORIGIN?: string;
  STUDIO_RUNNER_API_TOKEN?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const ALLOWED_ROUTES: ReadonlyArray<{
  method: "GET" | "POST";
  path: RegExp;
}> = [
  { method: "GET", path: /^\/api\/health$/ },
  { method: "POST", path: /^\/api\/studio\/runs$/ },
  { method: "GET", path: /^\/api\/studio\/runs\/[0-9a-f-]{36}$/ },
  { method: "GET", path: /^\/api\/studio\/runs\/[0-9a-f-]{36}\/stream$/ },
];

function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function runnerOrigin(environment: RunnerProxyEnvironment): URL | null {
  if (!environment.STUDIO_RUNNER_ORIGIN) return null;
  try {
    const origin = new URL(environment.STUDIO_RUNNER_ORIGIN);
    if (!(["https:", "http:"].includes(origin.protocol))) return null;
    if (origin.pathname !== "/" || origin.search || origin.hash) return null;
    return origin;
  } catch {
    return null;
  }
}

function hasValidAccessPair(environment: RunnerProxyEnvironment): boolean {
  return Boolean(environment.CF_ACCESS_CLIENT_ID) === Boolean(environment.CF_ACCESS_CLIENT_SECRET);
}

function isAllowedRoute(method: string, pathname: string): boolean {
  return ALLOWED_ROUTES.some((route) => route.method === method && route.path.test(pathname));
}

export async function proxyRunnerRequest(
  request: Request,
  environment: RunnerProxyEnvironment,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  if (!isAllowedRoute(request.method, requestUrl.pathname)) {
    return jsonResponse(404, { error: "Not found." });
  }
  const origin = runnerOrigin(environment);
  if (!origin || !environment.STUDIO_RUNNER_API_TOKEN || !hasValidAccessPair(environment)) {
    return jsonResponse(503, { error: "Studio runner proxy is not configured." });
  }

  const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, origin);
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${environment.STUDIO_RUNNER_API_TOKEN}`,
  });
  const contentType = request.headers.get("content-type");
  const idempotencyKey = request.headers.get("idempotency-key");
  if (contentType) headers.set("Content-Type", contentType);
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  if (environment.CF_ACCESS_CLIENT_ID && environment.CF_ACCESS_CLIENT_SECRET) {
    headers.set("CF-Access-Client-Id", environment.CF_ACCESS_CLIENT_ID);
    headers.set("CF-Access-Client-Secret", environment.CF_ACCESS_CLIENT_SECRET);
  }

  try {
    const isEventStream = requestUrl.pathname.endsWith("/stream");
    if (isEventStream) headers.set("Accept", "text/event-stream");
    const upstream = await fetcher(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "POST" ? request.body : undefined,
      redirect: "manual",
      signal: isEventStream ? request.signal : AbortSignal.timeout(15_000),
    });
    if (upstream.status >= 500) {
      console.error(`Studio runner returned upstream status ${upstream.status}.`);
      return jsonResponse(502, { error: "Studio runner is unavailable." });
    }
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["content-type", "location", "retry-after", "www-authenticate"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Studio runner proxy failed", error);
    return jsonResponse(502, { error: "Studio runner is unavailable." });
  }
}
