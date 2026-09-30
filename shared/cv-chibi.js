/* Member chibi sprites in the DOM (sheets and rows from assets/chibi/members.js).
   CAVIAR.chibi.member(id)                   member record (the guest's member when id is empty)
   CAVIAR.chibi.create(host, { className })  → { el, member, play(anim, holdMs), setMember(id) }
     play('idle' | 'frown' | 'dance', holdMs): after holdMs the member goes back to idle.
   The member is the one the guest's order picked (cv-hub), else the first of the list.
   Needs assets/chibi/members.js (and cv-hub.js for the guest's member). Styles: cv-theme.css. */
(function (NS) {
  'use strict';

  function member(id) {
    var list = NS.members || [];
    var want = id || (NS.hub && NS.hub.memberId && NS.hub.memberId());
    for (var i = 0; i < list.length; i++) if (list[i].id === want) return list[i];
    return list[0] || null;
  }

  /* Point a sprite element at one row of a member sheet: the body centred and standing on
     the bottom of a boxW x boxH box, cellPx = display size of one sheet cell. */
  function apply(node, m, anim, cellPx, boxW, boxH) {
    var a = m.anims[anim] || m.anims.idle;
    var b = m.bounds, k = cellPx / m.cell;
    var cols = 0, rows = 0;
    for (var key in m.anims) {
      cols = Math.max(cols, m.anims[key].frames);
      rows = Math.max(rows, m.anims[key].row + 1);
    }
    var st = node.style;
    st.setProperty('--sheet', 'url("' + NS.url(m.sheet) + '")');
    st.setProperty('--cell', cellPx + 'px');
    st.setProperty('--cols', cols);
    st.setProperty('--rows', rows);
    st.setProperty('--row', a.row);
    st.setProperty('--frames', a.frames);
    st.setProperty('--frames-1', Math.max(1, a.frames - 1));
    st.setProperty('--dur', (a.frames / a.fps) + 's');
    st.setProperty('--ox', (boxW / 2 - (b.x + b.w / 2) * k) + 'px');
    st.setProperty('--oy', (boxH - 2 - (b.y + b.h) * k) + 'px');
    node.classList.toggle('is-once', a.loop === false);
    node.classList.remove('is-playing');
    void node.offsetWidth;   // restart the row
    node.classList.add('is-playing');
  }

  function create(host, opts) {
    opts = opts || {};
    var box = document.createElement('div');
    box.className = 'cv-chibi' + (opts.className ? ' ' + opts.className : '');
    box.setAttribute('aria-hidden', 'true');
    var sprite = document.createElement('div');
    sprite.className = 'cv-sprite';
    box.appendChild(sprite);
    host.appendChild(box);

    var m = member(opts.member);
    var current = 'idle', timer = null;
    function draw(anim) {
      if (!m) return;
      var w = box.clientWidth || 90, h = box.clientHeight || 110;
      apply(sprite, m, anim, Math.round(h / m.bounds.h * m.cell * 0.94), w, h);
    }
    var api = {
      el: box,
      get member() { return m; },
      play: function (anim, holdMs) {
        clearTimeout(timer);
        current = anim;
        draw(anim);
        if (holdMs && anim !== 'idle') timer = setTimeout(function () { current = 'idle'; draw('idle'); }, holdMs);
      },
      setMember: function (id) { m = member(id); draw(current); }
    };
    if (window.ResizeObserver) new ResizeObserver(function () { draw(current); }).observe(box);
    draw('idle');
    return api;
  }

  NS.chibi = { member: member, apply: apply, create: create };
})(window.CAVIAR = window.CAVIAR || {});
