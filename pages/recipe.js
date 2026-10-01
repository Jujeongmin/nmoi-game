/* RECIPE BOOK — the B-cut card collection (polaroid browser + full-size viewer and save).
   B-cut n is the reward card of bingo mission n (shared/cv-bingo.js): locked until done. */
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
  function two(n) { return ('0' + n).slice(-2); }

  // Header
  $('link-home').href = NS.hub.link('index.html#cans');   // back to the can (game) selection
  NS.bingoUI.mount();
  if (NS.sound) NS.sound.bgm('pages');
  $('btn-bingo').addEventListener('click', function () { NS.bingoUI.open(); });

  // B-cut polaroid
  var index = 0;
  function showBcut(i) {
    var list = C.bcuts;
    index = (i + list.length) % list.length;
    var b = list[index];
    var lock = NS.bingo.bcut(index);
    var photo = $('bcut-photo');
    photo.innerHTML = '';
    if (lock.unlocked) {
      photo.appendChild(NS.assetSlot({
        name: '멤버 B컷 이미지 ' + two(index + 1),
        spec: b.member + ' · 세로 4:5',
        src: b.image,
        className: 'pg-polaroid__img'
      }));
    } else {
      var locked = el('div', 'pg-polaroid__lock');
      locked.appendChild(el('b', '', 'LOCKED'));
      locked.appendChild(el('span', '', '미션 「' + lock.mission.title + '」'));
      locked.appendChild(el('span', '', '달성하면 이 B컷이 열려요'));
      photo.appendChild(locked);
    }
    $('bcut-card').classList.toggle('is-locked', !lock.unlocked);
    $('bcut-open').textContent = lock.unlocked ? '크게 보기 · 저장하기' : '미션 보기 →';
    $('bcut-caption').textContent = b.caption;
    $('bcut-no').textContent = two(index + 1) + ' / ' + two(list.length);
    $('bcut-member').textContent = b.member;
    $('bcut-msg').textContent = b.message;
    var card = $('bcut-card');
    card.classList.remove('is-turn');
    void card.offsetWidth;
    card.classList.add('is-turn');
  }
  $('bcut-prev').addEventListener('click', function () { showBcut(index - 1); });
  $('bcut-next').addEventListener('click', function () { showBcut(index + 1); });
  $('bcut-card').addEventListener('click', function () { openViewer(); });
  $('bcut-open').addEventListener('click', function () { openViewer(); });
  NS.bingo.onChange(function () { showBcut(index); });

  /* ---------- Viewer + save ---------- */
  var viewer = $('viewer');
  function renderViewer() {
    var b = C.bcuts[index];
    var box = $('viewer-photo');
    box.innerHTML = '';
    box.appendChild(NS.assetSlot({ name: '멤버 B컷 이미지 ' + two(index + 1), spec: b.member + ' · 원본 해상도로 표시 · 저장 가능', src: b.image, className: 'pg-viewer__img' }));
    $('viewer-no').textContent = two(index + 1) + ' / ' + two(C.bcuts.length);
    $('viewer-cap').textContent = b.member + ' · ' + b.caption;
  }
  function missionCell(id) {
    var cells = NS.bingo.cells();
    for (var i = 0; i < cells.length; i++) if (cells[i].id === id) return i;
    return undefined;
  }
  function openViewer() {
    var lock = NS.bingo.bcut(index);
    if (!lock.unlocked) { NS.bingoUI.open(missionCell(lock.mission.id)); return; }
    renderViewer();
    viewer.hidden = false;
  }
  function closeViewer() { viewer.hidden = true; }
  $('viewer-close').addEventListener('click', closeViewer);
  // Viewer steps only through unlocked B-cuts.
  function stepUnlocked(dir) {
    for (var k = 1; k <= C.bcuts.length; k++) {
      var i = (index + dir * k + C.bcuts.length) % C.bcuts.length;
      if (NS.bingo.bcut(i).unlocked) { showBcut(i); renderViewer(); return; }
    }
  }
  $('viewer-prev').addEventListener('click', function () { stepUnlocked(-1); });
  $('viewer-next').addEventListener('click', function () { stepUnlocked(1); });
  document.addEventListener('keydown', function (e) {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') $('viewer-prev').click();
    if (e.key === 'ArrowRight') $('viewer-next').click();
  });

  // Placeholder file so the save flow can be demoed before the real B-cuts arrive.
  function placeholderBlob(b, no) {
    var c = document.createElement('canvas');
    c.width = 1080; c.height = 1350;
    var g = c.getContext('2d');
    g.fillStyle = '#f3ede0'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#c9ae78'; g.lineWidth = 4; g.strokeRect(48, 48, c.width - 96, c.height - 96);
    g.fillStyle = '#1a1612'; g.textAlign = 'center';
    g.font = '600 64px Cinzel, serif'; g.fillText('B-CUT ' + two(no), c.width / 2, 600);
    g.font = '500 44px "Noto Sans KR", sans-serif'; g.fillText(b.member, c.width / 2, 690);
    g.fillStyle = '#7a5f2e'; g.font = '500 32px "Noto Sans KR", sans-serif';
    g.fillText(NS.t('멤버 B컷 이미지가 들어올 자리 (에셋 교체 예정)'), c.width / 2, 780);
    return new Promise(function (resolve) { c.toBlob(resolve, 'image/png'); });
  }

  function fileName(no, type) {
    var ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : 'jpg';
    return 'nMoi_Caviar_Bcut_' + two(no) + '.' + ext;
  }

  function download(blob, name) {
    var file = null;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) { file = null; }
    // Phones: the share sheet offers "Save Image" to the photo library.
    var phone = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (phone && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name }).catch(function () {});
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  $('viewer-save').addEventListener('click', function () {
    var b = C.bcuts[index], no = index + 1, btn = this;
    if (!NS.bingo.bcut(index).unlocked) return;
    btn.disabled = true;
    var job = b.image
      ? fetch(NS.url(b.image)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      : placeholderBlob(b, no);
    job.then(function (blob) { return download(blob, fileName(no, blob.type)); })
      .catch(function () { if (b.image) window.open(NS.url(b.image), '_blank'); })  // fallback: long-press to save
      .then(function () { btn.disabled = false; });
  });

  showBcut(0);
})(window.CAVIAR = window.CAVIAR || {});
