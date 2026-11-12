const REQUEST_HEADERS = [
  'accept',
  'authorization',
  'content-type',
  'cookie',
  'if-modified-since',
  'if-none-match',
  'range',
] as const;

const RESPONSE_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-disposition',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
  'location',
  'retry-after',
  'vary',
  'x-content-type-options',
] as const;

type BackendPath = 'api' | 'vehicle-images';

function getBackendOrigin(): string {
  const configuredOrigin = process.env.API_ORIGIN?.trim();
  const origin = configuredOrigin || (
    process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : ''
  );

  if (!origin) {
    throw new Error('API_ORIGIN is not configured for this deployment.');
  }

  const parsed = new URL(origin);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('API_ORIGIN must use HTTP or HTTPS.');
  }

  return parsed.origin;
}

function makeUpstreamUrl(
  backendPath: BackendPath,
  pathSegments: string[],
  requestUrl: URL,
): URL {
  const encodedPath = pathSegments.map(segment => encodeURIComponent(segment)).join('/');
  const url = new URL(
    `${backendPath}/${encodedPath}`,
    `${getBackendOrigin()}/`,
  );

  url.search = requestUrl.search;
  return url;
}

export async function proxyToBackend(
  request: Request,
  backendPath: BackendPath,
  pathSegments: string[],
): Promise<Response> {
  let upstreamUrl: URL;

  try {
    upstreamUrl = makeUpstreamUrl(
      backendPath,
      pathSegments,
      new URL(request.url),
    );
  } catch (error) {
    console.error('[RoadNest proxy] Invalid backend configuration:', error);
    return Response.json(
      { message: 'RoadNest API proxy is not configured correctly.' },
      { status: 500 },
    );
  }

  const headers = new Headers();
  for (const headerName of REQUEST_HEADERS) {
    const value = request.headers.get(headerName);
    if (value) headers.set(headerName, value);
  }

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(method)) {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers();

    for (const headerName of RESPONSE_HEADERS) {
      const value = upstream.headers.get(headerName);
      if (value !== null) responseHeaders.set(headerName, value);
    }

    // Preserve all Set-Cookie headers separately. This is essential for the
    // HTTP-only rn_token session cookie used by login, registration and logout.
    const headersWithCookies = upstream.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookies = headersWithCookies.getSetCookie?.() ?? [];
    for (const setCookie of setCookies) {
      responseHeaders.append('set-cookie', setCookie);
    }

    // Fallback for runtimes that expose only the combined header. The backend
    // currently sets one session cookie, so this remains safe for this API.
    if (setCookies.length === 0) {
      const setCookie = upstream.headers.get('set-cookie');
      if (setCookie) responseHeaders.set('set-cookie', setCookie);
    }

    const hasNoResponseBody =
      method === 'HEAD' ||
      [204, 205, 304].includes(upstream.status);

    const body = hasNoResponseBody
      ? null
      : await upstream.arrayBuffer();

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[RoadNest proxy] Backend request failed:', {
      backendPath,
      path: pathSegments.join('/'),
      error,
    });

    return Response.json(
      { message: 'RoadNest API is temporarily unavailable. Please try again.' },
      { status: 502 },
    );
  }
}
