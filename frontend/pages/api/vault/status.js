export default function handler(_req, res) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
  const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());

  const payload = {
    gold_status: 'UNLOCKED',
    platinum_status: 'LOCKED',
    diamond_status: 'LOCKED',
    platinum_attendance_days: 1,
    platinum_deposit_done: false,
    diamond_deposit_current: 120000,
    expires_at: expiresAt.toISOString(),
    now: now.toISOString(),
    loss_total: 130000,
    loss_breakdown: { GOLD: 10000, PLATINUM: 30000, DIAMOND: 100000, BONUS: 0 },
    ms_countdown: { enabled: remainingMs < 60 * 60 * 1000, remaining_ms: remainingMs },
    referral_revive_available: true,
    social_proof: { vault_type: 'PLATINUM', claimed_last_24h: 4231 },
    curation_tier: 'PLATINUM_BIASED',
  };

  res.status(200).json(payload);
}
