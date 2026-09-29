/* CONTENT PAGES — Recipe Book (B-cut) and Trailer basket.
   Everything here is placeholder content for the demo. Paths are from the site root;
   `image: null` / `video: null` shows a labelled "asset slot" until the real file arrives.
   Texts marked 예시 are sample copy to be replaced by the members' own words. */
(function (NS) {
  'use strict';

  var MEMBERS = ['나라', '나탈리', '세린', '티야', '유온'];

  /* 15 B-cuts, 3 per member. image: 'assets/bcut/01.jpg' (4:5 portrait recommended). */
  var bcuts = [];
  for (var i = 0; i < 15; i++) {
    bcuts.push({
      image: null,
      member: MEMBERS[i % MEMBERS.length],
      caption: 'Trailer B-cut',
      message: '예시 · ' + MEMBERS[i % MEMBERS.length] + '의 비하인드 한 줄'
    });
  }

  NS.pagesContent = {
    recipe: {
      chef: 'CHEF. Newbie',
      title: 'Caviar Canapé',
      sub: 'Recipe',
      image: 'assets/pages/canape.webp',
      parts: [
        { name: 'Caviar',     text: '예시 · 좋은 캐비어 한 스푼이 전부를 결정해요' },
        { name: 'Dill',       text: '예시 · 마지막에 올리는 향 한 줄기' },
        { name: 'Sour Cream', text: '예시 · 부드럽게, 산뜻하게' },
        { name: 'Blini',      text: '예시 · 겉은 바삭, 속은 촉촉하게' }
      ],
      ingredients: ['캐비어 20g', '블리니 10개', '사워크림 50g', '딜 약간', '레몬 제스트 약간', '소금 · 후추 약간']
    },

    bcuts: bcuts,

    /* Member handwriting notes. image: scan of the real handwriting (replaces the text). */
    notes: [
      { title: "Chef's Diary",  text: '예시 · 처음엔 너무 짜고, 또 어떤 날은 심심했어요. 완벽한 밸런스를 찾기까지!', image: null },
      { title: 'Research Note', text: '예시 · 캐비어는 차갑게 · 블리니는 한 입 크기 · 레몬은 살짝만', image: null },
      { title: "Today's Aim",   text: '예시 · 누구나 한 입에 반할 특별한 한 입을 만들 것', image: null },
      { title: 'Tasting Note',  text: '예시 · 멤버 모두 한 입 먹고 눈이 반짝였던 그 순간', image: null }
    ],

    /* Trailer basket: hotspot positions are % of the basket photo (x, y).
       video: YouTube URL (watch or youtu.be) — null shows the video slot. locked: 공개 예정. */
    basket: 'assets/pages/basket.webp',
    trailers: [
      { no: '01', label: 'Trailer', title: '나라 Trailer',   x: 14, y: 20, video: null },
      { no: '02', label: 'Trailer', title: '나탈리 Trailer', x: 31, y: 37, video: null },
      { no: '03', label: 'Trailer', title: '세린 Trailer',   x: 48, y: 31, video: null },
      { no: '04', label: 'Trailer', title: '티야 Trailer',   x: 66, y: 38, video: null },
      { no: '05', label: 'Trailer', title: '유온 Trailer',   x: 84, y: 34, video: null },
      { no: '06', label: 'Group',   title: 'NMOI Group Trailer', x: 22, y: 58, video: null },
      { no: '07', label: 'Teaser',  title: 'Teaser',          x: 40, y: 53, video: null, locked: true },
      { no: '08', label: 'M/V',     title: 'Official M/V',    x: 51, y: 69, video: null, locked: true }
    ]
  };
})(window.CAVIAR = window.CAVIAR || {});
