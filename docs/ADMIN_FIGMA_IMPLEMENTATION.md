# ADMIN_FIGMA_IMPLEMENTATION.md

- 문서 타입: 구현 노트 / UI-디자인 매핑
- 버전: v0.1.0
- 작성일: 2025-12-20
- 작성자: Copilot (GPT-5.2)
- 대상 독자: FE 개발자, 운영(어드민) 담당자

## Changelog
- v0.1.0 (2025-12-20): `/admin` 페이지를 Figma(64:305) 레이아웃 기반으로 재구성하고, Tailwind 토큰(색/폰트) 보강 및 어드민 도구 UI를 다크/골드 톤으로 정리.

## 요약
- Figma에서 확인된 “완전체 Desktop(64:305)”의 좌측 사이드바 + 하단 푸터 + 우측 메인 구조를 `/admin`에 반영했습니다.
- 메인 콘텐츠(64:307)가 code layer에서 실질 내용이 비어 있어, 기존 어드민 기능 UI(상태/업로드/연장/알림/revive)는 우측 메인 영역에 “재배치/재디자인” 방식으로 유지했습니다.
- 하드코딩 색상/폰트 사용을 줄이기 위해 Tailwind 토큰(`cc.accent2`, `cc.textSub`, `ibm`, `ibmKr`)을 추가했습니다.

## 배경
- 기존 `/admin` 페이지는 “운영 도구” 목적에는 부합했으나, Figma 기반 신규 디자인과 시각적으로 중복되거나 톤이 맞지 않았습니다.
- 사용자 지시 문서(이 1개의 디자인을 Figma에서 구현하세요.md) 기준 노드는 `64:*`이며, `64:305`가 실제 완전체 레이아웃의 기준입니다.

## 목표
- Figma 레이아웃(사이드바/푸터/메인)을 최대한 그대로 반영.
- 기존 백엔드 API(`/api/vault/*`) 호출/동작은 유지.
- 기존 어드민 디자인과 시각적으로 중복되지 않도록 전면 재스킨.

## Figma → 코드 매핑
### 기준 노드
- `64:305` (완전체 Desktop): 좌측 사이드바, 하단 푸터, 우측 메인 컨테이너 구조.
- `64:307` (메인 code layer): 현재 MCP 컨텍스트 기준으로 내부 UI가 비어 있어(placeholder 수준), “그대로 추출” 불가.

### 컬러 토큰
- Footer 배경: `#282D1A` → Tailwind: `cc.accent2`
- 서브 텍스트: `#CBCBCB` → Tailwind: `cc.textSub`

### 폰트
- IBM Plex Sans / IBM Plex Sans KR
  - Tailwind: `font-ibm`, `font-ibmKr`
  - 현재는 페이지 단위 로드(`<Head>`). 향후 `_document.js`로 승격 가능(린트 경고 참고).

### 에셋
- Figma MCP로 제공된 이미지 URL(시간 제한 가능)
  - 아이콘 3종을 상수로 관리: `ICON_STAR`, `ICON_GAME`, `ICON_TELEGRAM`

## 구현 내용(코드 위치)
- 프론트 UI:
  - frontend/pages/admin.jsx
    - 전체 레이아웃을 “좌측 사이드바 + 하단 푸터 + 우측 메인”으로 재구성.
    - 우측 메인에 기존 섹션 도구 UI를 그대로 유지하되, 카드/인풋/버튼 스타일을 다크/골드 톤으로 정리.
- Tailwind 토큰:
  - frontend/tailwind.config.js
    - `extend.colors.cc.accent2`, `extend.colors.cc.textSub` 추가
    - `extend.fontFamily.ibm`, `extend.fontFamily.ibmKr` 추가

## 검증
- `next build` 성공(프로덕션 빌드 컴파일 확인).
- `next lint`는 경고만 남음(아래 참고).

## 리스크 / 남은 경고
- Next lint 경고
  - 페이지 단위 폰트 로드: `pages/_document.js`로 이동 권장
  - `<img>` 사용: `next/image` 사용 권장
- Figma 에셋 URL은 만료될 수 있어, 장기적으로는 `frontend/public/`로 고정 자산을 내리는 편이 안정적입니다.

## 후속 작업(옵션)
- 폰트 로드를 `pages/_document.js`로 이동하여 경고 제거.
- Figma 사이드바/푸터 문구/링크를 실제 운영 링크로 교체(요구사항 확정 필요).
- `/admin` 메인 영역의 타이포/간격을 Figma 수치에 더 엄격히 맞추기(현재는 기능 UI 유지 우선).
