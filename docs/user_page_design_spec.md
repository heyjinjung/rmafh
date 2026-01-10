# 유저 페이지 디자인 명세서 (v2.3)

## 1. 개요
본 문서는 CC 카지노 금고 유저 페이지(`frontend/pages/index.jsx`)의 **Clean & Flat** 리디자인을 위한 상세 기술 명세서입니다. 불필요한 장식을 배제하고 컨텐츠의 가시성을 높이는 것을 목표로 하며, 개발자가 즉시 구현할 수 있도록 **구체적인 수치와 속성**을 포함합니다.

## 2. 디자인 핵심 가치 (Core Values)
1.  **가독성 (Readability)**: 배경과 텍스트의 명도 대비를 4.5:1 이상으로 유지하여 시인성 확보.
2.  **절제미 (Minimalism)**: 과도한 글로우, 복잡한 그라디언트 테두리, 그림자를 제거하여 모던함 강조.
3.  **Flat Visual**: 노이즈 텍스처를 제거하고 차분한 단색 배경(`Deep Green`)을 사용하여 고급스러운 분위기 연출.

## 3. 디자인 토큰 (Design Tokens)

### 3.1 컬러 팔레트 (Color Palette)
| 토큰명 | Hex Code | 설명 및 용도 |
| :--- | :--- | :--- |
| **Primary Accent** | `#D2FD9C` | 메인 강조색 (Neon Green). 타이틀, 활성 버튼 텍스트. |
| **Secondary Accent** | `#07AF4D` | 플래티넘 등급 상징색 (Deep Green). |
| **Tertiary Accent** | `#00E0FF` | **[변경]** 다이아몬드 등급 상징색 (Bright Cyan). 고대비용. |
| **Background Flat** | `#020b07` | **[변경]** 메인 페이지 배경색. (Flat Deep Black-Green). |
| **Card Dropdown** | `rgba(255, 255, 255, 0.03)` | 카드/컨테이너 배경색. 아주 미세한 투명도. |
| **Danger / Error** | `#FF5555` | 로그아웃, 경고 문구. |
| **Text Primary** | `#FFFFFF` | 메인 타이틀, 본문 주요 내용. |
| **Text Sub** | `#889988` | 설명 보조 텍스트. |

### 3.2 타이포그래피 (Typography)
*   **Font Family**: `Noto Sans KR` (국문 권장), `IBM Plex Sans` (영문/숫자 권장)
*   **Scale**:
    *   `Display 1`: 42px (Bold) - 메인 타이틀
    *   `Heading 1`: 24px (Bold) - 금고 카드 타이틀
    *   `Body 1`: 16px (Medium) - 주요 본문
    *   `Body 2`: 14px (Regular) - 보조 설명
    *   `Caption`: 12px (Regular) - 캡션 및 태그

## 4. UI 컴포넌트 상세 명세

### A. 사이드바 (Sidebar)
*   **크기**: 너비 `340px` 고정 (데스크탑 기준).
*   **배경**: `backdrop-filter: blur(20px)` 적용. **테두리(Border-right) 제거**.
*   **레이아웃 구조**:
    1.  **헤더 (Top)**:
        *   Logo: `26x26px` 아이콘 + "CC CASINO" 텍스트.
        *   Title: "씨씨카지노 신규회원 전용금고" 사이드바 줄바뀜 한글깨짐 없게 주의할것  (`#FFFFFF`, `#D2FD9C` 강조).
    2.  **유저 정보 (Middle)**:
        *   배치: 헤더 바로 하단.
        *   구성: `[닉네임] Player` (Text-only) + `로그아웃` (Small Button).
        *   스타일: 불필요한 카드 배경 제거, 텍스트 위주 배치.
    3.  **CTA 네비게이션 (Bottom)**:
        *   Grid: `2 Columns` (1:1 비율 정사각형).
        *   Item 1: **씨씨카지노** (슬롯 아이콘). 배경 `#051a10`. Hover 시 테두리 `#D2FD9C` (50% Opacity).
        *   Item 2: **씨씨공식텔레채널** (확성기 아이콘). 배경 `#051a10`. - 한글 줄바꿈 깨짐없게 주의 
        *   Interaction: 호버 시 아이콘 `Scale 1.1` + `Rotate 5deg`. **Glow 효과 제거**.

### B. 메인 콘텐츠 - 금고 카드 (Vault Cards)
*   **카드 스타일 (Clean Style)**:
    *   **Border**: `Transparent` (투명). 등급별 그라디언트 테두리 제거.
    *   **Shadow**: `None` (제거). 외부 발광 효과 삭제.
    *   **Background**: `rgba(0,0,0, 0.8)` (짙은 반투명 검정).
ㄴ 각 금고별로 통일성은 있지만 각자의 특징이 부각되게 설정값이 달라야함 !! 

*   **아이콘 (Assets)**:
    *   **Gold**: 기존 3D 금괴 유지.
    *   **Platinum**: 기존 3D 플래티넘 유지.
    *   **Diamond**: **Cyan 톤 (#00E0FF)**으로 색조 변경된 3D 다이아몬드.
    *   **Effect**: 아이콘 주변의 `Glow Filter` 제거.

### C. 배경 (Background)
*   **속성**:
    *   `background-color: #020b07`
    *   `background-image: none` (방사형 그라디언트, 노이즈 텍스처 삭제).
    *   `background-attachment: fixed`

## 5. 에셋 요구사항 (Asset Requirements)

| 파일명 | 종류 | 크기 | 설명 |
| :--- | :--- | :--- | :--- |
| `icon_3d_gold.png` | IMG | 512px | 3D 렌더링된 금괴 아이콘 (유지) |
| `icon_3d_platinum.png` | IMG | 512px | 3D 렌더링된 실버/플래티넘 바 (유지) |
| `icon_3d_diamond_cyan.png` | IMG | 512px | **[수정필요]** Cyan(#00E0FF) 컬러 톤의 3D 다이아몬드 |
| `logo.png` | IMG | Vector | CC Casino 로고 (유지) |

## 6. 구현 체크리스트
1.  [ ] `index.jsx` 내 `getVaultColorScheme` 함수 수정 (테두리, 글로우 속성 제거).
2.  [ ] `Diamond` 케이스의 컬러 코드 `#00E0FF`로 일괄 변경.
3.  [ ] 최상위 `div` 배경 스타일을 Flat Color로 변경.
4.  [ ] 사이드바 컴포넌트 레이아웃 단순화 확인.

---
*Verified by: Developer Agent*
*Last Update: 2026-01-10*
