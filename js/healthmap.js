// Constants
const ANIMATION_FRAME_DURATION_MS = 300;
const POPUP_CASE_GRAPH_WIDTH_PX = 400;
const POPUP_CASE_GRAPH_HEIGHT_PX = 300;
const COLOR_MAP = [
  ['#67009e', '< 10', 10],
  ['#921694', '11–100', 100],
  ['#d34d60', '101–500', 500],
  ['#fb9533', '501–2000', 2000],
  ['#edf91c', '> 2000'],
  ['cornflowerblue', 'New'],
];

// Runtime constants
const timestamp = (new Date()).getTime();

// Globals
let dataProvider;
let locationInfo = {};
// A map from 2-letter ISO country codes to country objects.
let countries = {};
// A map from country names to country objects.
let countriesByName = {};
let dates = [];
let map;
// The same popup object will be reused.
let popup;
let autoDriveMode = false;
let threeDMode = false;
let initialFlyTo;

let currentIsoDate;
let animationIntervalId = 0;

let atomicFeaturesByDay = {};

let timeControl;


function setTimeControlLabel(date) {
  document.getElementById('date').innerText = dates[date];
}

/** Fills with leading zeros to the desired width. */
function zfill(n, width) {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

function onAllDailySlicesFetched() {
}

// Build list of locations with counts

// Filter list of locations
function filterList() {
  let filter = document.getElementById('location-filter').value.toUpperCase();
  let ul = document.getElementById('location-list');
  let list_items = document.getElementById(
      'location-list').getElementsByTagName('li');
  let clearFilter = document.getElementById('clear-filter');
  // Loop through all list items, and hide those who don't match the search
  // query.
  for (let i = 0; i < list_items.length; ++i) {
    let label = list_items[i].getElementsByClassName('label')[0];
    let txtValue = label.textContent || label.innerText;
    // Show/hide the clear filter button.
    clearFilter.style.display = !!filter ? 'flex' : 'none';

    // Show/hide matching list items.
    const show = txtValue.toUpperCase().indexOf(filter) != -1;
    list_items[i].style.display = show ? 'list-item' : 'none';
  }
}

function clearFilter() {
  document.getElementById('location-filter').value = '';
  filterList();
}

function fetchAboutPage() {
  fetch('about.html')
    .then(function(response) { return response.text(); })
    .then(function(html) { handleShowModal(html); });
}

function handleShowModal(html) {
  let modal = document.getElementById('modal');
  let modalWrapper = document.getElementById('modal-wrapper');
  // Switch elements to have 'display' value (block, flex) but keep hidden via
  // opacity
  modalWrapper.classList.add('is-block');
  modal.classList.add('is-flex');
  setTimeout(function () {
    // for transition
    modalWrapper.classList.add('is-visible');
    modal.classList.add('is-visible');
  }, 40);
  modal.innerHTML = html;
  // Attach an event to the close button once this is finished rendering.
  setTimeout(function() {
    document.getElementById('modal-cancel').onclick = handleHideModal;
  }, 0);
}

function handleHideModal() {
  let modal = document.getElementById('modal');
  let modalWrapper = document.getElementById('modal-wrapper');
  modalWrapper.classList.remove('is-visible');
  modal.classList.remove('is-visible');
  setTimeout(function () {
    // for transition
    modalWrapper.classList.remove('is-block');
    modal.classList.add('is-flex');
  }, 400);
}

function showLegend() {
  let list = document.getElementById('legend').getElementsByTagName('ul')[0];
  for (let i = 0; i < COLOR_MAP.length; i++) {
    let color = COLOR_MAP[i];
    let item = document.createElement('li');
    let circle = document.createElement('span');
    circle.className = 'circle';
    circle.style.backgroundColor = color[0];
    let label = document.createElement('span');
    label.className = 'label';
    label.textContent = color[1];
    item.appendChild(circle);
    item.appendChild(label);
    list.appendChild(item);
  }
}

function showPopupForEvent(e) {
  if (!e['features'].length) {
    // We can't do much without a feature.
    return;
  }

  let f = e['features'][0];
  let props = f['properties'];
  let geo_id = props['geoid'];
  let coordinatesString = geo_id.split('|');
  let lat = parseFloat(coordinatesString[0]);
  let lng = parseFloat(coordinatesString[1]);

  let totalCaseCount = 0;
  // Country, province, city
  let location = locationInfo[geo_id].split(',');
  // Replace country code with name if necessary
  if (location[2].length == 2) {
    location[2] = countries[location[2]].getName();
  }
  const countryName = location[2];
  const country = countriesByName[countryName];

  // Remove empty strings
  location = location.filter(function (el) { return el != ''; });
  let locationSpan = [];
  for (let i = 0; i < location.length; i++) {
    if (i == location.length - 1 && !!country) {
      locationSpan.push('<a target="_blank" href="/c/' +
                        country.getCode() + '/">' + location[i] + '</a>');
    } else {
      locationSpan.push(location[i]);
    }
  }
  totalCaseCount = props['total'];

  let content = document.createElement('div');
  content.innerHTML = '<h3 class="popup-header"><span>' + locationSpan.join(', ') + '</span></h3>';

  let relevantFeaturesByDay = {};
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    relevantFeaturesByDay[date] = [];
    for (let j = 0; j < atomicFeaturesByDay[date].length; j++) {
      const feature = atomicFeaturesByDay[date][j];
      if (feature['properties']['geoid'] == geo_id) {
        relevantFeaturesByDay[date].push(feature);
      }
    }
  }

  content.appendChild(Graphing.makeCasesGraph(
      DataProvider.convertGeoJsonFeaturesToGraphData(relevantFeaturesByDay, 'total'),
      POPUP_CASE_GRAPH_WIDTH_PX, POPUP_CASE_GRAPH_HEIGHT_PX, true /* mini */));

  // Ensure that if the map is zoomed out such that multiple
  // copies of the feature are visible, the popup appears
  // over the copy being pointed to.
  while (Math.abs(e['lngLat']['lng'] - lng) > 180) {
    lng += e['lngLat']['lng'] > lng ? 360 : -360;
  }
  popup.setLngLat([lng, lat]).setDOMContent(content);
  map.addPopup(popup);
  popup.getElement().onmouseleave = function() {
    popup.remove();
  };
}

