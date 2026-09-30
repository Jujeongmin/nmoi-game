/* Admin: the participant list (nickname, e-mail, tickets ...) and the admin roster, inside
   the settings panel of the landing. The Verse8 server decides who is an admin (whoAmI) and
   refuses everyone else; other guests see only their own account id, which an admin can add.

   CAVIAR.admin.settings(panel)   adds the admin (or "내 계정 ID") part to the settings panel
   CAVIAR.admin.open(tab)         'list' | 'admins'
   Needs cv-storage.js (whenServer) and the Verse8 server bridge; offline it shows nothing. */
(function (NS) {
  'use strict';

  var WAIT_MS = 6000;
  var box = null, who = null, rows = [], loading = false, tab = 'list';
  var view = { q: '', sort: 'joined' };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function server() {
    if (NS.server) return Promise.resolve(NS.server);
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('offline')); }, WAIT_MS);
      if (NS.whenServer) NS.whenServer(function (s) { clearTimeout(t); resolve(s); });
    });
  }
  function whoAmI() {
    if (!who) who = server().then(function (s) { return s.whoAmI(); });
    who.catch(function () { who = null; });
    return who;
  }
  function day(ts) {
    if (!ts) return '';
    var d = new Date(ts + 9 * 3600 * 1000);   // KST
    return d.toISOString().slice(0, 10);
  }

  /* ---------- settings panel ---------- */

  function settings(panel) {
    var host = el('section', 'cv-settings__section cv-admin-entry');
    host.hidden = true;
    var actions = panel.querySelector(':scope > .cv-actions');
    panel.insertBefore(host, actions);
    whoAmI().then(function (me) {
      host.innerHTML = '';
      host.hidden = false;
      if (me.admin) {
        host.appendChild(el('h3', 'cv-settings__head', '관리자'));
        var links = el('div', 'cv-settings__links');
        [['참가자 명단 보기', 'list'], ['관리자 관리', 'admins']].forEach(function (a) {
          var b = el('button', 'cv-settings__link', a[0]);
          b.type = 'button';
          b.addEventListener('click', function () { open(a[1]); });
          links.appendChild(b);
        });
        host.appendChild(links);
      } else {
        var show = el('button', 'cv-settings__link cv-admin-entry__id', '내 계정 ID 보기');
        show.type = 'button';
        show.addEventListener('click', function () {
          show.remove();
          var id = el('input', 'cv-admin-entry__field');
          id.readOnly = true;
          id.value = me.account;
          id.setAttribute('aria-label', '내 계정 ID');
          host.appendChild(id);
          host.appendChild(el('p', 'cv-settings__note', '관리자 등록이 필요하면 이 ID를 관리자에게 전달하세요.'));
          id.focus();
          id.select();
        });
        host.appendChild(show);
      }
    }, function () { host.remove(); });
  }

  /* ---------- overlay ---------- */

  function build() {
    box = el('div', 'cv-overlay cv-admin');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '관리자');
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    (document.getElementById('app') || document.body).appendChild(box);
  }
  function close() { if (box) box.classList.remove('is-open'); }

  function open(which) {
    if (!box) build();
    tab = which || 'list';
    box.classList.add('is-open');
    render();
    if (tab === 'list' && !rows.length && !loading) load();
  }

  function render() {
    box.innerHTML = '';
    var panel = el('div', 'cv-panel cv-admin__panel');
    box.appendChild(panel);
    panel.appendChild(el('p', 'cv-eyebrow', 'ADMIN'));
    var tabs = el('div', 'cv-admin__tabs');
    [['list', '참가자 명단'], ['admins', '관리자']].forEach(function (t) {
      var b = el('button', 'cv-admin__tab' + (tab === t[0] ? ' is-on' : ''), t[1]);
      b.type = 'button';
      b.addEventListener('click', function () { open(t[0]); });
      tabs.appendChild(b);
    });
    panel.appendChild(tabs);
    var body = el('div', 'cv-admin__body');
    panel.appendChild(body);
    if (tab === 'list') renderList(body); else renderAdmins(body);
    var foot = el('div', 'cv-actions');
    var closeBtn = el('button', 'cv-btn', '닫기');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', close);
    foot.appendChild(closeBtn);
    panel.appendChild(foot);
  }

  /* ---------- participant list ---------- */

  function load() {
    loading = true;
    rows = [];
    render();
    var byAccount = {};
    function page(after) {
      return server().then(function (s) { return s.adminParticipants(after, 200); }).then(function (res) {
        res.rows.forEach(function (r) { byAccount[r.account] = r; });   // a later row wins
        rows = Object.keys(byAccount).map(function (k) { return byAccount[k]; });
        if (box.classList.contains('is-open') && tab === 'list') render();
        return res.next ? page(res.next) : null;
      });
    }
    page(0).then(function () { loading = false; render(); }, function (err) {
      loading = false;
      rows = [];
      render();
      var msg = box.querySelector('.cv-admin__status');
      if (msg) msg.textContent = err && /not admin/.test(err.message) ? '관리자만 볼 수 있어요' : '서버에 연결하지 못했어요. 새로고침 후 다시 열어주세요.';
    });
  }

  function filtered() {
    var q = view.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      return !q || (r.nickname || '').toLowerCase().indexOf(q) >= 0 || (r.email || '').toLowerCase().indexOf(q) >= 0;
    });
    var key = view.sort;
    list.sort(function (a, b) {
      if (key === 'tickets') return b.tickets - a.tickets || a.joinedAt - b.joinedAt;
      if (key === 'referrals') return b.referrals - a.referrals || a.joinedAt - b.joinedAt;
      return a.joinedAt - b.joinedAt;
    });
    return list;
  }

  function renderList(body) {
    var presaved = rows.filter(function (r) { return r.presaved; }).length;
    var status = el('p', 'cv-admin__status', loading
      ? '불러오는 중… ' + rows.length + '명'
      : '참가자 ' + rows.length + '명 · 프리세이브 ' + presaved + '명');
    body.appendChild(status);

    var bar = el('div', 'cv-admin__bar');
    var q = el('input', 'cv-admin__search');
    q.type = 'search';
    q.placeholder = '닉네임·이메일 검색';
    q.value = view.q;
    q.addEventListener('input', function () { view.q = q.value; fillTable(); });
    bar.appendChild(q);
    var sort = el('select', 'cv-admin__sort');
    [['joined', '가입순'], ['tickets', '응모권 많은 순'], ['referrals', '초대 많은 순']].forEach(function (o) {
      var op = el('option', '', o[1]);
      op.value = o[0];
      if (view.sort === o[0]) op.selected = true;
      sort.appendChild(op);
    });
    sort.addEventListener('change', function () { view.sort = sort.value; fillTable(); });
    bar.appendChild(sort);
    body.appendChild(bar);

    var tools = el('div', 'cv-admin__tools');
    var csv = el('button', 'cv-admin__tool', 'CSV 저장');
    csv.type = 'button';
    csv.disabled = loading || !rows.length;
    csv.addEventListener('click', function () { saveCsv(body); });
    tools.appendChild(csv);
    var emails = el('button', 'cv-admin__tool', '이메일만 모아 보기');
    emails.type = 'button';
    emails.disabled = loading || !rows.length;
    emails.addEventListener('click', function () { showText(body, filtered().map(function (r) { return r.email; }).filter(Boolean).join('\n')); });
    tools.appendChild(emails);
    var reload = el('button', 'cv-admin__tool', '새로고침');
    reload.type = 'button';
    reload.disabled = loading;
    reload.addEventListener('click', load);
    tools.appendChild(reload);
    body.appendChild(tools);

    var wrap = el('div', 'cv-admin__table-wrap');
    var table = el('table', 'cv-admin__table');
    var head = el('tr');
    ['#', '닉네임', '이메일', '응모권', '프리세이브', '초대', '출석', '빙고 줄', '가입일'].forEach(function (h) { head.appendChild(el('th', '', h)); });
    var thead = el('thead');
    thead.appendChild(head);
    table.appendChild(thead);
    var tbody = el('tbody');
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);

    function fillTable() {
      tbody.innerHTML = '';
      var list = filtered();
      list.forEach(function (r, i) {
        var tr = el('tr');
        [String(i + 1), r.nickname, r.email, String(r.tickets), r.presaved ? '○' : '–', String(r.referrals), String(r.days), String(r.lines), day(r.joinedAt)]
          .forEach(function (v, k) { tr.appendChild(el('td', k === 2 ? 'is-email' : '', v)); });
        tbody.appendChild(tr);
      });
      if (!list.length && !loading) {
        var tr = el('tr');
        var td = el('td', 'cv-admin__empty', rows.length ? '검색 결과가 없어요' : '아직 참가자가 없어요');
        td.colSpan = 9;
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
    }
    fillTable();
  }

  function csvCell(v) {
    var s = String(v === undefined || v === null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* The game runs in a Verse8 frame that blocks downloads, so the file opens in a new tab
     (new tabs are allowed and may download); if that is blocked too, the text is shown. */
  function saveCsv(body) {
    var lines = [['닉네임', '이메일', '응모권', '프리세이브', '초대', '출석일', '빙고 줄', 'V8 로그인', '가입일', '계정 ID'].join(',')];
    filtered().forEach(function (r) {
      lines.push([r.nickname, r.email, r.tickets, r.presaved ? 'Y' : 'N', r.referrals, r.days, r.lines, r.v8 ? 'Y' : 'N', day(r.joinedAt), r.account].map(csvCell).join(','));
    });
    var text = lines.join('\r\n');
    var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });   // BOM: Excel reads Korean
    var url = URL.createObjectURL(blob);
    var framed = window.top !== window;
    if (!framed) {
      var a = el('a');
      a.href = url;
      a.download = 'nmoi-participants-' + day(Date.now()) + '.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      var win = null;
      try { win = window.open(url, '_blank'); } catch (e) { win = null; }
      if (!win) showText(body, text);
    }
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function showText(body, text) {
    var old = body.querySelector('.cv-admin__text');
    if (old) old.remove();
    var wrap = el('div', 'cv-admin__text');
    wrap.appendChild(el('p', 'cv-settings__note', '전체 선택 후 복사해서 쓰세요.'));
    var area = el('textarea', 'cv-admin__area');
    area.readOnly = true;
    area.value = text;
    wrap.appendChild(area);
    body.insertBefore(wrap, body.querySelector('.cv-admin__table-wrap'));
    area.focus();
    area.select();
  }

  /* ---------- admin roster ---------- */

  function renderAdmins(body) {
    var status = el('p', 'cv-admin__status', '불러오는 중…');
    body.appendChild(status);
    var list = el('ul', 'cv-admin__admins');
    body.appendChild(list);

    var form = el('form', 'cv-admin__add');
    form.appendChild(el('p', 'cv-settings__head', '관리자 추가'));
    var id = el('input', 'cv-admin__search');
    id.placeholder = '계정 ID (상대가 설정 → 내 계정 ID 보기에서 확인)';
    id.required = true;
    var name = el('input', 'cv-admin__search');
    name.placeholder = '이름 (메모용)';
    var add = el('button', 'cv-btn cv-btn--primary', '추가');
    add.type = 'submit';
    form.appendChild(id);
    form.appendChild(name);
    form.appendChild(add);
    body.appendChild(form);

    function fill(roster) {
      list.innerHTML = '';
      roster.fixed.forEach(function (a) {
        var li = el('li');
        li.appendChild(el('b', '', '기본 관리자'));
        li.appendChild(el('span', 'cv-admin__acc', a));
        list.appendChild(li);
      });
      roster.added.forEach(function (a) {
        var li = el('li');
        li.appendChild(el('b', '', a.name || '관리자'));
        li.appendChild(el('span', 'cv-admin__acc', a.account));
        var rm = el('button', 'cv-admin__tool', '빼기');
        rm.type = 'button';
        rm.addEventListener('click', function () {
          if (!window.confirm((a.name || a.account) + ' 님을 관리자에서 뺄까요?')) return;
          call(function (s) { return s.adminRemoveAdmin(a.account); });
        });
        li.appendChild(rm);
        list.appendChild(li);
      });
      status.textContent = '관리자 ' + (roster.fixed.length + roster.added.length) + '명';
    }
    function call(fn) {
      status.textContent = '처리 중…';
      server().then(fn).then(fill, function (err) {
        status.textContent = err && err.message && !/offline/.test(err.message) ? err.message : '서버에 연결하지 못했어요';
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = id.value.trim(), memo = name.value.trim();   // read before the fields are cleared
      if (!v) return;
      call(function (s) { return s.adminAddAdmin(v, memo); });
      id.value = '';
      name.value = '';
    });
    call(function (s) { return s.adminListAdmins(); });
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  NS.admin = { settings: settings, open: open, close: close };
})(window.CAVIAR = window.CAVIAR || {});
