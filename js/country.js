/** @constructor */
let Country = function(code, name, population, boundingBoxes) {

  /**
   * This country's two-letter iso code.
   * @type {string}
   * @const
   * @private
   */
  this.code_ = code;

  /**
   * This country's official name, as used in common language.
   * @type {string}
   * @const
   * @private
   */
  this.name_ = name;

  /**
   * This country's population, or zero is it isn't known.
   * @type {number}
   * @const
   * @private
   */
  this.population_ = population;

  /**
   * A list of bounding boxes encapsulating this country's geographical regions.
   * @const
   * @private
   */
  this.boundingBoxes_ = boundingBoxes;
};

/** @return {string} */
Country.prototype.getName = function() {
  return this.name_;
};

/** @return {string} */
Country.prototype.getCode = function() {
  return this.code_;
};

/** @return {number} */
Country.prototype.getPopulation = function() {
  return this.population_;
};

Country.prototype.getMainBoundingBox = function() {
  // Assume the 'main' geographical region is listed first.
  return this.boundingBoxes_[0];
};

/** Returns an array of [lat, long] for this country's center. */
Country.prototype.getCentroid = function() {
  const bb = this.getMainBoundingBox().map(x => parseFloat(x));
  return [((bb[0] + bb[2]) / 2).toFixed(4), ((bb[1] + bb[3]) / 2).toFixed(4)];
}
