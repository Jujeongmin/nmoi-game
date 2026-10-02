# 캐비어 이스케이프 업그레이드 계획 (크리에이터스 피드백)

피드백: 게임이 훨씬 더 게임 같아야 함 · 모션그래픽으로 딱 봤을 때 화려하고 멋있게 · 이스케이프 퀄리티가 너무 낮음.

결정 (사용자 확인):
- 분위기: 검정·금색 럭셔리 톤 유지 + 게임 연출 추가 (밝은 캐주얼로 가지 않음)
- 이스케이프: 보이는 것 + 게임 요소 둘 다 (조작 = 드래그 이동, 30초 생존 규칙은 유지)
- 범위: 이스케이프 먼저 완성해서 확인받고, 그 기준으로 매치·셰프·메인 화면

## 진행 결과 (2026-10-02)

- 1~3 구현 완료. 바뀐 점:
  - **황금 캔·보호막은 뺐다** (사용자 결정). 점수 = 버티기 + 진주 + 아슬아슬, 진주·아슬아슬이 콤보로 이어짐.
  - **그림은 코드로 그리지 않는다** (사용자 규칙). 배경·해초·빛줄기·진주·경고·조준점·이펙트·3-2-1·배너·콤보 뱃지는
    전부 GPT 생성 그림(`assets/escape/bg`, `assets/escape/fx`). 코드는 움직임만 (해초 흔들림, 빛 일렁임, 파티클 이동).
    원본: `assets/source/gen/escape-bg`, `escape-fx` → `python tools/make-escape-art.py` 로 자름.
  - 배경 후보 5개(GPT 3 · PixelLab 2) 중 **GPT-C (한밤 심해, 굵은 외곽선)** 선택. 오브젝트가 묻히지 않게
    배경은 진주·조개를 뺀 버전으로 다시 생성하고, 70% 투명도로 남색 위에 깔았다. 상어·진주·멤버 뒤에는 빛 번짐.
  - '동작 줄이기' 설정에서 배너·카운트다운이 안 보이던 문제 수정 (애니메이션이 보이는 상태로 끝나게).
- 다음: 공통 UI 키트 (버튼·패널·HUD·로고·타이틀/결과 화면) → 매치·셰프 → 랜딩. `docs/handoff.md` 4번.

---

아래는 처음 세운 계획 (튜닝값은 그대로 쓰였고, 황금 캔 항목은 빠짐).

## 1. 게임 요소 (game/logic.js, game/config.js)

- 캐비어 진주 줍기: 1.3~2.1초마다 생김, 최대 3개, 6.5초 뒤 사라짐, 60점 × 콤보 배율
- 황금 캔: 9~12초마다, 줍으면 6초 보호막 (상어에 한 번 맞아도 라이프 안 깎임), 100점
- 콤보: 진주·아슬아슬이 2.6초 안에 이어지면 콤보. 3개마다 배율 +1, 최대 x5. 맞으면 끊김
- 돌진 상어 (10초~): 화면 끝에서 조준선 1.0초 (마지막 0.3초는 방향 고정) → 직선 돌진 430
- 상어 떼 (20초~): 작은 상어 3마리가 한 줄로 화면을 가로지름 (추적 안 함), 0.9초 경고
- 웨이브 배너: 10초 "WAVE 2 · 돌진 상어 등장", 20초 "FINAL WAVE · 상어 떼가 몰려와요"
- 새 이벤트: pickup, combo, shield, shieldBreak, wave, dashAim, dash (main.js → 사운드·이펙트)
- 상어마다 크기 배율 (size): 판정 L·r 에 곱함 (돌진 1.15, 떼 0.62)
- 서버 점수 상한 20,000 (verse8/server.js GAMES) 안에 들어가게 조정. 빙고 점수 칸 2,000 / 4,000

초안 튜닝값 (config.js 에 넣을 것):

