export function safeJsonPretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function generateRequestId(prefix) {
  const rand = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function parseExternalUserIdsText(text) {
  const raw = String(text || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (raw.some((v) => v.length > 128)) {
    throw new Error('외부 아이디가 너무 길어요(128자 이하로 입력해주세요).');
  }

  return raw;
}

export function tryParseExternalUserIdsText(text) {
  try {
    return { ok: true, ids: parseExternalUserIdsText(text), message: '' };
  } catch (e) {
    return { ok: false, ids: [], message: e?.message || '외부 아이디 목록을 확인해주세요.' };
  }
}
