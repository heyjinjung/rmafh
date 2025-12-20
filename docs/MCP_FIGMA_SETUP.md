# Figma MCP 설정 가이드 (figma:react)

## 1. 메타
- 문서 타입: MCP/디자인 연동 가이드
- 버전: v0.1 (초안)
- 작성일: 2025-12-20
- 대상: FE/디자이너/툴링

## 2. 선행 조건
- Figma Personal Access Token 준비 (파일 편집 권한 포함)
- 워크스페이스에서 figma:react MCP 지원 확장 설치 (VS Code Copilot Chat 내장)
- 프로젝트 루트에서 인터넷 접근 가능해야 함 (fonts/CDN 포함)

## 3. 환경 변수/시크릿
- FIGMA_PERSONAL_ACCESS_TOKEN=<your_token>
- FIGMA_FILE_KEY=<figma_file_key> (파일 URL의 key 값)
- 필요 시 FIGMA_TEAM_ID, FIGMA_PROJECT_ID

## 4. VS Code에서 사용
- React 컴포넌트에 `import { defineProperties } from "figma:react";` 선언 (예: VaultChallenge 컴포넌트)
- defineProperties로 UI 조정 슬라이더/토글 노출: label/type/min/max/defaultValue 지정
- 폰트는 CDN으로 로드하거나 Figma 텍스트 스타일 매핑

## 5. MCP 커맨드/흐름 (예시)
1) Copilot Chat에 "Figma 연결" 요청 → 토큰/파일 키 입력
2) figma:react 컴포넌트에서 프롬프트 기반 변형 가능 (예: 색상 토큰, 라운드 값 수정)
3) 프리뷰: figma:react가 노출하는 props로 즉시 반영

## 6. 보안/운영 메모
- 토큰은 로컬 .env에 저장, git에 커밋 금지
- 팀 토큰 대신 개인 토큰 사용 시 만료/권한 확인 주기적 수행
- Figma 파일 권한은 View/Export 최소 권한 원칙, 편집권 필요 시 사전 승인

## 7. 트러블슈팅
- 401/403: 토큰/파일 키 권한 확인, 만료 여부 점검
- figma:react import 오류: VS Code 확장 업데이트 또는 재설치
- 폰트 불일치: 웹폰트 로드 시점을 `document.head` 삽입 또는 CSS @import로 선행
- 성능: drop-shadow/blur가 과하면 퍼포먼스 저하 → box-shadow 대체 검토
