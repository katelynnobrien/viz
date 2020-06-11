
/** @constructor */
let DataProvider = function(baseUrl) {
  /**
   * @const
   * @private
   */
  this.baseUrl_ = baseUrl;

  /** @private */
  this.countryFeaturesByDay_ = [];

  /** @private */
  this.provinceFeaturesByDay_ = [];

  /** @private */
  this.cityFeaturesByDay_ = [];

  /**
   * A map from country names to most recent data (case count, etc.).
   * @private
   */
  this.latestDataPerCountry_ = {};

  /** @private */
  this.dataSliceFileNames_ = [];
};

/**
 * This takes an Object whose keys are date string, and values are arrays of
 * GeoJSON-style features. It returns an Object with the following properties:
 * - 'dates' maps to an array of length N containing sorted date strings
 * - 'geoids' maps to an array containing unique geoids for this set
 * - for each geoid in the input data set, a key of this geoid maps to an
 *   array of length N containing corresponding values. A missing value is
 *   represented by 'null'.
 */
DataProvider.convertGeoJsonFeaturesToGraphData = function(datesToFeatures, prop) {
  let o = {};
  let dates = new Set();
  let geoids = new Set();
  for (let date in datesToFeatures) {
    dates.add(date);
  }
  o['dates'] = Array.from(dates).sort();

  for (let i = 0; i < o['dates'].length; i++) {
    const date = o['dates'][i];
    for (let j = 0; j < datesToFeatures[date].length; j++) {
      const feature = datesToFeatures[date][j];
      const geoid = feature['properties']['geoid'];
      if (!!geoid) {
        geoids.add(geoid);
      }
    }
  }
  o['geoids'] = Array.from(geoids);

  for (let i = 0; i < o['geoids'].length; i++) {
    const geoid = o['geoids'][i];
    if (!o[geoid]) {
      o[geoid] = [];
    }
    for (let j = 0; j < o['dates'].length; j++) {
      const date = o['dates'][j];
      let added = false;
      let k = 0;
      while (!added && k < datesToFeatures[date].length) {
        const feature = datesToFeatures[date][k];
        if (feature['properties']['geoid'] == geoid) {
          if (feature['properties'].hasOwnProperty(prop)) {
            o[geoid].push(feature['properties'][prop]);
            added = true;
            break;
          }
        }
        k++;
      }
      if (!added) {
        o[geoid].push(null);
      }
    }
  }
  return o;
}

DataProvider.prototype.getLatestDataPerCountry = function() {
  return this.latestDataPerCountry_;
};

DataProvider.prototype.fetchInitialData = function(callback) {
  const self = this;
  Promise.all([
    this.fetchLatestCounts(),
    this.fetchCountryNames(),
    this.fetchDataIndex(),
    this.fetchLocationData()
  ]).then(function() { self.fetchJhuData(); }).then(callback);
};


DataProvider.prototype.fetchDailySlices = function(callback) {
  let dailyFetches = [];
  for (let i = 0; i < this.dataSliceFileNames_.length; i++) {
    dailyFetches.push(this.fetchDailySlice(
        this.dataSliceFileNames_[i], false /* isNewest */));
  }
  Promise.all(dailyFetches).then(callback);
};


/** Loads the location data (geo names from latitude and longitude). */
DataProvider.prototype.fetchLocationData = function() {
  return fetch(this.baseUrl_ + 'location_info.data')
    .then(function(response) { return response.text(); })
    .then(function(responseText) {
      let lines = responseText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].split(':');
        locationInfo[parts[0]] = parts[1];
      }
    });
};


DataProvider.prototype.fetchDataIndex = function() {
  let self = this;
  return fetch(this.baseUrl_ + '/d/index.txt')
    .then(function(response) { return response.text(); })
    .then(function(responseText) {
      let lines = responseText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!!line) {
          self.dataSliceFileNames_.push(line);
        }
      }
    });
};


