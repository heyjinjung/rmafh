import { proxyToUpstream } from '../../../../../../lib/apiProxy';

export default async function handler(req, res) {
  const jobId = req.query?.jobId;
  return proxyToUpstream(req, res, {
    upstreamPath: `/api/vault/admin/jobs/${encodeURIComponent(String(jobId))}/items`,
    allowedMethods: ['GET'],
  });
}
