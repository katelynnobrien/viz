const STARTING_CASE_COUNT = 10000;

function syncInit() {
  dataProvider = new DataProvider(
      'https://raw.githubusercontent.com/ghdsi/covid-19/master/');
  dataProvider.fetchCountryNames().
      then(dataProvider.fetchJhuData.bind(dataProvider)).
      then(showSyncPage);
  setupTopBar();
}

function showSyncPage() {
  const aggregates = dataProvider.getAggregateData();
  let dates = Object.keys(aggregates);
  // Sort in chronological order.
  dates = dates.sort();
  let o = {'dates': dates};
  let curveStart = {};
  let curves = {};
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    let items = aggregates[date];
    for (let j = 0; j < items.length; j++) {
      const code = items[j]['code'];
      const cases = items[j]['cum_conf']
      if (!curveStart[code] && cases >= STARTING_CASE_COUNT) {
        curveStart[code] = date;
      }
      if (!!curveStart[code]) {
        if (!curves[code]) {
          curves[code] = [];
        }
        curves[code].push([date, cases]);
      }
    }
  }

  let maxDays = 0;
  for (let code in curves) {
    maxDays = Math.max(maxDays, curves[code].length);
  }

  let labels = [];
  let dataToPlot = [];
  for (let i = 0; i < maxDays; i++) {
    labels.push('D + ' + i);
  }
  let i = 0;
  for (let code in curves) {
    const country = countries[code];
    const name = country.getName();
    let thisData = [];
      for (let j = 0; j < curves[code].length; j++) {
        const caseCount = curves[code][j][1];
        const percentage = (caseCount / country.getPopulation() * 1000).toFixed(2);
        thisData.push(percentage);
    }
    const color = Graphing.CURVE_COLORS[i % Graphing.CURVE_COLORS.length];
    dataToPlot.push({'data': thisData, 'label': name, 'borderColor': color});
    i++;
  }

  let container = document.getElementById('data');
  container.innerHTML = '';
  let canvas = document.createElement('canvas');
  canvas.setAttribute('width', container.clientWidth + 'px');
  canvas.setAttribute('height', container.clientHeight + 'px');
  container.appendChild(canvas);
  let ctx = canvas.getContext('2d');
  let cfg = Graphing.CHART_CONFIG;
  cfg['options']['tooltips']['mode'] = 'nearest';
  cfg['options']['tooltips']['callbacks'] = {'label': function(item, data) {
    return data['datasets'][item['datasetIndex']]['label'] + ': ' + item['yLabel'] + ' ‰';
  }};
  cfg['options']['scales']['xAxes'][0]['type'] = undefined;
  cfg['options']['scales']['xAxes'][0]['time'] = {};

  cfg['data'] = {
    'labels': labels,
    'datasets': dataToPlot,
  }

  new Chart(ctx, cfg);
}

globalThis['syncInit'] = syncInit;
