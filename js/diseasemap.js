/** @constructor */
let DiseaseMap = function() {

  /** @private */
  this.mapboxMap_;
};

DiseaseMap.MAPBOX_TOKEN = 'pk.eyJ1IjoiaGVhbHRobWFwIiwiYSI6ImNrOGl1NGNldTAyYXYzZnBqcnBmN3RjanAifQ.H377pe4LPPcymeZkUBiBtg';

DiseaseMap.THREE_D_FEATURE_SIZE_IN_LATLNG = 0.4;

DiseaseMap.LIGHT_THEME = 'mapbox://styles/healthmap/ckc1y3lbr1upr1jq6pwfcb96k';
DiseaseMap.DARK_THEME = 'mapbox://styles/healthmap/ck7o47dgs1tmb1ilh5b1ro1vn';

/**
 * Takes an array of features, and bundles them in a way that the map API
 * can ingest.
 */
DiseaseMap.formatFeatureSet = function(features) {
  return {'type': 'FeatureCollection', 'features': features};
};


/** Tweaks the given object to make it ingestable as a feature by the map API. */
DiseaseMap.formatFeature = function(feature) {
  feature.type = 'Feature';
  if (!feature['properties']) {
    // This feature is missing key data, adding a placeholder.
    feature['properties'] = {'geoid': '0|0'};
  }
  // If the 'new' property is absent, assume 0.
  if (isNaN(feature['properties']['new'])) {
    feature['properties']['new'] = 0;
  }
  let coords = feature['properties']['geoid'].split('|');
  const featureType = threeDMode ? 'Polygon' : 'Point';
  const lat = parseFloat(coords[0]);
  const lng = parseFloat(coords[1]);
  // Flip latitude and longitude.
  let featureCoords = [lng, lat];
  if (threeDMode) {
    const half = DiseaseMap.THREE_D_FEATURE_SIZE_IN_LATLNG / 2;
    featureCoords = [[
      [lng + half, lat + half],
      [lng - half, lat + half],
      [lng - half, lat - half],
      [lng + half, lat - half],
      [lng + half, lat + half],
    ]];
  }
  feature['geometry'] = {
    'type': featureType,
    'coordinates': featureCoords,
  };
  if (threeDMode) {
    feature['properties']['height'] = 10 * Math.sqrt(100000 * feature['properties']['total']);
  }
  return feature;
};


DiseaseMap.prototype.showDataAtLatestDate = function() {
  if (!dates.length) {
    return;
  }
  const latestDate = dates[dates.length - 1];
  this.showDataAtDate(latestDate);
}

DiseaseMap.prototype.showDataAtDate = function(isodate) {
  if (currentIsoDate != isodate) {
    currentIsoDate = isodate;
  }
  let featuresToShow = atomicFeaturesByDay[isodate];

  // If the map is ready, show the data. Otherwise it will be shown when
  // the map is finished loading.
  let source = this.mapboxMap_.getSource('counts');
  if (!!source) {
    source.setData(DiseaseMap.formatFeatureSet(featuresToShow));
  }
};


DiseaseMap.prototype.init = function(callback) {
  mapboxgl.accessToken = DiseaseMap.MAPBOX_TOKEN;
  this.mapboxMap_ = new mapboxgl.Map({
    'container': 'map',
    'style': lightTheme ? DiseaseMap.LIGHT_THEME : DiseaseMap.DARK_THEME,
    'center': [10, 0],
    'zoom': 1,
  }).addControl(new mapboxgl.NavigationControl());
  popup = new mapboxgl.Popup({
    'closeButton': false,
    'closeOnClick': true,
    'maxWidth': 'none',
  });

  let self = this;
  timeControl.addEventListener('input', function() {
    setTimeControlLabel(timeControl.value);
    self.showDataAtDate(dates[timeControl.value]);
  });

  this.mapboxMap_.on('load', function () {
    self.mapboxMap_.addSource('counts', {
      'type': 'geojson',
      'data': DiseaseMap.formatFeatureSet([])
    });

    let circleColorForTotals = ['step', ['get', 'total']];
    // Don't use the last color here (for new cases).
    for (let i = 0; i < COLOR_MAP.length - 1; i++) {
      let color = COLOR_MAP[i];
      circleColorForTotals.push(color[0]);
      if (color.length > 2) {
        circleColorForTotals.push(color[2]);
      }
    }

    self.addLayer(map, 'totals', 'total', circleColorForTotals);
    //self.addLayer(map, 'daily', 'new', 'cornflowerblue');

    // If we're not showing any data yet, let's fix that.
    self.showDataAtLatestDate();

    self.mapboxMap_.on('mouseenter', 'totals', function (e) {
      // Change the cursor style as a UI indicator.
      this.getCanvas().style.cursor = 'pointer';
    });

    self.mapboxMap_.on('click', 'totals', showPopupForEvent);

    self.mapboxMap_.on('mouseleave', 'totals', function () {
      this.getCanvas().style.cursor = '';
    });
    if (threeDMode) {
      self.mapboxMap_.easeTo({pitch: 55});
    }
  });
  showLegend();
};


DiseaseMap.prototype.addPopup = function(popup) {
  popup.addTo(this.mapboxMap_);
};


DiseaseMap.prototype.addLayer = function(map, id, featureProperty, circleColor) {
  const type = threeDMode ? 'fill-extrusion' : 'circle';
  // const type = threeDMode ? 'fill' : 'circle';
  let paint = {
    'circle-radius': [
      'case', ['<', 0, ['number', ['get', featureProperty]]],
      ['*', ['log10', ['sqrt', ['get', featureProperty]]], 5],
      0],
    'circle-color': circleColor,
    'circle-opacity': 0.6,
  };
  if (threeDMode) {
    paint = {
      // 'fill-extrusion-base': 0,
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-color': circleColor,
      'fill-extrusion-opacity': 0.8,
    };
  }

  this.mapboxMap_.addLayer({
    'id': id,
    'type': type,
    'source': 'counts',
    'paint': paint
  });
};


/**
 * Navigates the map to the given country.
 * @param {string} code The code of the country to fly to.
 */
DiseaseMap.prototype.flyToCountry = function(code) {
  const country = countries[code];
  const dest = country.getMainBoundingBox();
  this.mapboxMap_.fitBounds([[dest[0], dest[1]], [dest[2], dest[3]]]);
};
