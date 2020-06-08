let Graphing = function() {
};

const CASE_GRAPH_WIDTH_PX = 200;
const CASE_GRAPH_HEIGHT_PX = 120;

Graphing.sameLocation = function(geoid_a, geoid_b) {
  // Comparing the strings directly seems sufficient for now, but we might need
  // to round to fewer decimal places first.
  return geoid_a == geoid_b;
}

Graphing.makeCaseGraph = function(geoid, property, features, dates) {
  let svg = d3.select(document.createElementNS(d3.namespaces.svg, 'svg'));
  svg.attr('width', CASE_GRAPH_WIDTH_PX).
      attr('height', CASE_GRAPH_HEIGHT_PX);

  let cases = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    let features = atomicFeaturesByDay[date];
    for (let i = 0; i < features.length; i++) {
      let f = features[i];
      if (Graphing.sameLocation(geoid, f['properties']['geoid'])) {
        f['properties']['date'] = date;
        let c = { 'date': d3.timeParse("%Y-%m-%d")(date) };
        c[property] = f['properties'][property];
        cases.push(c);
      }
    }
  }

  let xScale = d3.scaleTime()
      .domain(d3.extent(cases, function(c) { return c['date']; }))
      .range([0, CASE_GRAPH_WIDTH_PX]);

  svg.append('g')
      .attr('transform', 'translate(0,' + CASE_GRAPH_HEIGHT_PX + ')')
      .call(d3.axisBottom(xScale).tickValues([]));

  let yScale = d3.scaleLinear()
      .domain([0, d3.max(cases, function(c) { return c[property]; })])
      .range([CASE_GRAPH_HEIGHT_PX, 0]);

  svg.append("g")
      .call(d3.axisLeft(yScale).tickValues([]));

  let casesLine = d3.line()
    // apply the x scale to the x data
    .x(function(c) { return xScale(c['date']);})
    // apply the y scale to the y data
    .y(function(c) { return yScale(c[property]);})

  svg.append("path")
      .attr('d', casesLine(cases))
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1.5);

  return svg.node();
};
