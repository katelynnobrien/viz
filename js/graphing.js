let Graphing = function() {
};

Graphing.CURVE_COLORS = [
  '#4285F4',
  '#DB4437',
  '#F4B400',
  '#0F9D58',
];


Graphing.CHART_CONFIG = {
  'type': 'line',
  'options': {
    'responsive': true,
    'tooltips': {
      'mode': 'index',
      'intersect': false,
    },
    'hover': {
      'mode': 'index',
      'intersect': false
    },
    'scales': {
      'xAxes': [{
        'type': 'time',
        'time': {
          'tooltipFormat': 'll'
        },
        'scaleLabel': {
          'display': false,
        }
      }],
      'yAxes': [
        {'position': 'left',  'id': 'y1'},
      ]
    }
  }
};


Graphing.isoDateToUnixTime = function(isoDate) {
  const d = new Date(isoDate);
  return d.getTime();
};


/**
 * Takes a data object as returned by
 * |DataProvider.convertGeoJsonFeaturesToGraphData|.
 * Returns a DOM element with the requested graph.
 */
Graphing.makeCasesGraph = function(
      data, totalWidth, totalHeight, mini) {

  const container = document.createElement('div');
  container.setAttribute('id', 'chart');
  container.innerHTML = '';
  let chart = document.createElement('canvas');
  chart.setAttribute('width', totalWidth + 'px');
  chart.setAttribute('height', totalHeight + 'px');
  container.appendChild(chart);
  let ctx = chart.getContext('2d');
  // Deep copy.
  let cfg = JSON.parse(JSON.stringify(Graphing.CHART_CONFIG));

  let labels = [];
  for (let i = 0; i < data['dates'].length; i++) {
    const date = data['dates'][i];
    labels.push(Graphing.isoDateToUnixTime(date));
  }

  let dataToPlot = [];
  let i = 0;
  for (let geoid in data) {
    if (geoid == 'dates' || geoid == 'geoids') {
      continue;
    }
    let curve = {};
    curve['data'] = data[geoid];
    curve['borderColor'] =
        Graphing.CURVE_COLORS[i % Graphing.CURVE_COLORS.length];
    curve['label'] = 'Total cases';
    dataToPlot.push(curve);
    i += 1;
  }

  cfg['data'] = {
    'labels': labels,
    'datasets': dataToPlot,
  };

  new Chart(ctx, cfg);
  return container;
};
