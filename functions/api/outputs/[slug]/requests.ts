import { submitProposalRequest } from "../../../../server/proposalRequests";
import type { RequestEnv } from "../../../../server/proposalRequests";

export async function onRequestPost({ request, env, params }: {
  request: Request;
  env: RequestEnv;
  params: { slug: string };
}) {
  return submitProposalRequest(request, env, params.slug);
}
