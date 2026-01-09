import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

const ICON_STAR = '/logo.png';

export default function LoginPage() {
  const router = useRouter();
  const basePath = router.basePath || '';
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${basePath}/api/vault/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || '로그인 실패');
      }

      // localStorage에 유저 정보 저장
      localStorage.setItem('user', JSON.stringify({
        external_user_id: data.external_user_id,
        nickname: data.nickname,
        user_id: data.user_id,
      }));

      // 메인 페이지로 이동 (external_user_id 쿼리 파라미터)
      router.push(`/?external_user_id=${encodeURIComponent(data.external_user_id)}`);
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>CC Casino - 로그인</title>
      </Head>

      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* 로고 */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Image src={ICON_STAR} alt="CC Casino" width={64} height={64} className="h-16 w-16" priority />
            </div>
            <div>
              <h1 className="text-3xl font-bold">CC CASINO</h1>
              <p className="text-xl text-gold-primary mt-2">신규회원 전용금고</p>
            </div>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="nickname" className="block text-sm font-medium text-cc-textSub">
                닉네임
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임을 입력하세요"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-primary focus:border-transparent"
                disabled={loading}
                maxLength={50}
              />
              <p className="text-xs text-cc-textSub">
                닉네임으로 금고를 생성하고 입장합니다
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !nickname.trim()}
              className="w-full py-3 px-4 bg-gold-primary text-black font-semibold rounded-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-gold-primary focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? '입장 중...' : '금고 입장'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
