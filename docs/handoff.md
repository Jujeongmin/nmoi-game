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
- Python 3 (+ Pillow, numpy), Node 18+ 필요. 그림 생성은 Codex CLI (`npm i -g @openai/codex`, `codex login` = ChatGPT 요금제).

## 2. 배포 순서

1. `nmoi-game-src`에서 수정 → commit → `git push origin main` (GitHub)
2. `cd web && git fetch && git rebase origin/develop` (Verse8가 넣는 "The user changed the files" 커밋 먼저 받기)
3. `cd ../nmoi-game-src && python tools/sync-verse8.py ../web`
4. `cd ../web && npx vite build` (package-lock.json 은 커밋하지 않음) → commit "Sync GitHub main <sha>: …" → `git push origin develop` (= Verse8 배포)

로컬 확인: `nmoi-game-src`를 정적 서버로 띄워 `index.html` (서버 기능은 Verse8에서만 동작).

## 3. 데모 스위치 (출시 전 끌 것)

- `shared/cv-campaign.js`: `demo.unlockAllWeeks`, `demo.unlimitedPlays`
- `verse8/server.js`: `DEMO_UNLIMITED_PLAYS`
- 설정의 "데모 리셋" 메뉴

## 4. 남은 일

- 이스케이프 업그레이드 완료 (`docs/escape-upgrade.md` 진행 결과)
- **다음 작업: 전체를 게임답게** — 고객 요청 "UI와 다른 게임들도 더 게임같이".
  **메뉴판 디자인 콘셉트는 그대로** 두고 연출로 해결 (광택 게임 UI 키트는 거절됨, `docs/art-style.md` Keep the concept).
  공용 연출은 `shared/cv-juice.js` + `cv-theme.css` "Juice" (카드 펼침·줄 단위 등장, 버튼 빛 스침, 점수 롤링,
  결과 카운트업, 신기록 왁스 도장, 금색 실선 배너, 흔들림, 마지막 10초 맥박). 공용 장식 그림은 `assets/menu/`.
  세 게임 적용 완료: 이스케이프(콤보·웨이브), 매치(금박 꼬리·착지 고리·TABLE CLEARED·COMBO 배너, 캐비어는 안 터짐),
  셰프(재료 금박·PERFECT ORDER 배너·접시에 셰프 도장·접시 빛 스침·실수 흔들림).
  랜딩도 완료 (`landing/motion.js` + landing.css "Motion"): 테이블 반짝임·촛불·메뉴판 빛 스침, 주문서 줄 단위 등장·
  선택 시 금박·제출 시 왁스 도장, 서빙 카드 차례로 내려놓기, 캔 차례 등장·이번 주 캔 금색 고리·선택 시 금박과 어두워짐.
  새 그림은 메뉴판·테이블 그림체로만 생성, 후보를 보여 주고 고른 것만 적용 (`docs/art-style.md`).
  플레이 화면 배경: 매치 = 검정 벨벳 테이블보(`assets/match/table.webp`), 셰프 = 월넛 카운터(`assets/chef/counter.webp`),
  후보 3개씩 중 사용자 선택, `tools/make-stage-art.py`. 이스케이프 = 한밤 심해.
- 미리보기: 이 PC는 Windows "애니메이션 효과"가 꺼져 있어 움직임이 안 보임 → 주소에 `?motion=1` (탭 하나 동안 움직임 켬,
  `shared/cv-settings.js`). 캠페인 주차는 `?date=2026-10-27` 처럼 날짜를 줘서 확인
- 남는 B컷을 게임 화면 연출(타이틀·결과 배경, 멤버 컷)에 쓰기: B컷 이미지가 오면 작업. 보상 아님
- B컷 장수가 확정되면 `shared/cv-campaign.js` 의 `bingo.bcuts` 만 바꾸면 됨 (지금 10)
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
- 언어: 랜딩 상단 바 톱니 옆 지구본 버튼으로 바로 변경 (설정에도 있음). 첫 접속은 브라우저 언어로 자동
- 피드백 반영 (10/4): 이스케이프 = 죽림고수 방식 (작은 멤버, 사방에서 작은 상어 다수: 35%만 겨냥, 나머지는 직선·물결 경로), 조작은 마우스·손가락 모두 떠 있는 조이스틱 + WASD, 셋 다 같은 속도 160에 즉시 반응, 아슬아슬 점수·슬로모션 없음 /
  게임 설명 카드 좌측 상단 "← 레스토랑", 설명 문단 대신 플레이 영상 (`assets/clips`, `tools/record-clips.js` 로 다시 녹화) /
  셰프 주문서 = 재료 그림 / 트레일러 = 이스터에그 (`shared/cv-eggs.js`: 게임 밖 화면에서 멤버가 가끔 빼꼼, 누르면 그 멤버 트레일러가 열림,
  5명 다 찾으면 단체 트레일러. 플레이 중엔 안 나옴. 테스트: 콘솔 `CAVIAR.eggs.peekNow()` / `CAVIAR.eggs.reset()`)
- 이스케이프 = 버티기 모드 (10/4): 시간 제한 없음, 라이프 1, 기록 = 버틴 시간 (서버 점수 = 1/100초, 2345 = 23.45초, 배율 안 곱함).
  진주·콤보 없음. 프리세이브 효과 = 매 판 보호막 1회 (V8 주간 부스터 = 2회), `cv-campaign.js` timeGames · timed() · fmtScore() · boostLabel().
  빙고 시간 칸 10초 / 20초 (사용자 결정). 로컬 최고 기록 키는 'bestTime'. 난이도: 35초까지 오르고 그 뒤 천천히 더 (sim: 처음 하는 사람 봇 중간값 16초, 일반 34초). 웨이브 알림은 작은 상단 알림
  설명 카드 영상은 승인 후 다시 녹화 (`tools/record-clips.js` 의 escape 봇은 예전 30초 클리어 기준이라 고쳐야 함)
