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
      'filter': function (tooltipItem, data) {
        // Don't clutter the tooltip with 0 values.
        return tooltipItem['value'] != 0;
      },
      'mode': 'index',
      'intersect': false,
      'position': 'nearest',
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


Graphing.average = function(arr) {
  return arr.reduce((a, b) => (a + b)) / arr.length;
}

/**
 * Applies a sliding window of the given length on the given data. The window is
 * applied towards the past, meaning that the result of a given data point only
 * depends on past data. This also means that the first [windowSize - 1] data
 * points have to be discarded.
 */
Graphing.applySlidingWindow = function(data, windowSize) {
  let averagedData = [];
  let sliding = data.slice(0, windowSize);
  for (let i = windowSize; i < data.length; i++) {
    averagedData.push(Math.floor(Graphing.average(sliding)));
    sliding.shift();
    sliding.push(data[i]);
  }
  return averagedData;
}


/**
 * Takes a data object as returned by
 * |DataProvider.convertGeoJsonFeaturesToGraphData|.
 * Returns a DOM element with the requested graph.
 */
Graphing.makeCasesGraph = function(data, useAverageWindow, container) {

  const slidingWindowSize = 7;
  const singleCurve = Object.keys(data).length == 2;
  let canvas = document.createElement('canvas');
  canvas.setAttribute('width', container.clientWidth + 'px');
  canvas.setAttribute('height', container.clientHeight + 'px');
  container.appendChild(canvas);
  let ctx = canvas.getContext('2d');
  let cfg = Graphing.CHART_CONFIG;

  let labels = [];
  for (let i = 0; i < data['dates'].length; i++) {
    const date = data['dates'][i];
    labels.push(Graphing.isoDateToUnixTime(date));
  }

  // TODO: Right now we assume we want to apply a sliding window average
  // when there is more than one curve. These two things should be independent.
  if (useAverageWindow) {
    labels = labels.slice(slidingWindowSize);
  }

  let dataToPlot = [];
  let i = 0;
  // We have one key for dates, and one for geoids.
  for (let geoid in data) {
    if (geoid == 'dates') {
      continue;
    }
    let curve = {};
    const color = Graphing.CURVE_COLORS[i % Graphing.CURVE_COLORS.length];
    curve['borderColor'] = color;
    let label = '';
    // If we're showing multiple curves, show the city and region, but assume
    // the country is shown elsewhere.
    let info = locationInfo[geoid];
    if (!!info) {
      info = info.split('|');
      // Use the country name.
      info[2] = countries[info[2]].getName();
      // Remove empty strings.
      info = info.filter(function (el) { return el != ''; });
      label = info.join(', ');
    } else {
      label = 'Total cases';
    }
    curve['data'] = useAverageWindow ?
        Graphing.applySlidingWindow(data[geoid], slidingWindowSize) :
        data[geoid];
    curve['label'] = label;
    dataToPlot.push(curve);
    i += 1;
  }

  cfg['data'] = {
    'labels': labels,
    'datasets': dataToPlot,
  };

  new Chart(ctx, cfg);
};
