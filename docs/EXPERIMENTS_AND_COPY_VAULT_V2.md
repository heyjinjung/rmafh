# Vault v2.0 실험/카피 라이브러리

## 1. 메타
- 문서 타입: 실험/카피 가이드
- 버전: v0.1 (초안)
- 작성일: 2025-12-20
- 대상: 마케팅/제품/FE/BE

## 2. 목적 및 범위
- 손실 회피 프레이밍을 강화하는 카피/알림/배너 실험 정의
- A/B variant_id 매핑을 명확히 하여 FE/알림/백엔드가 동일한 키를 사용하도록 정합성 확보
- 측정 지표: 손실 시뮬레이터 클릭→CLAIM, 부활권 사용률, 알림 variant 전환율

## 3. variant_id 매핑 (제안)
- LOSS_BANNER_A: "지금 포기하면 사라질 혜택" (정량 강조)
- LOSS_BANNER_B: "여기서 멈추면 총 X원이 사라집니다" (정성+정량)
- SOCIAL_PROOF_A: "현재 4,231명이 플래티넘 금고를 회수했습니다"
- SOCIAL_PROOF_B: "다른 유저들이 방금 금고를 회수했어요. 당신의 금고도 곧 소멸됩니다"
- NARRATIVE_PUSH_A: "주인님, 저 여기서 48시간 뒤면 영영 사라져요... 꼭 찾아가 주세요"
- NARRATIVE_PUSH_B: "30,000원이 곧 사라집니다. 회수 버튼 한 번으로 지킬 수 있어요"
- TICKET_ZERO_A: "잠시만요! 그냥 나가시게요? 금고에 30,000원이 울고 있어요"
- TICKET_ZERO_B: "티켓은 없지만 금고에 보관된 30,000원이 있습니다. 지금 회수하세요"
- CLAIMED_FEEDBACK: "똑똑한 선택입니다! 10,000원의 손실을 막아냈습니다" (단일 사용)
- REFERRAL_REVIVE: "친구를 초대하면 만료가 24시간 연장됩니다" (CTA 배너/알림 공통)

## 4. 카피 라이브러리 (채널별)
- 플로팅 손실 배너: "지금 포기하면 사라질 혜택 합계 X원" / "X원을 잃기 전에 회수하세요"
- 긴박 타이머(ms): "만료까지 남은 시간" + ms 타이머, 배경 점멸
- 사회적 증거 토스트: variant_id SOCIAL_PROOF_A/B 적용, 쿨다운 24h
- 개인화 큐레이션 배너: "당신은 '골드'보다 '다이아몬드'에 더 가까운 고액 예치자 관상이네요!"
- 부활권 CTA: "만료 D-1, 초대하면 24시간 연장됩니다"
- CLAIMED 즉시 피드백: "똑똑한 선택입니다! X원의 손실을 막아냈습니다"
- 티켓 0 모달: variant_id TICKET_ZERO_A/B 적용

## 5. 실험 설계 가이드
- 트리거: 만료 임박(D-2/D-1/<1h), 티켓 0, CLAIMED 직후
- 랜덤 분배: user_id 해시 기반 variant_id 고정(알림/FE 공통)
- 노출 한도: 동일 사용자에 대해 SOCIAL_PROOF 1회/24h, 손실 배너 상시
- 멱등: notifications_queue.dedup_key에 variant_id 포함
- 안전장치: EXTENSION_LIMIT/EXPIRED 상태는 실험 노출 중단

## 6. 측정 지표 및 로그
- LOSS_BANNER: impressions, clicks, claim_within_1h
- SOCIAL_PROOF: impressions, clicks, claim_within_24h
- NARRATIVE_PUSH/TICKET_ZERO: open_rate, click_rate, claim_within_24h
- REFERRAL_REVIVE: cta_click_rate, revive_success_rate, 추가된 평균 연장 시간
- CLAIMED_FEEDBACK: 재방문율(D+1), NPS(옵션)
- 로그 필드: {variant_id, event, user_id, vault_type, req_id, sent_at, clicked_at, claimed_at}

## 7. 롤아웃/가드레일
- P1: 소규모(5%) 롤아웃 → claim_rate/expire_rate 모니터링
- P2: 50% 확장, variant별 claim_within_24h 차이 15pp 초과 시 카피/타겟 재검토
- P3: 100% 또는 승자 변형 고정
- 실패 롤백: 실험 플래그 OFF, 기본 카피(LOSS_BANNER_A/SOCIAL_PROOF_A) 유지

## 8. 협업 메모
- 카피 변경 시 variant_id는 유지, 텍스트만 교체 → 데이터 연속성 보장
- FE/BE/CRM 공통 i18n 키: variant_id를 키로 사용하거나 mapping 테이블 관리
- 법무/규제: 금액 표기 정확도 검증, 과장 표현 금지
