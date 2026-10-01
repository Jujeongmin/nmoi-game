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
- 빙고 5x5, 가운데 칸 = 프리세이브 (미션 24개 + 프리세이브). 미션 구성·B컷 배분 안을 먼저 확인받고 구현
- 중간 리워드 = 응모권 (미션/줄 단위)
- 주류 음료를 무알코올로 교체 (새 음료 이미지는 후보 여러 개 보여주고 승인받은 것만 커밋) + 음료 대사
- 메인 화면 언어 선택 버튼 (현재는 브라우저 언어로 자동)
- 확정 대사 적용 (게임 내 4줄 고정) + 녹음 파일 재생 훅
- 리워드 문구 교체: "쇼케이스 초청" → 하이디라오 상품권·에어팟 등

## 5. 대기 중

- 소속사: B컷 장수, 에셋, AI 관련 답변
- 회사: 외부 서버/DB, Spotify API 프리세이브, 소셜 로그인, 별도 URL

## 6. 최근 결정

- 하단 고정 띠: Kreators × Verse8 로고 (검정 띠, 흰 로고, 금색 선). 결과 카드의 POWERED BY 배지는 제거
- 게임오버 카드: 점수·최고 / 순위 / 멤버 한마디 / 미션 바 / CTA 1개 (프리세이브 전 = 프리세이브, 후 = 공유) / 버튼
- 캐주얼 체험(찍먹) 경로는 만들지 않음
