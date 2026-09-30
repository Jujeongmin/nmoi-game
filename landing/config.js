/* PRE-SAVE LANDING — content and mapping. Copy, questions, members and games live here.
   `image` paths are from the repo root (assets/landing/, generated art — replace freely).
   Set any of them to null to fall back to the CSS placeholder. */
(function (NS) {
  'use strict';

  NS.landingConfig = {
    nicknameMax: 10,

    images: {
      table: 'assets/landing/table.webp',   // 01 table with the closed menu (menu book near the centre)
      paper: 'assets/landing/paper.webp',   // texture for the order sheet, speech bubble and cards
    },

    /* Q. 고객님의 성향은? */
    moods: [
      { id: 'classic',  label: '클래식한 미식가' },
      { id: 'explorer', label: '새로운 맛 탐험가' },
      { id: 'mood',     label: '분위기파' },
      { id: 'bold',     label: '대담한 도전파' },
    ],

    /* Q. 좋아하는 캐비어 — decides which member serves the guest (03) and appears in games. */
    caviars: [
      { id: 'almas',      label: '알마스',   latin: 'ALMAS',       color: 'white', member: 'nara',    image: 'assets/landing/tin-almas.webp' },
      { id: 'imperial',   label: '임페리얼', latin: 'IMPERIAL',    color: 'green', member: 'natalie', image: 'assets/landing/tin-imperial.webp' },
      { id: 'classic',    label: '클래식',   latin: 'CLASSIC',     color: 'black', member: 'serin',   image: 'assets/landing/tin-classic.webp' },
      { id: 'platinum',   label: '플래티넘', latin: 'PLATINUM',    color: 'gold',  member: 'tiya',    image: 'assets/landing/tin-platinum.webp' },
      { id: 'whitepearl', label: '화이트펄', latin: 'WHITE PEARL', color: 'pearl', member: 'yoon',    image: 'assets/landing/tin-whitepearl.webp' },
    ],

    /* Q. 캐비어 먹을 때? — decides the member's expression on the serving screen.
       anim: a row of the member sheet (idle | frown | dance). */
    eats: [
      { id: 'cracker', label: '크래커에 곁들여서', anim: 'idle' },
      { id: 'hand',    label: '손등에 살짝',       anim: 'idle' },
      { id: 'wood',    label: '나무젓가락',        anim: 'idle' },
      { id: 'steel',   label: '고급진 쇠젓가락',   anim: 'frown' },
    ],

    /* Q. 같이 마실 음료 */
    drinks: [
      { id: 'white',    label: '화이트 와인', glass: 'wine',   tint: '#efe3b8', image: 'assets/landing/drink-white.webp' },
      { id: 'red',      label: '레드 와인',   glass: 'wine',   tint: '#7a2430', image: 'assets/landing/drink-red.webp' },
      { id: 'water',    label: '물',          glass: 'tumbler', tint: '#e6eef0', image: 'assets/landing/drink-water.webp' },
      { id: 'highball', label: '위스키하이볼', glass: 'tall',  tint: '#d9a857', image: 'assets/landing/drink-highball.webp' },
    ],

    /* 04 캐비어 캔 → game, in week order (W1 훔쳐라 · W2 매치 · W3 셰프, shared/cv-campaign.js).
       Paths are from the repo root. */
    cans: [
      { id: 'almas',    latin: 'ALMAS',    label: '알마스',   sub: '화이트', color: 'white', game: 'games/caviar-escape/',      gameName: '캐비어를 훔쳐라',   image: 'assets/landing/tin-almas.webp' },
      { id: 'classic',  latin: 'CLASSIC',  label: '클래식',   sub: '블랙',   color: 'black', game: 'games/caviar-match/',       gameName: '캐비어 매치',       image: 'assets/landing/tin-classic.webp' },
      { id: 'imperial', latin: 'IMPERIAL', label: '임페리얼', sub: '녹색',   color: 'green', game: 'games/caviar-master-chef/', gameName: '마스터 셰프 캐비어', image: 'assets/landing/tin-imperial.webp' },
    ],

    copy: {
      tapMenu: '메뉴판을 클릭해주세요',
      serve: '{name} 님,\n주문하신 최고급 캐비어\n준비해드리겠습니다.',
      secret: '이 맛의 비결은 뭐지?!',
      cansTitle: '어떤 캐비어를 맛보시겠어요?',
      cansNote: '선택하시면 게임을 시작합니다!',
    },
  };
})(window.CAVIAR = window.CAVIAR || {});
