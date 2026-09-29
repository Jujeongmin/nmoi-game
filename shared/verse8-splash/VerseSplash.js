/**
 * VerseSplash — YouTube Playables 호환 로고 스플래시 모듈 (v1.1, vanilla JS port)
 *
 * 향상된 애니메이션:
 *   Phase 1 (0-850ms)    Verse 워드마크 슬라이드 인 + 블러 풀림
 *   Phase 2 (500-1100ms) "8" 캐릭터 펀치 인 (오버슈트 베이스 이즈)
 *   Phase 3 (750-1400ms) 임팩트: 스테이지 미세 셰이크 + 시안 글로우 버스트
 *   Phase 4 (850-1600ms) 시머 와이프 (cyan-tinted sheen, 워드마크 mask)
 *   Phase 5 (1300ms~)    서스테인: 미세 호흡 + 글로우 펄스 (오디오 sustain 동기)
 *   Phase 6 (exit)       페이드 아웃 + 슬라이트 스케일 다운
 *
 * SDK Lifecycle:
 *   show() → DOM 생성 (SVG inline) → fadeIn → firstFrameReady() (via wrapper) → audio play
 *   hide() → minDuration 보장 → fadeOut. gameReady()는 lobby.js가 hide() 완료 후 호출.
 *
 * Playables SDK 미감지 환경에서도 (firstFrameReady 호출은 wrapper가 알아서 무시) 정상 동작.
 *
 * Note (port from splash.js v1.1.0 / VerseSplash.ts):
 *  - Routes `firstFrameReady` through `../sdk/ytgameSDK` (single source of truth).
 *  - Drops the `_notifyGameReady` call entirely. gameReady() is fired by lobby.js
 *    right after this splash's hide() resolves — i.e. once the lobby menu is
 *    actually visible/interactable.
 *  - CERTIFIED audio gate: boot playback is gated on the wrapper's
 *    `isAudioEnabled()` so the splash sting is SILENT when YouTube is muted.
 *    Inside the Playables iframe isAudioEnabled() returns `false` on its FIRST
 *    call (Handoff §7.4 quirk) even for an unmuted player; the real state arrives
 *    via onAudioEnabledChange. So we do NOT play on boot in the cert iframe and
 *    only start the sting if/when the callback affirmatively reports enabled.
 *    In dev the wrapper forces isAudioEnabled() → true, so the sting plays.
 *
 * @author Verse8 BD/Strategy
 * @version 1.1.0
 */

// Portable build: the YT Playables SDK hooks are INJECTED via constructor
// options (see below) instead of hard-imported, so this module drops into any
// game regardless of its SDK path/shape. Pass your game's wrappers:
//   new VerseSplash({ firstFrameReady, isAudioEnabled, onAudioEnabledChange })
// Omit them and the splash still runs standalone (firstFrameReady no-ops,
// audio treated as always-on).

export default class VerseSplash {
  constructor(options = {}) {
    this.logoSrc = options.logoSrc ?? "assets/splash/verse8_logo_light.svg";
    this.soundSrc = options.soundSrc ?? "assets/splash/splash.mp3";
    this.bgColor = options.bgColor ?? "#041627";
    this.glowColor = options.glowColor ?? "3, 255, 255";
    this.minDuration = options.minDuration ?? 2400;
    this.fadeInMs = options.fadeInMs ?? 350;
    this.fadeOutMs = options.fadeOutMs ?? 500;

    this.impactDelayMs = options.impactDelayMs ?? 500;
    this.impactBurstMs = options.impactBurstMs ?? 750;
    this.shimmerDelayMs = options.shimmerDelayMs ?? 850;
    this.sustainStartMs = options.sustainStartMs ?? 1300;

    // ── YT Playables SDK hooks (injected; safe no-op defaults for standalone) ──
    // firstFrameReady(): call once the first splash frame is on screen (cert §2).
    // isAudioEnabled(): current YT mute state (false = muted → splash stays silent).
    // onAudioEnabledChange(cb): subscribe to host mute toggles.
    this.firstFrameReady = options.firstFrameReady ?? (() => {});
    this.isAudioEnabled = options.isAudioEnabled ?? (() => true);
    this.onAudioEnabledChange = options.onAudioEnabledChange ?? (() => {});

    this.container = null;
    this.audio = null;
    this.audioEnabled = true;
    this.startTime = 0;
    this.audioOffListener = null;
    // Set when play() is rejected with NotAllowedError and a tap-to-unmute
    // retry listener is armed. Idempotent — second NotAllowedError doesn't
    // pile on more listeners.
    this.retryArmed = false;
  }

