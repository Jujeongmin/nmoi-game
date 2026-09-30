/* Member sprite window in the DOM — one implementation for every chibi on the pages
   (landing serving scene, game result cards, Escape's picker and result figure).

   The sheet is an <img> inside a clipping box, moved to the frame with whole pixels; frames
   advance on one shared requestAnimationFrame loop. No CSS custom properties in
   background-size / keyframes: some mobile browsers and in-app web views drop those, and the
   box then shows the whole sheet (and fractional offsets blur the art).

   CAVIAR.sprite.show(box, member, anim, { cell, ox, oy, play })
     cell: display px per sheet cell · ox/oy: where the cell's top-left sits in the box
     play: animate the row (loops, or holds the last frame for non-looping rows)
   CAVIAR.sprite.clear(box)
   Needs cv-storage.js (CAVIAR.url). Styles: .cv-spr in cv-theme.css. */
(function (NS) {
  'use strict';

  var live = [];   // boxes that animate
  var raf = 0;

  function reduced() {
    return document.documentElement.classList.contains('cv-reduce-motion');
  }

  function place(s, frame) {
    s.img.style.transform = 'translate(' + Math.round(s.ox - frame * s.cell) + 'px,' + Math.round(s.oy - s.row * s.cell) + 'px)';
    s.frame = frame;
  }

  function tick(now) {
    raf = 0;
    for (var i = live.length - 1; i >= 0; i--) {
      var s = live[i];
      if (!s.box.isConnected) { live.splice(i, 1); continue; }
      var f = reduced() ? 0 : Math.floor((now - s.t0) / 1000 * s.fps);
      f = s.loop ? f % s.frames : Math.min(f, s.frames - 1);
      if (f !== s.frame) place(s, f);
    }
    if (live.length) raf = requestAnimationFrame(tick);
  }

  function show(box, member, anim, o) {
    var a = member.anims[anim] || member.anims.idle;
    var cols = 0, rows = 0;
    for (var k in member.anims) {
      cols = Math.max(cols, member.anims[k].frames);
      rows = Math.max(rows, member.anims[k].row + 1);
    }
    var s = box.__sprite;
    if (!s) {
      var img = document.createElement('img');
      img.className = 'cv-spr__sheet';
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      box.classList.add('cv-spr');
      box.appendChild(img);
      s = box.__sprite = { box: box, img: img };
    }
    var cell = Math.round(o.cell);
    var src = NS.url(member.sheet);
    if (s.src !== src) { s.img.src = src; s.src = src; }
    s.img.style.width = cols * cell + 'px';
    s.img.style.height = rows * cell + 'px';
    s.cell = cell;
    s.ox = o.ox;
    s.oy = o.oy;
    s.row = a.row;
    s.frames = a.frames;
    s.fps = a.fps;
    s.loop = a.loop !== false;
    s.t0 = performance.now();
    s.frame = -1;
    place(s, 0);
    var i = live.indexOf(s);
    if (o.play && a.frames > 1) {
      if (i < 0) live.push(s);
      if (!raf) raf = requestAnimationFrame(tick);
    } else if (i >= 0) {
      live.splice(i, 1);
    }
  }

  function clear(box) {
    var s = box.__sprite;
    if (!s) return;
    var i = live.indexOf(s);
    if (i >= 0) live.splice(i, 1);
    s.img.remove();
    box.classList.remove('cv-spr');
    box.__sprite = null;
  }

  NS.sprite = { show: show, clear: clear };
})(window.CAVIAR = window.CAVIAR || {});
