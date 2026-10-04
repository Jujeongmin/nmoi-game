/* CONTENT PAGES — Recipe Book (B-cut cards) and Trailer basket.
   Everything here is placeholder content for the demo. Paths are from the site root;
   `image: null` / `video: null` shows a labelled "asset slot" until the real file arrives.
   Texts marked 예시 are sample copy to be replaced by the members' own words. */
(function (NS) {
  'use strict';

  var MEMBERS = ['나라', '나탈리', '세린', '티야', '유온'];

  /* B-cut cards (count: cv-campaign.js bingo.bcuts), one per finished bingo line, members in
     turn. image: 'assets/bcut/01.jpg' (4:5 portrait recommended). */
  var bcuts = [];
  for (var i = 0; i < NS.campaign.config.bingo.bcuts; i++) {
    bcuts.push({
      image: null,
      member: MEMBERS[i % MEMBERS.length],
      caption: 'Trailer B-cut',
      message: '예시 · ' + MEMBERS[i % MEMBERS.length] + '의 비하인드 한 줄'
    });
  }

  NS.pagesContent = {
    bcuts: bcuts,

    /* Trailer basket: hotspot positions are % of the basket picture (x, y) — re-check them when the picture changes.
       video: YouTube URL (watch or youtu.be) — null shows the video slot. locked: 공개 예정.
       member: hidden until that member is found peeking somewhere (shared/cv-eggs.js);
       group: hidden until all five are found. */
    basket: 'assets/pages/basket.webp',
    trailers: [
      { no: '01', member: 'nara', label: 'Trailer', title: '나라 Trailer',   x: 14, y: 24, video: null },
      { no: '02', member: 'natalie', label: 'Trailer', title: '나탈리 Trailer', x: 31, y: 41, video: null },
      { no: '03', member: 'serin', label: 'Trailer', title: '세린 Trailer',   x: 50, y: 34, video: null },
      { no: '04', member: 'tiya', label: 'Trailer', title: '티야 Trailer',   x: 66, y: 42, video: null },
      { no: '05', member: 'yoon', label: 'Trailer', title: '유온 Trailer',   x: 83, y: 38, video: null },
      { no: '06', group: true, label: 'Group',   title: 'n Moi Group Trailer', x: 21, y: 62, video: null },
      { no: '07', label: 'Teaser',  title: 'Teaser',          x: 40, y: 57, video: null, locked: true },
      { no: '08', label: 'M/V',     title: 'Official M/V',    x: 50, y: 72, video: null, locked: true }
    ]
  };
})(window.CAVIAR = window.CAVIAR || {});
