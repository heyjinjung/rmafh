import { proxyToUpstream } from '../../../../../lib/apiProxy';

export default async function handler(req, res) {
  return proxyToUpstream(req, res, {
    upstreamPath: '/api/vault/admin/operations/extend-expiry',
    allowedMethods: ['POST'],
  });
}
