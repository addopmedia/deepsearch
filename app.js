const state = {
  apps: [],
  summary: null,
  filtered: [],
  sortKey: 'revenue_12mo',
  sortDir: 'desc',
};

const fmt = {
  money: (v) => '$' + (v || 0).toLocaleString('en-US'),
  num: (v) => (v || 0).toLocaleString('en-US'),
  short: (v) => {
    v = v || 0;
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + v;
  },
  shortNum: (v) => {
    v = v || 0;
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return String(v);
  },
  rating: (v) => v ? v.toFixed(1) : '—',
  age: (v) => {
    v = parseInt(v, 10);
    if (!v || isNaN(v)) return '—';
    const y = Math.floor(v / 12), m = v % 12;
    if (y === 0) return m + 'мес';
    if (m === 0) return y + 'г';
    return y + 'г ' + m + 'мес';
  },
  yoy: (v) => {
    if (v === '' || v === null || v === undefined) return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    const pct = (n * 100);
    const sign = pct >= 0 ? '+' : '';
    return sign + pct.toFixed(0) + '%';
  },
};

async function load() {
  try {
    const r = await fetch('data.json');
    if (!r.ok) throw new Error('data.json not found — run stage6_build_site.py');
    const data = await r.json();
    state.apps = data.apps || [];
    state.summary = data.summary || {};
    render();
  } catch (e) {
    document.getElementById('tbody').innerHTML =
      `<tr><td colspan="19" class="empty">${e.message}</td></tr>`;
    document.getElementById('summary-sub').textContent = 'Нет данных';
  }
}

function render() {
  state.years = state.summary?.years || [];
  insertYearColumns();
  renderKpis();
  renderNicheOptions();
  applyFilters();
}

// Динамически вставляет колонки "Rev YYYY" после "Rev 30d"
function insertYearColumns() {
  const headRow = document.querySelector('#apps thead tr');
  if (!headRow || headRow.querySelector('[data-k^="year_"]')) return; // уже вставлены
  const anchor = headRow.querySelector('[data-k="revenue_30d"]');
  if (!anchor) return;
  for (const y of state.years) {
    const th = document.createElement('th');
    th.className = 'num';
    th.dataset.k = 'year_' + y;
    th.textContent = "'" + y.slice(2);
    anchor.after(th);
    // вставляем в обратном порядке чтобы сохранить хронологию
  }
  // после вставки в порядке anchor.after — годы окажутся в обратном порядке; перевыстроим
  const yearThs = [...headRow.querySelectorAll('[data-k^="year_"]')];
  yearThs.sort((a, b) => a.dataset.k.localeCompare(b.dataset.k));
  let prev = anchor;
  for (const th of yearThs) { prev.after(th); prev = th; }

  // навесим сортировку на новые заголовки
  yearThs.forEach(th => th.addEventListener('click', () => onSortClick(th)));
}

function renderKpis() {
  const s = state.summary || {};
  const kpis = [
    { label: 'Apps', value: s.total_apps || 0 },
    { label: 'Revenue 30d', value: fmt.short(s.total_revenue_30d) },
    { label: 'Revenue 12mo', value: fmt.short(s.total_revenue_12mo) },
    { label: 'Growing', value: (s.trend || {}).GROWING || 0, sub: 'растут' },
    { label: 'Stable', value: (s.trend || {}).STABLE || 0 },
    { label: 'Declining', value: (s.trend || {}).DECLINING || 0 },
    { label: 'Advertised', value: (s.advertised || {}).advertised || 0, sub: 'с рекламой' },
    { label: 'Organic', value: (s.advertised || {}).organic || 0, sub: 'без рекламы' },
    {
      label: 'YoY ниши',
      value: (s.overall_yoy === null || s.overall_yoy === undefined) ? '—' : fmt.yoy(s.overall_yoy),
      sub: `по ${s.yoy_comparable_apps || 0} апам с базой`,
      cls: (s.overall_yoy >= 0) ? 'yoy-pos' : 'yoy-neg',
    },
  ];
  document.getElementById('kpis').innerHTML = kpis.map(k =>
    `<div class="kpi"><div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.cls || ''}">${k.value}</div>
      ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
    </div>`).join('');

  document.getElementById('summary-sub').textContent =
    `${s.total_apps || 0} приложений · Rev 30d ${fmt.short(s.total_revenue_30d)} · Rev 12mo ${fmt.short(s.total_revenue_12mo)}`;
}

