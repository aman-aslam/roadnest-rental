import { proxyToBackend } from '@/lib/backend-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handle(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  return proxyToBackend(request, 'api', path);
}

export {
  handle as GET,
  handle as HEAD,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
};
