// BRICS development dashboard: loads a WDI CSV, summarises it and draws three charts.
const CSV_PATH = 'data/wdi_brics.csv';

// Match WDI series names to short labels and units.
const INDICATORS = [
  { match: 'Access to electricity', label: 'Access to electricity', unit: '%' },
  { match: 'GDP growth', label: 'GDP growth', unit: '%' },
  { match: 'GDP per capita', label: 'GDP per capita', unit: 'US$' },
  { match: 'Individuals using the Internet', label: 'Internet users', unit: '%' },
  { match: 'Life expectancy', label: 'Life expectancy', unit: 'years' },
  { match: 'Mortality rate, under-5', label: 'Under-5 mortality', unit: 'per 1,000' },
  { match: 'School enrollment, secondary', label: 'Secondary enrolment (GPI)', unit: 'index' },
  { match: 'Unemployment', label: 'Unemployment', unit: '%' }
];
const PALETTE = ['#6f9fc8', '#d9a066', '#8fb8a8', '#b58a6a', '#9bb7d4',
                 '#c9b38a', '#7a8fa6', '#e0b88a', '#a3c4bc', '#8d7b6a'];

// data[indicatorLabel][country] = { year: value }
let data = {};
let countries = [];
let years = [];
let colours = {};
const state = { ind: '', from: 0, to: 0, selected: new Set() };
const charts = {};
const $ = id => document.getElementById(id);

//  Loading and cleaning 
function loadCsv() {
  Papa.parse(CSV_PATH, {
    download: true, header: true, skipEmptyLines: true, transformHeader: h => h.trim(),
    complete: r => buildData(r.data),
    error: () => setStatus('Could not load ' + CSV_PATH + '. Check the file path, or choose the CSV below.', true)
  });
}

function buildData(rows) {
  data = {};
  const yearSet = new Set();
  const countrySet = new Set();
  rows.forEach(row => {
    const name = (row['Country Name'] || '').trim();
    const series = (row['Indicator Name'] || row['Series Name'] || '').trim();
    const meta = INDICATORS.find(i => series && series.startsWith(i.match));
    if (!name || !meta) return;               // skips WDI footnote rows and other series
    countrySet.add(name);
    data[meta.label] = data[meta.label] || {};
    data[meta.label][name] = data[meta.label][name] || {};
    Object.keys(row).forEach(col => {
      const m = col.match(/^(\d{4})/);        // columns look like "2019 [YR2019]"
      if (!m) return;
      const v = parseFloat(row[col]);         // ".." becomes NaN and is dropped
      if (!isNaN(v)) { data[meta.label][name][m[1]] = v; yearSet.add(+m[1]); }
    });
  });
  countries = [...countrySet].sort();
  years = [...yearSet].sort((a, b) => a - b);
  if (!countries.length || !years.length) {
    return setStatus('No matching WDI rows found. Check the CSV has Country Name and Indicator Name columns.', true);
  }
  countries.forEach((c, i) => colours[c] = PALETTE[i % PALETTE.length]);
  initControls();
  setStatus('');
  update();
}

function setStatus(msg, isError) {
  const s = $('status');
  s.textContent = msg;
  s.className = 'status' + (isError ? ' error' : '');
  s.hidden = !msg;
}

//  Controls 
function fillSelect(id, items, selected) {
  const el = $(id);
  el.innerHTML = '';
  items.forEach(v => el.add(new Option(v, v, false, String(v) === String(selected))));
}

function initControls() {
  const labels = INDICATORS.map(i => i.label).filter(l => data[l]);
  state.ind = labels[0];
  state.from = years[0];
  state.to = years[years.length - 1];
  state.selected = new Set(countries);
  fillSelect('indicator', labels, state.ind);
  fillSelect('from', years, state.from);
  fillSelect('to', years, state.to);

  const list = $('countryList');
  list.innerHTML = '';
  countries.forEach(c => {
    const chip = document.createElement('label');
    chip.className = 'chip';
    chip.innerHTML = '<input type="checkbox" checked><span class="dot"></span>';
    chip.append(c);
    chip.querySelector('.dot').style.background = colours[c];
    chip.querySelector('input').addEventListener('change', e => {
      e.target.checked ? state.selected.add(c) : state.selected.delete(c);
      update();
    });
    list.appendChild(chip);
  });
}

[['indicator', 'ind'], ['from', 'from'], ['to', 'to']].forEach(([id, key]) =>
  $(id).addEventListener('change', e => {
    state[key] = (key === 'from' || key === 'to') ? +e.target.value : e.target.value;
    if (state.from > state.to) {             // keep the range valid
      if (key === 'from') { state.to = state.from; $('to').value = state.to; }
      else { state.from = state.to; $('from').value = state.from; }
    }
    update();
  }));

$('csvFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) Papa.parse(file, { header: true, skipEmptyLines: true, transformHeader: h => h.trim(), complete: r => buildData(r.data) });
});

//  Calculations 
const unitOf = label => INDICATORS.find(i => i.label === label).unit;
const fmt = v => v == null || isNaN(v) ? 'n/a' :
  Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-ZA') : (Math.round(v * 10) / 10).toString();
