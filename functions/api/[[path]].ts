import {
  routeCloudflareRequest,
  type CloudflareAppEnvironment,
} from "../../cloudflare/appRouter";

interface PagesFunctionContext<Environment> {
  request: Request;
  env: Environment;
}

export function onRequest(
  context: PagesFunctionContext<CloudflareAppEnvironment>,
): Promise<Response> {
  return routeCloudflareRequest(context.request, context.env);
}
