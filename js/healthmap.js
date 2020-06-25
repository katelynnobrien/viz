// Constants
const ANIMATION_FRAME_DURATION_MS = 300;
const POPUP_CASE_GRAPH_WIDTH_PX = 400;
const POPUP_CASE_GRAPH_HEIGHT_PX = 300;
const LIVE_UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const COLOR_MAP = [
  ['#67009e', '< 10', 10],
  ['#921694', '11–100', 100],
  ['#d34d60', '101–500', 500],
  ['#fb9533', '501–2000', 2000],
  ['#edf91c', '> 2000'],
  ['cornflowerblue', 'New'],
];
const RANK_COLORS = [
  '#b600ff',  // purple
  '#0c1fb4',  // dark blue
  '#0060ff',  // blue
  '#00dd8e',  // teal
  '#00b31a',  // green
  '#bb9900',  // yellow
  '#e37300',  // orange
  '#e90000',  // red
];

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
let currentDateIndex = 0;
let animationIntervalId = 0;
let currentTouchY = -1;

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
  let location = locationInfo[geo_id].split('|');
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
  content.innerHTML = '<h3 class="popup-header"><span>' +
        locationSpan.join(', ') + '</span></h3>';

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

  let container = document.createElement('div');
  container.classList.add('chart');
  Graphing.makeCasesGraph(
      DataProvider.convertGeoJsonFeaturesToGraphData(
          relevantFeaturesByDay, 'total'), false /* average */, container);
  content.appendChild(container);

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
  document.getElementById('sidebar-tab-icon').textContent =
        previouslyHidden ? '◀' : '▶';
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
  }
}

function setupTopBar() {
  const LINKS = [
    ['Map', '/'],
    ['3D Map', '/#3d'],
    ['Auto-drive', '/#autodrive'],
    ['Rank', '/rank'],
    ['Completeness', '/completeness'],
  ];
  let topBar = document.getElementById('topbar');
  topBar.innerHTML = '<ul></ul>';
  for (let i = 0; i < LINKS.length; i++) {
    let item = document.createElement('li');
    item.textContent = LINKS[i][0];
    item.onclick = function() {
      window.location.replace(LINKS[i][1]);
    }
    topBar.firstElementChild.appendChild(item);
  }
}

function init() {
  dataProvider = new DataProvider(
      'https://raw.githubusercontent.com/ghdsi/covid-19/master/');

  processHash(window.location.href);
  window.onhashchange = function() {
    // TODO: Handle this more gracefully without a full reload.
    window.location.reload();
  }
  setupTopBar();
  timeControl = document.getElementById('slider');
  document.getElementById('sidebar-tab').onclick = toggleSideBar;
  document.getElementById('percapita').addEventListener('change', function(e) {
    updateCountryListCounts();
  });
  toggleSideBar();

  map = new DiseaseMap();
  map.init(function() {});

  dataProvider.fetchInitialData().then(function() {
    // Once the initial data is here, fetch the daily slices. Start with the
    // newest.
    dataProvider.fetchLatestDailySlice().then(function() {
      // The page is now interactive and showing the latest data. If we need to
      // focus on a given country, do that now.
      if (!!initialFlyTo) {
        map.flyToCountry(initialFlyTo);
      }
      renderCountryList();
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
  window.setTimeout(updateData, LIVE_UPDATE_INTERVAL_MS);
}

function renderCountryList() {
  let countryList = document.getElementById('location-list');
  const latestAggregateData = dataProvider.getLatestAggregateData();
  if (!latestAggregateData) {
    console.log('No data for rendering country list');
    return;
  }

  // Sort according to decreasing confirmed cases.
  latestAggregateData.sort(function(a, b) {
    return b['cum_conf'] - a['cum_conf'];
  });
  for (let i = 0; i < latestAggregateData.length; ++i) {
    let location = latestAggregateData[i];
    if (!location || !location['code']) {
      // We can't do much with this location.
      continue;
    }
    const code = location['code'];
    const country = countries[code];
    if (!country) {
      continue;
    }
    const name = country.getName();
    const geoid = country.getCentroid().join('|');
    let cumConf = parseInt(location['cum_conf'], 10) || 0;
    let legendGroup = 'default';

    // If the page we are on doesn't have the corresponding UI, we don't need
    // to do anything else.
    if (!!countryList) {
      // No city or province, just the country code.
      locationInfo[geoid] = '||' + code;
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
    updateCountryListCounts();
  }
}

function updateCountryListCounts() {
  const list = document.getElementById('location-list');
  let countSpans = list.getElementsByClassName('num');
  for (let i = 0; i < countSpans.length; i++) {
    let span = countSpans[i];
    const code = span.parentNode.getAttribute('country');
    const country = countries[code];
    let countToShow = dataProvider.getLatestDataPerCountry()[code][0];
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
  sortCountryList();
};

function sortCountryList() {
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


function updateData() {
  console.log('Updating data...');
  dataProvider.fetchLatestCounts().then(function() {
    console.log('Updated latest counts.');
  });
  dataProvider.fetchDataIndex().then(function() {
    console.log('Updated data index.');
  });

  // Update the data again after another time interval.
  window.setTimeout(updateData, LIVE_UPDATE_INTERVAL_MS);
}

function countryInit() {
  dataProvider = new DataProvider(
      'https://raw.githubusercontent.com/ghdsi/covid-19/master/');
  dataProvider.fetchCountryNames().
        then(dataProvider.fetchJhuData.bind(dataProvider)).
        then(dataProvider.loadCountryData.bind(dataProvider)).
        then(showCountryPage);
}

function showCountryPage(data) {
  const dash = document.getElementById('dash');
  const code = dash.getAttribute('c');
  const country = countries[code];
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

  const columns = chartsEl.clientHeight < chartsEl.clientWidth;
  chartsEl.style.flexDirection = columns ? 'row' : 'column';
  let container = document.createElement('div');
  container.classList.add('chart');
  container.setAttribute('id', 'new');
  container.innerHTML = '';
  Graphing.makeCasesGraph(o, true /* useAverageWindow */, container);
  chartsEl.appendChild(container);

  o = {'dates': dates};
  const centroidGeoid = country.getCentroid().join('|');
  const aggregateData = dataProvider.getAggregateData();
  o[centroidGeoid] = [];
  for (let i = 0; i < dates.length; i++) {
    if (!aggregateData[dates[i]]) {
      continue;
    }
    for (let j = 0; j < aggregateData[dates[i]]; i++) {
      const item = aggregateData[dates[i]][j];
      if (item['code'] == code) {
        o[centroidGeoid].push(item['cum_conf']);
        break;
      }
    }
  }
  container = document.createElement('div');
  container.classList.add('chart');
  container.setAttribute('id', 'total');
  container.innerHTML = '';
  // const totalCasesAggregateChart = Graphing.makeCasesGraph(
      // o, true /*average */, container);
  chartsEl.appendChild(container);
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
