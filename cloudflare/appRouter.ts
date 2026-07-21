import {
  handleCloudflareEvidenceRequest,
  type CloudflareEvidenceEnvironment,
  type EvidenceApiOptions,
} from "./evidenceApi";
import {
  proxyRunnerRequest,
  type RunnerProxyEnvironment,
} from "./runnerProxy";

export interface CloudflareAppEnvironment
  extends RunnerProxyEnvironment, CloudflareEvidenceEnvironment {}

export interface CloudflareAppRouterOptions extends EvidenceApiOptions {
  runnerFetcher?: typeof fetch;
}

export function routeCloudflareRequest(
  request: Request,
  environment: CloudflareAppEnvironment,
  options: CloudflareAppRouterOptions = {},
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/api/evidence/")) {
    return handleCloudflareEvidenceRequest(request, environment, options);
  }
  return proxyRunnerRequest(request, environment, options.runnerFetcher ?? fetch);
}
