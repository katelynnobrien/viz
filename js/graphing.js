let Graphing = function() {
};

Graphing.sameLocation = function(geoid_a, geoid_b) {
  // Comparing the strings directly seems sufficient for now, but we might need
  // to round to fewer decimal places first.
  return geoid_a == geoid_b;
}

Graphing.makeCasesGraph = function(
    geoids, property, features, dates, width, height) {
  let svg = d3.select(document.createElementNS(d3.namespaces.svg, 'svg'));
  svg.attr('width', width).attr('height', height);

  let curves = [];
  let allCases = [];
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

  svg.append('g')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(xScale).tickValues([]));

  let yScale = d3.scaleLinear()
      .domain([0, d3.max(allCases, function(c) { return c[property]; })])
      .range([height, 0]);

  svg.append("g")
      .call(d3.axisLeft(yScale).tickValues([]));

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
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1.5);
  }

  return svg.node();
};
