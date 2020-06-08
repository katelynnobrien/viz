let Graphing = function() {
};

Graphing.CURVE_COLORS = [
  '#4285F4',
  '#DB4437',
  '#F4B400',
  '#0F9D58',
];

Graphing.sameLocation = function(geoid_a, geoid_b) {
  // Comparing the strings directly seems sufficient for now, but we might need
  // to round to fewer decimal places first.
  return geoid_a == geoid_b;
}


/**
 * Returns a DOM svg element with the requested graph. The given geoids are
 * assumed to have no repetition.
 */
Graphing.makeCasesGraph = function(
    geoids, property, features, dates, totalWidth, totalHeight, mini) {
  let svg = d3.select(document.createElementNS(d3.namespaces.svg, 'svg'));
  const margin = mini ? {'top': 10,  'right': 0,  'bottom': 0,  'left': 0} :
                        {'top': 20, 'right': 30, 'bottom': 30, 'left': 40};
  let width = totalWidth - margin['left'] - margin['right'];
  let height = totalHeight - margin['top'] - margin['bottom'];

  svg.attr('width', totalWidth).attr('height', totalHeight);

  let curves = [];
  let allCases = [];

  // TODO: Very inefficient. Optimize a bit more.
  for (let g = 0; g < geoids.length; g++) {
    let curve = [];
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      for (let j = 0; j < features[date].length; j++) {
        let f = features[date][j];
        if (Graphing.sameLocation(geoids[g], f['properties']['geoid'])) {
          f['properties']['date'] = date;
          let c = { 'date': d3.timeParse("%Y-%m-%d")(date) };
          c[property] = f['properties'][property];
          curve.push(c);
          allCases.push(c);
        }
      }
    }
    curves.push(curve);
  }

  let xScale = d3.scaleTime()
      .domain(d3.extent(allCases, function(c) { return c['date']; }))
      .range([0, width]);

  let axisBottom = d3.axisBottom(xScale);
  if (mini) {
    axisBottom = axisBottom.tickValues([]);
  }
  svg.append('g')
      .attr('transform', 'translate(0,' + height + ')')
      .call(axisBottom);

  let yScale = d3.scaleLinear()
      .domain([0, d3.max(allCases, function(c) { return c[property]; })])
      .range([height, 0]);

  let axisLeft = d3.axisLeft(yScale);
  if (mini) {
    axisLeft = axisLeft.tickValues([]);
  }
  svg.append("g").call(axisLeft);

  let lines = [];
  for (let i = 0; i < curves.length; i++) {
    let line = d3.line().
      // apply the x scale to the x data
      x(function(c) { return xScale(c['date']);}).
      // apply the y scale to the y data
      y(function(c) { return yScale(c[property]);});
    lines.push(line);
  }

  for (let i = 0; i < lines.length; i++) {
    svg.append("path")
      .attr('fill', 'none')
      .attr('d', lines[i](curves[i]))
      .attr('stroke', Graphing.CURVE_COLORS[i % Graphing.CURVE_COLORS.length])
      .attr('stroke-width', 1.5);
  }

  return svg.node();
};
