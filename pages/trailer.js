/* TRAILER — basket of album objects; each object opens its trailer.
   Videos are YouTube links in pages/content.js (null = video slot placeholder).
   Member trailers are hidden until that member is found peeking around the site
   (shared/cv-eggs.js); the group trailer once all five are. ?play=NN opens one. */
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

  $('link-home').href = NS.hub.link('index.html#cans');   // back to the can (game) selection
  NS.bingoUI.mount();
  if (NS.sound) NS.sound.bgm('pages');
  $('btn-bingo').addEventListener('click', function () { NS.bingoUI.open(); });

  function youtubeId(url) {
    var m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(url || '');
    return m ? m[1] : null;
  }

  var E = NS.eggs;
  function memberName(id) {
    var list = NS.members || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return id;
  }
  function hidden(t) {
    if (!E) return false;
    if (t.member) return !E.has(t.member);
    if (t.group) return !E.allFound();
    return false;
  }

  var player = $('player'), frame = $('player-frame');
  function openTrailer(t) {
    $('player-no').textContent = t.no + ' ' + t.label;
    $('player-title').textContent = hidden(t) ? 'HIDDEN' : t.title;
    frame.innerHTML = '';
    var id = youtubeId(t.video);
    if (hidden(t)) {
      var hint = el('div', 'pg-hint');
      hint.appendChild(el('b', '', '?'));
      hint.appendChild(el('p', '', t.member
        ? NS.t('레스토랑 곳곳에서 빼꼼 나오는 {s} 멤버를 눌러 찾으면 열려요', { s: memberName(t.member) })
        : NS.t('다섯 멤버를 모두 찾으면 열려요 · {n}/{n2}', { n: E.found().length, n2: E.list.length })));
      hint.appendChild(el('small', '', '게임 중에는 나오지 않아요'));
      frame.appendChild(hint);
    } else if (t.locked && !id) {
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
  var spots = [];
  function render() {
    spots.forEach(function (n) { n.remove(); });
    spots = [];
    $('trailer-list').innerHTML = '';
    C.trailers.forEach(function (t) {
      var hide = hidden(t);
      var b = el('button', 'pg-spot' + (t.locked ? ' is-locked' : '') + (hide ? ' is-hidden' : ''));
      b.type = 'button';
      b.style.left = t.x + '%';
      b.style.top = t.y + '%';
      b.setAttribute('aria-label', t.no + ' ' + (hide ? 'HIDDEN' : t.title));
      b.appendChild(el('span', 'pg-spot__no', hide ? '?' : t.no));
      b.appendChild(el('span', 'pg-spot__label', hide ? 'Hidden' : t.locked ? 'Soon' : t.label));
      b.addEventListener('click', function () { openTrailer(t); });
      basket.appendChild(b);
      spots.push(b);

      var li = el('li');
      var row = el('button', 'pg-trailers__row' + (t.locked ? ' is-locked' : '') + (hide ? ' is-hidden' : ''));
      row.type = 'button';
      row.appendChild(el('b', '', t.no));
      row.appendChild(el('span', '', hide ? (t.member ? '숨은 멤버 트레일러' : '숨은 단체 트레일러') : t.title));
      row.appendChild(el('small', '', hide ? '찾아보기' : t.locked ? '공개 예정' : (t.video ? '재생' : '영상 자리')));
      row.addEventListener('click', function () { openTrailer(t); });
      li.appendChild(row);
      $('trailer-list').appendChild(li);
    });
    if (E) $('trailer-count').textContent = NS.t('숨은 트레일러 {n}/{n2}', { n: E.found().length, n2: E.list.length });
  }
  render();

  function byNo(no) { for (var i = 0; i < C.trailers.length; i++) if (C.trailers[i].no === no) return C.trailers[i]; return null; }
  if (E) E.onFind(function (id, open) {
    render();
    if (open) openTrailer(byNo(E.trailerOf(id)));
  });
  var q = /[?&]play=(\d{2})/.exec(window.location.search);
  if (q && byNo(q[1]) && !hidden(byNo(q[1]))) openTrailer(byNo(q[1]));
})(window.CAVIAR = window.CAVIAR || {});