DataProvider.prototype.fetchCountryNames = function() {
  return fetch('https://raw.githubusercontent.com/ghdsi/common/master/countries.data')
    .then(function(response) { return response.text(); })
    .then(function(responseText) {
      let countryLines = responseText.trim().split('\n');
      for (let i = 0; i < countryLines.length; i++) {
        let parts = countryLines[i].split(':');
        const code = parts[0];
        const name = parts[1];
        // Check whether population count is part of this datum.
        const population = parts.length == 4 ? parseInt(parts[2], 10) : 0;
        let bboxIndex = parts.length == 4 ? 3 : 2;
        let bboxParts = parts[bboxIndex].split('|');
        let bboxes = [];
        for (let j = 0; j < bboxParts.length; j++) {
            let bbox = bboxParts[j].split(',');
            bboxes.push(bbox);
        }
        let c = new Country(code, name, population, bboxes);
        countries[code] = c;
        countriesByName[name] = c;
      }
    });
};


/** Loads the latest case counts from the scraper. */
DataProvider.prototype.fetchLatestCounts = function() {
  return fetch(this.baseUrl_ + 'latestCounts.json?nocache=' + timestamp)
    .then(function(response) { return response.json(); })
    .then(function(jsonData) {
      const totalCasesEl = document.getElementById('total-cases');
      const lastUpdatedDateEl = document.getElementById('last-updated-date');
      if (!!totalCasesEl) {
        const totalCases = parseInt(jsonData[0]['caseCount'], 10);
        totalCasesEl.innerText = totalCases.toLocaleString();
      }
      if (!!lastUpdatedDateEl) {
        lastUpdatedDateEl.innerText = jsonData[0]['date'];
      }
    });
};


/** Loads the appropriate country-specific data. */
DataProvider.prototype.loadCountryData = function(callback) {
  const code = document.getElementById('dash').getAttribute('c');
  let self = this;
  this.fetchLocationData().then(function() {
    return fetch(self.baseUrl_ + 'c/' + code + '.json'); }).
        then(function(response) { return response.json(); }).then(callback);
}


DataProvider.prototype.fetchLatestDailySlice = function(callback) {
  return this.fetchDailySlice(this.dataSliceFileNames_[0], true /* isNewest */)
      .then(callback);
}

/**
 * Fetches the next daily slice of data we need. If no argument is provided,
 * fetches the latest slice first.
 */
DataProvider.prototype.fetchDailySlice = function(sliceFileName, isNewest) {
  let self = this;
  let url = this.baseUrl_ + 'd/' + sliceFileName;
  // Don't cache the most recent daily slice. Cache all others.
  if (isNewest) {
    url += '?nocache=' + timestamp;
  }
  return fetch(url)
      .then(function(response) {
          return response.status == 200 ? response.json() : undefined;
      })
      .then(function(jsonData) {
        if (!jsonData) {
          return;
        }
        self.processDailySlice(jsonData, isNewest);
  });
};


DataProvider.prototype.processDailySlice = function(jsonData, isNewest) {
  let currentDate = jsonData['date'];
  let features = jsonData['features'];

  // Cases grouped by country and province.
  let provinceFeatures = {};
  let countryFeatures = {};

  // "Re-hydrate" the features into objects ingestable by the map.
  for (let i = 0; i < features.length; i++) {
    let feature = DiseaseMap.formatFeature(features[i]);

    // If we don't know where this is, discard.
    if (!locationInfo[feature['properties']['geoid']]) {
      continue;
    }
    // City, province, country.
    let location = locationInfo[feature['properties']['geoid']].split(',');
    const countryCode = location[2];
    if (countryCode.length != 2) {
      console.log('Warning: invalid country code: ' + countryCode);
      console.log('From ' + location);
    }
    if (!provinceFeatures[location[1]]) {
      provinceFeatures[location[1]] = {'total': 0, 'new': 0};
    }
    provinceFeatures[location[1]]['total'] += feature['properties']['total'];
    provinceFeatures[location[1]]['new'] += feature['properties']['new'];
    if (!countryFeatures[countryCode]) {
      countryFeatures[countryCode] = {'total': 0, 'new': 0};
    }
    countryFeatures[countryCode]['total'] += feature['properties']['total'];
    countryFeatures[countryCode]['new'] += feature['properties']['new'];
  }

  dates.unshift(currentDate);

  countryFeaturesByDay[currentDate] = countryFeatures;
  provinceFeaturesByDay[currentDate] = provinceFeatures;
  atomicFeaturesByDay[currentDate] = features;
  console.log(countryFeaturesByDay[currentDate]);
  if (!!timeControl) {
    updateTimeControl();
  }
};