  /* ---------- public API ---------- */

  async show() {
    // Hide the game (canvas) until the splash is gone. Without this the Three.js
    // first frame can flash for a tick before the splash's opacity:0→1 fade-in
    // covers it (Lessons Learned: "스플래시 전 인게임 한 프레임 노출").
    document.documentElement.setAttribute("data-splash-active", "true");
    this.startTime = performance.now();
    this.injectStyles();
    await this.createDOM();

    // Audio is purely cosmetic — never let an error here abort the splash
    // visual sequence. A previous version of this file let a synchronous
    // localStorage exception escape from loadAudio(); the resulting
    // rejected show() promise meant the `--visible` class never got
    // added, so the opacity:0 fixed-position container sat invisibly
    // covering the entire viewport (max z-index) and ate every click on
    // the page underneath. Belt-and-suspenders: defensive try/catch here
    // even though loadAudio itself now wraps its localStorage access.
    try {
      this.loadAudio();
    } catch (err) {
      console.warn("[VerseSplash] loadAudio failed (non-fatal):", err);
    }

    await this.nextFrame();
    await this.nextFrame();
    this.container?.classList.add("verse8-splash--visible");

    // Tell YouTube the first frame is up. The injected wrapper should guard
    // against duplicate dispatch and no-op in dev mode.
    this.firstFrameReady();
    try {
      this.tryPlayAudio();
    } catch (err) {
      console.warn("[VerseSplash] tryPlayAudio failed (non-fatal):", err);
    }

    await this.wait(this.fadeInMs);
  }

  async hide() {
    // Reveal the game again. The splash still covers it (opacity:1, max z-index)
    // until the --exit fade-out below, so the canvas just cross-fades in as the
    // splash leaves — no flash. Removed at hide() entry so a thrown hide() can
    // never strand the game invisible.
    document.documentElement.removeAttribute("data-splash-active");
    const elapsed = performance.now() - this.startTime;
    const remaining = Math.max(0, this.minDuration - elapsed);
    if (remaining > 0) await this.wait(remaining);

    this.container?.classList.add("verse8-splash--exit");
    this.fadeAudio(this.fadeOutMs);
    await this.wait(this.fadeOutMs);

    this.container?.remove();
    this.container = null;
    if (this.audioOffListener) {
      this.audioOffListener();
      this.audioOffListener = null;
    }
    this.audio = null;
    // gameReady() is intentionally NOT called inside hide(). lobby.js fires it
    // right after this hide() promise resolves — once the splash has fully
    // faded and the lobby menu is actually visible (not still behind it).
  }

  /* ---------- internal ---------- */

