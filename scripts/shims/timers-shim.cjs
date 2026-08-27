// Browser stub for xml2js's require('timers').setImmediate.
module.exports = { setImmediate: (fn, ...args) => setTimeout(fn, 0, ...args) };
