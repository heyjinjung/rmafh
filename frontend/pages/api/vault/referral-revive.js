export default function handler(req, res) {
  res.setHeader('Allow', ['POST']);
  return res
    .status(410)
    .json({ error: { code: 'REFERRAL_REVIVE_REMOVED', message: '추천 상태 되살리기 기능이 삭제되었습니다.' } });
}