function renderNicheOptions() {
  const sel = document.getElementById('f-niche');
  const niches = Object.keys(state.summary?.sub_niches || {}).sort();
  for (const n of niches) {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = `${n} (${state.summary.sub_niches[n]})`;
    sel.appendChild(opt);
  }
}

function applyFilters() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const niche = document.getElementById('f-niche').value;
  const trend = document.getElementById('f-trend').value;
  const type = document.getElementById('f-type').value;
  const source = document.getElementById('f-source').value;
  const mon = document.getElementById('f-mon').value;
  const ads = document.getElementById('f-ads').value;

  state.filtered = state.apps.filter(a => {
    if (q) {
      const hay = `${a.name} ${a.developer_name} ${a.sub_niche}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (niche && a.sub_niche !== niche) return false;
    if (trend && a.trend !== trend) return false;
    if (type) {
      const t = a.type || 'Unknown';
      if (t !== type) return false;
    }
    if (source) {
      const s = a.source || 'Unknown';
      if (s !== source) return false;
    }
    if (mon) {
      const m = a.monetization || 'Unknown';
      if (m !== mon) return false;
    }
    if (ads === 'yes' && !a.advertised) return false;
    if (ads === 'no' && a.advertised) return false;
    return true;
  });

  sort();
  renderTable();
}

function yoyClass(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = parseFloat(v);
  if (isNaN(n)) return '';
  return n >= 0 ? 'yoy-pos' : 'yoy-neg';
}

const NUMERIC_STRING_KEYS = new Set(['yoy_revenue_growth', 'yoy_downloads_growth']);

function onSortClick(th) {
  const k = th.dataset.k;
  if (!k || k === 'rank') return;
  if (state.sortKey === k) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = k;
    state.sortDir = 'desc';
  }
  sort();
  renderTable();
}

function sort() {
  const k = state.sortKey;
  const dir = state.sortDir === 'asc' ? 1 : -1;
  // year-колонки: ключ вида "year_2024" → берём из rev_by_year
  if (k && k.startsWith('year_')) {
    const y = k.slice(5);
    state.filtered.sort((a, b) => {
      const na = (a.rev_by_year && a.rev_by_year[y]) || 0;
      const nb = (b.rev_by_year && b.rev_by_year[y]) || 0;
      return (na - nb) * dir;
    });
    return;
  }
  state.filtered.sort((a, b) => {
    let va = a[k], vb = b[k];
    // YoY хранится строкой ("" = нет базы → в самый низ)
    if (NUMERIC_STRING_KEYS.has(k)) {
      const na = (va === '' || va == null) ? -Infinity : parseFloat(va);
      const nb = (vb === '' || vb == null) ? -Infinity : parseFloat(vb);
      return (na - nb) * dir;
    }
    if (typeof va === 'boolean') va = va ? 1 : 0;
    if (typeof vb === 'boolean') vb = vb ? 1 : 0;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va || '').localeCompare(String(vb || '')) * dir;
  });
}

function renderTable() {
  const tbody = document.getElementById('tbody');
  if (!state.filtered.length) {
    tbody.innerHTML = '<tr><td colspan="19" class="empty">Нет данных под фильтры</td></tr>';
    document.getElementById('count').textContent = '0 из ' + state.apps.length;
    return;
  }

  tbody.innerHTML = state.filtered.map((a, i) => {
    const trendBadge = a.trend
      ? `<span class="badge badge-${a.trend.toLowerCase()}">${a.trend}</span>`
      : '<span class="badge badge-neutral">—</span>';
    const typeBadge = a.type
      ? `<span class="badge badge-neutral">${a.type}</span>`
      : '<span class="badge badge-neutral">—</span>';
    const adsBadge = a.advertised
      ? '<span class="badge badge-ads">Ads</span>'
      : '<span class="badge badge-neutral">Org</span>';
    const icon = a.icon
      ? `<img src="${a.icon}" alt="" loading="lazy">`
      : '<div class="icon-placeholder"></div>';
    return `<tr data-app="${a.app_id}">
      <td>${i + 1}</td>
      <td><div class="app-cell">${icon}<span class="app-name">${a.name || '—'}</span></div></td>
      <td>${a.developer_name || '—'}</td>
      <td>${typeBadge}</td>
      <td>${fmt.age(a.age_months)}</td>
      <td class="num">${fmt.short(a.revenue_12mo)}</td>
      <td class="num">${fmt.short(a.revenue_30d)}</td>
      ${(state.years || []).map(y => `<td class="num year-cell">${(a.rev_by_year && a.rev_by_year[y]) ? fmt.short(a.rev_by_year[y]) : '·'}</td>`).join('')}
      <td class="num ${yoyClass(a.yoy_revenue_growth)}">${fmt.yoy(a.yoy_revenue_growth)}</td>
      <td>${trendBadge}</td>
      <td class="num">${(a.acceleration || 0).toFixed(2)}</td>
      <td>${a.source || '—'}</td>
      <td>${a.monetization || '—'}</td>
      <td>${adsBadge}</td>
      <td class="num">${fmt.num(a.downloads_12mo)}</td>
      <td class="num">$${(a.rpd || 0).toFixed(2)}</td>
      <td>${a.sub_niche || '—'}</td>
      <td class="num">${fmt.rating(a.rating_avg)}</td>
      <td class="num">${a.countries_count || '—'}</td>
      <td>${a.publisher_country || 'Unknown'}</td>
    </tr>`;
  }).join('');

  document.getElementById('count').textContent =
    `${state.filtered.length} из ${state.apps.length}`;

  document.querySelectorAll('thead th').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.k === state.sortKey) {
      th.classList.add(state.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });

  // Клик по строке — открыть модалку
  tbody.querySelectorAll('tr[data-app]').forEach(row => {
    row.addEventListener('click', () => openModal(row.dataset.app));
  });
}

// ====================== Modal + charts ======================

function openModal(appId) {
  const a = state.apps.find(x => x.app_id === appId);
  if (!a) return;

  const months = a.months || [];
  const chartInstalls = renderChart(months, 'd', 'Installs', '#5eb2ff');
  const chartRevenue = renderChart(months, 'r', 'Revenue', '#4ade80', true);

  // Приоритет: top_countries_downloads → top_countries_revenue → countries_list
  const countryList = (
    (a.top_countries_downloads && a.top_countries_downloads.length) ? a.top_countries_downloads :
    (a.top_countries_revenue && a.top_countries_revenue.length) ? a.top_countries_revenue :
    (a.countries_list || [])
  ).slice(0, 10);
  const countryListLabel =
    (a.top_countries_downloads && a.top_countries_downloads.length) ? 'Top страны (downloads)' :
    (a.top_countries_revenue && a.top_countries_revenue.length) ? 'Top страны (revenue)' :
    'Страны публикации';

  const description = (a.description || '').slice(0, 500);

  const websiteLink = a.website
    ? `<a href="${a.website}" target="_blank" rel="noopener">${a.website}</a>`
    : '—';

  const devLink = a.developer_url
    ? `<a href="${a.developer_url}" target="_blank" rel="noopener">${a.developer_name}</a>`
    : (a.developer_name || '—');

  const appStoreLink = a.url
    ? `<a href="${a.url}" target="_blank" rel="noopener">App Store ↗</a>` : '';
  const spyLink = a.url_appstorespy
    ? `<a href="${a.url_appstorespy}" target="_blank" rel="noopener">AppstoreSpy ↗</a>` : '';

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-header">
      ${a.icon ? `<img src="${a.icon}" class="modal-icon" alt="">` : ''}
      <div class="modal-header-text">
        <h2 id="modal-title">${a.name || '—'}</h2>
        <div class="modal-meta">
          ${devLink} · ${a.sub_niche || '—'} · ${a.category || ''}
          · ${a.released ? a.released.slice(0, 10) : '—'}
          ${a.age_months ? `· ${a.age_months}mo` : ''}
        </div>
        <div class="modal-badges">
          ${a.trend ? `<span class="badge badge-${a.trend.toLowerCase()}">${a.trend}</span>` : ''}
          ${a.type ? `<span class="badge badge-neutral">${a.type}</span>` : ''}
          ${a.source ? `<span class="badge badge-neutral">${a.source}</span>` : ''}
          ${a.monetization ? `<span class="badge badge-neutral">${a.monetization}</span>` : ''}
          ${a.advertised ? '<span class="badge badge-ads">Advertised</span>' : '<span class="badge badge-neutral">Organic</span>'}
          ${a.iap ? '<span class="badge badge-neutral">IAP</span>' : ''}
        </div>
        <div class="modal-links">${[appStoreLink, spyLink].filter(Boolean).join(' · ')}</div>
      </div>
    </div>

    <div class="modal-kpis">
      <div class="mk"><div class="mk-l">Rev 12mo</div><div class="mk-v">${fmt.short(a.revenue_12mo)}</div></div>
      <div class="mk"><div class="mk-l">Rev 30d</div><div class="mk-v">${fmt.short(a.revenue_30d)}</div></div>
      <div class="mk"><div class="mk-l">Downloads 12mo</div><div class="mk-v">${fmt.shortNum(a.downloads_12mo)}</div></div>
      <div class="mk"><div class="mk-l">Downloads 30d</div><div class="mk-v">${fmt.shortNum(a.downloads_30d)}</div></div>
      <div class="mk"><div class="mk-l">Accel</div><div class="mk-v">${(a.acceleration || 0).toFixed(2)}</div></div>
      <div class="mk"><div class="mk-l">RPD</div><div class="mk-v">$${(a.rpd || 0).toFixed(2)}</div></div>
      <div class="mk"><div class="mk-l">Rating</div><div class="mk-v">${fmt.rating(a.rating_avg)} (${fmt.shortNum(a.rating_count)})</div></div>
      <div class="mk" title="${a.publisher_country_source === 'heuristic' ? 'Определено по суффиксу юр.лица (LLC/GmbH/…)' : a.publisher_country_source === 'api' ? 'Из API' : 'Нет данных'}">
        <div class="mk-l">Publisher HQ ${a.publisher_country_source === 'heuristic' ? '<span class="mk-hint">≈</span>' : ''}</div>
        <div class="mk-v">${a.publisher_country || 'Unknown'}</div>
      </div>
    </div>

    <div class="modal-charts">
      <div class="chart-block">
        <h3>Installs по месяцам</h3>
        ${chartInstalls}
      </div>
      <div class="chart-block">
        <h3>Revenue по месяцам</h3>
        ${chartRevenue}
      </div>
    </div>

    <div class="modal-countries">
      <h3>${countryListLabel}</h3>
      ${countryList.length
        ? `<div class="country-list">${countryList.map(c => `<span class="country-tag">${c}</span>`).join('')}</div>`
        : '<div class="empty">Нет данных</div>'}
      ${a.countries_count ? `<div class="modal-hint">всего стран: ${a.countries_count}</div>` : ''}
    </div>

    <div class="modal-desc">
      <h3>Description</h3>
      <div>${description || '—'}${a.description && a.description.length > 500 ? '…' : ''}</div>
    </div>

    <div class="modal-website">
      <h3>Website</h3>
      <div>${websiteLink}</div>
    </div>
  `;

  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  attachChartTooltips();
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
  document.body.style.overflow = '';
}

// ====================== SVG line chart ======================

function renderChart(months, key, label, color, isMoney = false) {
  if (!months.length) return '<div class="empty">Нет данных</div>';

  const w = 520, h = 180;
  const padL = 50, padR = 16, padT = 16, padB = 28;
  const cw = w - padL - padR;
  const ch = h - padT - padB;

  const values = months.map(m => m[key] || 0);
  const maxV = Math.max(1, ...values);
  const xStep = months.length > 1 ? cw / (months.length - 1) : 0;

  const points = months.map((m, i) => {
    const x = padL + i * xStep;
    const y = padT + ch - (m[key] / maxV) * ch;
    return { x, y, m: m.m, v: m[key] };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padT + ch} L ${points[0].x} ${padT + ch} Z`;

  // Y-axis ticks (3 значения)
  const ticks = [0, 0.5, 1].map(t => ({
    v: Math.round(t * maxV),
    y: padT + ch - t * ch,
  }));

  // X-axis labels (до 6 меток)
  const xLabelStep = Math.max(1, Math.ceil(months.length / 6));

  const formatVal = (v) => isMoney ? fmt.short(v) : fmt.shortNum(v);

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="grad-${label}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${ticks.map(t =>
      `<line x1="${padL}" y1="${t.y}" x2="${w - padR}" y2="${t.y}" stroke="#262b3a" stroke-dasharray="2,3"/>
       <text x="${padL - 6}" y="${t.y + 4}" text-anchor="end" class="chart-axis">${formatVal(t.v)}</text>`
    ).join('')}
    ${points.map((p, i) => i % xLabelStep === 0
      ? `<text x="${p.x}" y="${padT + ch + 16}" text-anchor="middle" class="chart-axis">${p.m.slice(2)}</text>`
      : '').join('')}
    <path d="${areaPath}" fill="url(#grad-${label})"/>
    <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2"/>
    ${points.map((p, i) => {
      const m = months[i];
      return `<g class="dot-group">
        <circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}" class="chart-dot"/>
        <circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" class="chart-hit"
                data-m="${m.m}" data-d="${m.d || 0}" data-r="${m.r || 0}"/>
      </g>`;
    }).join('')}
  </svg>`;
}

function attachChartTooltips() {
  const modal = document.getElementById('modal');
  let tooltip = modal.querySelector('.chart-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip hidden';
    modal.appendChild(tooltip);
  }

  modal.querySelectorAll('.chart-hit').forEach(hit => {
    hit.addEventListener('mouseenter', () => {
      const month = hit.dataset.m || '';
      const d = +hit.dataset.d || 0;
      const r = +hit.dataset.r || 0;
      tooltip.innerHTML = `
        <div class="tt-m">${month}</div>
        <div class="tt-row"><span class="tt-l">Installs</span><b>${fmt.shortNum(d)}</b></div>
        <div class="tt-row"><span class="tt-l">Revenue</span><b>${fmt.short(r)}</b></div>`;
      tooltip.classList.remove('hidden');
      const rect = hit.getBoundingClientRect();
      const modalRect = modal.getBoundingClientRect();
      tooltip.style.left = (rect.left - modalRect.left + rect.width / 2) + 'px';
      tooltip.style.top = (rect.top - modalRect.top - 8) + 'px';
    });
    hit.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });
  });
}

