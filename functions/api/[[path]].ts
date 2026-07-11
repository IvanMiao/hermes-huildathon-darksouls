import {
  proxyRunnerRequest,
  type RunnerProxyEnvironment,
} from "../../cloudflare/runnerProxy";

interface PagesFunctionContext<Environment> {
  request: Request;
  env: Environment;
}

export function onRequest(
  context: PagesFunctionContext<RunnerProxyEnvironment>,
): Promise<Response> {
  return proxyRunnerRequest(context.request, context.env);
}
