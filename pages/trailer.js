/* TRAILER — basket of album objects; each object opens its trailer.
   Videos are YouTube links in pages/content.js (null = video slot placeholder). */
(function (NS) {
  'use strict';

  var C = NS.pagesContent;
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  $('link-home').href = NS.hub.link('index.html');
  NS.bingoUI.mount();
  if (NS.sound) NS.sound.bgm('pages');
  $('btn-bingo').addEventListener('click', function () { NS.bingoUI.open(); });

  function youtubeId(url) {
    var m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(url || '');
    return m ? m[1] : null;
  }

  var player = $('player'), frame = $('player-frame');
  function openTrailer(t) {
    $('player-no').textContent = t.no + ' ' + t.label;
    $('player-title').textContent = t.title;
    frame.innerHTML = '';
    var id = youtubeId(t.video);
    if (t.locked && !id) {
      frame.appendChild(NS.assetSlot({ name: t.title + ' · 공개 예정', spec: '공개 일정에 맞춰 오브제와 영상이 열립니다 (이스터에그)' }));
    } else if (id) {
      var f = el('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      f.title = t.title;
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      frame.appendChild(f);
    } else {
      frame.appendChild(NS.assetSlot({ name: t.title + ' 영상', spec: 'YouTube 링크를 넣으면 이 자리에서 재생 · 16:9' }));
    }
    player.classList.add('is-open');
  }
  function closePlayer() { player.classList.remove('is-open'); frame.innerHTML = ''; }
  $('player-close').addEventListener('click', closePlayer);
  player.addEventListener('click', function (e) { if (e.target === player) closePlayer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePlayer(); });

  // Basket photo + hotspots
  var basket = $('basket');
  basket.appendChild(NS.assetSlot({ name: '장바구니 이미지', src: C.basket, className: 'pg-basket__img' }));
  C.trailers.forEach(function (t) {
    var b = el('button', 'pg-spot' + (t.locked ? ' is-locked' : ''));
    b.type = 'button';
    b.style.left = t.x + '%';
    b.style.top = t.y + '%';
    b.setAttribute('aria-label', t.no + ' ' + t.title);
    b.appendChild(el('span', 'pg-spot__no', t.no));
    b.appendChild(el('span', 'pg-spot__label', t.locked ? 'Soon' : t.label));
    b.addEventListener('click', function () { openTrailer(t); });
    basket.appendChild(b);

    var li = el('li');
    var row = el('button', 'pg-trailers__row' + (t.locked ? ' is-locked' : ''));
    row.type = 'button';
    row.appendChild(el('b', '', t.no));
    row.appendChild(el('span', '', t.title));
    row.appendChild(el('small', '', t.locked ? '공개 예정' : (t.video ? '재생' : '영상 자리')));
    row.addEventListener('click', function () { openTrailer(t); });
    li.appendChild(row);
    $('trailer-list').appendChild(li);
  });
})(window.CAVIAR = window.CAVIAR || {});