DataProvider.prototype.fetchJhuData = function() {
  let self = this;
  return fetch(this.baseUrl_ + 'jhu.json?nocache=' + timestamp)
    .then(function(response) { return response.json(); })
    .then(function(jsonData) {
      // If the page we are on doesn't have the corresponding UI, we don't need
      // to do anything else.
      let countryList = document.getElementById('location-list');
      let obj = jsonData['features'];
      // Sort according to decreasing confirmed cases.
      obj.sort(function(a, b) {
        return b['attributes']['cum_conf'] - a['attributes']['cum_conf'];
      });
      for (let i = 0; i < obj.length; ++i) {
        let location = obj[i];
        if (!location || !location['attributes'] || !location['centroid']) {
          // We can't do much with this location.
          continue;
        }
        const code = location['attributes']['code'];
        const country = countries[code];
        if (!country) {
          continue;
        }
        const name = country.getName();
        let lon = location['centroid']['x'] || 0;
        let lat = location['centroid']['y'] || 0;
        const geoid = '' + lat + '|' + lon;
        // The total count comes down as a formatted string.
        let cumConf = parseInt(
            location['attributes']['cum_conf'].replace(/,/g, ''),
            10) || 0;
        let legendGroup = 'default';
        self.latestDataPerCountry_[code] = [cumConf];
        if (!!countryList) {
          // No city or province, just the country name.
          locationInfo[geoid] = ',,' + name;
          if (cumConf <= 10) {
            legendGroup = '10';
          } else if (cumConf <= 100) {
            legendGroup = '100';
          } else if (cumConf <= 500) {
            legendGroup = '500';
          } else if (cumConf <= 2000) {
            legendGroup = '2000';
          }

          let item = document.createElement('li');
          let button = document.createElement('button');
          button.setAttribute('country', code);
          button.onclick = flyToCountry;
          button.innerHTML = '<span class="label">' + name + '</span>' +
              '<span class="num legend-group-' + legendGroup +
              '"></span>';
          item.appendChild(button);
          countryList.appendChild(item);
        }
      }
      if (!!countryList) {
        self.updateCountryListCounts();
      }
    });
}


DataProvider.prototype.updateCountryListCounts = function() {
  const list = document.getElementById('location-list');
  let countSpans = list.getElementsByClassName('num');
  for (let i = 0; i < countSpans.length; i++) {
    let span = countSpans[i];
    const code = span.parentNode.getAttribute('country');
    const country = countries[code];
    let countToShow = this.getLatestDataPerCountry()[code][0];
    if (document.getElementById('percapita').checked) {
      const population = country.getPopulation();
      if (!!population) {
        countToShow = '' + (100 * countToShow / country.getPopulation()).
              toFixed(3) + '%';
      } else {
        countToShow = '?';
      }
    } else {
      countToShow = countToShow.toLocaleString();
    }
    span.textContent = countToShow;
  }
  this.sortCountryList();
};


DataProvider.prototype.sortCountryList = function() {
  const list = document.getElementById('location-list');
  let items = list.children;
  let itemsArray = [];
  for (let i = 0; i < items.length; i++) {
    itemsArray.push(items[i]);
  }
  itemsArray.sort(function(a, b) {
    const str_a = a.getElementsByClassName(
        'num')[0].textContent.replace(/,/g, '');
    const str_b = b.getElementsByClassName(
        'num')[0].textContent.replace(/,/g, '');
    if (str_a == '?') { return 1; }
    if (str_b == '?') { return -1;}
    const count_a = parseFloat(str_a);
    const count_b = parseFloat(str_b);
    return count_a == count_b ? 0 : (count_a < count_b ? 1 : -1);
  });

  for (let i = 0; i < itemsArray.length; i++) {
    list.appendChild(itemsArray[i]);
  }
};


DataProvider.prototype.getCompletenessData = function(callback) {
}
