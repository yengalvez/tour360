(function ensureThreeMathCompat() {
  if (window.THREE && !window.THREE.Math && window.THREE.MathUtils) {
    window.THREE.Math = window.THREE.MathUtils;
  }
})();