```js
countdown: 2.4, resultDelay: 1.6,
player: { ..., pickRadius: 22 },
dash: { size: 1.15, aimTime: 1.0, lockTime: 0.3, speed: 430, every: [3.6, 5.2] },
pack: { size: 0.62, count: 3, gap: 34, speed: 165, warnTime: 0.9, every: [4.2, 6.0] },
waves: [{ at: 0 }, { at: 10, label: 'WAVE 2', sub: '돌진 상어 등장' }, { at: 20, label: 'FINAL WAVE', sub: '상어 떼가 몰려와요' }],
spawn: { first: 0.6, intervalStart: 2.4, intervalEnd: 1.05, maxStart: 1, maxEnd: 4 },   // 돌진·떼가 생기니 추적 상어는 줄임
pearls: { first: 1.2, every: [1.3, 2.1], max: 3, life: 6.5, points: 60 },
tin: { first: 7, every: [9, 12], life: 5.5, shield: 6, points: 100 },
combo: { window: 2.6, step: 3, maxMult: 5 },
assets: { shark: '../../assets/escape/shark.webp', tin: '../../assets/bingo/tin-platinum.webp' }
```

## 2. 화면 (game/renderer.js + 새 game/fx.js)

- 배경: 깊은 바다 라운지. 위 청록 → 아래 검정 그라데이션, 흔들리는 빛줄기 3~4개, 위쪽 물결 반짝임, 양옆 해초 실루엣, 올라가는 물방울, 바닥 금빛 모래, 비네트. 그라데이션은 resize 때 캐시
- 상어: 스프라이트를 세로 띠로 잘라 꼬리 쪽일수록 크게 흔들기 (헤엄 애니메이션), 아래 그림자, 꼬리 물방울. 돌진 상어는 붉은 빛 + 속도선, 떼는 작고 빠르게
- 경고: 화면 끝 맥박 치는 "!" 표식 + 들어오는 방향 화살표. 돌진은 붉은 점선 조준선 + 깜빡이는 조준점
- 멤버: 발밑 빛, 움직일 때 물방울, 보호막 = 무지갯빛 방울 (회전 하이라이트)
- 아이템: 진주 = 빛나는 진주 + 후광, 떠다님, 등장 팝, 사라지기 전 깜빡임. 캔 = 캔 이미지 + 뒤에서 도는 빛줄기
- fx.js: 파티클 (불꽃·물방울·고리·별·튀어오르는 글자), 화면 흔들림, 번쩍임, 줌 펀치. 파티클 최대 250개. reduce motion 이면 흔들림·번쩍임 약하게 (NS.settings.reduceMotion())
- 아슬아슬: 0.25초 슬로모션 (main.js 에서 game.update(dt × 0.35)), 금색 고리 + "아슬아슬 +150 x3"
- 콤보 표시: 화면 위쪽 "x3 COMBO" 크게, 배율 오를 때 튀어오름
- 남은 10초: 가장자리 붉은 맥박
- 성공: 금색·진주 색종이 폭발 / 게임 오버: 화면 서서히 어둡게
- 타이틀 화면 뒤 (idle): 장식용 상어 2~3마리가 배경에서 헤엄 (게임 판정 없음)

## 3. UI (index.html, game/ui.js, game/game.css)

- 카운트다운 3-2-1: 크게 커졌다 작아지는 숫자 + 금빛 번짐 + 고리, "출발"
- 웨이브 배너 (.ce-banner): 금색 선이 지나가며 라벨·설명이 미끄러져 들어왔다 나감
- HUD 점수: 바뀔 때 튀어오름, 남은 5초 시간 깜빡임 유지
- 사운드 (shared/cv-sound.js MAP 'caviar-escape'): pickup → collect, combo → combo, shield → start, shieldBreak → hit, dashAim → near 계열 새 효과음 (예: 낮은 경고음)
- 새 문구는 shared/cv-i18n-dict.js 에 번역 추가 (WAVE 2 / FINAL WAVE 는 영어 그대로)

## 4. 확인

- 390×664, 360×640 에서 프레임 (Chrome devtools Performance), 파티클 많을 때 끊김 없는지
- 브라우저 창이 숨겨져 있으면 rAF 가 멈춤: 테스트는 CAVIAR.debug.step(초) 로 진행 가능
- 끝나면 GitHub main → sync → GitLab develop (docs/handoff.md 2번)
- 새로 그려야 하는 그림(배경 일러스트 등)이 생기면 후보 여러 개 보여주고 승인받은 것만 커밋
