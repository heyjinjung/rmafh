import { proxyToUpstream } from '../../../../../../lib/apiProxy';

export default async function handler(req, res) {
  const segmentId = req.query?.segmentId;
  return proxyToUpstream(req, res, {
    upstreamPath: `/api/vault/admin/segments/${encodeURIComponent(String(segmentId))}`,
    allowedMethods: ['DELETE'],
  });
}
