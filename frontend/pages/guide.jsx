import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// 이미지 폴백 컴포넌트
function ImageWithFallback(props) {
  const [didError, setDidError] = useState(false);
  const { src, alt, style, className, ...rest } = props;
  const altText = typeof alt === 'string' && alt.trim() ? alt : '이미지';
  const width = typeof style?.width === 'number' ? style.width : 1;
  const height = typeof style?.height === 'number' ? style.height : 1;

  return didError ? (
    <div
      className={`inline-block bg-gray-100 text-center align-middle ${className ?? ''}`}
      style={style}
    >
      <div className="flex items-center justify-center w-full h-full">
        <img
          src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg=="
          alt="Error loading image"
          {...rest}
          data-original-url={src}
        />
      </div>
    </div>
  ) : (
    <Image
      src={src}
      alt={altText}
      className={className}
      style={style}
      width={width}
      height={height}
      unoptimized
      {...rest}
      onError={() => setDidError(true)}
    />
  );
}

// 금고 다이얼 컴포넌트
const VaultDial = ({ size = 'md', animationSpeed = 1 }) => {
  const sizes = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
  };

  return (
    <div className={`relative ${sizes[size]}`}>
      <div className="absolute inset-0 rounded-full border-8 border-[#2A2A2A] bg-gradient-to-br from-gray-700 to-gray-900 shadow-lg flex items-center justify-center">
        {[...Array(24)].map((_, i) => (
          <div
            key={i}
            className="absolute h-3 w-1 bg-[#D2FD9C]"
            style={{ transform: `rotate(${i * 15}deg) translateY(-45%)` }}
          />
        ))}
        <div className="absolute inset-[15%] rounded-full bg-gradient-to-br from-gray-800 to-gray-950 border-4 border-[#333333] flex items-center justify-center">
          <div className="absolute inset-[20%] rounded-full bg-black flex items-center justify-center">
            <div className="absolute inset-[30%] rounded-full bg-[#D2FD9C]" />
          </div>
        </div>

        <motion.div
          className="absolute h-[40%] w-2 bg-[#D2FD9C] rounded-full origin-bottom"
          style={{ bottom: '50%', left: 'calc(50% - 4px)' }}
          animate={{ rotate: [0, 180, 360] }}
          transition={{ duration: 20 / animationSpeed, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    </div>
  );
};

const Header = () => {
  return (
    <header className="bg-gradient-to-r from-[#202420] to-[#333933] text-white py-4 px-4 md:px-8 lg:px-16 sticky top-0 z-50 shadow-md border-b border-[#444]">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D2FD9C] to-[#98BF64] flex items-center justify-center mr-3 shadow-lg border-2 border-[#444]">
            <span className="text-[#282D1A] font-bold text-xl">금</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">금고 시스템</h1>
        </div>
        <div className="flex space-x-2">
          <Link
            href="/"
            className="bg-gradient-to-r from-[#98BF64] to-[#D2FD9C] text-[#282D1A] px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-md border border-[#D2FD9C] hidden md:block"
          >
            내 금고 확인
          </Link>
          <a
            href="https://ccc-010.com"
            className="bg-gradient-to-r from-[#282D1A] to-[#394508] text-white px-4 py-2 rounded-lg text-sm font-bold border border-[#D2FD9C] hover:opacity-90 transition-all shadow-md"
            target="_blank"
            rel="noreferrer"
          >
            씨씨싸이트
          </a>
        </div>
      </div>
    </header>
  );
};

const IntroSection = ({ animationSpeed }) => {
  return (
    <section className="bg-gradient-to-b from-[#282D1A] to-[#394508] text-white py-12 md:py-16 px-4 md:px-8 lg:px-16">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-3/5 mb-8 md:mb-0">
            <div className="inline-block px-4 py-1 bg-[#D2FD9C] text-[#282D1A] rounded-full font-bold mb-4 shadow-md">보안 금고 시스템</div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 leading-tight">
              금고를 열고 보상을 놓치지 마세요.
              <br />만료 전에 꼭 확인하세요.
            </h2>
            <p className="text-lg mb-6 font-medium">조건 충족 → 금고 해금 → 보상 수령까지, 만료되기 전에 진행하세요.</p>
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="bg-gradient-to-r from-[#98BF64] to-[#D2FD9C] text-[#282D1A] px-4 py-1.5 rounded-lg text-sm font-bold shadow-md border border-[#D2FD9C]">만료 카운트다운</span>
              <span className="bg-gradient-to-r from-[#98BF64] to-[#D2FD9C] text-[#282D1A] px-4 py-1.5 rounded-lg text-sm font-bold shadow-md border border-[#D2FD9C]">보상 손실 방지</span>
              <span className="bg-gradient-to-r from-[#98BF64] to-[#D2FD9C] text-[#282D1A] px-4 py-1.5 rounded-lg text-sm font-bold shadow-md border border-[#D2FD9C]">단계별 혜택</span>
            </div>
            <p className="text-sm text-gray-300 mb-6">처음이신가요? 아래 가이드만 보고 빠르게 시작할 수 있습니다.</p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://ccc-010.com"
                className="bg-gradient-to-r from-[#98BF64] to-[#D2FD9C] text-[#282D1A] font-bold py-3 px-6 rounded-lg text-base hover:opacity-90 transition-all shadow-md border border-[#D2FD9C]"
                target="_blank"
                rel="noreferrer"
              >
                씨씨싸이트
              </a>
              <Link
                href="/guide"
                className="bg-transparent border border-[#D2FD9C] text-white font-bold py-3 px-6 rounded-lg text-base hover:bg-white hover:bg-opacity-10 transition-all shadow-inner"
              >
                금고 가이드 보기
              </Link>
            </div>
          </div>
          <div className="md:w-2/5 flex justify-center">
            <div className="relative">
              <VaultDial size="lg" animationSpeed={animationSpeed} />
              <motion.div
                className="absolute -top-4 -right-4 w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2 / animationSpeed, repeat: Infinity }}
              >
                <span className="text-white text-2xl font-bold">!</span>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const CoreActionSection = () => {
  return (
    <section className="py-10 px-4 md:px-8 lg:px-16 bg-gradient-to-b from-gray-100 to-white relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-5">
        <div className="grid grid-cols-4 gap-1 w-full h-full">
          {[...Array(48)].map((_, i) => (
            <div key={i} className="border border-gray-500 rounded-sm" />
          ))}
        </div>
      </div>

      <div className="container mx-auto relative z-10">
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 bg-[#394508] text-[#D2FD9C] rounded-lg text-sm font-bold mb-2 shadow-sm">금고 이용 가이드</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#282D1A] mt-1">딱 3단계로 금고 보상 받기</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className="bg-gradient-to-b from-white to-gray-100 rounded-xl p-6 border border-gray-200 shadow-md hover:shadow-lg transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-[#D2FD9C] opacity-10 rounded-full -mr-10 -mt-10" />
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#282D1A] to-[#394508] flex items-center justify-center text-white font-bold text-xl mr-3 border-2 border-[#D2FD9C] shadow-md">
                  {step}
                </div>
                <h3 className="text-xl font-bold text-[#282D1A]">{['로그인하기', '금고 상태 확인', '보상 수령'][step - 1]}</h3>
              </div>
              <p className="text-gray-700 mb-4">
                {[
                  '닉네임을 입력하여 로그인합니다. 운영자가 사전 등록한 회원만 접속 가능합니다.',
                  '금고 화면에서 현재 상태(잠김/해제됨), 만료 시간, 보상 금액을 확인합니다.',
                  '금고가 해제됨 상태일 때 수령 버튼을 눌러 보상을 받으세요.',
                ][step - 1]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const VaultTypeCard = ({ title, description, rewardRange, icon, color, metalColor }) => {
  return (
    <motion.div
      className={`bg-gradient-to-b from-white to-${metalColor}-50 rounded-xl shadow-lg overflow-hidden border border-gray-200`}
      whileHover={{ y: -5, boxShadow: '0 12px 25px rgba(0, 0, 0, 0.15)' }}
      transition={{ duration: 0.3 }}
    >
      <div className={`h-2 ${color}`} />
      <div className="p-6">
        <div className={`w-16 h-16 rounded-full ${color} flex items-center justify-center mb-4 shadow-md border-2 border-white`}>
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 text-[#282D1A]">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        <div className="bg-[#F3F7EB] p-4 rounded-lg mb-5 border border-[#D2FD9C]">
          <p className="text-sm text-gray-600">
            <span className="font-bold text-[#394508]">보상 범위</span>: {rewardRange}
          </p>
        </div>
        <button className="w-full bg-gradient-to-r from-[#282D1A] to-[#394508] text-white py-3 rounded-lg font-bold hover:opacity-90 transition-all shadow-md border border-[#394508] text-center">
          자세히 보기
        </button>
      </div>
    </motion.div>
  );
};

const VaultTypeSection = () => {
  const vaultTypes = [
    {
      title: '골드 금고',
      description: 'CC카지노 텔레공식채널 입장확인, 담당실장 텔레 공식채널 입장 확인 시 해제됩니다.',
      rewardRange: '기본 보상',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="white">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
            clipRule="evenodd"
          />
        </svg>
      ),
      color: 'bg-gradient-to-r from-[#D4AF37] to-[#FADA5E]',
      metalColor: 'yellow',
    },
    {
      title: '플래티넘 금고',
      description: '누적입금 15만원 이상, 리뷰작성 1회 시 해제됩니다.',
      rewardRange: '중간 보상 (골드의 2배)',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="white">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
      ),
      color: 'bg-gradient-to-r from-[#5D5D5D] to-[#9E9E9E]',
      metalColor: 'gray',
    },
    {
      title: '다이아몬드 금고',
      description: '누적 50만원 이상 입금 시 해제됩니다.',
      rewardRange: '최고 보상 (플래티넘의 3배)',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="white">
          <path
            fillRule="evenodd"
            d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
            clipRule="evenodd"
          />
        </svg>
      ),
      color: 'bg-gradient-to-r from-[#B9F2FF] to-[#E0FFFF]',
      metalColor: 'blue',
    },
  ];

  return (
    <section id="vault-types" className="py-12 px-4 md:px-8 lg:px-16 bg-gray-100 relative">
      <div className="absolute inset-0 z-0 opacity-5">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border-2 border-gray-500"
            style={{
              width: `${Math.random() * 100 + 50}px`,
              height: `${Math.random() * 100 + 50}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto relative z-10">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 bg-[#394508] text-[#D2FD9C] rounded-lg text-sm font-bold mb-2 shadow-sm">금고 종류</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#282D1A] mt-1">금고 타입별 혜택</h2>
          <p className="text-gray-600 mt-2 max-w-2xl mx-auto">금고는 골드, 플래티넘, 다이아몬드 세 가지 타입이 있으며, 각각 다른 조건과 보상이 있습니다.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {vaultTypes.map((type, index) => (
            <VaultTypeCard key={index} {...type} />
          ))}
        </div>
      </div>
    </section>
  );
};

const VaultStatusSection = () => {
  return (
    <section id="vault-status" className="py-12 px-4 md:px-8 lg:px-16 bg-white relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-5">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ))}
      </div>

      <div className="container mx-auto relative z-10">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-8 md:mb-0">
            <span className="inline-block px-3 py-1 bg-[#394508] text-[#D2FD9C] rounded-lg text-sm font-bold mb-2 shadow-sm">금고 상태</span>
            <h2 className="text-2xl md:text-3xl font-bold text-[#282D1A] mt-1 mb-4">금고 상태 알아보기</h2>
            <p className="text-gray-700 mb-6">금고는 총 4가지 상태로 변화합니다. 상태에 따라 필요한 조치를 취하세요.</p>
            <ul className="space-y-4 mb-6">
              {[{
                title: '잠김 상태',
                desc: '출석/입금 등 조건을 충족해야 해제됩니다.',
              }, {
                title: '해제됨 상태',
                desc: '수령할 준비가 되었습니다. 수령 버튼을 클릭하세요.',
              }, {
                title: '수령완료 상태',
                desc: '성공적으로 보상을 받았습니다.',
              }, {
                title: '만료됨 상태',
                desc: '시간이 초과되어 보상을 받을 수 없습니다.',
              }].map((item, idx) => (
                <li key={item.title} className="flex items-start bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#282D1A] to-[#394508] flex items-center justify-center mr-3 flex-shrink-0 border border-[#D2FD9C]">
                    <span className="text-[#D2FD9C] font-bold">{idx + 1}</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#282D1A]">{item.title}</span>
                    <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="bg-gradient-to-r from-[#282D1A] to-[#394508] text-white px-5 py-3 rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-md">내 금고 상태 확인</Link>
            </div>
          </div>
          <div className="md:w-1/2 flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="bg-gradient-to-br from-[#333] to-[#111] p-8 rounded-xl border-8 border-gray-700 shadow-2xl">
                <div className="text-center mb-4">
                  <h3 className="text-[#D2FD9C] text-lg font-bold uppercase tracking-wider">금고 상태 디스플레이</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {['잠김', '해제됨', '수령완료', '만료됨'].map((label, idx) => (
                    <div key={label} className="w-32 h-32 md:w-36 md:h-36 bg-black rounded-lg border-4 border-[#333] flex flex-col items-center justify-center p-2 relative">
                      {idx === 1 ? (
                        <motion.div
                          className="absolute inset-0 border-4 border-[#D2FD9C] rounded-lg"
                          animate={{ opacity: [0.2, 0.8, 0.2] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      ) : null}
                      <div className="w-12 h-12 bg-[#282D1A] rounded-full flex items-center justify-center mb-2 border-2 border-[#D2FD9C]">
                        <span className="text-[#D2FD9C] font-bold">{idx + 1}</span>
                      </div>
                      <span className="text-[#D2FD9C] text-sm font-bold text-center">{label}</span>
                      <span className="text-gray-400 text-xs text-center">{['잠금 상태', '해제 상태', '수령 완료', '만료됨'][idx]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const DigitalTimer = () => {
  const [time, setTime] = useState({ hours: 2, minutes: 45, seconds: 30 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime((prevTime) => {
        if (prevTime.seconds > 0) return { ...prevTime, seconds: prevTime.seconds - 1 };
        if (prevTime.minutes > 0) return { ...prevTime, minutes: prevTime.minutes - 1, seconds: 59 };
        if (prevTime.hours > 0) return { hours: prevTime.hours - 1, minutes: 59, seconds: 59 };
        return prevTime;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex justify-center items-center gap-2">
      {['hours', 'minutes', 'seconds'].map((k, idx) => (
        <React.Fragment key={k}>
          <div className="w-16 h-16 bg-black border-2 border-[#444] rounded-md flex items-center justify-center">
            <span className="text-[#D2FD9C] text-3xl font-mono font-bold">{String(time[k]).padStart(2, '0')}</span>
          </div>
          {idx < 2 ? <div className="text-2xl font-bold text-[#D2FD9C]">:</div> : null}
        </React.Fragment>
      ))}
    </div>
  );
};

const ExpirySystemSection = () => {
  return (
    <section id="expiry-system" className="py-12 px-4 md:px-8 lg:px-16 bg-gradient-to-b from-gray-800 to-gray-900 text-white">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row-reverse items-center">
          <div className="md:w-1/2 mb-8 md:mb-0 md:pl-8">
            <span className="inline-block px-3 py-1 bg-[#D2FD9C] text-[#282D1A] rounded-lg text-sm font-bold mb-2 shadow-sm">만료 시스템</span>
            <h2 className="text-2xl md:text-3xl font-bold text-white mt-1 mb-4">만료 전에 꼭 확인하세요</h2>
            <p className="text-gray-300 mb-6">금고는 지정된 시간이 지나면 만료됨 상태가 되어 보상을 받을 수 없게 됩니다. 반드시 만료 전에 확인하세요.</p>
            <div className="space-y-4 mb-6">
              {[{
                icon: '⏰',
                text: '화면 상단에 만료까지 남은 시간이 표시됩니다.',
              }, {
                icon: '⚠️',
                text: '만료 1시간 전에는 강조 표시되어 알려드립니다.',
              }].map((item) => (
                <div key={item.text} className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
                  <p className="text-gray-300 flex items-center">
                    <span className="w-8 h-8 rounded-full bg-[#D2FD9C] flex items-center justify-center text-[#394508] font-bold mr-3">{item.icon}</span>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="md:w-1/2 flex justify-center">
            <div className="relative w-full max-w-sm">
              <motion.div
                className="bg-gradient-to-b from-[#333] to-[#222] rounded-xl p-6 shadow-2xl border-8 border-[#444]"
                initial={{ boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}
                animate={{ boxShadow: ['0 5px 15px rgba(0,0,0,0.3)', '0 5px 25px rgba(210,253,156,0.3)', '0 5px 15px rgba(0,0,0,0.3)'] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[#D2FD9C] text-xl font-bold">만료 카운트다운</h3>
                  <motion.div
                    className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-bold shadow"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    긴급
                  </motion.div>
                </div>
                <div className="bg-black rounded-lg p-5 mb-6 border border-[#444] shadow-inner">
                  <div className="text-[#D2FD9C] text-sm mb-3">만료까지 남은 시간</div>
                  <DigitalTimer />
                </div>
                <div className="bg-black rounded-lg p-4 mb-6 border border-[#444] shadow-inner">
                  <div className="text-[#D2FD9C] text-xs mb-1">손실 위험 금액</div>
                  <div className="text-red-500 text-2xl font-bold">50,000 포인트</div>
                </div>
                <Link href="/" className="w-full inline-block text-center bg-gradient-to-r from-[#98BF64] to-[#D2FD9C] text-[#282D1A] py-3 rounded-lg font-bold hover:opacity-90 transition-all shadow-md border border-[#98BF64]">
                  지금 수령하기
                </Link>
                <div className="mt-4 bg-gray-900 rounded-lg p-2 border border-[#444] shadow-inner">
                  <div className="flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs text-gray-400">만료 후 보상이 소멸됩니다</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const StepByStepGuideSection = () => {
  const steps = [
    {
      title: '닉네임으로 로그인하기',
      desc: '메인 화면에서 닉네임을 입력하여 로그인합니다. 운영자가 사전 등록한 회원만 접속할 수 있습니다.',
    },
    {
      title: '금고 상태 확인하기',
      desc: '로그인 후 금고 대시보드에서 현재 금고 상태를 확인하세요.',
    },
    {
      title: '조건 확인 및 충족',
      desc: '잠김 상태라면 해제 조건을 확인하고 충족하세요. 출석, 입금 등의 조건이 있을 수 있습니다.',
    },
    {
      title: '보상 수령하기',
      desc: '금고가 해제됨 상태일 때 수령 버튼을 클릭하여 보상을 받으세요.',
    },
    {
      title: '만료 주의하기',
      desc: '시간이 지나면 만료됨 상태로 변경됩니다. 만료 전에 꼭 수령하세요.',
    },
  ];

  return (
    <section className="py-12 px-4 md:px-8 lg:px-16 bg-white relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-[#394508] rounded-full"
            style={{
              width: `${Math.random() * 200 + 50}px`,
              height: `${Math.random() * 200 + 50}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.05,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto relative z-10">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 bg-[#394508] text-[#D2FD9C] rounded-lg text-sm font-bold mb-2 shadow-sm">상세 가이드</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#282D1A] mt-1">금고 이용 상세 가이드</h2>
          <p className="text-gray-600 mt-2 max-w-2xl mx-auto">처음 오신 분들을 위한 단계별 가이드입니다. 순서대로 따라 하시면 됩니다.</p>
        </div>

        <div className="max-w-3xl mx-auto">
          <ol className="relative border-l-4 border-[#D2FD9C]">
            {steps.map((step, idx) => (
              <li key={step.title} className={`ml-8 ${idx < steps.length - 1 ? 'mb-10' : ''}`}>
                <div className="absolute -left-5 mt-1.5 flex items-center justify-center w-10 h-10 bg-[#394508] rounded-full ring-4 ring-white shadow-md">
                  <span className="text-[#D2FD9C] font-bold text-xl">{idx + 1}</span>
                </div>
                <div className="bg-gradient-to-r from-white to-gray-50 p-5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-all">
                  <h3 className="text-lg font-bold text-[#282D1A] mb-2 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-[#D2FD9C] flex items-center justify-center mr-2 shadow-sm">
                      <span className="text-[#394508] font-bold">{idx + 1}</span>
                    </div>
                    {step.title}
                  </h3>
                  <p className="text-gray-600 mb-3">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="text-center mt-10">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <a
              href="https://t.me/jm956"
              className="inline-block bg-gradient-to-r from-[#282D1A] to-[#394508] text-white font-bold py-3 px-8 rounded-lg text-lg hover:opacity-90 transition-all shadow-lg border border-[#394508]"
              target="_blank"
              rel="noreferrer"
            >
              담당실장텔레연락
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState(null);
  const faqs = [
    {
      question: '금고에 접속할 수 없는 경우 어떻게 해야 하나요?',
      answer: '운영자가 회원 정보에 닉네임과 아이디를 업로드해야 접속 가능합니다. 접속이 안 되는 경우 운영자에게 닉네임 등록을 요청하세요.',
    },
    {
      question: '금고 잠금 해제 조건은 무엇인가요?',
      answer: '금고 타입별로 다른 조건이 있습니다. 골드는 출석만, 플래티넘은 출석+입금, 다이아몬드는 모든 조건과 VIP 자격이 필요합니다.',
    },
    {
      question: '만료된 금고는 다시 활성화할 수 있나요?',
      answer: '기본적으로 만료됨 상태가 되면 해당 금고의 보상을 받을 수 없습니다. 예외적으로 운영자 판단에 따라 연장이 가능할 수 있지만, 만료 전에 수령하는 것이 안전합니다.',
    },
    {
      question: '출석/입금이 반영되지 않는 경우 어떻게 해야 하나요?',
      answer: '출석과 입금 정보는 운영자가 매일 데이터를 업로드한 후에 반영됩니다. 당일 활동은 다음 날 업데이트 후에 반영되는 경우가 많습니다.',
    },
  ];

  return (
    <section className="py-12 px-4 md:px-8 lg:px-16 bg-gradient-to-b from-gray-100 to-white">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 bg-[#394508] text-[#D2FD9C] rounded-lg text-sm font-bold mb-2 shadow-sm">도움말</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#282D1A] mt-1">자주 묻는 질문</h2>
        </div>
        <div className="bg-white border border-gray-200 shadow-lg rounded-xl overflow-hidden">
          {faqs.map((faq, index) => (
            <div key={faq.question} className={`border-b border-gray-200 ${index === faqs.length - 1 ? 'border-b-0' : ''}`}>
              <button
                className="w-full flex justify-between items-center p-5 bg-gradient-to-r from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 transition-colors"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-bold text-left text-[#282D1A] flex items-center">
                  <div className="w-6 h-6 rounded-full bg-[#394508] flex items-center justify-center mr-3 text-[#D2FD9C] flex-shrink-0">?</div>
                  {faq.question}
                </span>
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 text-gray-500 transform transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </button>
              {openIndex === index ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-5 bg-[#F3F7EB] border-t border-gray-200"
                >
                  <div className="flex">
                    <div className="w-6 mr-3 flex-shrink-0" />
                    <p className="text-gray-700">{faq.answer}</p>
                  </div>
                </motion.div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const TroubleshootingSection = () => {
  return (
    <section className="py-12 px-4 md:px-8 lg:px-16 bg-gradient-to-b from-[#282D1A] to-[#394508] text-white">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 bg-[#D2FD9C] text-[#282D1A] rounded-lg text-sm font-bold mb-2 shadow-sm">문제 해결</span>
          <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">자주 발생하는 오류 해결</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {[{
            title: '회원정보필요',
            desc: '운영자가 회원 데이터를 업로드해야 이용 가능합니다. 운영자에게 닉네임을 알려 등록 요청하세요.',
          }, {
            title: '닉네임오류',
            desc: '닉네임이 입력되지 않았거나 형식이 올바르지 않습니다. 다시 입력해 주세요.',
          }, {
            title: '금고유형오류',
            desc: '잘못된 금고 타입으로 수령을 시도했습니다. 화면에 표시된 금고 타입으로 다시 시도하세요.',
          }, {
            title: '금고만료',
            desc: '금고가 만료되어 수령할 수 없습니다. 다음 금고가 생성될 때까지 기다리거나, 운영자에게 문의하세요.',
          }].map((item) => (
            <div
              key={item.title}
              className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-lg shadow-lg border border-gray-700 hover:shadow-2xl transition-all"
            >
              <div className="flex items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center mr-3 flex-shrink-0 shadow-md">
                  <span className="text-white font-bold">!</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#D2FD9C] mb-2">{item.title}</h3>
                  <p className="text-gray-300 text-sm">{item.desc}</p>
                </div>
              </div>
              <div className="mt-4 pl-12">
                <Link
                  href="/"
                  className="bg-[#D2FD9C] text-[#282D1A] px-3 py-1 rounded-md text-xs font-bold shadow-sm hover:bg-opacity-90 transition-all"
                >
                  바로가기
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <a
            className="bg-gradient-to-r from-[#98BF64] to-[#D2FD9C] text-[#282D1A] px-6 py-3 rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-md border border-[#D2FD9C]"
            href="https://t.me/jm956"
            target="_blank"
            rel="noreferrer"
          >
            운영자에게 문의하기
          </a>
        </div>
      </div>
    </section>
  );
};

export default function VaultOnboardingGuide({ animationSpeed = 1 }) {
  return (
    <div className="font-['Noto_Sans_KR'] text-gray-800 min-h-screen flex flex-col bg-white">
      <Head>
        <title>금고 가이드</title>
      </Head>
      <Header />
      <main className="flex-grow">
        <IntroSection animationSpeed={animationSpeed} />
        <CoreActionSection />
        <VaultTypeSection />
        <VaultStatusSection />
        <ExpirySystemSection />
        <StepByStepGuideSection />
        <FAQSection />
        <TroubleshootingSection />
      </main>
    </div>
  );
}
