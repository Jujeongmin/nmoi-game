# Verse8 로고 스플래시 모듈 (VerseSplash)

YouTube Playables 호환 로고 스플래시. **어떤 웹 게임에도 드롭인** — Vanilla JS, 외부 의존성 0, 프레임워크 무관(Phaser·Three.js·React·plain 다 됨).

애니메이션: 워드마크 슬라이드-인(블러 풀림) → "8" 펀치-인(오버슈트) → 임팩트 셰이크+시안 글로우 버스트 → 시머 와이프 → 서스테인 호흡. `prefers-reduced-motion` 시 단순 페이드로 대체.

---

## 들어있는 것
```
Verse8_Splash_Module/
├─ VerseSplash.js                 # 스플래시 클래스 (ESM, default export)
├─ assets/
│  ├─ verse8_logo_light.svg       # 로고 (인라인 → 워드마크/"8" 분리 애니)
│  ├─ verse8_logo_light.png       # 로고 래스터 폴백
│  └─ splash.mp3                  # 스플래시 사운드 스팅
├─ example.html                   # 독립 데모 (SDK 없이 바로 실행)
└─ README.md
```

## 빠른 적용 (3단계)

**1) 파일 복사** — `VerseSplash.js`를 게임에 넣고(예: `src/verse8-splash/`), `assets/`의 3개 파일을 게임의 정적 asset 경로로 복사.

**2) import + show/hide**
```js
import VerseSplash from './verse8-splash/VerseSplash.js'
// 게임의 YT Playables SDK 래퍼들 (게임마다 경로/이름 다를 수 있음)
import { firstFrameReady, isAudioEnabled, onAudioEnabledChange, gameReady } from './sdk/ytgameSDK.js'

const splash = new VerseSplash({
  logoSrc:  'assets/splash/verse8_logo_light.svg',   // ← 게임의 실제 경로로
  soundSrc: 'assets/splash/splash.mp3',
  firstFrameReady, isAudioEnabled, onAudioEnabledChange,   // ← SDK 훅 주입
})

await splash.show()   // 로고 표시 + firstFrameReady() 발화 + (뮤트 아니면) 사운드
// … 여기서 게임 부팅: 에셋 로드, 씬 준비 …
await splash.hide()   // minDuration 보장 후 페이드아웃, 게임으로 크로스페이드
gameReady()           // 스플래시가 사라지고 메뉴가 인터랙터블할 때 호출 (cert §2)
```

**3) anti-flash CSS 한 줄** — 게임 캔버스/루트가 스플래시 뜨기 직전 한 프레임 새는 것 방지. 스플래시가 `show()`에서 `<html data-splash-active="true">`를 켜고 `hide()`에서 끕니다.
```css
html[data-splash-active="true"] #game-canvas { visibility: hidden; }
```
> `#game-canvas`를 **게임의 실제 렌더 타겟 셀렉터**로 바꿀 것 (Three.js `#canvas-container`, Phaser `#game-container`, React 루트 등).

---

## SDK 훅 (주입)
| 훅 | 안 넘기면 | 용도 |
|---|---|---|
| `firstFrameReady()` | no-op | `show()`가 첫 프레임 뜨면 1회 호출 (cert §2: **firstFrameReady → gameReady** 순서) |
| `isAudioEnabled()` | `true` 취급 | 현재 YT 뮤트 상태. `false`면 스팅 **무음** (cert: 뮤트 시 소리 금지) |
| `onAudioEnabledChange(cb)` | no-op | 뮤트 토글 구독 → 언뮤트되면 스팅 재생 |

셋 다 생략하면 **독립 실행**(데모/비-YT 환경): firstFrameReady no-op, 오디오 항상 on 취급.
`gameReady()`는 이 모듈이 부르지 **않음** — 게임이 `hide()` 완료 후 직접 호출(스플래시 뒤에 아직 가려진 채로 gameReady가 불리는 것 방지).

## 옵션
| 옵션 | 기본값 | 설명 |
|---|---|---|
| `logoSrc` | `assets/splash/verse8_logo_light.svg` | 로고. `.svg`면 인라인해서 워드마크/"8" 분리 애니, 아니면 `<img>` 통짜 |
| `soundSrc` | `assets/splash/splash.mp3` | 사운드 스팅 |
| `bgColor` | `#041627` | 배경색 |
| `glowColor` | `"3, 255, 255"` | 시안 글로우 (RGB **문자열**, 따옴표 포함) |
| `minDuration` | `2400` | 최소 표시 시간(ms). 로딩이 빨라도 이만큼 유지 |
| `fadeInMs` / `fadeOutMs` | `350` / `500` | 페이드 인/아웃 |
| `impactDelayMs` `impactBurstMs` `shimmerDelayMs` `sustainStartMs` | `500` `750` `850` `1300` | 내부 애니 타이밍(대개 손댈 필요 없음) |

## Cert / 동작 노트 (YT Playables)
- **호출 순서**: `show()` → (게임 부팅) → `hide()` → `gameReady()`. `firstFrameReady`는 `show()` 안에서 자동 발화.
- **오디오 뮤트**: 뮤트(`isAudioEnabled()===false`)면 부팅 시 스팅 안 틀고, 언뮤트 콜백이 오면 그때 재생. YT iframe 첫 호출이 `false`를 반환하는 quirk까지 커버 (뮤트인지 quirk인지 구분 못 하므로 안전하게 부팅 무음).
- **anti-flash**: `data-splash-active` 속성 + 위 CSS로 게임 첫 프레임 노출 차단.
- **reduced-motion**: `prefers-reduced-motion: reduce` 시 애니 끄고 단순 페이드.
- **z-index**: `2147483647`(최상단). 페이드아웃 후 DOM에서 완전히 제거.
- **의존성 0**: SDK import 없음(주입식). 번들러/네이티브 ESM 모두 OK.

## 에셋 교체 가이드
- 로고 종횡비 **1691 : 333** (가로형 워드마크 + "8"). 다른 비율이면 `.verse8-splash__stage`의 `aspect-ratio` 조정 필요.
- SVG로 주면 그룹 `data-name`에 **"verse"** 포함 그룹(워드마크) + **"8"** 그룹이 있어야 분리 애니 동작. 없으면 자동으로 `<img>` 통짜 표시(애니는 페이드/임팩트만).
- `splash.mp3`는 **~1.5~2.4초** 스팅 권장(`minDuration` 안에 끝나게). 0dB 피크 노멀라이즈.

## 데모
`example.html`을 **정적 서버**로 열면 SDK 없이 바로 재생됩니다 (ESM import + SVG fetch 때문에 `file://` 직접 열기는 안 됨).
```
npx http-server .    # 그 후 http://localhost:8080/example.html
```

---
_출처: Verse8 soccer_juggle_master 의 검증된 스플래시(splash.js v1.1.0) 포터블 빌드. YT Playables cert 통과 게임들과 동일 로직._
