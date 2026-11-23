// Token Radar dashboard (no framework, no network).
// Reads window.RADAR from data.js, renders the board, a detail view for
// every protocol, a live-token view and the model page. State lives in the
// URL hash, so a board, a detail view and a filtered view each have an
// address: #view=board, #detail=<slug>, #cat=Lending, #watch=1 …
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.getElementById('meta').textContent = 'No data found.'; return; }
  var WATCH = {};
  D.watchlist.forEach(function (s) { WATCH[s] = true; });
  var PAGE = 25;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) { return n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(v) { if (v == null) return '—'; var c = v > 0 ? 'pos' : v < 0 ? 'neg' : ''; return '<span class="' + c + '">' + (v > 0 ? '+' : '') + v.toFixed(1) + '%</span>'; }
  function age(v) { return v == null ? '—' : v >= 365 ? (v / 365).toFixed(1) + 'y' : v + 'd'; }
  function $(id) { return document.getElementById(id); }

  function hash() {
    var h = {};
    location.hash.slice(1).split('&').forEach(function (p) { var kv = p.split('='); if (kv[0]) h[kv[0]] = decodeURIComponent(kv[1] || ''); });
    return h;
  }
  function setHash(h) {
    var s = Object.keys(h).filter(function (k) { return h[k] !== '' && h[k] !== '0' && h[k] !== false; })
      .map(function (k) { return k + '=' + encodeURIComponent(h[k]); }).join('&');
    history.replaceState(null, '', s ? '#' + s : location.pathname);
  }
  function state() {
    var h = hash();
    return { view: h.view || 'board', q: (h.q || '').toLowerCase(), cat: h.cat || '', chain: h.chain || '', sort: h.sort || 'value', mintvl: +(h.mintvl || 0), watch: h.watch === '1', page: Math.max(1, +(h.page || 1)), detail: h.detail || '' };
  }

  // Fill the filter selects once.
  var cats = {}, chains = {};
  D.rows.forEach(function (r) { if (r.category) cats[r.category] = 1; r.chains.forEach(function (c) { chains[c] = 1; }); });
  Object.keys(cats).sort().forEach(function (c) { $('cat').appendChild(new Option(c, c)); });
  Object.keys(chains).sort().forEach(function (c) { $('chain').appendChild(new Option(c, c)); });

  $('meta').textContent = 'Snapshot ' + D.as_of + ' · ' + D.board_size + ' pre-token protocols ranked · watchlist ' + D.watchlist_size +
    ' · floor ' + money(D.floor_usd) + ' · model ' + D.model_version;

  function filtered(st) {
    var rows = D.rows.filter(function (r) {
      if (st.watch && !WATCH[r.slug]) return false;
      if (st.cat && r.category !== st.cat) return false;
      if (st.chain && r.chains.indexOf(st.chain) < 0) return false;
      if (r.tvl_usd < st.mintvl) return false;
      if (st.q && (r.name.toLowerCase().indexOf(st.q) < 0 && r.slug.indexOf(st.q) < 0)) return false;
      return true;
    });
    var by = {
      value: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d == null ? -1e9 : b.change_7d) - (a.change_7d == null ? -1e9 : a.change_7d); },
      odds: function (a, b) { return b.launch_odds - a.launch_odds; },
      age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); },
      name: function (a, b) { return a.name < b.name ? -1 : 1; },
    }[st.sort] || byValue;
    function byValue(a, b) { return b.implied_value_usd - a.implied_value_usd; }
    return rows.sort(by);
  }

  function renderBoard(st) {
    var rows = filtered(st);
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    var page = Math.min(st.page, pages);
    var slice = rows.slice((page - 1) * PAGE, page * PAGE);
    $('count').textContent = rows.length + ' of ' + D.rows.length + ' protocols' +
      (st.watch ? ' · watchlist only' : '') + (st.cat ? ' · ' + st.cat : '') + (st.chain ? ' · ' + st.chain : '') +
      ' · sorted by ' + ({ value: 'implied value', tvl: 'TVL', growth: '7-day growth', odds: 'launch odds', age: 'age', name: 'name' }[st.sort]);
    $('rows').innerHTML = slice.map(function (r) {
      var max = Math.max.apply(null, D.rows.map(function (x) { return x.implied_value_high_usd; }));
      var left = Math.round((r.implied_value_low_usd / max) * 100);
      var width = Math.max(2, Math.round(((r.implied_value_high_usd - r.implied_value_low_usd) / max) * 100));
      return '<tr data-slug="' + esc(r.slug) + '"' + (st.detail === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td>' +
        '<td class="name">' + esc(r.name) + (WATCH[r.slug] ? ' <span class="pill wl">WATCHLIST</span>' : '') + '<br><span class="sub">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num">' + Math.round(r.launch_odds * 100) + '%</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong><div class="rangebar"><i style="left:' + left + '%;width:' + width + '%"></i></div><span class="sub">' + money(r.implied_value_low_usd) + ' – ' + money(r.implied_value_high_usd) + '</span></td></tr>';
    }).join('') || '<tr><td colspan="9">Nothing matches these filters.</td></tr>';
    $('pageinfo').textContent = 'Page ' + page + ' of ' + pages;
    $('prev').disabled = page <= 1;
    $('next').disabled = page >= pages;
    $('prev').onclick = function () { var h = hash(); h.page = page - 1; setHash(h); render(); };
    $('next').onclick = function () { var h = hash(); h.page = page + 1; setHash(h); render(); };
  }

  function renderDetail(st) {
    var el = $('detail');
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === st.detail) r = x; });
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    var peer = D.peers[r.category] || { n: 0, median: 0, p25: 0, p75: 0 };
    var steps = r.farm_steps.map(function (s) {
      var parts = s.split(' Cost: ');
      var rest = parts[1] || '';
      return '<li>' + esc(parts[0]) + '<br><span class="ct">Cost: ' + esc(rest) + '</span></li>';
    }).join('');
    el.hidden = false;
    el.innerHTML = '<h2>#' + r.rank + ' · ' + esc(r.name) + '</h2>' +
      '<p class="lede">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) + ' · listed ' + esc(r.listed_at || 'unknown') +
      ' · ' + (WATCH[r.slug] ? 'on the watchlist. ' : 'below the watchlist floor — an early find. ') +
      'Records no token in the snapshot.</p>' +
      '<h3>Implied value — the math</h3>' +
      '<table class="math"><tbody>' +
      '<tr><td>TVL</td><td>' + moneyFull(r.tvl_usd) + '</td></tr>' +
      '<tr><td>Peer multiple (' + esc(r.category || 'Uncategorised') + ', ' + r.peer_sample + ' live ' + (r.peer_sample === 1 ? 'protocol' : 'protocols') + ', median ' + peer.median + ')</td><td>× ' + r.peer_multiple + '</td></tr>' +
      '<tr><td>Peer-implied value if a token launched today</td><td>' + moneyFull(r.peer_implied_fdv_usd) + '</td></tr>' +
      '<tr><td>Growth — 7-day TVL change ' + (r.change_7d == null ? 'unreported' : r.change_7d.toFixed(1) + '%') + '</td><td>× ' + r.growth_multiplier + '</td></tr>' +
      '<tr><td>Maturity — ' + age(r.age_days) + ' tracked</td><td>× ' + r.maturity_multiplier + '</td></tr>' +
      '<tr><td>Launch odds — category launch rate, size and age</td><td>× ' + r.launch_odds + '</td></tr>' +
      '<tr><td><strong>Implied value (expected value)</strong></td><td><strong>' + moneyFull(r.implied_value_usd) + '</strong></td></tr>' +
      '<tr><td>Range — peer 25th to 75th percentile</td><td>' + moneyFull(r.implied_value_low_usd) + ' – ' + moneyFull(r.implied_value_high_usd) + '</td></tr>' +
      '</tbody></table>' +
      '<h3>Farm plan — 7 steps</h3><ol class="steps">' + steps + '</ol>' +
      '<p class="lede">A token is not guaranteed. Only farm what you can afford to lose, and never pay to claim.</p>';
  }

  function renderLive() {
    $('liverows').innerHTML = D.live.map(function (r) {
      return '<tr><td class="name">' + esc(r.name) + '<br><span class="sub">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td><td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num"><strong>' + money(r.mcap_usd) + '</strong></td>' +
        '<td class="num">' + (r.mcap_tvl == null ? '—' : r.mcap_tvl.toFixed(2) + '×') + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td></tr>';
    }).join('');
  }

  function renderModel() {
    var c = D.check;
    var peerRows = Object.keys(D.peers).map(function (k) { return [k, D.peers[k]]; })
      .filter(function (x) { return x[1].n >= 3; }).sort(function (a, b) { return b[1].n - a[1].n; }).slice(0, 12);
    $('modelbody').innerHTML =
      '<h3>Constants</h3><table class="math"><tbody>' +
      '<tr><td>Growth</td><td>7-day change clamped to −40%…+60%, weight 0.6</td></tr>' +
      '<tr><td>Maturity</td><td>0.70 + 0.30 × min(age, 1,095 days) / 1,095; unknown age = 365 days</td></tr>' +
      '<tr><td>Peer multiple</td><td>category median mcap / TVL, shrunk toward the global median with n / (n + 5), clamped to 0.03–1.00</td></tr>' +
      '<tr><td>Launch odds</td><td>category token rate shrunk toward the global rate, × size × age, clamped to 5–85%</td></tr>' +
      '</tbody></table>' +
      '<h3>Backtest — computed from this snapshot, in-sample</h3>' +
      '<p class="lede">For each of the ' + c.live_with_mcap + ' live-token protocols with a market cap, the peer model predicts its market cap as TVL × peer multiple. ' +
      'Median absolute error: <strong>' + c.peer_median_ape_pct + '%</strong> for the peer model, versus <strong>' + c.flat_median_ape_pct + '%</strong> for a flat 0.25× TVL multiple. ' +
      'The peer model ' + (c.peer_beats_flat ? 'beats' : 'does not beat') + ' the flat multiple on this snapshot. ' +
      'Global peer median mcap / TVL is ' + c.global_peer_median + ' (25th: ' + c.global_peer_p25 + ', 75th: ' + c.global_peer_p75 + '); ' +
      Math.round(c.global_launch_rate * 100) + '% of the snapshot&rsquo;s protocols already record a token.</p>' +
      '<h3>Peer multiples by category</h3><table class="math"><thead><tr><th>Category</th><th class="num">Live n</th><th class="num">Median</th><th class="num">25th</th><th class="num">75th</th></tr></thead><tbody>' +
      peerRows.map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td class="num">' + x[1].n + '</td><td class="num">' + x[1].median + '</td><td class="num">' + x[1].p25 + '</td><td class="num">' + x[1].p75 + '</td></tr>'; }).join('') +
      '</tbody></table>' +
      '<h3>Coverage</h3><p class="lede">Board: ' + D.board_size + ' rows — all ' + D.watchlist_size + ' watchlist protocols plus ' + D.early_size +
      ' rankable pre-token protocols below the floor. Live view: ' + D.live_size + ' token protocols set aside at market values.</p>';
  }

  function render() {
    var st = state();
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === st.view); });
    $('view-board').hidden = st.view !== 'board';
    $('view-live').hidden = st.view !== 'live';
    $('view-model').hidden = st.view !== 'model';
    if (st.view === 'board') {
      $('q').value = hash().q || '';
      $('cat').value = st.cat; $('chain').value = st.chain; $('sort').value = st.sort;
      $('mintvl').value = String(st.mintvl); $('watch').checked = st.watch;
      renderBoard(st);
      renderDetail(st);
    }
    if (st.view === 'live') renderLive();
    if (st.view === 'model') renderModel();
  }

  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { var h = hash(); h.view = b.getAttribute('data-view'); delete h.detail; delete h.page; setHash(h); render(); });
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    var h = hash(); h.detail = tr.getAttribute('data-slug'); setHash(h); render();
    document.getElementById('detail').scrollIntoView();
  });
  function bind(id, key) {
    $(id).addEventListener('input', function () { var h = hash(); h[key] = $(id).value; delete h.page; if (key === 'watch') h.watch = $(id).checked ? '1' : ''; setHash(h); render(); });
    $(id).addEventListener('change', function () { var h = hash(); h[key] = $(id).value; delete h.page; if (key === 'watch') h.watch = $(id).checked ? '1' : ''; setHash(h); render(); });
  }
  bind('q', 'q'); bind('cat', 'cat'); bind('chain', 'chain'); bind('sort', 'sort'); bind('mintvl', 'mintvl'); bind('watch', 'watch');
  window.addEventListener('hashchange', render);
  render();
})();