  injectStyles() {
    if (document.getElementById("verse8-splash-style")) return;
    const style = document.createElement("style");
    style.id = "verse8-splash-style";
    style.textContent = `
      .verse8-splash {
        position: fixed; inset: 0;
        background: ${this.bgColor};
        display: flex; align-items: center; justify-content: center;
        z-index: 2147483647;
        opacity: 0;
        transition: opacity ${this.fadeInMs}ms ease-out;
        will-change: opacity;
      }
      .verse8-splash--visible { opacity: 1; }
      .verse8-splash--exit {
        opacity: 0;
        transition: opacity ${this.fadeOutMs}ms ease-in;
      }

      .verse8-splash__stage {
        position: relative;
        width: clamp(200px, 62vw, 600px);
        aspect-ratio: 1691 / 333;
        will-change: transform, filter;
        transform: translateZ(0);
      }

      .verse8-splash__stage > svg,
      .verse8-splash__stage > img {
        width: 100%; height: 100%;
        display: block;
        user-select: none;
        -webkit-user-drag: none;
        overflow: visible;
      }

      .verse8-splash__wordmark,
      .verse8-splash__eight {
        transform-box: fill-box;
        transform-origin: 50% 50%;
        opacity: 0;
      }

      .verse8-splash__shimmer {
        position: absolute; inset: 0;
        pointer-events: none;
        background: linear-gradient(
          110deg,
          transparent 0%,
          transparent 38%,
          rgba(255, 255, 255, 0.85) 49%,
          rgba(${this.glowColor}, 0.95) 50%,
          rgba(255, 255, 255, 0.85) 51%,
          transparent 62%,
          transparent 100%
        );
        background-size: 240% 100%;
        background-position: -130% 0;
        -webkit-mask-image: url('${this.logoSrc}');
                mask-image: url('${this.logoSrc}');
        -webkit-mask-size: contain;
                mask-size: contain;
        -webkit-mask-position: center;
                mask-position: center;
        -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
        mix-blend-mode: screen;
        opacity: 0;
      }

      /* ---------- 트리거: --visible 클래스가 추가될 때 모든 애니메이션 발동 ---------- */

      .verse8-splash--visible .verse8-splash__wordmark {
        animation: v8-wordmark-in 850ms 0ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .verse8-splash--visible .verse8-splash__eight {
        animation: v8-eight-punch 600ms ${this.impactDelayMs}ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }

      .verse8-splash--visible .verse8-splash__stage {
        animation:
          v8-stage-impact 650ms ${this.impactBurstMs}ms cubic-bezier(0.4, 0, 0.2, 1) forwards,
          v8-stage-sustain 1800ms ${this.sustainStartMs}ms ease-in-out infinite alternate;
      }

      .verse8-splash--visible .verse8-splash__shimmer {
        animation: v8-shimmer 750ms ${this.shimmerDelayMs}ms ease-in-out forwards;
      }

      /* ---------- 키프레임 ---------- */

      @keyframes v8-wordmark-in {
        0% {
          opacity: 0;
          transform: translateX(-14%) scale(1.05);
          filter: blur(18px);
        }
        55% {
          opacity: 1;
          transform: translateX(-1.2%) scale(1.005);
          filter: blur(0);
        }
        78% {
          transform: translateX(0.6%) scale(0.997);
        }
        100% {
          opacity: 1;
          transform: translateX(0) scale(1);
          filter: blur(0);
        }
      }

      @keyframes v8-eight-punch {
        0% {
          opacity: 0;
          transform: translateX(60%) scale(1.7) rotate(-10deg);
          filter: blur(10px);
        }
        55% {
          opacity: 1;
          transform: translateX(-3%) scale(0.92) rotate(2deg);
          filter: blur(0);
        }
        80% {
          transform: translateX(0.6%) scale(1.025) rotate(-0.5deg);
        }
        100% {
          opacity: 1;
          transform: translateX(0) scale(1) rotate(0);
          filter: blur(0);
        }
      }

      @keyframes v8-stage-impact {
        0% {
          transform: translate3d(0, 0, 0);
          filter: drop-shadow(0 0 0 transparent);
        }
        12% {
          transform: translate3d(-3px, 0, 0);
          filter: drop-shadow(0 0 14px rgba(${this.glowColor}, 0.45));
        }
        24% {
          transform: translate3d(3px, 0, 0);
          filter: drop-shadow(0 0 38px rgba(${this.glowColor}, 0.85));
        }
        38% {
          transform: translate3d(-1px, 0, 0);
          filter: drop-shadow(0 0 28px rgba(${this.glowColor}, 0.6));
        }
        60% {
          transform: translate3d(0, 0, 0);
          filter: drop-shadow(0 0 18px rgba(${this.glowColor}, 0.4));
        }
        100% {
          transform: translate3d(0, 0, 0);
          filter: drop-shadow(0 0 12px rgba(${this.glowColor}, 0.22));
        }
      }

      @keyframes v8-stage-sustain {
        0% {
          transform: translateY(0);
          filter: drop-shadow(0 0 12px rgba(${this.glowColor}, 0.20));
        }
        100% {
          transform: translateY(-2px);
          filter: drop-shadow(0 0 24px rgba(${this.glowColor}, 0.40));
        }
      }

      @keyframes v8-shimmer {
        0% {
          background-position: -130% 0;
          opacity: 0;
        }
        15% { opacity: 1; }
        85% {
          opacity: 0.55;
          background-position: 230% 0;
        }
        100% {
          opacity: 0;
          background-position: 230% 0;
        }
      }

      /* 모션 감소 선호 시 단순 fade로 대체 */
      @media (prefers-reduced-motion: reduce) {
        .verse8-splash, .verse8-splash__stage,
        .verse8-splash--visible .verse8-splash__wordmark,
        .verse8-splash--visible .verse8-splash__eight,
        .verse8-splash--visible .verse8-splash__stage,
        .verse8-splash--visible .verse8-splash__shimmer {
          animation: none !important;
          transition: opacity ${this.fadeInMs}ms ease !important;
          transform: none !important;
          filter: none !important;
          opacity: 1 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async createDOM() {
    const container = document.createElement("div");
    container.className = "verse8-splash";
    container.setAttribute("role", "img");
    container.setAttribute("aria-label", "Verse 8");
    this.container = container;

    const stage = document.createElement("div");
    stage.className = "verse8-splash__stage";

    // Inline the SVG so we can address the wordmark and "8" groups separately
    // for the staggered animation. Falls back to <img> if anything goes wrong.
    let inlinedOk = false;
    if (this.logoSrc.toLowerCase().endsWith(".svg")) {
      try {
        const res = await fetch(this.logoSrc, { cache: "force-cache" });
        if (res.ok) {
          const text = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, "image/svg+xml");
          const svg = doc.documentElement;
          if (svg && svg.tagName.toLowerCase() === "svg") {
            const allG = svg.querySelectorAll("g");
            let wordmarkG = null;
            let eightG = null;
            allG.forEach((g) => {
              const dn = g.getAttribute("data-name") || "";
              if (dn.toLowerCase().includes("verse")) wordmarkG = g;
              else if (dn.startsWith("8 ") || dn === "8 Image") eightG = g;
            });
            // Fallback heuristic: nested groups whose <image> width > 1000 = wordmark, < 500 = "8"
            if (!wordmarkG || !eightG) {
              const innerGroups = svg.querySelectorAll("g > g > g");
              innerGroups.forEach((g) => {
                const img = g.querySelector("image");
                if (!img) return;
                const w = parseInt(img.getAttribute("width") || "0", 10);
                if (w > 1000 && !wordmarkG) wordmarkG = g;
                else if (w > 0 && w < 500 && !eightG) eightG = g;
              });
            }
            if (wordmarkG)
              wordmarkG.setAttribute("class", "verse8-splash__wordmark");
            if (eightG) eightG.setAttribute("class", "verse8-splash__eight");
            stage.appendChild(svg);
            inlinedOk = true;
          }
        }
      } catch (err) {
        console.warn("[VerseSplash] inline SVG 실패, <img> 폴백:", err);
      }
    }

    if (!inlinedOk) {
      const img = document.createElement("img");
      img.src = this.logoSrc;
      img.alt = "Verse 8";
      img.draggable = false;
      stage.appendChild(img);
    }

    const shimmer = document.createElement("div");
    shimmer.className = "verse8-splash__shimmer";
    stage.appendChild(shimmer);

    container.appendChild(stage);
    document.body.appendChild(container);
  }

  loadAudio() {
    // Plain `new Audio()` element — no Web Audio API, no gesture-unlock
    // listener stack on top. Whether playback actually happens is dictated
    // by the browser's autoplay policy + the host environment:
    //   - YouTube Playables: iframe `allow="autoplay"` granted → plays.
    //   - Origin with prior MEI / interaction: plays.
    //   - Fresh origin, no prior gesture: initial play() rejects with
    //     NotAllowedError; we arm a one-shot input listener (see
    //     `attemptPlay` → `armRetryOnNextInput`) that retries the
    //     moment the user taps anywhere. Production never hits this
    //     branch because YouTube grants the gesture for us.
    this.audio = new Audio(this.soundSrc);
    this.audio.preload = "auto";
    this.audio.volume = 1.0;
  }

  tryPlayAudio() {
    // cert: audio MUST NOT be output while YouTube mute is set. Inside the
    // Playables iframe isAudioEnabled() returns `false` on its FIRST call
    // (Handoff §7.4 quirk) — for an UNMUTED player too — and the real mute
    // state arrives shortly after via onAudioEnabledChange. So we GATE boot
    // playback on the probe: in the cert iframe it is false (mute OR the §7.4
    // quirk) → we do NOT play on boot, and the sting only starts if/when the
    // callback affirmatively reports enabled. This guarantees silence under
    // mute and is exactly what the certified games (beers_gone, shape_master)
    // do. In dev the wrapper forces isAudioEnabled() → true, so the sting plays
    // immediately for local testing.
    //
    // DO NOT revert to "audioEnabled = true + always attemptPlay()": that plays
    // the sting for the window before the callback fires `false`, producing an
    // audible blip under YT mute — the reported cert violation.
    this.audioEnabled = this.isAudioEnabled();

    const handler = (enabled) => {
      this.audioEnabled = enabled;
      if (!this.audio) return;
      if (enabled) {
        const p = this.audio.play();
        if (p && typeof p.then === "function") {
          void p.catch((err) => {
            console.warn("[VerseSplash] toggle play() rejected:", err?.name);
          });
        }
      } else {
        this.audio.pause();
      }
    };
    this.onAudioEnabledChange(handler);
    // No off-listener — the wrapper doesn't expose one, and the splash is
    // short-lived so we just stop reacting once `this.audio` is null after hide().

    // Only attempt boot playback when audio is known-enabled. In the cert
    // iframe this is false (mute OR the §7.4 first-call quirk) so nothing plays
    // until the callback confirms enabled — guaranteeing no output under mute.
    if (this.audioEnabled && this.audio) {
      this.attemptPlay();
    }
  }

  /**
   * Attempt audio playback. If the browser rejects with NotAllowedError
   * (autoplay policy on a fresh origin without a propagated gesture), arm
   * a one-shot pointer/touch/keyboard listener that retries on the next
   * user input — guaranteeing audio plays as soon as the user touches
   * anything.
   *
   * Production (YouTube Playables) never hits the retry path: the parent
   * iframe's `allow="autoplay"` grant means the initial play() resolves.
   * The retry path covers dev (localhost / cloudflare tunnel) where the
   * page is opened without a prior user gesture on this origin.
   */
  attemptPlay() {
    if (!this.audio) return;
    const p = this.audio.play();
    if (!p || typeof p.then !== "function") return;
    void p.catch((err) => {
      // Common rejection reasons:
      //   NotAllowedError → autoplay policy (need gesture)
      //   NotSupportedError → MIME / codec issue
      //   AbortError → another play() interrupted this one
      if (err?.name === "NotAllowedError" && !this.retryArmed) {
        this.armRetryOnNextInput();
      } else {
        console.warn("[VerseSplash] play() rejected:", err?.name ?? err);
      }
    });
  }

  /**
   * Register a one-shot input listener that retries play() on the next
   * user interaction. Capture-phase + passive so we don't interfere with
   * the game's pointer handling. Auto-removes after first input fires.
   */
  armRetryOnNextInput() {
    if (this.retryArmed) return;
    this.retryArmed = true;
    const events = ["pointerdown", "touchstart", "keydown", "click"];
    const onInput = () => {
      events.forEach((ev) => document.removeEventListener(ev, onInput, true));
      if (!this.audio) return;
      this.attemptPlay();
    };
    events.forEach((ev) =>
      document.addEventListener(ev, onInput, {
        capture: true,
        passive: true,
      })
    );
  }

  fadeAudio(durationMs) {
    if (!this.audio) return;
    const audioRef = this.audio;
    const startVol = audioRef.volume;
    const startTime = performance.now();
    const tick = () => {
      if (!this.audio) return;
      const t = Math.min(1, (performance.now() - startTime) / durationMs);
      audioRef.volume = startVol * (1 - t);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        audioRef.pause();
        audioRef.currentTime = 0;
      }
    };
    requestAnimationFrame(tick);
  }

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
}