// ====================== Revenue matrix (pivot) ======================

function buildMonthAxis(windowSize) {
  // собираем уникальные месяцы из всех apps, берём последние windowSize
  const set = new Set();
  for (const a of state.apps) {
    for (const m of (a.months || [])) set.add(m.m);
  }
  const all = [...set].sort();
  return all.slice(-windowSize);
}

function sparkline(months, axis, color = '#4ade80') {
  // мини-граф revenue по оси axis
  const vals = axis.map(mo => {
    const hit = months.find(m => m.m === mo);
    return hit ? (hit.r || 0) : 0;
  });
  const max = Math.max(1, ...vals);
  const w = 90, h = 22;
  const step = vals.length > 1 ? w / (vals.length - 1) : 0;
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/>
  </svg>`;
}

function heatColor(ratio) {
  // ratio 0..1 → прозрачность зелёного
  if (ratio <= 0) return 'transparent';
  const a = 0.08 + ratio * 0.62;
  return `rgba(74, 222, 128, ${a.toFixed(3)})`;
}

function renderMatrix() {
  const windowSize = parseInt(document.getElementById('matrix-window').value, 10) || 24;
  const axis = buildMonthAxis(windowSize);

  // сортируем приложения по revenue_12mo desc
  const apps = [...state.apps].sort((x, y) => (y.revenue_12mo || 0) - (x.revenue_12mo || 0));

  const thead = document.querySelector('#matrix-table thead');
  const tbody = document.querySelector('#matrix-table tbody');

  thead.innerHTML = `<tr>
    <th class="sticky-col">App</th>
    <th>Trend</th>
    <th class="num">Rev 12mo</th>
    <th class="num">YoY</th>
    <th>Trend-line</th>
    ${axis.map(m => `<th class="num mcol">${m.slice(2)}</th>`).join('')}
  </tr>`;

  tbody.innerHTML = apps.map(a => {
    const monthMap = {};
    for (const m of (a.months || [])) monthMap[m.m] = m.r || 0;
    const vals = axis.map(mo => monthMap[mo] || 0);
    const max = Math.max(1, ...vals);
    const cells = axis.map((mo, i) => {
      const v = vals[i];
      const ratio = v / max;
      const title = `${mo}: ${fmt.short(v)}`;
      return `<td class="num mcell" style="background:${heatColor(ratio)}" title="${title}">${v ? fmt.short(v) : ''}</td>`;
    }).join('');
    const trendBadge = a.trend
      ? `<span class="badge badge-${a.trend.toLowerCase()}">${a.trend}</span>`
      : '<span class="badge badge-neutral">—</span>';
    const icon = a.icon ? `<img src="${a.icon}" alt="" loading="lazy">` : '<div class="icon-placeholder"></div>';
    return `<tr>
      <td class="sticky-col"><div class="app-cell">${icon}<span class="app-name">${a.name || '—'}</span></div></td>
      <td>${trendBadge}</td>
      <td class="num">${fmt.short(a.revenue_12mo)}</td>
      <td class="num ${yoyClass(a.yoy_revenue_growth)}">${fmt.yoy(a.yoy_revenue_growth)}</td>
      <td>${sparkline(a.months || [], axis)}</td>
      ${cells}
    </tr>`;
  }).join('');
}

// ====================== YoY growth table ======================

function growthCell(cur, prev) {
  if (!prev || prev <= 0) return '<span class="g-na">—</span>';
  const g = cur / prev - 1;
  const cls = g >= 0 ? 'yoy-pos' : 'yoy-neg';
  const sign = g >= 0 ? '+' : '';
  return `<span class="${cls}">${sign}${(g * 100).toFixed(0)}%</span>`;
}

function renderYoyTable() {
  const years = state.years || [];
  const apps = [...state.apps].sort((a, b) => (b.revenue_12mo || 0) - (a.revenue_12mo || 0));

  const thead = document.querySelector('#yoy-table thead');
  const tbody = document.querySelector('#yoy-table tbody');

  // заголовок: App | <год> | Δ% | <год> | Δ% | ...
  let head = '<tr><th class="sticky-col">App</th>';
  years.forEach((y, i) => {
    head += `<th class="num">'${y.slice(2)}</th>`;
    if (i > 0) head += `<th class="num">Δ</th>`;
  });
  head += '</tr>';
  thead.innerHTML = head;

  // итоговая строка по нише
  const totalRow = (label, getByYear, sticky) => {
    let tr = `<tr class="${sticky ? 'yoy-total' : ''}"><td class="sticky-col"><b>${label}</b></td>`;
    years.forEach((y, i) => {
      const cur = getByYear(y);
      tr += `<td class="num">${cur ? fmt.short(cur) : '·'}</td>`;
      if (i > 0) tr += `<td class="num">${growthCell(cur, getByYear(years[i - 1]))}</td>`;
    });
    tr += '</tr>';
    return tr;
  };

  const nicheByYear = state.summary.revenue_by_year || {};
  let rows = totalRow('ВСЯ НИША', (y) => nicheByYear[y] || 0, true);

  rows += apps.map(a => {
    const rby = a.rev_by_year || {};
    let tr = `<tr><td class="sticky-col"><div class="app-cell">${a.icon ? `<img src="${a.icon}" alt="" loading="lazy">` : '<div class="icon-placeholder"></div>'}<span class="app-name">${a.name || '—'}</span></div></td>`;
    years.forEach((y, i) => {
      const cur = rby[y] || 0;
      tr += `<td class="num year-cell">${cur ? fmt.short(cur) : '·'}</td>`;
      if (i > 0) tr += `<td class="num">${growthCell(cur, rby[years[i - 1]] || 0)}</td>`;
    });
    tr += '</tr>';
    return tr;
  }).join('');

  tbody.innerHTML = rows;
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const isMatrix = tab === 'revenue-matrix';
  const isYoy = tab === 'yoy';
  const isTable = tab === 'table';
  document.querySelector('.table-wrap').classList.toggle('hidden', !isTable);
  document.getElementById('filters-bar').classList.toggle('hidden', !isTable);
  document.getElementById('yoy-view').classList.toggle('hidden', !isYoy);
  document.getElementById('matrix-view').classList.toggle('hidden', !isMatrix);
  if (isMatrix) renderMatrix();
  if (isYoy) renderYoyTable();
}

// ====================== Wiring ======================

document.addEventListener('DOMContentLoaded', () => {
  ['search','f-niche','f-trend','f-type','f-source','f-mon','f-ads'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', applyFilters);
      el.addEventListener('change', applyFilters);
    }
  });
  document.querySelectorAll('#apps thead th').forEach(th => {
    th.addEventListener('click', () => onSortClick(th));
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', e => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Вкладки
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  // Окно матрицы
  const mw = document.getElementById('matrix-window');
  if (mw) mw.addEventListener('change', renderMatrix);

  load();
});