function flyToCountry(event) {
  let target = event.target;
  while (!target.getAttribute('country')) {
    target = target.parentNode;
  }
  const code = target.getAttribute('country');
  if (!code) {
    return;
  }
  map.flyToCountry(code);
}

function showDataAtDate(iso_date) {
  map.showDataAtDate(iso_date);
}

function onMapAnimationEnded() {
  if (autoDriveMode) {
    // Let the last frame last for a few seconds before restarting.
    setTimeout(function() {
      toggleMapAnimation(onMapAnimationEnded);
    }, 2000);
  }
}

function onAllDataFetched() {
  dates = dates.sort();
  if (autoDriveMode) {
    toggleMapAnimation(onMapAnimationEnded);
  }
}

function toggleSideBar() {
  let pageWrapper = document.getElementById('page-wrapper');
  const previouslyHidden = pageWrapper.classList.contains('sidebar-hidden');
  document.getElementById('sidebar-tab-icon').textContent = previouslyHidden ? '◀' : '▶';
  pageWrapper.classList.toggle('sidebar-hidden');
}

function processHash(url) {
  const hash = url.split('#')[1] || '';
  if (!!hash) {
    let hashBrowns = hash.split('/');
    for (let i = 0; i < hashBrowns.length; i++) {
      const hashBrown = hashBrowns[i];
      if (hashBrown.toLowerCase() == 'autodrive') {
        autoDriveMode = true;
        document.body.classList.add('autodrive');
        continue;
      }
      if (hashBrown.toLowerCase() == '3d') {
        threeDMode = true;
        continue;
      }
      // Country codes
      if (hashBrown.length == 2 && hashBrown.toUpperCase() == hashBrown) {
        initialFlyTo = hashBrown;
      }
    }
  }}

