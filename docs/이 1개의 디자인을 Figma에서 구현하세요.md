이 1개의 디자인을 Figma에서 구현하세요. [모든 뷰포트용 레이아웃]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-388&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [사이드바컨테이너 - 데스크탑]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-310&m=dev

이 1개의 디자인을 Figma에서 구현하세요. . [사이드바컨테이너 -태블릿]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-337&m=dev

이 1개의 디자인을 Figma에서 구현하세요.  [사이드바컨테이너 -모바일]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-372&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [푸터]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-326&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [핵심 금고디자인 = 메인]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-307&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [완전체 데스크탑]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-305&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [완전체태블릿]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-334&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [완전체 모바일]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-361&m=dev


프론트는 완전히 이렇게 진행할건데
1) 피그마 MCP활용할것
1-1) 먼저 본 소스와 내용을 문서화 할것 
그 후 적정 토큰과 프론트 개발순서에 따라 개발을 진행할 것 
2) 우리 백앤드 개발요소에 맞추어 본 프론트앤드 디자인을 변경할것
3)  즉 API/스키마/테이블은 우리 백앤드를 활용할것
4) 기타 디자인 에 필요한 스택은 현재 구현된 피그마의 기준을 따를 것 


Figma 접근: MCP로 연동 가능한지, 토큰/파일 접근 권한을 알려주세요.
ㄴ 니가 현재 상태 알아봐봐
2. 우선순위: 완전체 vs 개별 섹션(메인/사이드바/푸터) 중 어떤 것부터 진행할까요? - 보통 개발 순서를 따라줘 / 효율적인 순서
3. 백엔드 연동 정보: API 스펙/스키마(예: 문서나 샘플 응답)와 로컬 호출 방법이 필요합니다. - 프로젝트 서치하여 찾아
UI 가이드: FE 스타일 가이드나 컴포넌트 규칙이 있다면 알려주세요(없다면 제가 정리해서 제안드릴게요). - 니가 정리해서 제안해줘 
산출물 형태: 먼저 구현 계획서(구성/라우팅/데이터바인딩/컴포넌트 매핑)부터 작성할까요, 아니면 바로 코드 작업에 착수할까요? - 1번 작업 완료되면 구현계획서 작성

추천 개발 순서(효율 기준)

## 현재 상태(2025-12-20)
- Figma 기준 레이아웃(사이드바/푸터/메인)은 `frontend/pages/index.jsx`에 구현되어 있습니다.
- FE는 Next API Routes로 백엔드(`/api/vault/*`)를 프록시하고 있으며, 로컬 실행은 `http://localhost:3002/` 입니다.

