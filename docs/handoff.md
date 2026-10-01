# 작업 인계 (다른 PC에서 이어가기)

## 1. 새 PC 준비

```bash
git clone https://github.com/Jujeongmin/nmoi-game.git nmoi-game-src
git clone https://gitlab.verse8.io/anjshdkdl99/web.git web   # Verse8 GitLab 계정으로 로그인
cd web && git checkout develop && npm install
```

- 두 폴더를 같은 상위 폴더에 둔다 (`nmoi-game-src/`, `web/` 나란히). 동기화 스크립트가 `../web`을 쓴다.
- `nmoi-game-src/verse8/admins.local.json`은 git에 없다 (공개 저장소라 제외). 직접 만든다:
  `["0x내Verse8계정ID"]` — 없이 동기화하면 고정 관리자가 비어서 배포된다.
- Python 3, Node 18+ 필요.

## 2. 배포 순서

1. `nmoi-game-src`에서 수정 → commit → `git push origin main` (GitHub)
2. `cd web && git fetch && git rebase origin/develop` (Verse8가 넣는 "The user changed the files" 커밋 먼저 받기)
3. `cd ../nmoi-game-src && python tools/sync-verse8.py ../web`
4. `cd ../web && npx vite build` → commit "Sync GitHub main <sha>: …" → `git push origin develop` (= Verse8 배포)

로컬 확인: `nmoi-game-src`를 정적 서버로 띄워 `index.html` (서버 기능은 Verse8에서만 동작).

## 3. 데모 스위치 (출시 전 끌 것)

- `shared/cv-campaign.js`: `demo.unlockAllWeeks`, `demo.unlimitedPlays`
- `verse8/server.js`: `DEMO_UNLIMITED_PLAYS`
- 설정의 "데모 리셋" 메뉴

## 4. 남은 일

- 크리에이터스 피드백 반영 (회의 다음 날 전달 예정)
- 남는 B컷을 게임 화면 연출(타이틀·결과 배경, 멤버 컷)에 쓰기: B컷 이미지가 오면 작업. 보상 아님
- B컷 장수가 확정되면 `shared/cv-campaign.js` 의 `bingo.bcuts` 만 바꾸면 됨 (지금 10)
- 메인 화면 언어 선택 버튼 (현재는 브라우저 언어로 자동)
- 확정 대사 적용 (게임 내 4줄 고정) + 녹음 파일 재생 훅
- 경품 이름 표기: 판 완성 보상은 지금 "상위 등급 경품 추첨". 하이디라오 상품권·에어팟 이름을 넣을지 확정되면 반영

## 5. 대기 중

- 소속사: B컷 장수, 에셋, AI 관련 답변
- 회사: 외부 서버/DB, Spotify API 프리세이브, 소셜 로그인, 별도 URL

## 6. 최근 결정

- 하단 고정 띠: Kreators × Verse8 로고 (검정 띠, 흰 로고, 금색 선). 결과 카드의 POWERED BY 배지는 제거
- 게임오버 카드: 점수·최고 / 순위 / 멤버 한마디 / 미션 바 / CTA 1개 (프리세이브 전 = 프리세이브, 후 = 공유) / 버튼
- 캐주얼 체험(찍먹) 경로는 만들지 않음
- 음료: 청포도 에이드 · 딸기 에이드 · 물 · 레몬에이드 (술 없음)
- 빙고 5x5: 가운데 프리세이브, 주차마다 8칸 (첫 판 · 점수 I · 점수 II · 결과 공유 · 게임 순위 · 초대 순위 · 친구 초대 · 출석).
  칸 = 응모권 +1, 줄 = 응모권 +3 + B컷 1장 (완성한 순서대로), 판 완성 = 상위 등급 경품 추첨. 맨 윗줄은 W1 칸만이라 1주차 안에 첫 줄 가능
