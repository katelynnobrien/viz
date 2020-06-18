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
    'legend': {
      'display': false,
    },
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
  // We have one key for dates, and one for geoids.
  const singleCurve = Object.keys(data).length == 3;
  for (let geoid in data) {
    if (geoid == 'dates' || geoid == 'geoids') {
      continue;
    }
    let curve = {};
    curve['data'] = data[geoid];
    curve['borderColor'] =
        Graphing.CURVE_COLORS[i % Graphing.CURVE_COLORS.length];
    let label = '';
    if (singleCurve) {
      // For the time being, a graph with a single curve means we're showing
      // total cases, and the rest of the info is above the graph.
      label = 'Total cases';
    } else {
      // If we're showing multiple curves, show the city and region, but assume
      // the country is shown elsewhere.
      let info = locationInfo[geoid].split('|');
      // Remove the country.
      info = info.slice(0, 2);
      // Remove empty strings.
      info = info.filter(function (el) { return el != ''; });
      label = info.join(', ');
    }
    curve['label'] = label;
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