function init() {
  dataProvider = new DataProvider(
      'https://raw.githubusercontent.com/ghdsi/covid-19/master/');

  processHash(window.location.href);
  timeControl = document.getElementById('slider');
  document.getElementById('sidebar-tab').onclick = toggleSideBar;
  document.getElementById('percapita').addEventListener('change', function(e) {
    dataProvider.updateCountryListCounts();
  });
  toggleSideBar();

  map = new DiseaseMap();
  map.init(function() {});

  dataProvider.fetchInitialData(function() {
    // Once the initial data is here, fetch the daily slices. Start with the
    // newest.
    dataProvider.fetchLatestDailySlice(function() {
      // The page is now interactive and showing the latest data. If we need to
      // focus on a given country, do that now.
      if (!!initialFlyTo) {
        map.flyToCountry(initialFlyTo);
      }
      // At this point the 'dates' array only contains the latest date.
      // Show the latest data when we have that before fetching older data.
      map.showDataAtDate(dates[0]);
      dataProvider.fetchDailySlices(onAllDataFetched);
    });
  });
  // Get the basic data about locations before we can start getting daily
  // slices.

  document.getElementById('spread').
      addEventListener('click', toggleMapAnimation);
  document.getElementById('playpause').setAttribute('src', 'img/play.svg');
}

function countryInit() {
  dataProvider = new DataProvider(
      'https://raw.githubusercontent.com/ghdsi/covid-19/master/');
  dataProvider.loadCountryData(showCountryPage);
}

function completenessInit() {
  dataProvider = new DataProvider(
      'https://raw.githubusercontent.com/ghdsi/covid-19/master/');
  dataProvider.fetchInitialData(function() {
    // We only need the latest daily slice for the data completeness page.
    dataProvider.fetchLatestDailySlice(function() {
      const latestCountryFeatures = dataProvider.getCountryFeaturesForDay(
          dates[0]);

      const aggregates = {};
      const totalsFromIndividuals = {};

      const latestDataPerCountry = dataProvider.getLatestDataPerCountry();
      for (let c in latestDataPerCountry) {
        aggregates[c] = latestDataPerCountry[c][0];
      }

      for (let c in latestCountryFeatures) {
        const data = latestCountryFeatures[c];
        totalsFromIndividuals[c] = data['total'];
      }

      let comparisons = [];
      for (let c in aggregates) {
          comparisons.push([c, totalsFromIndividuals[c] || 0, aggregates[c]]);
      }
      // Sort by completeness level.
      comparisons.sort(function(a, b) {
        return (a[1] / a[2]) >= (b[1] / b[2]) ? 1 : -1;
      });
      let container = document.getElementById('data');
      container.innerHTML = '';
      let list = document.createElement('ul');
      for (let i = 0; i < comparisons.length; i++) {
        const code = comparisons[i][0];
        const name = countries[code].getName();
        const individual = comparisons[i][1];
        const aggregate = comparisons[i][2];
        const percentage = (100 * individual / aggregate).toFixed(1);
        let item = document.createElement('li');
        item.innerHTML = name + ': <b>' + percentage + '%</b>' +
              ' (' + individual + ' vs ' + aggregate + ')';
        list.appendChild(item);
      }
      container.appendChild(list);
    });
  });
}

function showCountryPage(data) {
  // De-duplicate geoids and dates, in case the data isn't well organized.
  let geoids = new Set();
  let dates = new Set();
  for (let date in data) {
    dates.add(date);
  }
  dates = Array.from(dates).sort();

  let o = {'dates': dates};

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    for (let geoid in data[date]) {
      geoids.add(geoid);
    }
  }

  const geoidsArray = Array.from(geoids);
  for (let i = 0; i < geoidsArray.length; i++) {
    const g = geoidsArray[i];
    o[g] = [];
    for (let j = 0; j < dates.length; j++) {
      const date = dates[j];
      if (!isNaN(data[date][g])) {
        o[g].push(data[date][g]);
      } else {
        o[g].push(null);
      }
    }
  }

  let chartsEl = document.getElementById('charts');
  chartsEl.appendChild(Graphing.makeCasesGraph(
      o, chartsEl.clientWidth, chartsEl.clientHeight, false /* mini */));
}

// Exports
if (typeof(globalThis) === 'undefined' && typeof(global) !== "undefined") {
    globalThis = global;
}
globalThis['clearFilter'] = clearFilter;
globalThis['fetchAboutPage'] = fetchAboutPage;
globalThis['filterList'] = filterList;
globalThis['init'] = init;
globalThis['countryInit'] = countryInit;
globalThis['completenessInit'] = completenessInit;
