// Easing functions collection - from easings.js
export const easings = {
  ['circ-in']: (t: number) => -1 * (Math.sqrt(1 - t * t) - 1),
  ['circ-out']: (t: number) => Math.sqrt(1 - (t = t - 1) * t),
  ['circ-in-out']: (t: number) => {
    if ((t /= 1 / 2) < 1) return -1 / 2 * (Math.sqrt(1 - t * t) - 1);
    return 1 / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1);
  },
  ['cubic-in']: (t: number) => t * t * t,
  ['cubic-out']: (t: number) => (--t) * t * t + 1,
  ['cubic-in-out']: (t: number) => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  ['elastic-in']: (t: number) => {
    var s = 1.70158; var p = 0; var a = 1;
    if (t == 0) return 0; if (t == 1) return 1; if (!p) p = .3;
    if (a < Math.abs(1)) { a = 1; var s = p / 4; }
    else var s = p / (2 * Math.PI) * Math.asin(1 / a);
    return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p));
  },
  ['elastic-out']: (t: number) => {
    var s = 1.70158; var p = 0; var a = 1;
    if (t == 0) return 0; if (t == 1) return 1; if (!p) p = .3;
    if (a < Math.abs(1)) { a = 1; var s = p / 4; }
    else var s = p / (2 * Math.PI) * Math.asin(1 / a);
    return a * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
  },
  ['elastic-in-out']: (t: number) => {
    var s = 1.70158; var p = 0; var a = 1;
    if (t == 0) return 0; if ((t /= 1 / 2) == 2) return 1; if (!p) p = 1 * (.3 * 1.5);
    if (a < Math.abs(1)) { a = 1; var s = p / 4; }
    else var s = p / (2 * Math.PI) * Math.asin(1 / a);
    if (t < 1) return -.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p));
    return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p) * .5 + 1;
  },
  ['expo-in']: (t: number) => (t == 0) ? 0 : Math.pow(2, 10 * (t - 1)),
  ['expo-out']: (t: number) => (t == 1) ? 1 : 1 - Math.pow(2, -10 * t),
  ['expo-in-out']: (t: number) => {
    if (t == 0) return 0;
    if (t == 1) return 1;
    if ((t /= 1 / 2) < 1) return 1 / 2 * Math.pow(2, 10 * (t - 1));
    return 1 / 2 * (-Math.pow(2, -10 * --t) + 2);
  },
  ['linear']: (t: number) => t,
  ['quad-in']: (t: number) => t * t,
  ['quad-out']: (t: number) => t * (2 - t),
  ['quad-in-out']: (t: number) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  ['quart-in']: (t: number) => t * t * t * t,
  ['quart-out']: (t: number) => 1 - (--t) * t * t * t,
  ['quart-in-out']: (t: number) => t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  ['quint-in']: (t: number) => t * t * t * t * t,
  ['quint-out']: (t: number) => 1 + (--t) * t * t * t * t,
  ['quint-in-out']: (t: number) => t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
  ['sine-in']: (t: number) => 1 - Math.cos(t * (Math.PI / 2)),
  ['sine-out']: (t: number) => Math.sin(t * (Math.PI / 2)),
  ['sine-in-out']: (t: number) => 1 / 2 * (1 - Math.cos(Math.PI * t)),
};