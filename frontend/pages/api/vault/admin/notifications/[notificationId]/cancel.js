import { proxyToUpstream } from '../../../../../../lib/apiProxy';

export default async function handler(req, res) {
  const notificationId = req.query?.notificationId;
  return proxyToUpstream(req, res, {
    upstreamPath: `/api/vault/admin/notifications/${encodeURIComponent(String(notificationId))}/cancel`,
    allowedMethods: ['POST'],
  });
}