const withUnit = (v, label) => {
  const u = unitOf(label);
  if (isNaN(v)) return 'n/a';
  return u === '%' ? fmt(v) + '%' : u === 'US$' ? 'US$ ' + fmt(v) : fmt(v);
};
const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;

// Latest value for a country on or before the "To" year, within the chosen range.
function latest(label, country) {
  const series = (data[label] || {})[country] || {};
  for (let y = state.to; y >= state.from; y--) if (series[y] != null) return { year: y, value: series[y] };
  return null;
}
function earliest(label, country) {
  const series = (data[label] || {})[country] || {};
  for (let y = state.from; y <= state.to; y++) if (series[y] != null) return { year: y, value: series[y] };
  return null;
}

//  Rendering
function update() {
  const sel = countries.filter(c => state.selected.has(c));
  if (!sel.length) { setStatus('Select at least one country to see the charts.', true); return; }
  setStatus('');
  updateKpis(sel);
  drawLine(sel);
  drawBar(sel);
  drawPie(sel);
}

function updateKpis(sel) {
  const label = state.ind;
  const latestVals = sel.map(c => ({ c, ...latest(label, c) })).filter(o => o.value != null);

  // Indicator 1: average of the latest values across selected countries
  $('kpi1Label').textContent = 'Average, ' + label;
  $('kpi1').textContent = withUnit(mean(latestVals.map(o => o.value)), label);
  $('kpi1Sub').textContent = latestVals.length + ' of ' + sel.length + ' countries, latest value up to ' + state.to;

  // Indicator 2: highest country
  const top = latestVals.slice().sort((a, b) => b.value - a.value)[0];
  $('kpi2Label').textContent = 'Highest value';
  $('kpi2').textContent = top ? top.c : 'n/a';
  $('kpi2Sub').textContent = top ? withUnit(top.value, label) + ' in ' + top.year : 'No data in this range';

  // Indicator 3: average change from first to last available value
  const changes = sel.map(c => {
    const a = earliest(label, c), b = latest(label, c);
    return a && b && a.year !== b.year ? b.value - a.value : null;
  }).filter(v => v !== null);
  const ch = mean(changes);
  $('kpi3Label').textContent = 'Average change, ' + state.from + ' to ' + state.to;
  $('kpi3').textContent = isNaN(ch) ? 'n/a' : (ch > 0 ? '+' : '') + fmt(ch);
  $('kpi3Sub').textContent = unitOf(label) === '%' ? 'percentage points' : unitOf(label);
}

function baseOptions(xTitle, yTitle) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
    scales: {
      x: { title: { display: !!xTitle, text: xTitle } },
      y: { title: { display: !!yTitle, text: yTitle } }
    }
  };
}
function render(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}

// Chart 1: line chart, indicator over time for each country
function drawLine(sel) {
  const label = state.ind;
  const yrs = years.filter(y => y >= state.from && y <= state.to);
  $('lineTitle').textContent = label + ' (' + unitOf(label) + '), ' + state.from + ' to ' + state.to;
  render('lineChart', {
    type: 'line',
    data: {
      labels: yrs,
      datasets: sel.map(c => ({
        label: c,
        data: yrs.map(y => (data[label][c] || {})[y] ?? null),
        borderColor: colours[c], backgroundColor: colours[c],
        borderWidth: 2, pointRadius: 2, tension: 0.2, spanGaps: true
      }))
    },
    options: baseOptions('Year', unitOf(label))
  });
}

// Chart 2: bar chart, latest value per country, sorted high to low
function drawBar(sel) {
  const label = state.ind;
  const rows = sel.map(c => ({ c, ...latest(label, c) })).filter(o => o.value != null)
                  .sort((a, b) => b.value - a.value);
  $('barTitle').textContent = 'Country ranking: ' + label + ', latest up to ' + state.to;
  const opts = baseOptions('', unitOf(label));
  opts.plugins.legend.display = false;
  opts.plugins.tooltip = { callbacks: { afterLabel: ctx => 'Year: ' + rows[ctx.dataIndex].year } };
  render('barChart', {
    type: 'bar',
    data: {
      labels: rows.map(o => o.c),
      datasets: [{ label, data: rows.map(o => o.value), backgroundColor: rows.map(o => colours[o.c]) }]
    },
    options: opts
  });
}

// Chart 3: pie chart, each country's share of the combined latest value
function drawPie(sel) {
  const label = state.ind;
  const all = sel.map(c => ({ c, ...latest(label, c) })).filter(o => o.value != null);
  const rows = all.filter(o => o.value > 0);      // a pie can only show positive values
  const total = rows.reduce((s, o) => s + o.value, 0);
  const dropped = all.length - rows.length;
  $('pieTitle').textContent = 'Share of combined ' + label + ', latest up to ' + state.to +
    (dropped ? ' (' + dropped + ' zero or negative value excluded)' : '');
  const opts = { responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } },
      tooltip: { callbacks: { label: ctx => ctx.label + ': ' + fmt(ctx.parsed) + ' (' + fmt(ctx.parsed / total * 100) + '% of total)' } } } };
  render('pieChart', {
    type: 'pie',
    data: { labels: rows.map(o => o.c),
      datasets: [{ data: rows.map(o => o.value), backgroundColor: rows.map(o => colours[o.c]), borderColor: '#fff', borderWidth: 2 }] },
    options: opts
  });
}

loadCsv();
