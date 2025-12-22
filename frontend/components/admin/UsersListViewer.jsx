import { useState } from 'react';

function formatKoDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function formatWon(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString('ko-KR')}원`;
}

function statusBadge(status) {
  if (status === 'UNLOCKED') return <span className="text-admin-neon">활성</span>;
  if (status === 'LOCKED') return <span className="text-admin-muted">비활성</span>;
  if (status === 'CLAIMED') return <span className="text-blue-400">수령완료</span>;
  if (status === 'EXPIRED') return <span className="text-red-400">만료</span>;
  return <span className="text-cc-textSub">{status || '-'}</span>;
}

export default function UsersListViewer({ adminPassword, onSelectUser }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');

  const handleFetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = query ? `?query=${encodeURIComponent(query)}` : '';
      const response = await fetch(`/api/vault/users-list${qs}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || `HTTP ${response.status}`);
      }

      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (externalUserId) => {
    if (onSelectUser) {
      const found = users.find((u) => u.external_user_id === externalUserId);
      onSelectUser(found || { external_user_id: externalUserId });
    }
  };

  const inputBase =
    'w-full px-3 py-2 bg-admin-bg border border-admin-border text-admin-text rounded focus:outline-none focus:border-admin-neon';
  const btnBase =
    'px-4 py-2 bg-admin-neon text-admin-bg font-semibold rounded hover:bg-admin-neonHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 flex gap-2">
          <input
            className={inputBase}
            placeholder="외부 아이디 또는 닉네임으로 검색 (비우면 전체)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFetchUsers();
            }}
          />
          <button onClick={handleFetchUsers} disabled={loading} className={btnBase}>
            {loading ? '조회 중...' : '검색/조회'}
          </button>
          <button
            onClick={() => {
              setQuery('');
              handleFetchUsers();
            }}
            disabled={loading}
            className={btnBase}
          >
            {loading ? '조회 중...' : '전체 회원 조회'}
          </button>
        </div>
        {total > 0 && (
          <div className="text-sm text-admin-text">
            총 <span className="font-bold text-admin-neon">{total}</span>명
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
          오류: {error}
        </div>
      )}

      {users.length > 0 && (
        <div className="overflow-x-auto border border-admin-border rounded">
          <table className="w-full text-sm text-left">
            <thead className="bg-admin-bg border-b border-admin-border">
              <tr>
                <th className="px-3 py-2 text-admin-muted">아이디</th>
                <th className="px-3 py-2 text-admin-muted">닉네임</th>
                <th className="px-3 py-2 text-admin-muted">가입일</th>
                <th className="px-3 py-2 text-admin-muted">골드</th>
                <th className="px-3 py-2 text-admin-muted">플래티넘</th>
                <th className="px-3 py-2 text-admin-muted">다이아</th>
                <th className="px-3 py-2 text-admin-muted">출석</th>
                <th className="px-3 py-2 text-admin-muted">입금</th>
                <th className="px-3 py-2 text-admin-muted">텔레그램</th>
                <th className="px-3 py-2 text-admin-muted">리뷰</th>
                <th className="px-3 py-2 text-admin-muted">만료일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.user_id}
                  onClick={() => handleRowClick(user.external_user_id)}
                  className="border-b border-admin-border hover:bg-admin-bg/50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 text-admin-neon font-mono">{user.external_user_id}</td>
                  <td className="px-3 py-2 text-admin-text">{user.nickname || '-'}</td>
                  <td className="px-3 py-2 text-admin-text">
                    {user.joined_date ? formatKoDate(user.joined_date) : formatKoDate(user.created_at)}
                  </td>
                  <td className="px-3 py-2">{statusBadge(user.gold_status)}</td>
                  <td className="px-3 py-2">{statusBadge(user.platinum_status)}</td>
                  <td className="px-3 py-2">{statusBadge(user.diamond_status)}</td>
                  <td className="px-3 py-2 text-admin-text">
                    {user.platinum_attendance_days}일
                    {user.max_attendance_days !== undefined && (
                      <span className="text-admin-muted text-xs ml-1">
                        /{user.max_attendance_days}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-admin-text">
                    {user.platinum_deposit_done ? '플래티넘 완료' : '-'}
                  </td>
                  <td className="px-3 py-2 text-admin-text">{user.telegram_ok ? '✓' : '-'}</td>
                  <td className="px-3 py-2 text-admin-text">{user.review_ok ? '✓' : '-'}</td>
                  <td className="px-3 py-2 text-admin-text">{formatKoDate(user.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && users.length === 0 && (
        <div className="text-center py-8 text-admin-muted">회원 리스트를 조회하려면 버튼을 클릭하세요</div>
      )}
    </div>
  );
}
