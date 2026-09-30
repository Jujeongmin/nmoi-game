/* CAVIAR BINGO — DOM: board overlay (TIER 1, behind the V8 login), mission link on a
   game's title card, mission / rank / pre-save blocks on a game's result card.
   Styles: shared/cv-bingo.css. Needs cv-storage, cv-campaign, cv-account, cv-bingo.

   Landing:  CAVIAR.bingoUI.mount();  then .open()
   Game:     CAVIAR.bingoUI.attachGame(gameId);
             CAVIAR.bingoUI.showRun(gameId, CAVIAR.bingo.report(gameId, stats)); */
(function (NS) {
  'use strict';

  var B = NS.bingo;
  var A = NS.account;
  var CFG = NS.campaign.config;
  var overlay = null, els = {}, selected = null, currentGame = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function host() { return document.getElementById('app') || document.body; }
  function weekLabel(i) { var w = NS.campaign.weeks[i]; return w.label + ' · ' + NS.campaign.md(w.start); }

  function build() {
    overlay = el('div', 'cv-overlay cv-bingo');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', '캐비어 빙고');
    var panel = el('div', 'cv-panel cv-bingo__panel');

    var head = el('div', 'cv-bingo__head');
    head.appendChild(el('p', 'cv-eyebrow', 'TIER 1 · MISSION BINGO'));
    els.title = el('h2', 'cv-bingo__title');
    els.sub = el('p', 'cv-bingo__sub');
    head.appendChild(els.title);
    head.appendChild(els.sub);

    els.body = el('div', 'cv-bingo__body');
    els.board = el('div', 'cv-bingo__board');
    els.board.setAttribute('role', 'grid');
    els.detail = el('div', 'cv-bingo__detail');
    els.gate = el('div', 'cv-bingo__gate');
    els.body.appendChild(els.board);
    els.body.appendChild(els.detail);

    var close = el('button', 'cv-btn cv-bingo__close', '닫기');
    close.type = 'button';
    close.addEventListener('click', api.close);

    panel.appendChild(head);
    panel.appendChild(els.gate);
    panel.appendChild(els.body);
    panel.appendChild(close);
    if (NS.brand) NS.brand.badge(panel);
    overlay.appendChild(panel);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) api.close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('is-open')) api.close(); });
    host().appendChild(overlay);
  }

  /* ---------- TIER 1 gate (V8 login placeholder) ---------- */

  function renderGate() {
    var g = els.gate;
    g.innerHTML = '';
    g.appendChild(el('p', 'cv-bingo__gate-title', '더 큰 보상은 V8 로그인'));
    g.appendChild(el('p', 'cv-bingo__desc', '게임·프리세이브는 로그인 없이 계속할 수 있어요. 빙고 미션과 상위 보상은 Verse8 소셜 1탭 로그인 후 열려요.'));
    var list = el('ul', 'cv-bingo__gate-list');
    B.rewards.forEach(function (r) { var li = el('li'); li.appendChild(el('b', '', r.label)); li.appendChild(document.createTextNode(' ' + r.reward)); list.appendChild(li); });
    g.appendChild(list);
    g.appendChild(NS.assetSlot({ name: 'Verse8 소셜 1탭 로그인', spec: '로그인 연결 주소를 받으면 이 버튼이 Verse8 로그인으로 연결됩니다', className: 'cv-bingo__gate-slot' }));
    var demo = el('button', 'cv-presave-link__demo cv-bingo__gate-demo', '데모: 로그인한 것으로 보기');
    demo.type = 'button';
    demo.addEventListener('click', function () { A.setDemoLogin(true); renderBoard(); });
    g.appendChild(demo);
  }

  /* ---------- board ---------- */

  function tinImage(cell) {
    var src = cell.done ? B.art.filled[cell.tone] : B.art.empty;
    var img = el('img', 'cv-bingo__tin');
    img.alt = '';
    img.decoding = 'async';
    img.onerror = function () { img.removeAttribute('src'); img.classList.add('cv-bingo__tin--css'); };
    img.src = NS.url(src);
    return img;
  }

  var SVG = 'http://www.w3.org/2000/svg';
  function renderLines(lines) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'cv-bingo__lines');
    svg.setAttribute('viewBox', '0 0 ' + B.size + ' ' + B.size);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    lines.forEach(function (line) {
      var a = line[0], z = line[line.length - 1];
      var l = document.createElementNS(SVG, 'line');
      l.setAttribute('x1', a % B.size + 0.5); l.setAttribute('y1', Math.floor(a / B.size) + 0.42);
      l.setAttribute('x2', z % B.size + 0.5); l.setAttribute('y2', Math.floor(z / B.size) + 0.42);
      svg.appendChild(l);
    });
    return svg;
  }

  function renderBoard() {
    var logged = A.loggedIn();
    els.gate.hidden = logged;
    els.body.hidden = !logged;
    var st = A.state();
    var lines = B.lines();
    els.title.textContent = !logged ? 'CAVIAR BINGO' : lines.length ? 'BINGO × ' + lines.length : 'CAVIAR BINGO';
    els.sub.innerHTML = '';
    els.sub.appendChild(document.createTextNode('미션 '));
    els.sub.appendChild(el('b', '', B.missionCount() + ' / 15'));
    els.sub.appendChild(document.createTextNode(' · 응모권 '));
    els.sub.appendChild(el('b', '', st.tickets + '장'));
    if (!logged) { renderGate(); return; }

    var cells = B.cells();
    var fresh = B.unseen();
    els.board.innerHTML = '';
    cells.forEach(function (cell) {
      var b = el('button', 'cv-bingo__cell cv-bingo__cell--' + cell.tone);
      b.type = 'button';
      if (cell.done) b.classList.add('is-done');
      if (cell.locked) b.classList.add('is-locked');
      if (cell.done && fresh.indexOf(cell.id) >= 0) b.classList.add('is-fresh');
      if (cell.type === 'presave') b.classList.add('is-presave');
      if (selected === cell.index) b.classList.add('is-selected');
      b.setAttribute('aria-label', cell.quest.title + (cell.done ? ' — 완료' : cell.locked ? ' — 잠김' : ''));
      b.appendChild(tinImage(cell));
      b.appendChild(el('span', 'cv-bingo__name', cell.locked ? NS.campaign.md(NS.campaign.weeks[cell.week].start) + ' 공개' : cell.quest.title));
      b.addEventListener('click', function () { selected = cell.index; renderBoard(); });
      els.board.appendChild(b);
    });
    if (lines.length) els.board.appendChild(renderLines(lines));
    // After the translation pass (a microtask): long names shrink instead of wrapping.
    setTimeout(function () { oneLine(els.board.querySelectorAll('.cv-bingo__name'), 8); }, 0);
    B.markSeen();
    renderDetail(cells);
  }

  /* Keep each label on one line: step the font down (to minPx at most) while it overflows. */
  function oneLine(nodes, minPx) {
    Array.prototype.forEach.call(nodes, function (n) {
      n.style.fontSize = '';
      if (!n.clientWidth) return;   // not laid out (board hidden)
      var fs = parseFloat(getComputedStyle(n).fontSize);
      while (n.scrollWidth > n.clientWidth + 0.5 && fs > minPx) {
        fs -= 0.5;
        n.style.fontSize = fs + 'px';
      }
    });
  }

  function rewardTiers() {
    var tiers = el('div', 'cv-bingo__rewards');
    var state = [B.missionCount() + '/15장', B.lines().length + '줄', B.fullBoard() ? '달성' : '—'];
    var on = [B.missionCount() > 0, B.lines().length > 0, B.fullBoard()];
    B.rewards.forEach(function (r, i) {
      var t = el('div', 'cv-bingo__reward' + (on[i] ? ' is-on' : ''));
      t.appendChild(el('b', '', r.label));
      t.appendChild(el('span', '', r.reward));
      t.appendChild(el('em', '', state[i]));
      tiers.appendChild(t);
    });
    return tiers;
  }

  function inviteBlock() {
    var box = el('div', 'cv-invite');
    var link = A.inviteLink();
    var st = A.state();
    box.appendChild(el('p', 'cv-invite__count', '지금까지 인정된 친구 ' + st.referrals + '명'));
    if (!link) {
      box.appendChild(el('p', 'cv-bingo__desc', '레스토랑 주문서(닉네임·이메일)를 작성하면 내 초대 링크가 만들어져요. (Verse8 서버 연결 필요)'));
      return box;
    }
    var field = el('input', 'cv-invite__field');
    field.readOnly = true;
    field.value = link;
    field.setAttribute('aria-label', '내 초대 링크');
    var copy = el('button', 'cv-bingo__link', '링크 복사');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = '복사됨'; };
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, function () { field.select(); });
      else field.select();
    });
    box.appendChild(field);
    var row = el('div', 'cv-bingo__actions');
    row.appendChild(copy);
    if (navigator.share) {
      var share = el('button', 'cv-bingo__link', '공유하기');
      share.type = 'button';
      share.addEventListener('click', function () { navigator.share({ title: 'n Moi Caviar', url: link }).catch(function () {}); });
      row.appendChild(share);
    }
    box.appendChild(row);
    box.appendChild(el('p', 'cv-invite__rule', '새 이메일로 들어온 친구가 프리세이브를 눌러야 1명으로 인정돼요.'));
    return box;
  }

  function renderDetail(cells) {
    var d = els.detail;
    d.innerHTML = '';
    var cell = selected === null ? null : cells[selected];
    if (!cell) {
      d.appendChild(el('p', 'cv-bingo__hint', '칸을 누르면 미션을 볼 수 있어요. 미션마다 B컷 카드가 열려요.'));
      d.appendChild(rewardTiers());
      d.appendChild(el('p', 'cv-bingo__note', B.rewardNote));
      return;
    }
    var q = cell.quest;
    var kind = { score: '게임 스코어', rank: '게임 순위', refrank: '레퍼럴 순위', ref: '레퍼럴', att: '출석' }[cell.type];
    var metaText = cell.type === 'presave' ? 'SPECIAL · 프리세이브'
      : weekLabel(cell.week) + ' · ' + (cell.game ? cell.game.name + ' · ' : '') + kind;
    d.appendChild(el('p', 'cv-bingo__meta', metaText));
    var qt = el('p', 'cv-bingo__q', q.title);
    if (cell.done) qt.appendChild(el('span', 'cv-tag cv-bingo__done', '완료'));
    d.appendChild(qt);
    d.appendChild(el('p', 'cv-bingo__desc', q.desc));
    var n = B.missions.indexOf(q);
    if (n >= 0) d.appendChild(el('p', 'cv-bingo__card', '달성 보상 · B컷 카드 #' + (n + 1)));

    if (cell.locked) {
      d.appendChild(el('p', 'cv-bingo__hint', NS.campaign.md(NS.campaign.weeks[cell.week].start) + '에 공개되는 미션이에요.'));
      return;
    }
    if (cell.done) return;
    var status = statusText(cell);
    if (status) d.appendChild(el('p', 'cv-bingo__hint', status));
    if (cell.type === 'presave' && NS.presave) {
      d.appendChild(NS.presave.linkBlock(function () { renderBoard(); refreshLinks(); }));
    } else if (cell.type === 'ref' || cell.type === 'refrank') {
      d.appendChild(inviteBlock());
    } else if (cell.type === 'att') {
      d.appendChild(el('p', 'cv-bingo__hint', '방문해서 게임을 1판 끝낸 날만 출석이에요 · 지금까지 ' + A.days() + '일'));
    } else if (cell.game && cell.gameId !== currentGame) {
      var actions = el('div', 'cv-bingo__actions');
      var play = el('a', 'cv-bingo__link', '게임하러 가기 →');
      play.href = NS.hub ? NS.hub.gameUrl(cell.game.path) : NS.url(cell.game.path + 'index.html');
      actions.appendChild(play);
      d.appendChild(actions);
    }
  }

  /* Progress the server reported for a cell (ranks: current standing until the week ends). */
  function statusText(cell) {
    var st = cell.status;
    if (cell.type === 'score' && st && st.need) return '지금 최고 ' + st.best.toLocaleString('en-US') + '점 · ' + (st.need - st.best).toLocaleString('en-US') + '점 남음';
    if (cell.type !== 'rank' && cell.type !== 'refrank') return '';
    if (!st) return 'Verse8 서버에서 순위를 집계해요';
    if (!st.rank) return st.final ? '이번 주 기록이 없어 달성하지 못했어요' : '이번 주 기록이 생기면 순위가 표시돼요';
    var line = (st.final ? '최종 ' : '지금 ') + st.rank + '위 / ' + st.total + '명 · ' + st.cutoff + '위 안이면 달성';
    return st.final ? line + ' — 아쉽게 달성하지 못했어요' : line + ' (주 마감 때 판정)';
  }

  /* ---------- progress bar + booster nudge (landing + result cards) ---------- */

  /* compact (result cards): no pre-save line (the pre-save button says it), and the head
     links to the bingo board. */
  function progressBlock(dark, compact, gained) {
    var p = B.weekProgress();
    var box = el('div', 'cv-progress' + (dark ? ' is-dark' : ''));
    var head = el('p', 'cv-progress__head');
    head.appendChild(el('b', '', NS.campaign.weeks[p.week].label + ' 미션 ' + p.done + ' / ' + p.total));
    head.appendChild(document.createTextNode(' · 응모권 ' + A.state().tickets + '장'));
    if (gained) head.appendChild(el('span', 'cv-progress__gain', '+' + gained));   // this run's tickets
    if (compact) {
      var go = el('button', 'cv-progress__link', '빙고판 ›');
      go.type = 'button';
      go.addEventListener('click', function () { api.open(); });
      head.appendChild(go);
    }
    box.appendChild(head);
    var bar = el('div', 'cv-progress__bar');
    var fill = el('span');
    fill.style.width = Math.round(p.done / p.total * 100) + '%';
    bar.appendChild(fill);
    box.appendChild(bar);
    if (!compact && !A.presaved() && !NS.campaign.isReleased()) {
      box.appendChild(el('p', 'cv-progress__nudge', '프리세이브하면 점수 x' + CFG.booster + ' · 하루 1판 더 · 응모권 +' + CFG.tickets.presave));
    }
    return box;
  }

  /* ---------- game cards ---------- */

  var titleLinks = [];
  function questLinkText(gameId) {
    var p = B.progress(gameId);
    return '이 게임 미션 ' + p.done + '/' + p.total + ' · 빙고판 보기';
  }
  function refreshLinks() { titleLinks.forEach(function (l) { l.btn.textContent = questLinkText(l.game); }); }
  function insertBeforeActions(panel, node) {
    var actions = panel.querySelector('.cv-actions');
    if (actions) panel.insertBefore(node, actions); else panel.appendChild(node);
  }

  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  /* The guest's member reacts to the run (overview S4 멤버 멘트): a finished mission or a new
     best → dance, a scored run → idle, nothing → frown. */
  function memberLine(gameId, fresh) {
    if (!NS.chibi || !NS.chibi.member()) return null;
    var run = B.lastRun(gameId);
    var score = run ? run.score : 0;
    var best = NS.storage.scope(gameId).getNumber('best', 0);
    var anim, key;
    if (fresh && fresh.length) { anim = 'dance'; key = 'mission'; }
    else if (score > 0 && score >= best) { anim = 'dance'; key = 'best'; }
    else if (score > 0) { anim = 'idle'; key = 'ok'; }
    else { anim = 'frown'; key = 'low'; }
    var wrap = el('div', 'cv-result-member');
    var chibi = NS.chibi.create(wrap);
    var talkBox = el('div', 'cv-result-member__talk');
    var line = el('p', 'cv-result-member__line');
    var name = el('b', '', chibi.member.name);
    var said = document.createTextNode('');
    line.appendChild(name);
    line.appendChild(said);
    talkBox.appendChild(line);
    wrap.appendChild(talkBox);
    function say(k) { said.nodeValue = NS.talk ? NS.talk.line(k) : ''; }
    say(key);

    // The guest answers; the member replies, then the answer happens (overview S4: 다시 하기 ·
    // 빙고 · 프리세이브).
    if (NS.talk) {
      var retry = document.getElementById('btn-retry');
      var acts = {
        again: retry ? function () { retry.click(); } : null,
        bingo: function () { api.open(); },
        presave: !A.presaved() && !NS.campaign.isReleased() && NS.presave ? function () { if (!NS.presave.open()) NS.presave.interstitial(); } : null
      };
      var replies = el('div', 'cv-result-member__replies');
      Object.keys(acts).forEach(function (k) {
        if (!acts[k]) return;
        var r = el('button', 'cv-result-member__reply', NS.talk.reply(k));
        r.type = 'button';
        r.addEventListener('click', function () {
          say(k);
          chibi.play(k === 'bingo' ? 'idle' : 'dance', 1400);
          replies.remove();
          NS.track('talk_reply', { game: gameId, reply: k });
          setTimeout(acts[k], 900);
        });
        replies.appendChild(r);
      });
      talkBox.appendChild(replies);
    }
    setTimeout(function () { chibi.play(anim); }, 0);   // once it is in the card and has a size
    return wrap;
  }

  /* S4 nudge (overview §5): the real score x booster — never a made-up number — and what it
     would have meant for the score mission. Pre-saved guests get their invite link here. */
  function boosterNudge(gameId) {
    var run = B.lastRun(gameId);
    if (!run || !NS.presave) return null;
    var need = run.need && run.need.need;
    var wrap = el('div', 'cv-nudge');
    if (NS.campaign.isReleased()) {
      wrap.appendChild(ctaButton('n Moi 신곡 Spotify에서 듣기 →'));
      return wrap;
    }
    if (A.presaved()) {
      var mine = Math.floor(run.score * CFG.booster);
      if (need && mine < need) wrap.appendChild(el('p', 'cv-nudge__text', '부스터 x' + CFG.booster + ' 적용 ' + fmt(mine) + '점 · 미션(' + fmt(need) + '점)까지 ' + fmt(need - mine) + '점'));
      var link = A.inviteLink();
      if (link) wrap.appendChild(copyButton(link));
      return wrap.childNodes.length ? wrap : null;
    }
    var boosted = Math.floor(run.score * CFG.booster);
    var text = '부스터였으면 ' + fmt(boosted) + '점';
    if (need && run.score < need && boosted >= need) text += ' → 미션 달성이었어요';
    else if (need && boosted < need) text += ' · 미션(' + fmt(need) + '점)까지 ' + fmt(need - boosted) + '점';
    wrap.appendChild(el('p', 'cv-nudge__text', text));
    wrap.appendChild(ctaButton('Spotify 프리세이브 · 다음 판부터 x' + CFG.booster + ' →'));
    return wrap;
  }

  function ctaButton(label) {
    var ps = el('button', 'cv-presave-cta');
    ps.type = 'button';
    ps.appendChild(el('span', 'cv-presave-cta__tag', NS.campaign.isReleased() ? 'SPOTIFY' : 'PRE-SAVE'));
    ps.appendChild(el('span', '', label));
    ps.addEventListener('click', function () { if (!NS.presave.open()) NS.presave.interstitial(); });
    return ps;
  }

  function copyButton(link) {
    var b = el('button', 'cv-presave-cta', '');
    b.type = 'button';
    b.appendChild(el('span', 'cv-presave-cta__tag', 'INVITE'));
    var label = el('span', '', '내 초대 링크 복사 · 친구가 프리세이브하면 미션 +1');
    b.appendChild(label);
    b.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { label.textContent = '초대 링크를 복사했어요'; }, function () {});
    });
    return b;
  }

  /* Share: +1 ticket once per game per day (overview §3). */
  function shareButton(gameId) {
    var b = el('button', 'cv-share');
    b.type = 'button';
    function render() {
      var done = A.shared(gameId);
      b.disabled = done;
      b.textContent = done ? '오늘 공유 완료 · 응모권 +' + CFG.tickets.share : '공유하고 응모권 +' + CFG.tickets.share;
    }
    b.addEventListener('click', function () {
      var url = A.inviteLink() || NS.url('index.html');
      var text = NS.t('n Moi 캐비어 레스토랑에서 게임하고 프리세이브!');
      var finish = function () { A.share(gameId); render(); };
      var copied = function () { finish(); b.textContent = '링크를 복사했어요 · 응모권 +' + CFG.tickets.share; };
      // Clipboard API can be refused (permissions, embedded frames): copy through a hidden field.
      var fallback = function () {
        var f = el('textarea', 'cv-share__field');
        f.value = url;
        f.setAttribute('readonly', '');
        f.style.position = 'fixed';
        f.style.opacity = '0';
        document.body.appendChild(f);
        f.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        f.remove();
        if (ok) { copied(); return; }
        try { window.prompt(NS.t('이 링크를 복사해서 공유해 주세요'), url); } catch (e) { /* no dialogs here */ }
      };
      if (navigator.share) navigator.share({ title: 'n Moi Caviar', text: text, url: url }).then(finish, function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(copied, fallback);
      else fallback();
    });
    render();
    return b;
  }

  var api = {
    progressBlock: progressBlock,
    inviteBlock: inviteBlock,
    mount: function () { if (!overlay) build(); },

    open: function (focusIndex) {
      api.mount();
      selected = typeof focusIndex === 'number' ? focusIndex : null;
      renderBoard();
      overlay.classList.add('is-open');
    },

    close: function () {
      if (overlay) overlay.classList.remove('is-open');
      refreshLinks();
    },

    /** Title card: missions link, runs left / week lock (cv-account). */
    attachGame: function (gameId) {
      currentGame = gameId;
      api.mount();
      var panel = document.querySelector('#screen-title .cv-panel');
      if (!panel) return;
      var btn = el('button', 'cv-quest-link', questLinkText(gameId));
      btn.type = 'button';
      btn.addEventListener('click', function () { api.open(); });
      insertBeforeActions(panel, btn);
      titleLinks.push({ btn: btn, game: gameId });
      A.attachGame(gameId);
    },

    /** Result card: new missions, run tickets, booster nudge (S4), rank, share. */
    showRun: function (gameId, fresh) {
      refreshLinks();
      var panel = document.querySelector('#screen-result .cv-panel');
      if (!panel) return;
      var box = panel.querySelector('.cv-quest-result');
      if (!box) { box = el('div', 'cv-quest-result'); insertBeforeActions(panel, box); }
      box.innerHTML = '';
      if (fresh && fresh.length) {
        box.classList.add('is-new');
        box.appendChild(el('p', 'cv-quest-result__head', '미션 달성 · B컷 카드가 열렸어요'));
        fresh.forEach(function (q) { box.appendChild(el('p', 'cv-quest-result__item', q.title + ' — ' + q.desc)); });
      } else {
        box.classList.remove('is-new');
      }
      var gained = A.runGrants(gameId).reduce(function (t, g) { return t + g.n; }, 0);
      box.appendChild(progressBlock(fresh && fresh.length, true, gained));

      var member = memberLine(gameId, fresh);
      if (member) box.insertBefore(member, box.firstChild);
      var nudge = boosterNudge(gameId);
      if (nudge) box.appendChild(nudge);
      if (NS.leaderboard) NS.leaderboard.renderResult(box, gameId);
      box.appendChild(shareButton(gameId));
      if (NS.brand) NS.brand.badge(panel);
    }
  };

  B.onChange(function () { refreshLinks(); if (overlay && overlay.classList.contains('is-open')) renderBoard(); });

  NS.bingoUI = api;
})(window.CAVIAR = window.CAVIAR || {});
