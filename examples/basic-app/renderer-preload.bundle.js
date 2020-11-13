(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
'use strict';

var objectAssign = require('object-assign');

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:
// NB: The URL to the CommonJS spec is kept just for tradition.
//     node-assert has evolved a lot since then, both in API and behavior.

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

// Expose a strict only variant of assert
function strict(value, message) {
  if (!value) fail(value, true, message, '==', strict);
}
assert.strict = objectAssign(strict, assert, {
  equal: assert.strictEqual,
  deepEqual: assert.deepStrictEqual,
  notEqual: assert.notStrictEqual,
  notDeepEqual: assert.notDeepStrictEqual
});
assert.strict.strict = assert.strict;

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"object-assign":11,"util/":4}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],4:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":3,"_process":12,"inherits":2}],5:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],6:[function(require,module,exports){

},{}],7:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this,require("buffer").Buffer)
},{"base64-js":5,"buffer":7,"ieee754":9}],8:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],9:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],10:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],11:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],12:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],13:[function(require,module,exports){
const electronCommonIpcModule = require('electron-common-ipc');
electronCommonIpcModule.PreloadElectronCommonIpc();

console.log(`IsElectronCommonIpcAvailable=${electronCommonIpcModule.IsElectronCommonIpcAvailable()}`);

const electron = require('electron');
window.ipcRenderer = electron.ipcRenderer;


},{"electron":"electron","electron-common-ipc":41}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIpcBusClient = void 0;
const IpcBusClient_1 = require("./IpcBusClient");
const windowLocal = window;
exports.CreateIpcBusClient = () => {
    if (windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.CreateIpcBusClient) {
        return windowLocal.ElectronCommonIpc.CreateIpcBusClient();
    }
    return null;
};
windowLocal.CreateIpcBusClient = exports.CreateIpcBusClient;
IpcBusClient_1.IpcBusClient.Create = exports.CreateIpcBusClient;

},{"./IpcBusClient":15}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusClient = exports.ELECTRON_IPC_BRIDGE_LOGPATH_ENV_VAR = exports.ELECTRON_IPC_BROKER_LOGPATH_ENV_VAR = exports.IPCBUS_CHANNEL_QUERY_STATE = exports.IPCBUS_CHANNEL = void 0;
exports.IPCBUS_CHANNEL = '/electron-ipc-bus';
exports.IPCBUS_CHANNEL_QUERY_STATE = `${exports.IPCBUS_CHANNEL}/queryState`;
exports.ELECTRON_IPC_BROKER_LOGPATH_ENV_VAR = 'ELECTRON_IPC_BROKER_LOGPATH';
exports.ELECTRON_IPC_BRIDGE_LOGPATH_ENV_VAR = 'ELECTRON_IPC_BRIDGE_LOGPATH';
var IpcBusClient;
(function (IpcBusClient) {
})(IpcBusClient = exports.IpcBusClient || (exports.IpcBusClient = {}));

},{}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusClientImpl = void 0;
const events_1 = require("events");
const IpcBusUtils = require("./IpcBusUtils");
class IpcBusClientImpl extends events_1.EventEmitter {
    constructor(transport) {
        super();
        super.setMaxListeners(0);
        this._transport = transport;
        this._connectCloseState = new IpcBusUtils.ConnectCloseState();
    }
    get peer() {
        return this._peer;
    }
    connect(arg1, arg2, arg3) {
        return this._connectCloseState.connect(() => {
            const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
            return this._transport.connect(this, options)
                .then((peer) => {
                this._peer = peer;
                const eventNames = this.eventNames();
                for (let i = 0, l = eventNames.length; i < l; ++i) {
                    const eventName = eventNames[i];
                    this._transport.addChannel(this, eventName, this.listenerCount(eventName));
                }
            });
        });
    }
    close(options) {
        return this._connectCloseState.close(() => {
            this._transport.removeChannel(this);
            return this._transport.close(this, options)
                .then(() => {
                this._peer = null;
            });
        });
    }
    send(channel, ...args) {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.sendMessage(this, channel, args);
        return this._connectCloseState.connected;
    }
    request(channel, timeoutDelay, ...args) {
        channel = IpcBusUtils.CheckChannel(channel);
        return this._transport.requestMessage(this, channel, timeoutDelay, args);
    }
    emit(event, ...args) {
        event = IpcBusUtils.CheckChannel(event);
        this._transport.sendMessage(this, event, args);
        return this._connectCloseState.connected;
    }
    on(channel, listener) {
        return this.addListener(channel, listener);
    }
    off(channel, listener) {
        return this.removeListener(channel, listener);
    }
    addListener(channel, listener) {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.addListener(channel, listener);
    }
    removeListener(channel, listener) {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.removeChannel(this, channel);
        return super.removeListener(channel, listener);
    }
    once(channel, listener) {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.once(channel, listener);
    }
    removeAllListeners(channel) {
        if (arguments.length === 1) {
            channel = IpcBusUtils.CheckChannel(channel);
        }
        this._transport.removeChannel(this, channel);
        return super.removeAllListeners(channel);
    }
    prependListener(channel, listener) {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.prependListener(channel, listener);
    }
    prependOnceListener(channel, listener) {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.prependOnceListener(channel, listener);
    }
}
exports.IpcBusClientImpl = IpcBusClientImpl;

},{"./IpcBusUtils":21,"events":8}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusCommand = void 0;
var IpcBusCommand;
(function (IpcBusCommand) {
    let Kind;
    (function (Kind) {
        Kind["Handshake"] = "HAN";
        Kind["Shutdown"] = "SHT";
        Kind["Connect"] = "COO";
        Kind["Close"] = "COC";
        Kind["AddChannelListener"] = "LICA";
        Kind["RemoveChannelListener"] = "LICR";
        Kind["RemoveChannelAllListeners"] = "LICRA";
        Kind["RemoveListeners"] = "LIR";
        Kind["SendMessage"] = "MES";
        Kind["RequestResponse"] = "RQR";
        Kind["RequestClose"] = "RQC";
        Kind["LogGetMessage"] = "LOGGET";
        Kind["LogLocalSendRequest"] = "LOGMES";
        Kind["LogLocalRequestResponse"] = "LOGRQR";
        Kind["BridgeConnect"] = "BCOO";
        Kind["BridgeClose"] = "BCOC";
    })(Kind = IpcBusCommand.Kind || (IpcBusCommand.Kind = {}));
    ;
})(IpcBusCommand = exports.IpcBusCommand || (exports.IpcBusCommand = {}));

},{}],18:[function(require,module,exports){
(function (process){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusConnectorImpl = void 0;
const IpcBusCommand_1 = require("./IpcBusCommand");
const IpcBusLogConfig_1 = require("./log/IpcBusLogConfig");
const IpcBusLog_factory_1 = require("./log/IpcBusLog-factory");
const IpcBusUtils_1 = require("./IpcBusUtils");
class IpcBusConnectorImpl {
    constructor(contextType) {
        this._process = {
            type: contextType,
            pid: process ? process.pid : -1
        };
        this._log = IpcBusLog_factory_1.CreateIpcBusLog();
        this._messageId = `m_${this._process.type}.${IpcBusUtils_1.CreateUniqId()}`;
        this._messageCount = 0;
    }
    get process() {
        return this._process;
    }
    addClient(client) {
        this._client = client;
    }
    removeClient(client) {
        if (this._client === client) {
            this._client = null;
        }
    }
    cloneCommand(command) {
        const logCommand = {
            kind: command.kind,
            peer: command.peer,
            channel: command.channel,
            request: command.request
        };
        return logCommand;
    }
    logMessageSend(previousLog, ipcBusCommand) {
        if (this._log.level >= IpcBusLogConfig_1.IpcBusLogConfig.Level.Sent) {
            const id = `${this._messageId}.${this._messageCount++}`;
            ipcBusCommand.log = {
                id,
                kind: ipcBusCommand.kind,
                peer: ipcBusCommand.peer,
                timestamp: this._log.now,
                command: this.cloneCommand(ipcBusCommand),
                previous: previousLog,
            };
            while (previousLog) {
                ipcBusCommand.log.related_peer = previousLog.peer;
                previousLog = previousLog.previous;
            }
            return ipcBusCommand.log;
        }
        return null;
    }
    logLocalMessage(peer, ipcBusCommandLocal, argsResponse) {
        if (this._log.level >= IpcBusLogConfig_1.IpcBusLogConfig.Level.Sent) {
            const ipcBusCommandLog = Object.assign({}, ipcBusCommandLocal);
            ipcBusCommandLog.kind = `LOG${ipcBusCommandLocal.kind}`;
            ipcBusCommandLog.log.local = true;
            this.postCommand(ipcBusCommandLog, argsResponse);
            return ipcBusCommandLog.log;
        }
        return null;
    }
    logMessageGet(peer, local, ipcBusCommandPrevious, args) {
        if (this._log.level & IpcBusLogConfig_1.IpcBusLogConfig.Level.Get) {
            const ipcBusCommandLog = {
                kind: IpcBusCommand_1.IpcBusCommand.Kind.LogGetMessage,
                peer,
                channel: ''
            };
            this.logMessageSend(ipcBusCommandPrevious.log, ipcBusCommandLog);
            ipcBusCommandLog.log.command = this.cloneCommand(ipcBusCommandPrevious);
            ipcBusCommandLog.log.related_peer = ipcBusCommandPrevious.peer;
            ipcBusCommandLog.log.local = local;
            if (this._log.level & IpcBusLogConfig_1.IpcBusLogConfig.Level.GetArgs) {
                this.postCommand(ipcBusCommandLog, args);
            }
            else {
                this.postCommand(ipcBusCommandLog);
            }
            return ipcBusCommandLog.log;
        }
        return null;
    }
}
exports.IpcBusConnectorImpl = IpcBusConnectorImpl;

}).call(this,require('_process'))
},{"./IpcBusCommand":17,"./IpcBusUtils":21,"./log/IpcBusLog-factory":23,"./log/IpcBusLogConfig":25,"_process":12}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusTransportImpl = void 0;
const socket_serializer_1 = require("socket-serializer");
const Client = require("./IpcBusClient");
const IpcBusUtils = require("./IpcBusUtils");
const IpcBusCommand_1 = require("./IpcBusCommand");
const replyChannelPrefix = `${Client.IPCBUS_CHANNEL}/request-`;
class DeferredRequestPromise {
    constructor(client, request) {
        this.client = client;
        this.request = request;
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
        this.promise.catch(() => { });
        this._settled = false;
    }
    isSettled() {
        return this._settled;
    }
    settled(ipcBusCommand, args) {
        if (this._settled === false) {
            const ipcBusEvent = { channel: ipcBusCommand.request.channel, sender: ipcBusCommand.peer };
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Peer #${ipcBusEvent.sender.name} replied to request on ${ipcBusCommand.request.replyChannel}`);
            try {
                if (ipcBusCommand.request.resolve) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] resolve`);
                    const response = { event: ipcBusEvent, payload: args[0] };
                    this.resolve(response);
                }
                else if (ipcBusCommand.request.reject) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: ${args[0]}`);
                    const response = { event: ipcBusEvent, err: args[0] };
                    this.reject(response);
                }
                else {
                    throw 'unknown format';
                }
            }
            catch (err) {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: ${err}`);
                const response = { event: ipcBusEvent, err };
                this.reject(response);
            }
            this._settled = true;
        }
    }
    timeout() {
        const response = {
            event: {
                channel: this.request.channel,
                sender: this.client.peer
            },
            err: 'timeout'
        };
        this.reject(response);
    }
}
class IpcBusTransportImpl {
    constructor(connector) {
        this._connector = connector;
        this._peer = {
            id: `t_${connector.process.type}.${IpcBusUtils.CreateUniqId()}`,
            name: 'IPCTransport',
            process: connector.process
        };
        this._requestFunctions = new Map();
        this._postCommandBind = () => { };
        this._connectCloseState = new IpcBusUtils.ConnectCloseState();
    }
    get peer() {
        return this._peer;
    }
    static generateReplyChannel(peer) {
        ++IpcBusTransportImpl.s_requestNumber;
        return `${replyChannelPrefix}${peer.id}-${IpcBusTransportImpl.s_requestNumber}`;
    }
    createPeer(process, name) {
        ++IpcBusTransportImpl.s_clientNumber;
        const peer = {
            id: `${process.type}.${IpcBusUtils.CreateUniqId()}`,
            process,
            name: ''
        };
        peer.name = this.generateName(peer, name);
        return peer;
    }
    generateName(peer, name) {
        if (name == null) {
            name = `${peer.process.type}`;
            if (peer.process.wcid) {
                name += `-${peer.process.wcid}`;
            }
            if (peer.process.rid && (peer.process.rid !== peer.process.wcid)) {
                name += `-r${peer.process.rid}`;
            }
            if (peer.process.pid) {
                name += `-p${peer.process.pid}`;
            }
            name += `.${IpcBusTransportImpl.s_clientNumber}`;
        }
        return name;
    }
    _onClientMessageReceived(client, local, ipcBusCommand, args) {
        let logGetMessage;
        if (this._logActivate) {
            logGetMessage = this._connector.logMessageGet(client.peer, local, ipcBusCommand, args);
        }
        const listeners = client.listeners(ipcBusCommand.channel);
        const ipcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
        if (ipcBusCommand.request) {
            const settled = (resolve, argsResponse) => {
                const ipcBusCommandResponse = {
                    kind: IpcBusCommand_1.IpcBusCommand.Kind.RequestResponse,
                    channel: ipcBusCommand.request.replyChannel,
                    peer: client.peer,
                    request: ipcBusCommand.request
                };
                if (resolve) {
                    ipcBusCommand.request.resolve = true;
                }
                else {
                    ipcBusCommand.request.reject = true;
                }
                if (this._logActivate) {
                    this._connector.logMessageSend(logGetMessage, ipcBusCommandResponse);
                }
                if (local) {
                    if (this._onResponseReceived(true, ipcBusCommandResponse, argsResponse) && logGetMessage) {
                        this._connector.logLocalMessage(client.peer, ipcBusCommandResponse, argsResponse);
                    }
                }
                else {
                    this.postMessage(ipcBusCommandResponse, argsResponse);
                }
            };
            ipcBusEvent.request = {
                resolve: (payload) => {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Resolve request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - payload: ${JSON.stringify(payload)}`);
                    settled(true, [payload]);
                },
                reject: (err) => {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Reject request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - err: ${JSON.stringify(err)}`);
                    settled(false, [err]);
                }
            };
        }
        for (let i = 0, l = listeners.length; i < l; ++i) {
            listeners[i].call(client, ipcBusEvent, ...args);
        }
    }
    _onResponseReceived(local, ipcBusCommand, args, ipcPacketBuffer) {
        const deferredRequest = this._requestFunctions.get(ipcBusCommand.channel);
        if (deferredRequest) {
            args = args || ipcPacketBuffer.parseArrayAt(1);
            if (this._logActivate) {
                this._connector.logMessageGet(deferredRequest.client.peer, local, ipcBusCommand, args);
            }
            this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
            deferredRequest.settled(ipcBusCommand, args);
            return true;
        }
        return false;
    }
    onConnectorArgsReceived(ipcBusCommand, args, ipcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand_1.IpcBusCommand.Kind.SendMessage: {
                if (this.hasChannel(ipcBusCommand.channel)) {
                    args = args || ipcPacketBuffer.parseArrayAt(1);
                    this.onMessageReceived(false, ipcBusCommand, args);
                    return true;
                }
                break;
            }
            case IpcBusCommand_1.IpcBusCommand.Kind.RequestResponse:
                return this._onResponseReceived(false, ipcBusCommand, args, ipcPacketBuffer);
        }
        return false;
    }
    onConnectorPacketReceived(ipcBusCommand, ipcPacketBuffer) {
        return this.onConnectorArgsReceived(ipcBusCommand, undefined, ipcPacketBuffer);
    }
    onConnectorContentReceived(ipcBusCommand, rawContent) {
        const packetDecoder = new socket_serializer_1.IpcPacketBuffer(rawContent);
        return this.onConnectorArgsReceived(ipcBusCommand, undefined, packetDecoder);
    }
    onConnectorShutdown() {
        this._connectCloseState.shutdown();
        this._requestFunctions.clear();
    }
    sendMessage(client, channel, args) {
        const ipcMessage = {
            kind: IpcBusCommand_1.IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer
        };
        if (this._logActivate) {
            this._connector.logMessageSend(null, ipcMessage);
        }
        if (this.hasChannel(channel)) {
            this.onMessageReceived(true, ipcMessage, args);
        }
        this.postMessage(ipcMessage, args);
    }
    cancelRequest(client) {
        this._requestFunctions.forEach((request, key) => {
            if (client === request.client) {
                request.timeout();
                this._requestFunctions.delete(key);
                const ipcMessageClose = {
                    kind: IpcBusCommand_1.IpcBusCommand.Kind.RequestClose,
                    channel: request.request.channel,
                    peer: request.client.peer,
                    request: request.request
                };
                if (this._logActivate) {
                    this._connector.logMessageSend(null, ipcMessageClose);
                }
                this.postMessage(ipcMessageClose);
            }
        });
    }
    requestMessage(client, channel, timeoutDelay, args) {
        timeoutDelay = IpcBusUtils.checkTimeout(timeoutDelay);
        const ipcBusCommandRequest = { channel, replyChannel: IpcBusTransportImpl.generateReplyChannel(client.peer) };
        const deferredRequest = new DeferredRequestPromise(client, ipcBusCommandRequest);
        this._requestFunctions.set(ipcBusCommandRequest.replyChannel, deferredRequest);
        const ipcMessage = {
            kind: IpcBusCommand_1.IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer,
            request: ipcBusCommandRequest
        };
        let logSendMessage;
        if (this._logActivate) {
            logSendMessage = this._connector.logMessageSend(null, ipcMessage);
        }
        if (this.hasChannel(channel)) {
            this.onMessageReceived(true, ipcMessage, args);
        }
        if (deferredRequest.isSettled()) {
            this._connector.logLocalMessage(client.peer, ipcMessage, args);
        }
        else {
            if (timeoutDelay >= 0) {
                setTimeout(() => {
                    if (this._requestFunctions.delete(ipcBusCommandRequest.replyChannel)) {
                        deferredRequest.timeout();
                        const ipcMessageClose = {
                            kind: IpcBusCommand_1.IpcBusCommand.Kind.RequestClose,
                            channel,
                            peer: client.peer,
                            request: ipcBusCommandRequest
                        };
                        if (logSendMessage) {
                            this._connector.logMessageSend(logSendMessage, ipcMessageClose);
                        }
                        this.postMessage(ipcMessageClose);
                    }
                }, timeoutDelay);
            }
            this.postMessage(ipcMessage, args);
        }
        return deferredRequest.promise;
    }
    connect(client, options) {
        return this._connectCloseState.connect(() => {
            return this._connector.handshake(this, options)
                .then((handshake) => {
                const peer = this.createPeer(handshake.process, options.peerName);
                this._logActivate = handshake.logLevel > 0;
                this._postCommandBind = this._connector.postCommand.bind(this._connector);
                return peer;
            });
        });
    }
    close(client, options) {
        return this._connectCloseState.close(() => {
            return this._connector.shutdown(this, options)
                .then(() => {
                this._postCommandBind = () => { };
            });
        });
    }
    postAdmin(ipcBusCommand) {
        this._postCommandBind(ipcBusCommand);
    }
    postMessage(ipcBusCommand, args) {
        this._postCommandBind(ipcBusCommand, args);
    }
}
exports.IpcBusTransportImpl = IpcBusTransportImpl;
IpcBusTransportImpl.s_requestNumber = 0;
IpcBusTransportImpl.s_clientNumber = 0;

},{"./IpcBusClient":15,"./IpcBusCommand":17,"./IpcBusUtils":21,"socket-serializer":74}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusTransportMultiImpl = void 0;
const IpcBusUtils = require("./IpcBusUtils");
const IpcBusCommand_1 = require("./IpcBusCommand");
const IpcBusTransportImpl_1 = require("./IpcBusTransportImpl");
class IpcBusTransportMultiImpl extends IpcBusTransportImpl_1.IpcBusTransportImpl {
    constructor(connector) {
        super(connector);
    }
    hasChannel(channel) {
        return this._subscriptions.hasChannel(channel);
    }
    onMessageReceived(local, ipcBusCommand, args) {
        this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
            this._onClientMessageReceived(connData.conn, local, ipcBusCommand, args);
        });
    }
    onConnectorShutdown() {
        super.onConnectorShutdown();
        if (this._subscriptions) {
            this._subscriptions.emitter = false;
            this._subscriptions = null;
        }
    }
    connect(client, options) {
        return super.connect(client, options)
            .then((peer) => {
            if (this._subscriptions == null) {
                this._subscriptions = new IpcBusUtils.ChannelConnectionMap(this._peer.name, (conn) => conn.peer.id, true);
                this._subscriptions.on('channel-added', (channel) => {
                    this.postAdmin({
                        peer: this._peer,
                        kind: IpcBusCommand_1.IpcBusCommand.Kind.AddChannelListener,
                        channel
                    });
                });
                this._subscriptions.on('channel-removed', (channel) => {
                    this.postAdmin({
                        peer: this._peer,
                        kind: IpcBusCommand_1.IpcBusCommand.Kind.RemoveChannelListener,
                        channel
                    });
                });
            }
            return peer;
        });
    }
    close(client, options) {
        if (this._subscriptions) {
            this.cancelRequest(client);
            if (this._subscriptions.getChannelsCount() === 0) {
                this._subscriptions.emitter = false;
                this._subscriptions = null;
                return super.close(client, options);
            }
        }
        return Promise.resolve();
    }
    addChannel(client, channel, count) {
        if (this._subscriptions == null) {
            return;
        }
        this._subscriptions.addRefCount(channel, client, client.peer, count);
    }
    removeChannel(client, channel, all) {
        if (this._subscriptions == null) {
            return;
        }
        if (channel) {
            if (all) {
                this._subscriptions.releaseAll(channel, client, client.peer);
            }
            else {
                this._subscriptions.release(channel, client, client.peer);
            }
        }
        else {
            this._subscriptions.removePeer(client, client.peer);
        }
    }
}
exports.IpcBusTransportMultiImpl = IpcBusTransportMultiImpl;

},{"./IpcBusCommand":17,"./IpcBusTransportImpl":19,"./IpcBusUtils":21}],21:[function(require,module,exports){
(function (process){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionPeers = exports.ChannelConnectionMap = exports.ConnectCloseState = exports.Logger = exports.BinarySearch = exports.CreateUniqId = exports.CheckConnectOptions = exports.checkTimeout = exports.CheckChannel = exports.IPC_BUS_TIMEOUT = void 0;
const shortid = require("shortid");
const events_1 = require("events");
exports.IPC_BUS_TIMEOUT = 2000;
const win32prefix1 = '\\\\.\\pipe';
const win32prefix2 = '\\\\?\\pipe';
function CleanPipeName(str) {
    if (process.platform === 'win32') {
        if ((str.lastIndexOf(win32prefix1, 0) === -1) && (str.lastIndexOf(win32prefix2, 0) === -1)) {
            str = str.replace(/^\//, '');
            str = str.replace(/\//g, '-');
            str = win32prefix1 + '\\' + str;
        }
    }
    return str;
}
function CheckChannel(channel) {
    switch (typeof channel) {
        case 'string':
            break;
        case 'undefined':
            channel = 'undefined';
            break;
        default:
            if (channel === null) {
                channel = 'null';
            }
            else {
                channel = channel.toString();
            }
            break;
    }
    return channel;
}
exports.CheckChannel = CheckChannel;
function checkTimeout(val) {
    const parseVal = parseFloat(val);
    if (parseVal == val) {
        return parseVal;
    }
    else {
        return exports.IPC_BUS_TIMEOUT;
    }
}
exports.checkTimeout = checkTimeout;
function CheckConnectOptions(arg1, arg2, arg3) {
    const options = (typeof arg1 === 'object' ? arg1 : typeof arg2 === 'object' ? arg2 : typeof arg3 === 'object' ? arg3 : {});
    if (Number(arg1) >= 0) {
        options.port = Number(arg1);
        options.host = typeof arg2 === 'string' ? arg2 : undefined;
    }
    else if (typeof arg1 === 'string') {
        const parts = arg1.split(':');
        if ((parts.length === 2) && (Number(parts[1]) >= 0)) {
            options.port = Number(parts[1]);
            options.host = parts[0];
        }
        else {
            options.path = arg1;
        }
    }
    if (options.path) {
        options.path = CleanPipeName(options.path);
    }
    if (options.timeoutDelay == null) {
        options.timeoutDelay = exports.IPC_BUS_TIMEOUT;
    }
    return options;
}
exports.CheckConnectOptions = CheckConnectOptions;
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#&');
function CreateUniqId() {
    return shortid.generate();
}
exports.CreateUniqId = CreateUniqId;
function BinarySearch(array, target, compareFn) {
    let left = 0;
    let right = array.length;
    while (left < right) {
        let middle = (left + right) >> 1;
        const compareResult = compareFn(target, array[middle]);
        if (compareResult > 0) {
            left = middle + 1;
        }
        else if (compareResult < 0) {
            right = middle;
        }
        else {
            return middle;
        }
    }
    return -left - 1;
}
exports.BinarySearch = BinarySearch;
;
class Logger {
    static info(msg) {
        console.log(msg);
    }
    static warn(msg) {
        console.warn(msg);
    }
    static error(msg) {
        console.error(msg);
    }
}
exports.Logger = Logger;
Logger.enable = false;
Logger.service = false;
;
class ConnectCloseState {
    constructor() {
        this.shutdown();
    }
    get connected() {
        return this._connected;
    }
    connect(cb) {
        if (this._waitForConnected == null) {
            this._waitForConnected = this._waitForClosed
                .then(() => {
                return cb();
            })
                .then((t) => {
                this._connected = true;
                return t;
            })
                .catch((err) => {
                this._waitForConnected = null;
                throw err;
            });
        }
        return this._waitForConnected;
    }
    close(cb) {
        if (this._waitForConnected) {
            const waitForConnected = this._waitForConnected;
            this._waitForConnected = null;
            this._waitForClosed = waitForConnected
                .then(() => {
                this._connected = false;
                return cb();
            });
        }
        return this._waitForClosed;
    }
    shutdown() {
        this._waitForConnected = null;
        this._waitForClosed = Promise.resolve();
        this._connected = false;
    }
}
exports.ConnectCloseState = ConnectCloseState;
class ChannelConnectionMap extends events_1.EventEmitter {
    constructor(name, getKey, emitter) {
        super();
        this._name = name;
        this._getKey = getKey;
        this.emitter = emitter;
        this._channelsMap = new Map();
    }
    getKey(t) {
        return this._getKey(t);
    }
    _info(str) {
        Logger.enable && Logger.info(`[${this._name}] ${str}`);
    }
    _warn(str) {
        Logger.enable && Logger.warn(`[${this._name}] ${str}`);
    }
    hasChannel(channel) {
        return this._channelsMap.has(channel);
    }
    getChannels() {
        const channels = Array.from(this._channelsMap.keys());
        return channels;
    }
    getChannelsCount() {
        return this._channelsMap.size;
    }
    clear() {
        this._channelsMap.clear();
    }
    addRefs(channels, conn, peer) {
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.addRef(channels[i], conn, peer);
        }
    }
    releases(channels, conn, peer) {
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.release(channels[i], conn, peer);
        }
    }
    _declareNewChannel(channel, conn, peer, count) {
        Logger.enable && this._info(`SetChannel: '${channel}', peerId =  ${peer ? peer.id : 'unknown'}`);
        const connsMap = new Map();
        this._channelsMap.set(channel, connsMap);
        const key = this._getKey(conn);
        const connData = new ConnectionPeers(key, conn, peer, count);
        connsMap.set(key, connData);
        this.emitter && this.emit('channel-added', channel);
        return connsMap;
    }
    setSingleChannel(channel, conn, peer) {
        this._declareNewChannel(channel, conn, peer, 1);
    }
    getSingleChannel(channel) {
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            return null;
        }
        if (connsMap.size !== 1) {
            throw 'should not happen';
            return null;
        }
        return connsMap.values().next().value;
    }
    addRefCount(channel, conn, peer, count) {
        Logger.enable && this._info(`AddRef: '${channel}': conn = ${this._getKey(conn)}, peerId =  ${peer ? peer.id : 'unknown'}`);
        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            connsMap = this._declareNewChannel(channel, conn, peer, count);
        }
        else {
            const key = this._getKey(conn);
            let connData = connsMap.get(key);
            if (connData == null) {
                connData = new ConnectionPeers(key, conn, peer, count);
                connsMap.set(key, connData);
            }
            else {
                connData.addPeer(peer, count);
            }
        }
        return connsMap.size;
    }
    addRef(channel, conn, peer) {
        return this.addRefCount(channel, conn, peer, 1);
    }
    _releaseConnData(channel, connData, connsMap, peer, all) {
        if (peer == null) {
            connData.clearPeers();
        }
        else {
            if (all) {
                if (connData.removePeer(peer) === false) {
                    Logger.enable && this._warn(`Release '${channel}': peerId # ${peer ? peer.id : 'unknown'} is unknown`);
                }
            }
            else {
                connData.releasePeer(peer);
            }
        }
        if (connData.peerRefCounts.size === 0) {
            connsMap.delete(connData.key);
            if (connsMap.size === 0) {
                this._channelsMap.delete(channel);
                this.emitter && this.emit('channel-removed', channel);
            }
        }
        Logger.enable && this._info(`Release '${channel}': count = ${connData.peerRefCounts.size}`);
        return connsMap.size;
    }
    _releaseChannel(channel, conn, peer, all) {
        Logger.enable && this._info(`Release '${channel}' (${all}): peerId = ${peer ? peer.id : 'unknown'}`);
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`Release '${channel}': '${channel}' is unknown`);
            return 0;
        }
        else {
            const key = this._getKey(conn);
            const connData = connsMap.get(key);
            if (connData == null) {
                Logger.enable && this._warn(`Release '${channel}': conn is unknown`);
                return 0;
            }
            return this._releaseConnData(channel, connData, connsMap, peer, all);
        }
    }
    release(channel, conn, peer) {
        return this._releaseChannel(channel, conn, peer, false);
    }
    releaseAll(channel, conn, peer) {
        return this._releaseChannel(channel, conn, peer, true);
    }
    removeChannel(channel) {
        if (this._channelsMap.delete(channel)) {
            this.emitter && this.emit('channel-removed', channel);
            return true;
        }
        return false;
    }
    _removeConnectionOrPeer(conn, peer) {
        Logger.enable && this._info(`removeConnectionOrPeer: peerId = ${peer ? peer.id : 'unknown'}`);
        this._channelsMap.forEach((connsMap, channel) => {
            connsMap.forEach((connData) => {
                if (connData.conn === conn) {
                    this._releaseConnData(channel, connData, connsMap, peer, true);
                }
            });
        });
    }
    removePeer(conn, peer) {
        return this._removeConnectionOrPeer(conn, peer);
    }
    removeConnection(conn) {
        return this._removeConnectionOrPeer(conn, null);
    }
    forEachChannel(channel, callback) {
        Logger.enable && this._info(`forEachChannel '${channel}'`);
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`forEachChannel: Unknown channel '${channel}' !`);
        }
        else {
            connsMap.forEach((connData) => {
                Logger.enable && this._info(`forEachChannel '${channel}' - ${JSON.stringify(Array.from(connData.peerRefCounts.keys()))} (${connData.peerRefCounts.size})`);
                callback(connData, channel);
            });
        }
    }
    forEach(callback) {
        Logger.enable && this._info('forEach');
        this._channelsMap.forEach((connsMap, channel) => {
            connsMap.forEach((connData) => {
                Logger.enable && this._info(`forEach '${channel}' - ${JSON.stringify(Array.from(connData.peerRefCounts.keys()))} (${connData.peerRefCounts.size})`);
                callback(connData, channel);
            });
        });
    }
    on(event, listener) {
        return super.addListener(event, listener);
    }
    off(event, listener) {
        return super.removeListener(event, listener);
    }
}
exports.ChannelConnectionMap = ChannelConnectionMap;
class ConnectionPeers {
    constructor(key, conn, peer, count) {
        this.peerRefCounts = new Map();
        this.key = key;
        this.conn = conn;
        const refCount = (count == null) ? 1 : count;
        const peerRefCount = { peer, refCount };
        this.peerRefCounts.set(peer.id, peerRefCount);
    }
    addPeer(peer, count) {
        const refCount = (count == null) ? 1 : count;
        let peerRefCount = this.peerRefCounts.get(peer.id);
        if (peerRefCount == null) {
            peerRefCount = { peer, refCount };
            this.peerRefCounts.set(peer.id, peerRefCount);
        }
        else {
            peerRefCount.refCount += refCount;
        }
        return peerRefCount.refCount;
    }
    clearPeers() {
        this.peerRefCounts.clear();
    }
    removePeer(peer) {
        return this.peerRefCounts.delete(peer.id);
    }
    releasePeer(peer) {
        const peerRefCount = this.peerRefCounts.get(peer.id);
        if (peerRefCount == null) {
            return 0;
        }
        else {
            if (--peerRefCount.refCount <= 0) {
                this.peerRefCounts.delete(peer.id);
            }
            return peerRefCount.refCount;
        }
    }
}
exports.ConnectionPeers = ConnectionPeers;
(function (ConnectionPeers) {
    ;
})(ConnectionPeers = exports.ConnectionPeers || (exports.ConnectionPeers = {}));
;

}).call(this,require('_process'))
},{"_process":12,"events":8,"shortid":56}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIpcBusLog = void 0;
const IpcBusLogConfigImpl_1 = require("./IpcBusLogConfigImpl");
let g_log;
exports.CreateIpcBusLog = () => {
    if (g_log == null) {
        g_log = new IpcBusLogConfigImpl_1.IpcBusLogConfigImpl();
    }
    return g_log;
};
const windowLocal = window;
windowLocal.CreateIpcBusLog = exports.CreateIpcBusLog;

},{"./IpcBusLogConfigImpl":26}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIpcBusLog = void 0;
const v2_1 = require("electron-process-type/lib/v2");
const IpcBusUtils = require("../IpcBusUtils");
const IpcBusLogConfigMain_1 = require("./IpcBusLogConfigMain");
const IpcBusLogConfigImpl_1 = require("./IpcBusLogConfigImpl");
let g_log;
exports.CreateIpcBusLog = () => {
    if (g_log == null) {
        const electronProcessType = v2_1.GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusLog process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main':
                g_log = new IpcBusLogConfigMain_1.IpcBusLogConfigMain();
                break;
            case 'renderer':
            case 'node':
            default:
                g_log = new IpcBusLogConfigImpl_1.IpcBusLogConfigImpl();
                break;
        }
    }
    return g_log;
};

},{"../IpcBusUtils":21,"./IpcBusLogConfigImpl":26,"./IpcBusLogConfigMain":27,"electron-process-type/lib/v2":44}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusLog = void 0;
var IpcBusLog;
(function (IpcBusLog) {
    let Kind;
    (function (Kind) {
        Kind[Kind["SEND_MESSAGE"] = 0] = "SEND_MESSAGE";
        Kind[Kind["GET_MESSAGE"] = 1] = "GET_MESSAGE";
        Kind[Kind["SEND_REQUEST"] = 2] = "SEND_REQUEST";
        Kind[Kind["GET_REQUEST"] = 3] = "GET_REQUEST";
        Kind[Kind["SEND_REQUEST_RESPONSE"] = 4] = "SEND_REQUEST_RESPONSE";
        Kind[Kind["GET_REQUEST_RESPONSE"] = 5] = "GET_REQUEST_RESPONSE";
        Kind[Kind["SEND_CLOSE_REQUEST"] = 6] = "SEND_CLOSE_REQUEST";
        Kind[Kind["GET_CLOSE_REQUEST"] = 7] = "GET_CLOSE_REQUEST";
    })(Kind = IpcBusLog.Kind || (IpcBusLog.Kind = {}));
    function KindToStr(kind) {
        switch (kind) {
            case Kind.SEND_MESSAGE:
                return 'SendMessage';
            case Kind.GET_MESSAGE:
                return 'GetMessage';
            case Kind.SEND_REQUEST:
                return 'SendRequest';
            case Kind.GET_REQUEST:
                return 'GetRequest';
            case Kind.SEND_REQUEST_RESPONSE:
                return 'SendRequestResponse';
            case Kind.GET_REQUEST_RESPONSE:
                return 'GetRequestResponse';
            case Kind.SEND_CLOSE_REQUEST:
                return 'SendCloseRequest';
            case Kind.GET_CLOSE_REQUEST:
                return 'GetCloseRequest';
        }
    }
    IpcBusLog.KindToStr = KindToStr;
})(IpcBusLog = exports.IpcBusLog || (exports.IpcBusLog = {}));

},{}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusLogConfig = void 0;
var IpcBusLogConfig;
(function (IpcBusLogConfig) {
    let Level;
    (function (Level) {
        Level[Level["None"] = 0] = "None";
        Level[Level["Sent"] = 1] = "Sent";
        Level[Level["Get"] = 2] = "Get";
        Level[Level["SentArgs"] = 4] = "SentArgs";
        Level[Level["GetArgs"] = 8] = "GetArgs";
        Level[Level["Max"] = 15] = "Max";
    })(Level = IpcBusLogConfig.Level || (IpcBusLogConfig.Level = {}));
})(IpcBusLogConfig = exports.IpcBusLogConfig || (exports.IpcBusLogConfig = {}));

},{}],26:[function(require,module,exports){
(function (process){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusLogConfigImpl = void 0;
const IpcBusLogConfig_1 = require("./IpcBusLogConfig");
const LogLevelEnv = 'ELECTRON_IPC_LOG_LEVEL';
const LogBaseTimeEnv = 'ELECTRON_IPC_LOG_BASE_TIME';
const ArgMaxContentLenEnv = 'ELECTRON_IPC_LOG_ARG_MAX_CONTENT_LEN';
let performanceNode;
try {
    performanceNode = require('perf_hooks').performance;
}
catch (err) {
}
const performanceInterface = performanceNode || performance || {};
const performanceNow = performanceInterface.now ||
    performanceInterface.mozNow ||
    performanceInterface.msNow ||
    performanceInterface.oNow ||
    performanceInterface.webkitNow ||
    function () { return (new Date()).getTime(); };
class IpcBusLogConfigImpl {
    constructor() {
        const levelFromEnv = this.getLevelFromEnv();
        this._level = Math.max(IpcBusLogConfig_1.IpcBusLogConfig.Level.None, levelFromEnv);
        const baseTimeFromEnv = this.getBaseTimeFromEnv();
        this._baseTime = Math.max(this.now, baseTimeFromEnv);
        const argMaxLenFromEnv = this.getArgMaxContentLenFromEnv();
        this._argMaxContentLen = Math.max(-1, argMaxLenFromEnv);
    }
    getLevelFromEnv() {
        if (process && process.env) {
            const levelAny = process.env[LogLevelEnv];
            if (levelAny != null) {
                let level = Number(levelAny);
                level = Math.min(level, IpcBusLogConfig_1.IpcBusLogConfig.Level.Max);
                level = Math.max(level, IpcBusLogConfig_1.IpcBusLogConfig.Level.None);
                return level;
            }
        }
        return -1;
    }
    getBaseTimeFromEnv() {
        if (process && process.env) {
            const baseTimeAny = process.env[LogBaseTimeEnv];
            if (baseTimeAny != null) {
                const baseline = Number(baseTimeAny);
                return baseline;
            }
        }
        return -1;
    }
    getArgMaxContentLenFromEnv() {
        if (process && process.env) {
            const argMaxContentLenAny = process.env[ArgMaxContentLenEnv];
            if (argMaxContentLenAny != null) {
                const argMaxContentLen = Number(argMaxContentLenAny);
                return argMaxContentLen;
            }
        }
        return -1;
    }
    get level() {
        return this._level;
    }
    set level(level) {
        if (process && process.env) {
            process.env[LogLevelEnv] = level.toString();
        }
        this._level = level;
    }
    get baseTime() {
        return this._baseTime;
    }
    get now() {
        return Date.now();
    }
    get hrnow() {
        const clocktime = performanceNow.call(performanceInterface) * 1e-3;
        return clocktime;
    }
    set baseTime(baseTime) {
        if (process && process.env) {
            process.env[LogBaseTimeEnv] = baseTime.toString();
        }
        this._baseTime = baseTime;
    }
    set argMaxContentLen(argMaxContentLen) {
        argMaxContentLen = (argMaxContentLen == null) ? -1 : argMaxContentLen;
        if (process && process.env) {
            process.env[ArgMaxContentLenEnv] = argMaxContentLen.toString();
        }
        this._argMaxContentLen = argMaxContentLen;
    }
    get argMaxContentLen() {
        return this._argMaxContentLen;
    }
}
exports.IpcBusLogConfigImpl = IpcBusLogConfigImpl;

}).call(this,require('_process'))
},{"./IpcBusLogConfig":25,"_process":12,"perf_hooks":6}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusLogConfigMain = void 0;
const socket_serializer_1 = require("socket-serializer");
const IpcBusCommand_1 = require("../IpcBusCommand");
const IpcBusRendererContent_1 = require("../renderer/IpcBusRendererContent");
const IpcBusLog_1 = require("./IpcBusLog");
const IpcBusLogConfigImpl_1 = require("./IpcBusLogConfigImpl");
const IpcBusLogConfig_1 = require("./IpcBusLogConfig");
const IpcBusLog_factory_1 = require("./IpcBusLog-factory");
const IpcBusLogUtils_1 = require("./IpcBusLogUtils");
class IpcBusLogConfigMain extends IpcBusLogConfigImpl_1.IpcBusLogConfigImpl {
    constructor() {
        super();
        this._order = 0;
    }
    getCallback() {
        return this._cb;
    }
    setCallback(cb) {
        this._cb = cb;
    }
    getArgs(args) {
        if (args == null) {
            return [];
        }
        if (this._argMaxContentLen <= 0) {
            return args;
        }
        else {
            const managed_args = [];
            for (let i = 0, l = args.length; i < l; ++i) {
                managed_args.push(IpcBusLogUtils_1.CutData(args[i], this._argMaxContentLen));
            }
            return managed_args;
        }
    }
    buildMessage(logMessage, args, payload, top) {
        const command = logMessage.command;
        let needArgs = false;
        let kind;
        switch (logMessage.kind) {
            case IpcBusCommand_1.IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand_1.IpcBusCommand.Kind.LogLocalSendRequest: {
                if (top && ((this._level & IpcBusLogConfig_1.IpcBusLogConfig.Level.Sent) === 0)) {
                    return null;
                }
                kind = command.request ? IpcBusLog_1.IpcBusLog.Kind.SEND_REQUEST : IpcBusLog_1.IpcBusLog.Kind.SEND_MESSAGE;
                needArgs = (this._level & IpcBusLogConfig_1.IpcBusLogConfig.Level.SentArgs) === IpcBusLogConfig_1.IpcBusLogConfig.Level.SentArgs;
                break;
            }
            case IpcBusCommand_1.IpcBusCommand.Kind.RequestClose: {
                if (top && ((this._level & IpcBusLogConfig_1.IpcBusLogConfig.Level.Sent) === 0)) {
                    return null;
                }
                kind = IpcBusLog_1.IpcBusLog.Kind.SEND_CLOSE_REQUEST;
                break;
            }
            case IpcBusCommand_1.IpcBusCommand.Kind.RequestResponse:
            case IpcBusCommand_1.IpcBusCommand.Kind.LogLocalRequestResponse: {
                if (top && ((this._level & IpcBusLogConfig_1.IpcBusLogConfig.Level.Sent) === 0)) {
                    return null;
                }
                kind = IpcBusLog_1.IpcBusLog.Kind.SEND_REQUEST_RESPONSE;
                needArgs = (this._level & IpcBusLogConfig_1.IpcBusLogConfig.Level.SentArgs) === IpcBusLogConfig_1.IpcBusLogConfig.Level.SentArgs;
                break;
            }
            case IpcBusCommand_1.IpcBusCommand.Kind.LogGetMessage: {
                if (command.kind === IpcBusCommand_1.IpcBusCommand.Kind.SendMessage) {
                    kind = command.request ? IpcBusLog_1.IpcBusLog.Kind.GET_REQUEST : IpcBusLog_1.IpcBusLog.Kind.GET_MESSAGE;
                }
                else if (command.kind === IpcBusCommand_1.IpcBusCommand.Kind.RequestResponse) {
                    kind = IpcBusLog_1.IpcBusLog.Kind.GET_REQUEST_RESPONSE;
                }
                else if (command.kind === IpcBusCommand_1.IpcBusCommand.Kind.RequestClose) {
                    kind = IpcBusLog_1.IpcBusLog.Kind.GET_CLOSE_REQUEST;
                }
                needArgs = (this._level & IpcBusLogConfig_1.IpcBusLogConfig.Level.GetArgs) === IpcBusLogConfig_1.IpcBusLogConfig.Level.GetArgs;
                break;
            }
        }
        const message = {
            kind,
            id: logMessage.id,
            peer: logMessage.peer,
            related_peer: logMessage.related_peer || logMessage.peer,
            timestamp: logMessage.timestamp - this._baseTime,
            local: logMessage.local,
            payload,
            args: needArgs ? this.getArgs(args) : undefined
        };
        switch (message.kind) {
            case IpcBusLog_1.IpcBusLog.Kind.SEND_MESSAGE:
            case IpcBusLog_1.IpcBusLog.Kind.GET_MESSAGE: {
                message.channel = command.channel;
                break;
            }
            case IpcBusLog_1.IpcBusLog.Kind.SEND_REQUEST:
            case IpcBusLog_1.IpcBusLog.Kind.GET_REQUEST: {
                message.channel = command.request.channel;
                message.responseChannel = command.request.replyChannel;
                break;
            }
            case IpcBusLog_1.IpcBusLog.Kind.SEND_CLOSE_REQUEST:
            case IpcBusLog_1.IpcBusLog.Kind.GET_CLOSE_REQUEST: {
                message.channel = command.request.channel;
                message.responseChannel = command.request.replyChannel;
                message.responseStatus = 'cancelled';
                break;
            }
            case IpcBusLog_1.IpcBusLog.Kind.SEND_REQUEST_RESPONSE:
            case IpcBusLog_1.IpcBusLog.Kind.GET_REQUEST_RESPONSE: {
                message.channel = command.request.channel;
                message.responseChannel = command.request.replyChannel;
                message.responseStatus = command.request.resolve ? 'resolved' : 'rejected';
                break;
            }
        }
        return message;
    }
    addLog(ipcBusCommand, args, payload) {
        ++this._order;
        if (ipcBusCommand.log == null) {
            const id = `external-${ipcBusCommand.peer.id}-${this._order}`;
            ipcBusCommand.log = {
                id,
                kind: ipcBusCommand.kind,
                timestamp: this.now,
                peer: ipcBusCommand.peer,
                command: ipcBusCommand
            };
        }
        let logMessage = ipcBusCommand.log;
        const message = this.buildMessage(logMessage, args, payload, true);
        if (message != null) {
            const trace = {
                order: this._order,
                stack: [message]
            };
            logMessage = logMessage.previous;
            while (logMessage) {
                const message = this.buildMessage(logMessage, args, payload, false);
                trace.stack.push(message);
                logMessage = logMessage.previous;
            }
            trace.first = trace.stack[trace.stack.length - 1];
            trace.current = trace.stack[0];
            const subOrder = (trace.current.kind >= IpcBusLog_1.IpcBusLog.Kind.SEND_REQUEST) ? trace.current.kind - IpcBusLog_1.IpcBusLog.Kind.SEND_REQUEST : trace.current.kind;
            trace.id = `${trace.first.id}_${String.fromCharCode(97 + subOrder)}`;
            this._cb(trace);
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }
    addLogRawContent(ipcBusCommand, rawContent) {
        if (ipcBusCommand.log) {
            const lograwContent = Object.assign({}, rawContent);
            IpcBusRendererContent_1.IpcBusRendererContent.FixRawContent(lograwContent);
            IpcBusRendererContent_1.IpcBusRendererContent.UnpackRawContent(lograwContent);
            const packet = new socket_serializer_1.IpcPacketBuffer(lograwContent);
            return this.addLog(ipcBusCommand, packet.parseArrayAt(1), packet.buffer.length);
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }
    addLogPacket(ipcBusCommand, ipcPacketBuffer) {
        if (ipcBusCommand.log) {
            return this.addLog(ipcBusCommand, ipcPacketBuffer.parseArrayAt(1), ipcPacketBuffer.buffer.length);
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }
}
exports.IpcBusLogConfigMain = IpcBusLogConfigMain;
IpcBusLog_1.IpcBusLog.SetLogLevel = (level, cb, argContentLen) => {
    const logger = IpcBusLog_factory_1.CreateIpcBusLog();
    logger.level = level;
    logger.setCallback(cb);
    logger.argMaxContentLen = argContentLen;
};

},{"../IpcBusCommand":17,"../renderer/IpcBusRendererContent":33,"./IpcBusLog":24,"./IpcBusLog-factory":23,"./IpcBusLogConfig":25,"./IpcBusLogConfigImpl":26,"./IpcBusLogUtils":28,"socket-serializer":74}],28:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CutData = exports.JSON_stringify = exports.JSON_stringify_string = exports.JSON_stringify_object = exports.JSON_stringify_array = void 0;
const CutMarker = '\'__cut__\'';
function JSON_stringify_array(data, maxLen, output) {
    output += '[';
    for (let i = 0, l = data.length; i < l; ++i) {
        if (output.length >= maxLen) {
            output += CutMarker;
            break;
        }
        output += JSON_stringify(data[i], maxLen - output.length);
        output += ',';
    }
    output += ']';
    return output;
}
exports.JSON_stringify_array = JSON_stringify_array;
function JSON_stringify_object(data, maxLen, output) {
    output += '{';
    if (data) {
        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; ++i) {
            if (output.length >= maxLen) {
                output += CutMarker;
                break;
            }
            const key = keys[i];
            output += key + ': ';
            if (output.length >= maxLen) {
                output += CutMarker;
                break;
            }
            output += JSON_stringify(data[key], maxLen - output.length);
            output += ',';
        }
    }
    else {
        output += 'null';
    }
    output += '}';
    return output;
}
exports.JSON_stringify_object = JSON_stringify_object;
function JSON_stringify_string(data, maxLen) {
    if (data.length > maxLen) {
        return data.substr(0, maxLen) + CutMarker;
    }
    else {
        return data;
    }
}
exports.JSON_stringify_string = JSON_stringify_string;
function JSON_stringify(data, maxLen) {
    let output = '';
    switch (typeof data) {
        case 'object':
            if (Buffer.isBuffer(data)) {
                if (data.length > maxLen * 2) {
                    output = data.toString('utf8', 0, maxLen) + CutMarker;
                }
                else {
                    output = data.toString('utf8', 0, maxLen);
                }
            }
            else if (Array.isArray(data)) {
                output = JSON_stringify_array(data, maxLen, output);
            }
            else if (data instanceof Date) {
                output = data.toISOString();
            }
            else {
                output = JSON_stringify_object(data, maxLen, output);
            }
            break;
        case 'string':
            output = JSON_stringify_string(data, maxLen);
            break;
        case 'number':
            output = data.toString();
            break;
        case 'boolean':
            output = data ? 'true' : 'false';
            break;
        case 'undefined':
            output = '__undefined__';
            break;
    }
    return output;
}
exports.JSON_stringify = JSON_stringify;
function CutData(data, maxLen) {
    switch (typeof data) {
        case 'object':
            if (Buffer.isBuffer(data)) {
                if (data.length > maxLen * 2) {
                    data = data.toString('utf8', 0, maxLen) + CutMarker;
                }
                else {
                    data = data.toString('utf8', 0, maxLen);
                }
            }
            else if (Array.isArray(data)) {
                data = JSON_stringify_array(data, maxLen, '');
            }
            else if (data instanceof Date) {
                return data;
            }
            else {
                return JSON_stringify_object(data, maxLen, '');
            }
            break;
        case 'string':
            data = JSON_stringify_string(data, maxLen);
            break;
        case 'number':
            return data;
        case 'boolean':
            return data;
        case 'undefined':
            return data;
    }
    return data;
}
exports.CutData = CutData;

}).call(this,{"isBuffer":require("../../../examples/basic-app/node_modules/is-buffer/index.js")})
},{"../../../examples/basic-app/node_modules/is-buffer/index.js":10}],29:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusFrameBridge = exports.CrossFrameEventDispatcher = exports.CrossFrameEventEmitter = void 0;
const uuid = require("uuid");
const events_1 = require("events");
const IpcBusConnectorRenderer_1 = require("./IpcBusConnectorRenderer");
const CrossFrameMessage_1 = require("./CrossFrameMessage");
const trace = false;
class CrossFrameEventEmitter extends events_1.EventEmitter {
    constructor(target, origin) {
        super();
        this._target = target;
        this._origin = origin || '*';
        this._uuid = uuid.v4();
        this._messageHandler = this._messageHandler.bind(this);
        this._start();
        if (trace) {
            this.on('newListener', (event) => {
                trace && console.log(`CFEE ${this._uuid} - newListener ${event}`);
            });
            this.on('removeListener', (event) => {
                trace && console.log(`CFEE ${this._uuid} - removeListener ${event}`);
            });
        }
        window.addEventListener('unload', () => {
            trace && console.log(`CFEE ${this._uuid} - unload event`);
            this.close();
        });
    }
    _start() {
        if (this._messageChannel == null) {
            trace && console.log(`CFEE ${this._uuid} - init`);
            this._messageChannel = new MessageChannel();
            this._messageChannel.port1.addEventListener('message', this._messageHandler);
            this._messageChannel.port1.start();
            const packet = CrossFrameMessage_1.CrossFrameMessage.Encode(this._uuid, 'init', []);
            this._target.postMessage(packet, this._origin, [this._messageChannel.port2]);
        }
    }
    close() {
        if (this._messageChannel != null) {
            trace && console.log(`CFEE ${this._uuid} - exit`);
            const packet = CrossFrameMessage_1.CrossFrameMessage.Encode(this._uuid, 'exit', []);
            this._target.postMessage(packet, this._origin);
            this._messageChannel.port1.removeEventListener('message', this._messageHandler);
            this._messageChannel.port1.close();
            this._messageChannel = null;
        }
    }
    send(channel, ...args) {
        trace && console.log(`CFEE ${this._uuid} - send: ${channel} - ${JSON.stringify(args)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Encode(this._uuid, channel, args);
        this._messageChannel.port1.postMessage(packet);
    }
    _eventHandler(channel, ...args) {
        trace && console.log(`CFEE ${this._uuid} - emit: ${channel} - ${JSON.stringify(args)} => ${this.listenerCount(channel)}`);
        this.emit(channel, ...args);
    }
    _messageHandler(event) {
        trace && console.log(`CFEE ${this._uuid} - messageHandler: ${JSON.stringify(event)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Decode(event.data);
        if (packet) {
            if (Array.isArray(packet.args)) {
                this._eventHandler(packet.channel, ...packet.args);
            }
            else {
                this._eventHandler(packet.channel);
            }
        }
    }
}
exports.CrossFrameEventEmitter = CrossFrameEventEmitter;
class CrossFrameEventDispatcher {
    constructor(target) {
        this._target = target;
        this._lifecycleHandler = this._lifecycleHandler.bind(this);
        this._messageHandler = this._messageHandler.bind(this);
        this._started = false;
    }
    start() {
        if (this._started === false) {
            trace && console.log(`CFEDisp ${this._uuid} - start`);
            this._started = true;
            this._uuid = uuid.v4();
            this._ports = new Map();
            const target = this._target;
            if (target.addEventListener) {
                target.addEventListener('message', this._lifecycleHandler);
            }
            else if (target.attachEvent) {
                target.attachEvent('onmessage', this._lifecycleHandler);
            }
        }
    }
    stop() {
        if (this._started) {
            trace && console.log(`CFEDisp ${this._uuid} - stop`);
            this._started = false;
            const target = this._target;
            if (target.addEventListener) {
                target.removeEventListener('message', this._lifecycleHandler);
            }
            else if (target.attachEvent) {
                target.detachEvent('onmessage', this._lifecycleHandler);
            }
            this._ports.forEach((port) => {
                port.removeEventListener('message', this._messageHandler);
                port.close();
            });
            this._ports.clear();
            this._ports = null;
        }
    }
    _lifecycleHandler(event) {
        const packet = CrossFrameMessage_1.CrossFrameMessage.Decode(event.data);
        trace && console.log(`CFEDisp ${this._uuid} - lifecycle - ${JSON.stringify(packet)}`);
        if (packet) {
            if (packet.channel === 'init') {
                trace && console.log(`CFEDisp ${this._uuid} - lifecycle - init ${packet.uuid}`);
                let port = this._ports.get(packet.uuid);
                if (port == null) {
                    port = event.ports[0];
                    this._ports.set(packet.uuid, port);
                    port.addEventListener('message', this._messageHandler);
                    port.start();
                }
            }
            else if (packet.channel === 'exit') {
                trace && console.log(`CFEDisp ${this._uuid} - lifecycle - exit ${packet.uuid}`);
                let port = this._ports.get(packet.uuid);
                if (port) {
                    this._ports.delete(packet.uuid);
                    port.removeEventListener('message', this._messageHandler);
                    port.close();
                }
            }
        }
    }
    _messageHandler(event) {
        trace && console.log(`CFEDisp ${this._uuid} - messageHandler ${JSON.stringify(event)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Decode(event.data);
        if (packet) {
            trace && console.log(`CFEDisp ${this._uuid} - messageHandler - ${packet}`);
            this._ports.forEach((port, uuid) => {
                if (uuid !== packet.uuid) {
                    port.postMessage(event.data);
                }
            });
        }
    }
}
exports.CrossFrameEventDispatcher = CrossFrameEventDispatcher;
class IpcBusFrameBridge extends CrossFrameEventDispatcher {
    constructor(ipcWindow, target) {
        super(target);
        this._ipcWindow = ipcWindow;
        this._messageTransportHandlerEvent = this._messageTransportHandlerEvent.bind(this);
        this._messageTransportHandlerConnect = this._messageTransportHandlerConnect.bind(this);
    }
    start() {
        super.start();
        this._ipcWindow.addListener(IpcBusConnectorRenderer_1.IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._messageTransportHandlerConnect);
        this._ipcWindow.addListener(IpcBusConnectorRenderer_1.IPCBUS_TRANSPORT_RENDERER_EVENT, this._messageTransportHandlerEvent);
    }
    stop() {
        this._ipcWindow.removeListener(IpcBusConnectorRenderer_1.IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._messageTransportHandlerConnect);
        this._ipcWindow.removeListener(IpcBusConnectorRenderer_1.IPCBUS_TRANSPORT_RENDERER_EVENT, this._messageTransportHandlerEvent);
        super.stop();
    }
    _messageHandler(event) {
        const packet = CrossFrameMessage_1.CrossFrameMessage.Decode(event.data);
        trace && console.log(`IpcBusFrameBridge - messageHandler - ${JSON.stringify(packet)}`);
        if (packet) {
            if (Array.isArray(packet.args)) {
                this._ipcWindow.send(packet.channel, ...packet.args);
            }
            else {
                this._ipcWindow.send(packet.channel);
            }
        }
    }
    _messageTransportHandlerEvent(...args) {
        trace && console.log(`_messageTransportHandlerEvent ${JSON.stringify(args)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Encode('dispatcher', IpcBusConnectorRenderer_1.IPCBUS_TRANSPORT_RENDERER_EVENT, args);
        this._ports.forEach((port) => {
            port.postMessage(packet);
        });
    }
    _messageTransportHandlerConnect(...args) {
        trace && console.log(`_messageTransportHandlerConnect ${JSON.stringify(args)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Encode('dispatcher', IpcBusConnectorRenderer_1.IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, args);
        this._ports.forEach((port) => {
            port.postMessage(packet);
        });
    }
}
exports.IpcBusFrameBridge = IpcBusFrameBridge;

},{"./CrossFrameMessage":30,"./IpcBusConnectorRenderer":32,"events":8,"uuid":76}],30:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossFrameMessage = void 0;
const json_helpers_1 = require("json-helpers");
var CrossFrameMessage;
(function (CrossFrameMessage) {
    CrossFrameMessage.CrossFrameKeyId = '__cross-frame-message__';
    function Decode(data) {
        try {
            const wrap = json_helpers_1.JSONParser.parse(data);
            const packet = wrap[CrossFrameMessage.CrossFrameKeyId];
            if (packet) {
                return packet;
            }
        }
        catch (e) {
        }
        return null;
    }
    CrossFrameMessage.Decode = Decode;
    function Encode(uuid, channel, args) {
        const wrap = {
            [CrossFrameMessage.CrossFrameKeyId]: {
                uuid,
                channel,
                args: args
            }
        };
        return json_helpers_1.JSONParser.stringify(wrap);
    }
    CrossFrameMessage.Encode = Encode;
})(CrossFrameMessage = exports.CrossFrameMessage || (exports.CrossFrameMessage = {}));

},{"json-helpers":53}],31:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Create = exports.CreateTransport = exports.CreateConnector = void 0;
const IpcBusConnectorRenderer_1 = require("./IpcBusConnectorRenderer");
const IpcBusClientImpl_1 = require("../IpcBusClientImpl");
const IpcBusTransportMultiImpl_1 = require("../IpcBusTransportMultiImpl");
function CreateConnector(contextType, ipcWindow) {
    const connector = new IpcBusConnectorRenderer_1.IpcBusConnectorRenderer(contextType, ipcWindow);
    return connector;
}
exports.CreateConnector = CreateConnector;
let g_transport = null;
function CreateTransport(contextType, ipcWindow) {
    if (g_transport == null) {
        const connector = CreateConnector(contextType, ipcWindow);
        g_transport = new IpcBusTransportMultiImpl_1.IpcBusTransportMultiImpl(connector);
    }
    return g_transport;
}
exports.CreateTransport = CreateTransport;
function Create(contextType, ipcWindow) {
    const transport = CreateTransport(contextType, ipcWindow);
    const ipcClient = new IpcBusClientImpl_1.IpcBusClientImpl(transport);
    return ipcClient;
}
exports.Create = Create;

},{"../IpcBusClientImpl":16,"../IpcBusTransportMultiImpl":20,"./IpcBusConnectorRenderer":32}],32:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusConnectorRenderer = exports.IPCBUS_TRANSPORT_RENDERER_EVENT = exports.IPCBUS_TRANSPORT_RENDERER_COMMAND = exports.IPCBUS_TRANSPORT_RENDERER_HANDSHAKE = void 0;
const assert = require("assert");
const socket_serializer_1 = require("socket-serializer");
const IpcBusUtils = require("../IpcBusUtils");
const IpcBusConnectorImpl_1 = require("../IpcBusConnectorImpl");
const IpcBusRendererContent_1 = require("./IpcBusRendererContent");
exports.IPCBUS_TRANSPORT_RENDERER_HANDSHAKE = 'ECIPC:IpcBusRenderer:Handshake';
exports.IPCBUS_TRANSPORT_RENDERER_COMMAND = 'ECIPC:IpcBusRenderer:Command';
exports.IPCBUS_TRANSPORT_RENDERER_EVENT = 'ECIPC:IpcBusRenderer:Event';
class IpcBusConnectorRenderer extends IpcBusConnectorImpl_1.IpcBusConnectorImpl {
    constructor(contextType, ipcWindow) {
        assert(contextType === 'renderer' || contextType === 'renderer-frame', `IpcBusTransportWindow: contextType must not be a ${contextType}`);
        super(contextType);
        this._ipcWindow = ipcWindow;
        this._connectCloseState = new IpcBusUtils.ConnectCloseState();
    }
    onConnectorShutdown() {
        if (this._onIpcEventReceived) {
            this._client.onConnectorShutdown();
            this._ipcWindow.removeListener(exports.IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
            this._onIpcEventReceived = null;
        }
    }
    _onConnect(eventOrPeer, peerOrArgs, handshakeArg) {
        if (handshakeArg) {
            const handshake = handshakeArg;
            this._onIpcEventReceived = (event, ipcBusCommand, rawContent) => {
                IpcBusRendererContent_1.IpcBusRendererContent.FixRawContent(rawContent);
                IpcBusRendererContent_1.IpcBusRendererContent.UnpackRawContent(rawContent);
                this._client.onConnectorContentReceived(ipcBusCommand, rawContent);
            };
            this._ipcWindow.addListener(exports.IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
            return handshake;
        }
        else {
            const handshake = peerOrArgs;
            this._onIpcEventReceived = (ipcBusCommand, rawContent) => {
                IpcBusRendererContent_1.IpcBusRendererContent.FixRawContent(rawContent);
                IpcBusRendererContent_1.IpcBusRendererContent.UnpackRawContent(rawContent);
                this._client.onConnectorContentReceived(ipcBusCommand, rawContent);
            };
            this._ipcWindow.addListener(exports.IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
            return handshake;
        }
    }
    ;
    handshake(client, options) {
        return this._connectCloseState.connect(() => {
            return new Promise((resolve, reject) => {
                let timer;
                const onIpcConnect = (eventOrPeer, peerOrArgs, handshakeArg) => {
                    this._ipcWindow.removeListener(exports.IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onIpcConnect);
                    this.addClient(client);
                    const handshake = this._onConnect(eventOrPeer, peerOrArgs, handshakeArg);
                    this._process = Object.assign(this._process, handshake.process);
                    this._log.level = handshake.logLevel;
                    clearTimeout(timer);
                    resolve(handshake);
                };
                options = IpcBusUtils.CheckConnectOptions(options);
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        this._ipcWindow.removeListener(exports.IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onIpcConnect);
                        reject('timeout');
                    }, options.timeoutDelay);
                }
                this._ipcWindow.addListener(exports.IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onIpcConnect);
                this._ipcWindow.send(exports.IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, client.peer);
            });
        });
    }
    shutdown(client, options) {
        return this._connectCloseState.close(() => {
            this.onConnectorShutdown();
            this.removeClient(client);
            return Promise.resolve();
        });
    }
    postCommand(ipcBusCommand, args) {
        ipcBusCommand.bridge = true;
        const packetOut = new socket_serializer_1.IpcPacketBuffer();
        packetOut.serializeArray([ipcBusCommand, args]);
        const packRawContent = IpcBusRendererContent_1.IpcBusRendererContent.PackRawContent(packetOut.getRawContent());
        this._ipcWindow.send(exports.IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcBusCommand, packRawContent);
    }
    postBuffer(buffer) {
        throw 'not implemented';
    }
}
exports.IpcBusConnectorRenderer = IpcBusConnectorRenderer;

},{"../IpcBusConnectorImpl":18,"../IpcBusUtils":21,"./IpcBusRendererContent":33,"assert":1,"socket-serializer":74}],33:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusRendererContent = void 0;
var IpcBusRendererContent;
(function (IpcBusRendererContent) {
    function FixRawContent(rawContent) {
        if (rawContent.buffer instanceof Uint8Array) {
            const arr = rawContent.buffer;
            rawContent.buffer = Buffer.from(arr.buffer);
            if (arr.byteLength !== arr.buffer.byteLength) {
                rawContent.buffer = rawContent.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
            }
        }
    }
    IpcBusRendererContent.FixRawContent = FixRawContent;
    function PackRawContent(buffRawContent) {
        const rawContent = buffRawContent;
        return rawContent;
    }
    IpcBusRendererContent.PackRawContent = PackRawContent;
    function UnpackRawContent(rawContent) {
        return rawContent;
    }
    IpcBusRendererContent.UnpackRawContent = UnpackRawContent;
})(IpcBusRendererContent = exports.IpcBusRendererContent || (exports.IpcBusRendererContent = {}));

}).call(this,require("buffer").Buffer)
},{"buffer":7}],34:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsElectronCommonIpcAvailable = exports.PreloadElectronCommonIpc = exports.PreloadElectronCommonIpcAutomatic = void 0;
const IpcBusClientRenderer_factory_1 = require("./IpcBusClientRenderer-factory");
const CrossFrameEventEmitter2_1 = require("./CrossFrameEventEmitter2");
const trace = false;
function PreloadElectronCommonIpcAutomatic() {
    return _PreloadElectronCommonIpc('Implicit');
}
exports.PreloadElectronCommonIpcAutomatic = PreloadElectronCommonIpcAutomatic;
function PreloadElectronCommonIpc(iframeSupport = false) {
    return _PreloadElectronCommonIpc('Explicit', iframeSupport);
}
exports.PreloadElectronCommonIpc = PreloadElectronCommonIpc;
function _PreloadElectronCommonIpc(context, iframeSupport = false) {
    const windowLocal = window;
    if (windowLocal.self === windowLocal.top) {
        try {
            const electron = require('electron');
            if (electron && electron.ipcRenderer) {
                windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
                if (windowLocal.ElectronCommonIpc.CreateIpcBusClient == null) {
                    trace && console.log(`inject - ${context} - ElectronCommonIpc.CreateIpcBusClient`);
                    windowLocal.ElectronCommonIpc.CreateIpcBusClient = () => {
                        trace && console.log(`${context} - ElectronCommonIpc.CreateIpcBusClient`);
                        const ipcBusClient = IpcBusClientRenderer_factory_1.Create('renderer', electron.ipcRenderer);
                        return ipcBusClient;
                    };
                }
                if (windowLocal.ElectronCommonIpc.FrameBridge == null) {
                    trace && console.log(`inject - ${context} - ElectronCommonIpc.FrameBridge`);
                    windowLocal.ElectronCommonIpc.FrameBridge = new CrossFrameEventEmitter2_1.IpcBusFrameBridge(electron.ipcRenderer, window);
                }
            }
        }
        catch (_) {
        }
        try {
            const frameBridge = windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.FrameBridge;
            if (frameBridge) {
                if (iframeSupport) {
                    trace && console.log(`${context} - ElectronCommonIpc.FrameBridge - start`);
                    frameBridge.start();
                }
                else {
                    frameBridge.stop();
                    trace && console.log(`${context} - ElectronCommonIpc.FrameBridge - stop`);
                }
            }
        }
        catch (_) {
        }
    }
    else {
        try {
            windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
            if (windowLocal.ElectronCommonIpc.CreateIpcBusClient == null) {
                trace && console.log(`${context} - Frame ElectronCommonIpc`);
                const crossFrameEE = new CrossFrameEventEmitter2_1.CrossFrameEventEmitter(window.parent);
                windowLocal.ElectronCommonIpc.CreateIpcBusClient = () => {
                    trace && console.log(`${context} - Frame ElectronCommonIpc.CreateIpcBusClient`);
                    const ipcBusClient = IpcBusClientRenderer_factory_1.Create('renderer-frame', crossFrameEE);
                    return ipcBusClient;
                };
            }
        }
        catch (_) {
        }
    }
    return IsElectronCommonIpcAvailable();
}
function IsElectronCommonIpcAvailable() {
    try {
        const windowLocal = window;
        return (windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.CreateIpcBusClient) != null;
    }
    catch (_) {
    }
    return false;
}
exports.IsElectronCommonIpcAvailable = IsElectronCommonIpcAvailable;

},{"./CrossFrameEventEmitter2":29,"./IpcBusClientRenderer-factory":31,"electron":"electron"}],35:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IpcBusService_factory_1 = require("./IpcBusService-factory");
const windowLocal = window;
windowLocal.CreateIpcBusService = IpcBusService_factory_1.CreateIpcBusService;
windowLocal.CreateIpcBusServiceProxy = IpcBusService_factory_1.CreateIpcBusServiceProxy;

},{"./IpcBusService-factory":36}],36:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIpcBusServiceProxy = exports.CreateIpcBusService = void 0;
const IpcBusService_1 = require("./IpcBusService");
const IpcBusServiceImpl_1 = require("./IpcBusServiceImpl");
const IpcBusServiceProxyImpl_1 = require("./IpcBusServiceProxyImpl");
exports.CreateIpcBusService = (client, serviceName, serviceImpl, options) => {
    return new IpcBusServiceImpl_1.IpcBusServiceImpl(client, serviceName, serviceImpl);
};
IpcBusService_1.IpcBusService.Create = exports.CreateIpcBusService;
exports.CreateIpcBusServiceProxy = (client, serviceName, options) => {
    return new IpcBusServiceProxyImpl_1.IpcBusServiceProxyImpl(client, serviceName, options);
};
IpcBusService_1.IpcBusServiceProxy.Create = exports.CreateIpcBusServiceProxy;

},{"./IpcBusService":37,"./IpcBusServiceImpl":38,"./IpcBusServiceProxyImpl":39}],37:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusServiceProxy = exports.IpcBusService = exports.IPCBUS_SERVICE_EVENT_STOP = exports.IPCBUS_SERVICE_EVENT_START = void 0;
exports.IPCBUS_SERVICE_EVENT_START = 'service-event-start';
exports.IPCBUS_SERVICE_EVENT_STOP = 'service-event-stop';
var IpcBusService;
(function (IpcBusService) {
})(IpcBusService = exports.IpcBusService || (exports.IpcBusService = {}));
var IpcBusServiceProxy;
(function (IpcBusServiceProxy) {
})(IpcBusServiceProxy = exports.IpcBusServiceProxy || (exports.IpcBusServiceProxy = {}));

},{}],38:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusServiceImpl = void 0;
const events_1 = require("events");
const Service = require("./IpcBusService");
const ServiceUtils = require("./IpcBusServiceUtils");
const IpcBusUtils = require("../IpcBusUtils");
function hasMethod(obj, name) {
    if (name === 'constructor') {
        return null;
    }
    if (name[0] === '_') {
        return null;
    }
    const desc = Object.getOwnPropertyDescriptor(obj, name);
    if (!!desc && (typeof desc.value === 'function')) {
        return desc;
    }
    return null;
}
function getInstanceMethodNames(obj) {
    const methodNames = new Map();
    Object.getOwnPropertyNames(obj)
        .forEach(name => {
        const desc = hasMethod(obj, name);
        if (desc) {
            methodNames.set(name, desc);
        }
    });
    let proto = Object.getPrototypeOf(obj);
    while (proto) {
        if (proto === events_1.EventEmitter.prototype) {
            for (let prop of Object.keys(events_1.EventEmitter.prototype)) {
                if (prop[0] !== '_') {
                    methodNames.delete(prop);
                }
            }
            methodNames.delete('off');
            break;
        }
        else if (proto === Object.prototype) {
            break;
        }
        Object.getOwnPropertyNames(proto)
            .forEach(name => {
            const desc = hasMethod(proto, name);
            if (desc) {
                methodNames.set(name, desc);
            }
        });
        proto = Object.getPrototypeOf(proto);
    }
    return methodNames;
}
class IpcBusServiceImpl {
    constructor(_ipcBusClient, _serviceName, _exposedInstance, options) {
        this._ipcBusClient = _ipcBusClient;
        this._serviceName = _serviceName;
        this._exposedInstance = _exposedInstance;
        this._prevImplEmit = null;
        this._callHandlers = new Map();
        this._onCallReceived = this._onCallReceived.bind(this);
        this.registerCallHandler(ServiceUtils.IPCBUS_SERVICE_CALL_GETSTATUS, () => {
            return this._getServiceStatus();
        });
        if (this._exposedInstance) {
            const methodNames = getInstanceMethodNames(this._exposedInstance);
            methodNames.forEach((methodDesc, methodName) => {
                this.registerCallHandler(methodName, methodDesc.value);
            });
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' does NOT have an implementation`);
        }
    }
    _getServiceStatus() {
        const serviceStatus = {
            started: true,
            callHandlers: this._getCallHandlerNames(),
            supportEventEmitter: (this._prevImplEmit != null)
        };
        return serviceStatus;
    }
    start() {
        if (this._exposedInstance && this._exposedInstance['emit']) {
            this._prevImplEmit = this._exposedInstance['emit'];
            this._exposedInstance['emit'] = (eventName, ...args) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is emitting event '${eventName}'`);
                this.sendEvent(ServiceUtils.IPCBUS_SERVICE_WRAPPER_EVENT, eventName, args);
                this._prevImplEmit.call(this._exposedInstance, eventName, ...args);
            };
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' will send events emitted by its implementation`);
        }
        this._ipcBusClient.addListener(ServiceUtils.getServiceCallChannel(this._serviceName), this._onCallReceived);
        this.sendEvent(Service.IPCBUS_SERVICE_EVENT_START, this._getServiceStatus());
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STARTED`);
    }
    stop() {
        if (this._exposedInstance && this._prevImplEmit) {
            this._exposedInstance['emit'] = this._prevImplEmit;
            this._prevImplEmit = null;
        }
        this.sendEvent(Service.IPCBUS_SERVICE_EVENT_STOP, {});
        this._ipcBusClient.removeListener(ServiceUtils.getServiceCallChannel(this._serviceName), this._onCallReceived);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STOPPED`);
    }
    registerCallHandler(name, handler) {
        this._callHandlers.set(name, handler);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' registered call handler '${name}'`);
    }
    unregisterCallHandler(name) {
        this._callHandlers.delete(name);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' unregistered call handler '${name}'`);
    }
    sendEvent(name, ...args) {
        const eventMsg = { eventName: name, args: args };
        this._ipcBusClient.send(ServiceUtils.getServiceEventChannel(this._serviceName), eventMsg);
    }
    _onCallReceived(event, call) {
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is calling implementation's '${call.handlerName}'`);
        const callHandler = this._callHandlers.get(call.handlerName);
        try {
            if (!callHandler) {
                throw `Function unknown !`;
            }
            else {
                const result = callHandler.apply(this._exposedInstance, call.args);
                if (event.request) {
                    if (result && result['then']) {
                        result.then(event.request.resolve, event.request.reject);
                    }
                    else {
                        event.request.resolve(result);
                    }
                }
            }
        }
        catch (e) {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing call to '${call.handlerName}' : ${e}`);
            if (event.request) {
                event.request.reject(e);
            }
        }
    }
    _getCallHandlerNames() {
        const callHandlerNames = Array.from(this._callHandlers.keys()).filter((name) => name[0] !== '_');
        return callHandlerNames;
    }
}
exports.IpcBusServiceImpl = IpcBusServiceImpl;

},{"../IpcBusUtils":21,"./IpcBusService":37,"./IpcBusServiceUtils":40,"events":8}],39:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcBusServiceProxyImpl = void 0;
const events_1 = require("events");
const Service = require("./IpcBusService");
const ServiceUtils = require("./IpcBusServiceUtils");
const IpcBusUtils = require("../IpcBusUtils");
class Deferred {
    constructor(executor, immediat = true) {
        this.id = ++Deferred._globalCounter;
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
            if (immediat) {
                if (executor) {
                    executor(resolve, reject);
                }
            }
            else {
                this._executor = executor;
            }
        });
    }
    execute() {
        if (this._executor) {
            this._executor(this.resolve, this.reject);
        }
    }
    then(...args) {
        return this.promise.then(...args);
    }
    catch(...args) {
        return this.promise.catch(...args);
    }
}
Deferred._globalCounter = 0;
class CallWrapperEventEmitter extends events_1.EventEmitter {
}
class IpcBusServiceProxyImpl extends events_1.EventEmitter {
    constructor(ipcBusClient, serviceName, options) {
        super();
        super.setMaxListeners(0);
        this._ipcBusClient = ipcBusClient;
        this._serviceName = serviceName;
        options = options || {};
        options.timeoutDelay = options.timeoutDelay || IpcBusUtils.IPC_BUS_TIMEOUT;
        this._options = options;
        this._pendingCalls = new Map();
        this._wrapper = new CallWrapperEventEmitter();
        this._isStarted = false;
        this._onServiceReceived = this._onServiceReceived.bind(this);
        this._ipcBusClient.addListener(ServiceUtils.getServiceEventChannel(this._serviceName), this._onServiceReceived);
        this.getStatus()
            .then((serviceStatus) => {
            this._onServiceStart(serviceStatus);
        })
            .catch((err) => {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] first status to '${this._serviceName}' - err: ${err}`);
        });
    }
    connect(options) {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = this._options.timeoutDelay;
        }
        return new Promise((resolve, reject) => {
            if (this._isStarted) {
                return resolve(this.getWrapper());
            }
            let timer;
            const serviceStart = () => {
                clearTimeout(timer);
                this.removeListener(Service.IPCBUS_SERVICE_EVENT_START, serviceStart);
                resolve(this.getWrapper());
            };
            if (options.timeoutDelay >= 0) {
                timer = setTimeout(() => {
                    this.removeListener(Service.IPCBUS_SERVICE_EVENT_START, serviceStart);
                    reject('timeout');
                }, options.timeoutDelay);
            }
            this.addListener(Service.IPCBUS_SERVICE_EVENT_START, serviceStart);
        });
    }
    get isStarted() {
        return this._isStarted;
    }
    getWrapper() {
        const typed_wrapper = this._wrapper;
        return typed_wrapper;
    }
    get wrapper() {
        return this._wrapper;
    }
    getStatus() {
        return this._call(ServiceUtils.IPCBUS_SERVICE_CALL_GETSTATUS);
    }
    _requestApply(name, args) {
        const deferred = new Deferred((resolve, reject) => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.request(ServiceUtils.getServiceCallChannel(this._serviceName), -1, callMsg)
                .then((res) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] resolve call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                this._pendingCalls.delete(deferred.id);
                resolve(res.payload);
            })
                .catch((res) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] reject call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                this._pendingCalls.delete(deferred.id);
                reject(res.err);
            });
        }, false);
        this._pendingCalls.set(deferred.id, deferred);
        return deferred;
    }
    _call(name, ...args) {
        const deferred = this._requestApply(name, args);
        deferred.execute();
        return deferred.promise;
    }
    requestApply(name, args) {
        const deferred = this._requestApply(name, args);
        if (this._isStarted) {
            deferred.execute();
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
        return deferred.promise;
    }
    requestCall(name, ...args) {
        return this.requestApply(name, args);
    }
    apply(name, args) {
        return this.requestApply(name, args);
    }
    call(name, ...args) {
        return this.requestApply(name, args);
    }
    _sendApply(name, args) {
        const deferred = new Deferred((resolve, reject) => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.send(ServiceUtils.getServiceCallChannel(this._serviceName), -1, callMsg);
            this._pendingCalls.delete(deferred.id);
        }, false);
        this._pendingCalls.set(deferred.id, deferred);
        return deferred;
    }
    sendApply(name, args) {
        if (this._isStarted) {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.send(ServiceUtils.getServiceCallChannel(this._serviceName), -1, callMsg);
        }
        else {
            this._sendApply(name, args);
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
    }
    sendCall(name, ...args) {
        return this.sendApply(name, args);
    }
    _updateWrapper(serviceStatus) {
        for (let i = 0, l = serviceStatus.callHandlers.length; i < l; ++i) {
            const handlerName = serviceStatus.callHandlers[i];
            const requestProc = (...args) => {
                return this.requestApply(handlerName, args);
            };
            const sendProc = (...args) => {
                return this.sendApply(handlerName, args);
            };
            this._wrapper[handlerName] = requestProc;
            this._wrapper[`request_${handlerName}`] = requestProc;
            this._wrapper[`send_${handlerName}`] = sendProc;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' added '${handlerName}' to its wrapper`);
        }
    }
    _onServiceReceived(event, msg) {
        if (msg.eventName === ServiceUtils.IPCBUS_SERVICE_WRAPPER_EVENT) {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Wrapper '${this._serviceName}' receive event '${msg.args[0]}'`);
            this._wrapper.emit(msg.args[0], ...msg.args[1]);
            this.emit(msg.args[0], ...msg.args[1]);
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' receive event '${msg.eventName}'`);
            switch (msg.eventName) {
                case Service.IPCBUS_SERVICE_EVENT_START:
                    this._onServiceStart(msg.args[0]);
                    break;
                case Service.IPCBUS_SERVICE_EVENT_STOP:
                    this._onServiceStop();
                    break;
                default:
                    this.emit(msg.eventName, ...msg.args);
                    break;
            }
        }
    }
    _onServiceStart(serviceStatus) {
        if (!this._isStarted && serviceStatus.started) {
            this._isStarted = true;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STARTED`);
            this._updateWrapper(serviceStatus);
            this.emit(Service.IPCBUS_SERVICE_EVENT_START, serviceStatus);
            this._pendingCalls.forEach((deferred) => {
                deferred.execute();
            });
        }
    }
    _onServiceStop() {
        if (this._isStarted) {
            this._isStarted = false;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STOPPED`);
            this.emit(Service.IPCBUS_SERVICE_EVENT_STOP);
            this._pendingCalls.forEach((deferred) => {
                deferred.reject(`Service '${this._serviceName}' stopped`);
            });
        }
    }
}
exports.IpcBusServiceProxyImpl = IpcBusServiceProxyImpl;

},{"../IpcBusUtils":21,"./IpcBusService":37,"./IpcBusServiceUtils":40,"events":8}],40:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceEventChannel = exports.getServiceCallChannel = exports.getServiceNamespace = exports.IPCBUS_SERVICE_REMOVE_LISTENER = exports.IPCBUS_SERVICE_ADD_LISTENER = exports.IPCBUS_SERVICE_CALL_GETSTATUS = exports.IPCBUS_SERVICE_WRAPPER_EVENT = void 0;
const Client = require("../IpcBusClient");
exports.IPCBUS_SERVICE_WRAPPER_EVENT = 'service-wrapper-event';
exports.IPCBUS_SERVICE_CALL_GETSTATUS = '__getServiceStatus';
exports.IPCBUS_SERVICE_ADD_LISTENER = '_addListener';
exports.IPCBUS_SERVICE_REMOVE_LISTENER = '_removeListener';
function getServiceNamespace(serviceName) {
    return `${Client.IPCBUS_CHANNEL}/ipc-service/${serviceName}`;
}
exports.getServiceNamespace = getServiceNamespace;
function getServiceCallChannel(serviceName) {
    return getServiceNamespace(serviceName) + '/call';
}
exports.getServiceCallChannel = getServiceCallChannel;
function getServiceEventChannel(serviceName) {
    return getServiceNamespace(serviceName) + '/event';
}
exports.getServiceEventChannel = getServiceEventChannel;

},{"../IpcBusClient":15}],41:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./electron-common-ipc-common"), exports);
__exportStar(require("./IpcBus/IpcBusClient-factory-browser"), exports);
__exportStar(require("./IpcBus/log/IpcBusLog"), exports);
__exportStar(require("./IpcBus/log/IpcBusLog-factory-browser"), exports);
__exportStar(require("./IpcBus/service/IpcBusService-factory-browser"), exports);
require("./IpcBus/IpcBusClient-factory-browser");
require("./IpcBus/log/IpcBusLog-factory-browser");
require("./IpcBus/service/IpcBusService-factory-browser");
const IpcBusRendererPreload_1 = require("./IpcBus/renderer/IpcBusRendererPreload");
IpcBusRendererPreload_1.PreloadElectronCommonIpcAutomatic();

},{"./IpcBus/IpcBusClient-factory-browser":14,"./IpcBus/log/IpcBusLog":24,"./IpcBus/log/IpcBusLog-factory-browser":22,"./IpcBus/renderer/IpcBusRendererPreload":34,"./IpcBus/service/IpcBusService-factory-browser":35,"./electron-common-ipc-common":42}],42:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivateServiceTrace = exports.ActivateIpcBusTrace = void 0;
__exportStar(require("./IpcBus/IpcBusClient"), exports);
__exportStar(require("./IpcBus/service/IpcBusService"), exports);
__exportStar(require("./IpcBus/service/IpcBusService-factory"), exports);
__exportStar(require("./IpcBus/renderer/IpcBusRendererPreload"), exports);
const IpcBusUtils = require("./IpcBus/IpcBusUtils");
function ActivateIpcBusTrace(enable) {
    IpcBusUtils.Logger.enable = enable;
}
exports.ActivateIpcBusTrace = ActivateIpcBusTrace;
function ActivateServiceTrace(enable) {
    IpcBusUtils.Logger.service = enable;
}
exports.ActivateServiceTrace = ActivateServiceTrace;
require("./IpcBus/service/IpcBusService-factory");

},{"./IpcBus/IpcBusClient":15,"./IpcBus/IpcBusUtils":21,"./IpcBus/renderer/IpcBusRendererPreload":34,"./IpcBus/service/IpcBusService":37,"./IpcBus/service/IpcBusService-factory":36}],43:[function(require,module,exports){
(function (process){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetElectronProcessType = exports.IsProcessElectron = exports.IsContextWorker = exports.IsContextBrowser = exports.IsContextNode = exports.ElectronProcessType = void 0;
const isBrowser = (typeof window === 'object') && (typeof window.document === 'object');
const isWebWorker = (typeof self === 'object') && self.constructor && (self.constructor.name === 'DedicatedWorkerGlobalScope');
const ProcessContextUndefined = 0x00000000;
const ProcessContextNode = 0x00000001;
const ProcessContextBrowser = 0x00000010;
const ProcessContextWorker = 0x00100000;
const ProcessElectron = 0x00010000;
const ProcessElectronMain = 0x00030000;
var ElectronProcessType;
(function (ElectronProcessType) {
    ElectronProcessType[ElectronProcessType["Undefined"] = ProcessContextUndefined] = "Undefined";
    ElectronProcessType[ElectronProcessType["Node"] = ProcessContextNode] = "Node";
    ElectronProcessType[ElectronProcessType["Browser"] = ProcessContextBrowser] = "Browser";
    ElectronProcessType[ElectronProcessType["Worker"] = ProcessContextWorker] = "Worker";
    ElectronProcessType[ElectronProcessType["ElectronNode"] = ProcessContextNode | ProcessElectron] = "ElectronNode";
    ElectronProcessType[ElectronProcessType["ElectronBrowser"] = ProcessContextBrowser | ProcessElectron] = "ElectronBrowser";
    ElectronProcessType[ElectronProcessType["ElectronMainNode"] = ProcessContextNode | ProcessElectronMain] = "ElectronMainNode";
})(ElectronProcessType = exports.ElectronProcessType || (exports.ElectronProcessType = {}));
function IsContextNode() {
    const processContext = GetElectronProcessType();
    return (processContext & ProcessContextNode) === ProcessContextNode;
}
exports.IsContextNode = IsContextNode;
function IsContextBrowser() {
    const processContext = GetElectronProcessType();
    return (processContext & ProcessContextBrowser) === ProcessContextBrowser;
}
exports.IsContextBrowser = IsContextBrowser;
function IsContextWorker() {
    const processContext = GetElectronProcessType();
    return (processContext & ProcessContextWorker) === ProcessContextWorker;
}
exports.IsContextWorker = IsContextWorker;
function IsProcessElectron() {
    const processContext = GetElectronProcessType();
    return (processContext & ProcessElectron) === ProcessElectron;
}
exports.IsProcessElectron = IsProcessElectron;
function GetElectronProcessType() {
    let processContext = ElectronProcessType.Undefined;
    if (isBrowser) {
        processContext = ElectronProcessType.Browser;
        if ((typeof process === 'object') && (process.type === 'renderer')) {
            processContext = ElectronProcessType.ElectronBrowser;
        }
        else if ((typeof navigator === 'object') && (typeof navigator.appVersion === 'string') && (navigator.appVersion.indexOf(' Electron/') >= 0)) {
            processContext = ElectronProcessType.ElectronBrowser;
            try {
                const electron = require('electron');
                if (electron.ipcRenderer) {
                    processContext = ElectronProcessType.ElectronBrowser;
                }
            }
            catch (err) {
            }
        }
    }
    else if (isWebWorker) {
        processContext = ElectronProcessType.Worker;
    }
    else if (typeof process === 'object') {
        processContext = ElectronProcessType.Node;
        if (process.type === 'browser') {
            processContext = ElectronProcessType.ElectronMainNode;
        }
        else {
            if ((typeof process.versions === 'object') && (typeof process.versions.electron === 'string')) {
                processContext = ElectronProcessType.ElectronNode;
            }
            else {
                processContext = process.env['ELECTRON_RUN_AS_NODE'] ? ElectronProcessType.ElectronNode : ElectronProcessType.Node;
            }
        }
    }
    return processContext;
}
exports.GetElectronProcessType = GetElectronProcessType;

}).call(this,require('_process'))
},{"_process":12,"electron":"electron"}],44:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./v2/electron-process-type"), exports);

},{"./v2/electron-process-type":45}],45:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetElectronProcessType = void 0;
const util = require("../electron-process-type-util");
function GetElectronProcessType() {
    const electronProcessType = util.GetElectronProcessType();
    switch (electronProcessType) {
        case util.ElectronProcessType.ElectronMainNode:
            return 'main';
        case util.ElectronProcessType.Node:
        case util.ElectronProcessType.ElectronNode:
            return 'node';
        case util.ElectronProcessType.Browser:
        case util.ElectronProcessType.ElectronBrowser:
            return 'renderer';
        case util.ElectronProcessType.Worker:
            return 'worker';
        case util.ElectronProcessType.Undefined:
        default:
            return 'undefined';
    }
}
exports.GetElectronProcessType = GetElectronProcessType;

},{"../electron-process-type-util":43}],46:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const json_formatter_1 = require("./json-formatter");
exports.dateJSONSupport = new json_formatter_1.JSONFormatter('Date', Date, (t) => t.valueOf(), (data) => new Date(data));
exports.errorJSONSupport = new json_formatter_1.JSONFormatter('Error', Error, (t) => t.message, (data) => new Error(data));
exports.typeErrorJSONSupport = new json_formatter_1.JSONFormatter('TypeError', TypeError, (t) => t.message, (data) => new TypeError(data));
exports.bufferJSONSupport = new json_formatter_1.JSONFormatter('Buffer', Buffer, null, (data) => Buffer.from(data));
exports.bufferJSONSupportBinary = new json_formatter_1.JSONFormatter('Buffer', Buffer, (t) => t.toString('binary'), (data) => Buffer.from(data, 'binary'));

}).call(this,require("buffer").Buffer)
},{"./json-formatter":47,"buffer":7}],47:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class JSONFormatter {
    constructor(objectName, objectConstructor, serialize, unserialize) {
        this.objectName = objectName;
        this.objectConstructor = objectConstructor;
        this.previousToJSON = Object.getOwnPropertyDescriptor(objectConstructor.prototype, 'toJSON');
        this.unserialize = unserialize;
        this.serialize = serialize;
    }
    create(data) {
        return this.unserialize(data);
    }
    install() {
        if (this.serialize) {
            try {
                const self = this;
                Object.defineProperty(this.objectConstructor.prototype, 'toJSON', {
                    value: function () {
                        return { type: self.objectName, data: self.serialize(this) };
                    },
                    configurable: true,
                    enumerable: false,
                    writable: true
                });
            }
            catch (err) {
            }
        }
    }
    uninstall() {
        if (this.serialize) {
            try {
                if (this.previousToJSON) {
                    const self = this;
                    Object.defineProperty(this.objectConstructor.prototype, 'toJSON', self.previousToJSON);
                }
                else {
                    Object.defineProperty(this.objectConstructor.prototype, 'toJSON', {
                        value: function () {
                            return this.toString();
                        },
                        configurable: true,
                        enumerable: false,
                        writable: true
                    });
                }
            }
            catch (err) {
            }
        }
    }
}
exports.JSONFormatter = JSONFormatter;

},{}],48:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tojson_1 = require("./tojson");
var JSONParser;
(function (JSONParser) {
    function stringify(value, replacer, space) {
        const toJSONReplacer = tojson_1.ToJSONReplacer.Get();
        return toJSONReplacer.stringify(value, replacer, space);
    }
    JSONParser.stringify = stringify;
    function parse(text, reviver) {
        const toJSONReviver = tojson_1.ToJSONReviver.Get();
        return toJSONReviver.parse(text, reviver);
    }
    JSONParser.parse = parse;
})(JSONParser = exports.JSONParser || (exports.JSONParser = {}));
var JSONParserV2;
(function (JSONParserV2) {
    function stringify(value, replacer, space) {
        const toJSONReplacer = tojson_1.ToJSONReplacer.GetV2();
        return toJSONReplacer.stringify(value, replacer, space);
    }
    JSONParserV2.stringify = stringify;
    function parse(text, reviver) {
        const toJSONReviver = tojson_1.ToJSONReviver.GetV2();
        return toJSONReviver.parse(text, reviver);
    }
    JSONParserV2.parse = parse;
})(JSONParserV2 = exports.JSONParserV2 || (exports.JSONParserV2 = {}));

},{"./tojson":52}],49:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tojson_1 = require("./tojson");
class ToJSONReplacerImpl {
    constructor(jsonFormattersMap) {
        this._jsonFormattersMap = jsonFormattersMap;
    }
    install() {
        this._jsonFormattersMap.forEach(item => {
            item.install();
        });
    }
    uninstall() {
        this._jsonFormattersMap.forEach(item => {
            item.uninstall();
        });
    }
    replacer(key, value) {
        if (typeof key === 'undefined') {
            return tojson_1.ToJSONConstants.JSON_TOKEN_UNDEFINED;
        }
        return value;
    }
    replacerChain(replacer, key, value) {
        if (typeof key === 'undefined') {
            return tojson_1.ToJSONConstants.JSON_TOKEN_UNDEFINED;
        }
        return replacer(key, value);
    }
    stringify(value, replacer, space) {
        this.install();
        try {
            const replacerCb = replacer ? this.replacerChain.bind(this, replacer) : this.replacer.bind(this);
            const result = JSON.stringify(value, replacerCb, space);
            this.uninstall();
            return result;
        }
        catch (err) {
            this.uninstall();
            throw err;
        }
    }
}
exports.ToJSONReplacerImpl = ToJSONReplacerImpl;
class ToJSONReviverImpl {
    constructor(jsonFormattersMap) {
        this._jsonFormattersMap = jsonFormattersMap;
    }
    reviver(key, value) {
        if (value) {
            if (value === tojson_1.ToJSONConstants.JSON_TOKEN_UNDEFINED) {
                return undefined;
            }
            if ((typeof value.type === 'string') && value.hasOwnProperty('data')) {
                const format = this._jsonFormattersMap.get(value.type);
                if (format) {
                    return format.create(value.data);
                }
            }
        }
        return value;
    }
    reviverChain(reviver, key, value) {
        if (value) {
            if (value === tojson_1.ToJSONConstants.JSON_TOKEN_UNDEFINED) {
                return undefined;
            }
            if ((typeof value.type === 'string') && value.hasOwnProperty('data')) {
                const format = this._jsonFormattersMap.get(value.type);
                if (format) {
                    return format.create(value.data);
                }
            }
        }
        return reviver(key, value);
    }
    parse(text, reviver) {
        const reviverCb = reviver ? this.reviverChain.bind(this, reviver) : this.reviver.bind(this);
        return JSON.parse(text, reviverCb);
    }
}
exports.ToJSONReviverImpl = ToJSONReviverImpl;

},{"./tojson":52}],50:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tojson_1 = require("./tojson");
const tojson_impl_1 = require("./tojson-impl");
const json_formatter_default_1 = require("./json-formatter-default");
const jsonFormattersMap = new Map();
jsonFormattersMap.set(json_formatter_default_1.dateJSONSupport.objectName, json_formatter_default_1.dateJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.errorJSONSupport.objectName, json_formatter_default_1.errorJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.typeErrorJSONSupport.objectName, json_formatter_default_1.typeErrorJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.bufferJSONSupport.objectName, json_formatter_default_1.bufferJSONSupport);
const jsonReplacer = new tojson_impl_1.ToJSONReplacerImpl(jsonFormattersMap);
tojson_1.ToJSONReplacer.Get = tojson_1.ToJSONReplacer.GetV1 = () => {
    return jsonReplacer;
};
const jsonReviver = new tojson_impl_1.ToJSONReviverImpl(jsonFormattersMap);
tojson_1.ToJSONReviver.Get = tojson_1.ToJSONReviver.GetV1 = () => {
    return jsonReviver;
};

},{"./json-formatter-default":46,"./tojson":52,"./tojson-impl":49}],51:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tojson_1 = require("./tojson");
const tojson_impl_1 = require("./tojson-impl");
const json_formatter_default_1 = require("./json-formatter-default");
const jsonFormattersMap = new Map();
jsonFormattersMap.set(json_formatter_default_1.dateJSONSupport.objectName, json_formatter_default_1.dateJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.errorJSONSupport.objectName, json_formatter_default_1.errorJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.typeErrorJSONSupport.objectName, json_formatter_default_1.typeErrorJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.bufferJSONSupportBinary.objectName, json_formatter_default_1.bufferJSONSupportBinary);
const jsonReplacer = new tojson_impl_1.ToJSONReplacerImpl(jsonFormattersMap);
tojson_1.ToJSONReplacer.GetV2 = () => {
    return jsonReplacer;
};
const jsonReviver = new tojson_impl_1.ToJSONReviverImpl(jsonFormattersMap);
tojson_1.ToJSONReviver.GetV2 = () => {
    return jsonReviver;
};

},{"./json-formatter-default":46,"./tojson":52,"./tojson-impl":49}],52:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ToJSONConstants;
(function (ToJSONConstants) {
    ToJSONConstants.JSON_TOKEN_UNDEFINED = '_/undefined/_';
})(ToJSONConstants = exports.ToJSONConstants || (exports.ToJSONConstants = {}));
var ToJSONReplacer;
(function (ToJSONReplacer) {
})(ToJSONReplacer = exports.ToJSONReplacer || (exports.ToJSONReplacer = {}));
var ToJSONReviver;
(function (ToJSONReviver) {
})(ToJSONReviver = exports.ToJSONReviver || (exports.ToJSONReviver = {}));

},{}],53:[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./json-helpers-common"));

},{"./json-helpers-common":54}],54:[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./code/json-parser"));
const v1 = require("./code/tojson-v1");
v1;
const v2 = require("./code/tojson-v2");
v2;

},{"./code/json-parser":48,"./code/tojson-v1":50,"./code/tojson-v2":51}],55:[function(require,module,exports){
// This file replaces `format.js` in bundlers like webpack or Rollup,
// according to `browser` config in `package.json`.

module.exports = function (random, alphabet, size) {
  // We can’t use bytes bigger than the alphabet. To make bytes values closer
  // to the alphabet, we apply bitmask on them. We look for the closest
  // `2 ** x - 1` number, which will be bigger than alphabet size. If we have
  // 30 symbols in the alphabet, we will take 31 (00011111).
  // We do not use faster Math.clz32, because it is not available in browsers.
  var mask = (2 << Math.log(alphabet.length - 1) / Math.LN2) - 1
  // Bitmask is not a perfect solution (in our example it will pass 31 bytes,
  // which is bigger than the alphabet). As a result, we will need more bytes,
  // than ID size, because we will refuse bytes bigger than the alphabet.

  // Every hardware random generator call is costly,
  // because we need to wait for entropy collection. This is why often it will
  // be faster to ask for few extra bytes in advance, to avoid additional calls.

  // Here we calculate how many random bytes should we call in advance.
  // It depends on ID length, mask / alphabet size and magic number 1.6
  // (which was selected according benchmarks).

  // -~f => Math.ceil(f) if n is float number
  // -~i => i + 1 if n is integer number
  var step = -~(1.6 * mask * size / alphabet.length)
  var id = ''

  while (true) {
    var bytes = random(step)
    // Compact alternative for `for (var i = 0; i < step; i++)`
    var i = step
    while (i--) {
      // If random byte is bigger than alphabet even after bitmask,
      // we refuse it by `|| ''`.
      id += alphabet[bytes[i] & mask] || ''
      // More compact than `id.length + 1 === size`
      if (id.length === +size) return id
    }
  }
}

},{}],56:[function(require,module,exports){
'use strict';
module.exports = require('./lib/index');

},{"./lib/index":60}],57:[function(require,module,exports){
'use strict';

var randomFromSeed = require('./random/random-from-seed');

var ORIGINAL = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-';
var alphabet;
var previousSeed;

var shuffled;

function reset() {
    shuffled = false;
}

function setCharacters(_alphabet_) {
    if (!_alphabet_) {
        if (alphabet !== ORIGINAL) {
            alphabet = ORIGINAL;
            reset();
        }
        return;
    }

    if (_alphabet_ === alphabet) {
        return;
    }

    if (_alphabet_.length !== ORIGINAL.length) {
        throw new Error('Custom alphabet for shortid must be ' + ORIGINAL.length + ' unique characters. You submitted ' + _alphabet_.length + ' characters: ' + _alphabet_);
    }

    var unique = _alphabet_.split('').filter(function(item, ind, arr){
       return ind !== arr.lastIndexOf(item);
    });

    if (unique.length) {
        throw new Error('Custom alphabet for shortid must be ' + ORIGINAL.length + ' unique characters. These characters were not unique: ' + unique.join(', '));
    }

    alphabet = _alphabet_;
    reset();
}

function characters(_alphabet_) {
    setCharacters(_alphabet_);
    return alphabet;
}

function setSeed(seed) {
    randomFromSeed.seed(seed);
    if (previousSeed !== seed) {
        reset();
        previousSeed = seed;
    }
}

function shuffle() {
    if (!alphabet) {
        setCharacters(ORIGINAL);
    }

    var sourceArray = alphabet.split('');
    var targetArray = [];
    var r = randomFromSeed.nextValue();
    var characterIndex;

    while (sourceArray.length > 0) {
        r = randomFromSeed.nextValue();
        characterIndex = Math.floor(r * sourceArray.length);
        targetArray.push(sourceArray.splice(characterIndex, 1)[0]);
    }
    return targetArray.join('');
}

function getShuffled() {
    if (shuffled) {
        return shuffled;
    }
    shuffled = shuffle();
    return shuffled;
}

/**
 * lookup shuffled letter
 * @param index
 * @returns {string}
 */
function lookup(index) {
    var alphabetShuffled = getShuffled();
    return alphabetShuffled[index];
}

function get () {
  return alphabet || ORIGINAL;
}

module.exports = {
    get: get,
    characters: characters,
    seed: setSeed,
    lookup: lookup,
    shuffled: getShuffled
};

},{"./random/random-from-seed":63}],58:[function(require,module,exports){
'use strict';

var generate = require('./generate');
var alphabet = require('./alphabet');

// Ignore all milliseconds before a certain time to reduce the size of the date entropy without sacrificing uniqueness.
// This number should be updated every year or so to keep the generated id short.
// To regenerate `new Date() - 0` and bump the version. Always bump the version!
var REDUCE_TIME = 1567752802062;

// don't change unless we change the algos or REDUCE_TIME
// must be an integer and less than 16
var version = 7;

// Counter is used when shortid is called multiple times in one second.
var counter;

// Remember the last time shortid was called in case counter is needed.
var previousSeconds;

/**
 * Generate unique id
 * Returns string id
 */
function build(clusterWorkerId) {
    var str = '';

    var seconds = Math.floor((Date.now() - REDUCE_TIME) * 0.001);

    if (seconds === previousSeconds) {
        counter++;
    } else {
        counter = 0;
        previousSeconds = seconds;
    }

    str = str + generate(version);
    str = str + generate(clusterWorkerId);
    if (counter > 0) {
        str = str + generate(counter);
    }
    str = str + generate(seconds);
    return str;
}

module.exports = build;

},{"./alphabet":57,"./generate":59}],59:[function(require,module,exports){
'use strict';

var alphabet = require('./alphabet');
var random = require('./random/random-byte');
var format = require('nanoid/format');

function generate(number) {
    var loopCounter = 0;
    var done;

    var str = '';

    while (!done) {
        str = str + format(random, alphabet.get(), 1);
        done = number < (Math.pow(16, loopCounter + 1 ) );
        loopCounter++;
    }
    return str;
}

module.exports = generate;

},{"./alphabet":57,"./random/random-byte":62,"nanoid/format":55}],60:[function(require,module,exports){
'use strict';

var alphabet = require('./alphabet');
var build = require('./build');
var isValid = require('./is-valid');

// if you are using cluster or multiple servers use this to make each instance
// has a unique value for worker
// Note: I don't know if this is automatically set when using third
// party cluster solutions such as pm2.
var clusterWorkerId = require('./util/cluster-worker-id') || 0;

/**
 * Set the seed.
 * Highly recommended if you don't want people to try to figure out your id schema.
 * exposed as shortid.seed(int)
 * @param seed Integer value to seed the random alphabet.  ALWAYS USE THE SAME SEED or you might get overlaps.
 */
function seed(seedValue) {
    alphabet.seed(seedValue);
    return module.exports;
}

/**
 * Set the cluster worker or machine id
 * exposed as shortid.worker(int)
 * @param workerId worker must be positive integer.  Number less than 16 is recommended.
 * returns shortid module so it can be chained.
 */
function worker(workerId) {
    clusterWorkerId = workerId;
    return module.exports;
}

/**
 *
 * sets new characters to use in the alphabet
 * returns the shuffled alphabet
 */
function characters(newCharacters) {
    if (newCharacters !== undefined) {
        alphabet.characters(newCharacters);
    }

    return alphabet.shuffled();
}

/**
 * Generate unique id
 * Returns string id
 */
function generate() {
  return build(clusterWorkerId);
}

// Export all other functions as properties of the generate function
module.exports = generate;
module.exports.generate = generate;
module.exports.seed = seed;
module.exports.worker = worker;
module.exports.characters = characters;
module.exports.isValid = isValid;

},{"./alphabet":57,"./build":58,"./is-valid":61,"./util/cluster-worker-id":64}],61:[function(require,module,exports){
'use strict';
var alphabet = require('./alphabet');

function isShortId(id) {
    if (!id || typeof id !== 'string' || id.length < 6 ) {
        return false;
    }

    var nonAlphabetic = new RegExp('[^' +
      alphabet.get().replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&') +
    ']');
    return !nonAlphabetic.test(id);
}

module.exports = isShortId;

},{"./alphabet":57}],62:[function(require,module,exports){
'use strict';

var crypto = typeof window === 'object' && (window.crypto || window.msCrypto); // IE 11 uses window.msCrypto

var randomByte;

if (!crypto || !crypto.getRandomValues) {
    randomByte = function(size) {
        var bytes = [];
        for (var i = 0; i < size; i++) {
            bytes.push(Math.floor(Math.random() * 256));
        }
        return bytes;
    };
} else {
    randomByte = function(size) {
        return crypto.getRandomValues(new Uint8Array(size));
    };
}

module.exports = randomByte;

},{}],63:[function(require,module,exports){
'use strict';

// Found this seed-based random generator somewhere
// Based on The Central Randomizer 1.3 (C) 1997 by Paul Houle (houle@msc.cornell.edu)

var seed = 1;

/**
 * return a random number based on a seed
 * @param seed
 * @returns {number}
 */
function getNextValue() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed/(233280.0);
}

function setSeed(_seed_) {
    seed = _seed_;
}

module.exports = {
    nextValue: getNextValue,
    seed: setSeed
};

},{}],64:[function(require,module,exports){
'use strict';

module.exports = 0;

},{}],65:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferListReader = void 0;
const buffer_1 = require("buffer");
const reader_1 = require("./reader");
class BufferListReader extends reader_1.ReaderBase {
    constructor(buffers, offset) {
        super(0);
        this._contexts = [];
        this._buffers = buffers || [];
        this._length = this._buffers.reduce((sum, buffer) => sum + buffer.length, 0);
        this._curOffset = 0;
        this._curBufferIndex = 0;
        this.seek(offset || 0);
    }
    reset() {
        super.reset();
        this._contexts = [];
        this._buffers = [];
        this._length = 0;
        this._curOffset = 0;
        this._curBufferIndex = 0;
    }
    appendBuffer(buffer) {
        this._buffers.push(buffer);
        this._length += buffer.length;
    }
    get length() {
        return this._length;
    }
    pushd() {
        return this._contexts.push({ offset: this._offset, curOffset: this._curOffset, curBufferIndex: this._curBufferIndex });
    }
    popd() {
        const context = this._contexts.pop();
        if (!context.rebuild) {
            this._offset = context.offset;
            this._curBufferIndex = context.curBufferIndex;
            this._curOffset = context.curOffset;
        }
        else {
            if (context.offset < (this._length >> 1)) {
                this._offset = 0;
                this._curBufferIndex = 0;
                this._curOffset = 0;
            }
            else {
                this._offset = this._length - 1;
                this._curBufferIndex = this._buffers.length - 1;
                this._curOffset = this._buffers[this._curBufferIndex].length - 1;
            }
            this.seek(context.offset);
        }
        return this._contexts.length;
    }
    seek(offset) {
        if (this._offset !== offset) {
            let curBuffer = this._buffers[this._curBufferIndex];
            this._curOffset += (offset - this._offset);
            this._offset = offset;
            while (this._curOffset >= curBuffer.length) {
                if (this._curBufferIndex >= this._buffers.length - 1) {
                    if (!this._noAssert) {
                        throw new RangeError('Index out of range');
                    }
                    return false;
                }
                this._curOffset -= curBuffer.length;
                ++this._curBufferIndex;
                curBuffer = this._buffers[this._curBufferIndex];
            }
            while (this._curOffset < 0) {
                if (this._curBufferIndex <= 0) {
                    if (!this._noAssert) {
                        throw new RangeError('Index out of range');
                    }
                    return false;
                }
                --this._curBufferIndex;
                curBuffer = this._buffers[this._curBufferIndex];
                this._curOffset += curBuffer.length;
            }
        }
        return this.checkEOF();
    }
    reduce() {
        if (this.checkEOF(1)) {
            this.reset();
        }
        else {
            if (this._curBufferIndex > 0) {
                this._buffers.splice(0, this._curBufferIndex);
                this._length -= (this._offset - this._curOffset);
                this._offset = this._curOffset;
                this._curBufferIndex = 0;
            }
            if (this._buffers.length >= 0) {
                const curBuffer = this._buffers[0];
                if ((curBuffer.length > BufferListReader.ReduceThreshold) && (this._curOffset > (curBuffer.length >> 1))) {
                    const newBuffer = buffer_1.Buffer.allocUnsafe(curBuffer.length - this._curOffset);
                    curBuffer.copy(newBuffer, 0, this._curOffset);
                    this._buffers[0] = newBuffer;
                    this._length -= this._curOffset;
                    this._offset -= this._curOffset;
                    this._curOffset = 0;
                }
            }
        }
    }
    _consolidate(len) {
        let curBuffer = this._buffers[this._curBufferIndex];
        let newOffset = this._curOffset + len;
        if (newOffset > curBuffer.length) {
            let bufferLength = 0;
            const buffers = [];
            for (let endBufferIndex = this._curBufferIndex, l = this._buffers.length; endBufferIndex < l; ++endBufferIndex) {
                buffers.push(this._buffers[endBufferIndex]);
                bufferLength += this._buffers[endBufferIndex].length;
                if (newOffset <= bufferLength) {
                    break;
                }
            }
            curBuffer = this._buffers[this._curBufferIndex] = buffer_1.Buffer.concat(buffers, bufferLength);
            this._buffers.splice(this._curBufferIndex + 1, buffers.length - 1);
            if (!this._noAssert && (newOffset > curBuffer.length)) {
            }
            let index = this._contexts.length;
            while (index) {
                const context = this._contexts[--index];
                context.rebuild = context.rebuild || (context.curBufferIndex > this._curBufferIndex);
            }
        }
        else if (newOffset === curBuffer.length) {
            ++this._curBufferIndex;
            newOffset = 0;
        }
        this._offset += len;
        this._curOffset = newOffset;
        return curBuffer;
    }
    _readNumber(bufferFunction, byteSize) {
        const start = this._curOffset;
        const currBuffer = this._consolidate(byteSize);
        return bufferFunction.call(currBuffer, start, this._noAssert);
    }
    readByte() {
        return this._readNumber(buffer_1.Buffer.prototype.readUInt8, 1);
    }
    readUInt16() {
        return this._readNumber(buffer_1.Buffer.prototype.readUInt16LE, 2);
    }
    readUInt32() {
        return this._readNumber(buffer_1.Buffer.prototype.readUInt32LE, 4);
    }
    readDouble() {
        return this._readNumber(buffer_1.Buffer.prototype.readDoubleLE, 8);
    }
    readString(encoding, len) {
        const end = reader_1.Reader.AdjustEnd(this._offset, this._length, len);
        if (this._offset === end) {
            return '';
        }
        else {
            const start = this._curOffset;
            len = end - this._offset;
            const currBuffer = this._consolidate(len);
            return currBuffer.toString(encoding, start, end);
        }
    }
    subarray(len) {
        const end = reader_1.Reader.AdjustEnd(this._offset, this._length, len);
        if (this._offset === end) {
            return buffer_1.Buffer.alloc(0);
        }
        else {
            const start = this._curOffset;
            len = end - this._offset;
            const currBuffer = this._consolidate(len);
            if ((start === 0) && (len === currBuffer.length)) {
                return currBuffer;
            }
            else {
                return buffer_1.Buffer.from(currBuffer.buffer, currBuffer.byteOffset + start, len);
            }
        }
    }
    slice(len) {
        const end = reader_1.Reader.AdjustEnd(this._offset, this._length, len);
        if (this._offset === end) {
            return buffer_1.Buffer.alloc(0);
        }
        else {
            const start = this._curOffset;
            len = end - this._offset;
            const currBuffer = this._consolidate(len);
            if ((start === 0) && (len === currBuffer.length)) {
                return currBuffer;
            }
            else {
                return currBuffer.slice(start, end);
            }
        }
    }
}
exports.BufferListReader = BufferListReader;
BufferListReader.ReduceThreshold = 100000;

},{"./reader":72,"buffer":7}],66:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferListWriter = exports.BufferListWriterBase = void 0;
const buffer_1 = require("buffer");
const writer_1 = require("./writer");
class BufferListWriterBase extends writer_1.WriterBase {
    constructor() {
        super();
        this._length = 0;
    }
    reset() {
        this._length = 0;
    }
    get length() {
        return this._length;
    }
    writeBytes(dataArray) {
        const uint8Array = new Uint8Array(dataArray);
        const buffer = buffer_1.Buffer.from(uint8Array.buffer);
        return this._appendBuffer(buffer.length, buffer);
    }
    _writeNumber(bufferFunction, data, byteSize) {
        const buffer = buffer_1.Buffer.allocUnsafe(byteSize);
        bufferFunction.call(buffer, data, 0, this._noAssert);
        return this._appendBuffer(byteSize, buffer);
    }
    writeByte(data) {
        return this._writeNumber(buffer_1.Buffer.prototype.writeUInt8, data, 1);
    }
    writeUInt16(data) {
        return this._writeNumber(buffer_1.Buffer.prototype.writeUInt16LE, data, 2);
    }
    writeUInt32(data) {
        return this._writeNumber(buffer_1.Buffer.prototype.writeUInt32LE, data, 4);
    }
    writeDouble(data) {
        return this._writeNumber(buffer_1.Buffer.prototype.writeDoubleLE, data, 8);
    }
    writeString(data, encoding, len) {
        if (len != null) {
            data = data.substring(0, len);
        }
        const buffer = buffer_1.Buffer.from(data, encoding);
        return this._appendBuffer(buffer.length, buffer);
    }
    writeBuffer(buffer, sourceStart, sourceEnd) {
        if ((sourceStart != null) || (sourceEnd != null)) {
            buffer = buffer.slice(sourceStart, sourceEnd);
        }
        return this._appendBuffer(buffer.length, buffer);
    }
    write(writer) {
        return this._appendBuffers(writer.length, writer.buffers);
    }
    pushContext() {
    }
    popContext() {
    }
}
exports.BufferListWriterBase = BufferListWriterBase;
class BufferListWriter extends BufferListWriterBase {
    constructor() {
        super();
        this._buffers = [];
    }
    reset() {
        super.reset();
        this._buffers = [];
    }
    get buffer() {
        if (this._buffers.length === 0) {
            return buffer_1.Buffer.allocUnsafe(0);
        }
        if (this._buffers.length > 1) {
            this._buffers = [buffer_1.Buffer.concat(this._buffers, this._length)];
        }
        return this._buffers[0];
    }
    get buffers() {
        return this._buffers;
    }
    _appendBuffer(length, buffer) {
        this._buffers.push(buffer);
        this._length += length;
        return this._length;
    }
    _appendBuffers(length, buffers) {
        this._buffers = this._buffers.concat(buffers);
        this._length += length;
        return this._length;
    }
}
exports.BufferListWriter = BufferListWriter;

},{"./writer":73,"buffer":7}],67:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferReader = void 0;
const reader_1 = require("./reader");
class BufferReader extends reader_1.ReaderBase {
    constructor(buffer, offset) {
        super(offset);
        this._buffer = buffer;
        this._contexts = [];
    }
    reset() {
        super.reset();
        this._buffer = reader_1.ReaderBase.EmptyBuffer;
        this._contexts = [];
    }
    get length() {
        return this._buffer.length;
    }
    pushd() {
        return this._contexts.push(this._offset);
    }
    popd() {
        this._offset = this._contexts.pop();
        return this._contexts.length;
    }
    seek(offset) {
        this._offset = offset;
        return this.checkEOF();
    }
    _readNumber(bufferFunction, byteSize) {
        const start = this._offset;
        this._offset += byteSize;
        return bufferFunction.call(this._buffer, start, this._noAssert);
    }
    readByte() {
        return this._readNumber(Buffer.prototype.readUInt8, 1);
    }
    readUInt16() {
        return this._readNumber(Buffer.prototype.readUInt16LE, 2);
    }
    readUInt32() {
        return this._readNumber(Buffer.prototype.readUInt32LE, 4);
    }
    readDouble() {
        return this._readNumber(Buffer.prototype.readDoubleLE, 8);
    }
    readString(encoding, len) {
        const end = reader_1.Reader.AdjustEnd(this._offset, this._buffer.length, len);
        if (this._offset === end) {
            return '';
        }
        else {
            const start = this._offset;
            this._offset = end;
            return this._buffer.toString(encoding, start, end);
        }
    }
    slice(len) {
        const end = reader_1.Reader.AdjustEnd(this._offset, this._buffer.length, len);
        if (this._offset === end) {
            return Buffer.allocUnsafe(0);
        }
        else {
            const start = this._offset;
            len = end - this._offset;
            this._offset = end;
            if ((start === 0) && (len === this._buffer.length)) {
                return this._buffer;
            }
            else {
                return this._buffer.slice(start, end);
            }
        }
    }
    subarray(len) {
        const end = reader_1.Reader.AdjustEnd(this._offset, this._buffer.length, len);
        if (this._offset === end) {
            return Buffer.alloc(0);
        }
        else {
            const start = this._offset;
            len = end - this._offset;
            this._offset = end;
            return Buffer.from(this._buffer, this._buffer.byteOffset + start, len);
        }
    }
    reduce() {
    }
}
exports.BufferReader = BufferReader;

}).call(this,require("buffer").Buffer)
},{"./reader":72,"buffer":7}],68:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferWriter = void 0;
const writer_1 = require("./writer");
class BufferWriter extends writer_1.WriterBase {
    constructor(buffer, offset) {
        super();
        this._buffer = buffer;
        this._offset = offset || 0;
    }
    reset() {
        this._buffer = writer_1.WriterBase.EmptyBuffer;
        this._offset = 0;
    }
    get buffer() {
        return this._buffer;
    }
    get buffers() {
        return [this._buffer];
    }
    get length() {
        return this._buffer.length;
    }
    get offset() {
        return this._offset;
    }
    writeBytes(dataArray) {
        for (let i = 0, l = dataArray.length; i < l; ++i) {
            this._writeNumber(Buffer.prototype.writeUInt8, dataArray[i], 1);
        }
        return this._offset;
    }
    _writeNumber(bufferFunction, data, byteSize) {
        this._offset = bufferFunction.call(this._buffer, data, this._offset, this._noAssert);
        return this._offset;
    }
    writeByte(data) {
        return this._writeNumber(Buffer.prototype.writeUInt8, data, 1);
    }
    writeUInt16(data) {
        return this._writeNumber(Buffer.prototype.writeUInt16LE, data, 2);
    }
    writeUInt32(data) {
        return this._writeNumber(Buffer.prototype.writeUInt32LE, data, 4);
    }
    writeDouble(data) {
        return this._writeNumber(Buffer.prototype.writeDoubleLE, data, 8);
    }
    writeString(data, encoding, len) {
        this._offset += this._buffer.write(data, this._offset, len, encoding);
        return this._offset;
    }
    writeBuffer(data, sourceStart, sourceEnd) {
        this._offset += data.copy(this._buffer, this._offset, sourceStart, sourceEnd);
        return this._offset;
    }
    write(writer) {
        const buffers = writer.buffers;
        for (let i = 0, l = buffers.length; i < l; ++i) {
            this.writeBuffer(buffers[i]);
        }
        return this._offset;
    }
    pushContext() {
    }
    popContext() {
    }
}
exports.BufferWriter = BufferWriter;

}).call(this,require("buffer").Buffer)
},{"./writer":73,"buffer":7}],69:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcPacketParser = exports.IpcPacketSerializer = void 0;
const ipcPacketBufferWrap_1 = require("./ipcPacketBufferWrap");
const bufferListWriter_1 = require("./bufferListWriter");
const bufferReader_1 = require("./bufferReader");
class IpcPacketSerializer {
    constructor() {
        this._writer = new bufferListWriter_1.BufferListWriter();
        this._packet = new ipcPacketBufferWrap_1.IpcPacketBufferWrap();
    }
    serialize(data) {
        this._packet.write(this._writer, data);
        return this;
    }
    get buffer() {
        return this._writer.buffer;
    }
    get buffers() {
        return this._writer.buffers;
    }
}
exports.IpcPacketSerializer = IpcPacketSerializer;
;
class IpcPacketParser {
    constructor(buffer) {
        this._reader = new bufferReader_1.BufferReader(buffer);
        this._packet = new ipcPacketBufferWrap_1.IpcPacketBufferWrap();
    }
    parse() {
        return this._packet.read(this._reader);
    }
}
exports.IpcPacketParser = IpcPacketParser;

},{"./bufferListWriter":66,"./bufferReader":67,"./ipcPacketBufferWrap":71}],70:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcPacketBuffer = void 0;
const ipcPacketBufferWrap_1 = require("./ipcPacketBufferWrap");
const bufferReader_1 = require("./bufferReader");
const bufferListWriter_1 = require("./bufferListWriter");
class IpcPacketBuffer extends ipcPacketBufferWrap_1.IpcPacketBufferWrap {
    constructor(rawContent) {
        super(rawContent);
        if (rawContent) {
            this._buffer = rawContent.buffer;
        }
    }
    reset() {
        super.reset();
        this._buffer = null;
    }
    get buffer() {
        return this._buffer;
    }
    setRawContent(rawContent) {
        super.setRawContent(rawContent);
        this._buffer = rawContent.buffer;
    }
    getRawContent() {
        const rawContent = {
            type: this._type,
            contentSize: this._contentSize,
            buffer: this._buffer
        };
        return rawContent;
    }
    keepDecodingFromReader(bufferReader) {
        if ((this._type === ipcPacketBufferWrap_1.BufferType.Partial) && (this._contentSize >= 0)) {
            const packetSize = this.packetSize;
            if (bufferReader.checkEOF(packetSize)) {
                this._buffer = bufferReader.subarray(packetSize);
                return true;
            }
            else {
                this._buffer = null;
                return false;
            }
        }
        return this.decodeFromReader(bufferReader);
    }
    decodeFromReader(bufferReader) {
        bufferReader.pushd();
        const result = this._readHeader(bufferReader);
        bufferReader.popd();
        if (result) {
            this._buffer = bufferReader.subarray(this.packetSize);
        }
        else {
            this._buffer = null;
        }
        return result;
    }
    decodeFromBuffer(buffer) {
        const result = this._readHeader(new bufferReader_1.BufferReader(buffer));
        if (result) {
            this._buffer = buffer;
        }
        else {
            this._buffer = null;
        }
        return result;
    }
    _serializeAndCheck(checker, data) {
        const bufferWriter = new bufferListWriter_1.BufferListWriter();
        this.write(bufferWriter, data);
        this._buffer = bufferWriter.buffer;
        return checker.call(this);
    }
    serializeNumber(dataNumber) {
        return this._serializeAndCheck(this.isNumber, dataNumber);
    }
    serializeBoolean(dataBoolean) {
        return this._serializeAndCheck(this.isBoolean, dataBoolean);
    }
    serializeDate(dataDate) {
        return this._serializeAndCheck(this.isDate, dataDate);
    }
    serializeString(data, encoding) {
        const bufferWriter = new bufferListWriter_1.BufferListWriter();
        this.writeString(bufferWriter, data, encoding);
        this._buffer = bufferWriter.buffer;
        return this.isString();
    }
    serializeObject(dataObject) {
        return this._serializeAndCheck(this.isObject, dataObject);
    }
    serializeBuffer(dataBuffer) {
        return this._serializeAndCheck(this.isBuffer, dataBuffer);
    }
    serializeArray(args) {
        return this._serializeAndCheck(this.isArray, args);
    }
    serialize(data) {
        return this._serializeAndCheck(this.isComplete, data);
    }
    _parseAndCheck(checker) {
        if (checker.call(this)) {
            const bufferReader = new bufferReader_1.BufferReader(this._buffer, this._headerSize);
            return this._readContent(0, bufferReader);
        }
        return null;
    }
    parse() {
        return this._parseAndCheck(this.isComplete);
    }
    parseBoolean() {
        return this._parseAndCheck(this.isBoolean);
    }
    parseNumber() {
        return this._parseAndCheck(this.isNumber);
    }
    parseDate() {
        return this._parseAndCheck(this.isDate);
    }
    parseObject() {
        return this._parseAndCheck(this.isObject);
    }
    parseBuffer() {
        return this._parseAndCheck(this.isBuffer);
    }
    parseArray() {
        return this._parseAndCheck(this.isArray);
    }
    parseString() {
        return this._parseAndCheck(this.isString);
    }
    parseArrayLength() {
        if (this.isArray()) {
            const bufferReader = new bufferReader_1.BufferReader(this._buffer, this._headerSize);
            return this._readArrayLength(bufferReader);
        }
        return null;
    }
    parseArrayAt(index) {
        if (this.isArray()) {
            const bufferReader = new bufferReader_1.BufferReader(this._buffer, this._headerSize);
            return this._readArrayAt(bufferReader, index);
        }
        return null;
    }
    parseArraySlice(start, end) {
        if (this.isArray()) {
            const bufferReader = new bufferReader_1.BufferReader(this._buffer, this._headerSize);
            return this._readArraySlice(bufferReader, start, end);
        }
        return null;
    }
}
exports.IpcPacketBuffer = IpcPacketBuffer;

},{"./bufferListWriter":66,"./bufferReader":67,"./ipcPacketBufferWrap":71}],71:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcPacketBufferWrap = exports.BufferType = void 0;
const bufferListWriter_1 = require("./bufferListWriter");
const bufferWriter_1 = require("./bufferWriter");
const json_helpers_1 = require("json-helpers");
const headerSeparator = '['.charCodeAt(0);
const footerSeparator = ']'.charCodeAt(0);
const FooterLength = 1;
const FixedHeaderSize = 2;
const PacketSizeHeader = 4;
const DynamicHeaderSize = FixedHeaderSize + PacketSizeHeader;
function BufferTypeHeader(type) {
    return (type.charCodeAt(0) << 8) + headerSeparator;
}
var BufferType;
(function (BufferType) {
    BufferType[BufferType["NotValid"] = BufferTypeHeader('X')] = "NotValid";
    BufferType[BufferType["Partial"] = BufferTypeHeader('P')] = "Partial";
    BufferType[BufferType["String"] = BufferTypeHeader('s')] = "String";
    BufferType[BufferType["Buffer"] = BufferTypeHeader('B')] = "Buffer";
    BufferType[BufferType["BooleanTrue"] = BufferTypeHeader('T')] = "BooleanTrue";
    BufferType[BufferType["BooleanFalse"] = BufferTypeHeader('F')] = "BooleanFalse";
    BufferType[BufferType["ArrayWithSize"] = BufferTypeHeader('A')] = "ArrayWithSize";
    BufferType[BufferType["PositiveInteger"] = BufferTypeHeader('+')] = "PositiveInteger";
    BufferType[BufferType["NegativeInteger"] = BufferTypeHeader('-')] = "NegativeInteger";
    BufferType[BufferType["Double"] = BufferTypeHeader('d')] = "Double";
    BufferType[BufferType["Object"] = BufferTypeHeader('O')] = "Object";
    BufferType[BufferType["ObjectSTRINGIFY"] = BufferTypeHeader('o')] = "ObjectSTRINGIFY";
    BufferType[BufferType["Null"] = BufferTypeHeader('N')] = "Null";
    BufferType[BufferType["Undefined"] = BufferTypeHeader('U')] = "Undefined";
    BufferType[BufferType["Date"] = BufferTypeHeader('D')] = "Date";
})(BufferType = exports.BufferType || (exports.BufferType = {}));
;
class IpcPacketBufferWrap {
    constructor(rawContent) {
        this.writeArray = this.writeArrayWithSize;
        this.writeObject = this.writeObjectSTRINGIFY2;
        if (rawContent) {
            this.setTypeAndContentSize(rawContent.type, rawContent.contentSize);
        }
        else {
            this.setTypeAndContentSize(BufferType.NotValid, -1);
        }
    }
    reset() {
        this._type = BufferType.NotValid;
        this._contentSize = -1;
    }
    setRawContent(rawContent) {
        this.setTypeAndContentSize(rawContent.type, rawContent.contentSize);
    }
    getRawContent() {
        const rawContent = {
            type: this._type,
            contentSize: this._contentSize,
        };
        return rawContent;
    }
    get type() {
        return this._type;
    }
    get packetSize() {
        return this._contentSize + (this._headerSize + FooterLength);
    }
    get contentSize() {
        return this._contentSize;
    }
    get footerSize() {
        return FooterLength;
    }
    get headerSize() {
        return this._headerSize;
    }
    setTypeAndContentSize(bufferType, contentSize) {
        this._type = bufferType;
        switch (bufferType) {
            case BufferType.Date:
            case BufferType.Double:
                this._headerSize = FixedHeaderSize;
                this._contentSize = 8;
                break;
            case BufferType.NegativeInteger:
            case BufferType.PositiveInteger:
                this._headerSize = FixedHeaderSize;
                this._contentSize = 4;
                break;
            case BufferType.BooleanTrue:
            case BufferType.BooleanFalse:
            case BufferType.Null:
            case BufferType.Undefined:
                this._headerSize = FixedHeaderSize;
                this._contentSize = 0;
                break;
            case BufferType.Object:
            case BufferType.ObjectSTRINGIFY:
            case BufferType.String:
            case BufferType.Buffer:
            case BufferType.ArrayWithSize:
                this._headerSize = DynamicHeaderSize;
                this._contentSize = contentSize;
                break;
            default:
                this._type = BufferType.NotValid;
                this._contentSize = -1;
                break;
        }
    }
    setPacketSize(packetSize) {
        this._contentSize = packetSize - (this._headerSize + FooterLength);
    }
    isNotValid() {
        return (this._type === BufferType.NotValid);
    }
    isPartial() {
        return (this._type === BufferType.Partial);
    }
    isComplete() {
        return (this._type !== BufferType.NotValid) && (this._type !== BufferType.Partial);
    }
    isNull() {
        return (this._type === BufferType.Null);
    }
    isUndefined() {
        return (this._type === BufferType.Undefined);
    }
    isArray() {
        return (this._type === BufferType.ArrayWithSize);
    }
    isObject() {
        switch (this._type) {
            case BufferType.Object:
            case BufferType.ObjectSTRINGIFY:
                return true;
            default:
                return false;
        }
    }
    isString() {
        return (this._type === BufferType.String);
    }
    isBuffer() {
        return (this._type === BufferType.Buffer);
    }
    isDate() {
        return (this._type === BufferType.Date);
    }
    isNumber() {
        switch (this._type) {
            case BufferType.NegativeInteger:
            case BufferType.PositiveInteger:
            case BufferType.Double:
                return true;
            default:
                return false;
        }
    }
    isBoolean() {
        switch (this._type) {
            case BufferType.BooleanTrue:
            case BufferType.BooleanFalse:
                return true;
            default:
                return false;
        }
    }
    isFixedSize() {
        return (this._headerSize === FixedHeaderSize);
    }
    _skipHeader(bufferReader) {
        return bufferReader.skip(this._headerSize);
    }
    _readHeader(bufferReader) {
        if (bufferReader.checkEOF(FixedHeaderSize)) {
            this._type = BufferType.Partial;
            return false;
        }
        this.setTypeAndContentSize(bufferReader.readUInt16(), -1);
        if (this._type === BufferType.NotValid) {
            return false;
        }
        if (this._headerSize === DynamicHeaderSize) {
            if (bufferReader.checkEOF(PacketSizeHeader)) {
                this._type = BufferType.Partial;
                return false;
            }
            this.setPacketSize(bufferReader.readUInt32());
        }
        if (bufferReader.checkEOF(this._contentSize + this.footerSize)) {
            this._type = BufferType.Partial;
            return false;
        }
        return true;
    }
    writeFooter(bufferWriter) {
        bufferWriter.writeByte(footerSeparator);
        bufferWriter.popContext();
    }
    writeDynamicSizeHeader(bufferWriter, bufferType, contentSize) {
        bufferWriter.pushContext();
        this.setTypeAndContentSize(bufferType, contentSize);
        bufferWriter.writeUInt16(this._type);
        bufferWriter.writeUInt32(this.packetSize);
    }
    writeFixedSize(bufferWriter, bufferType, num) {
        bufferWriter.pushContext();
        this.setTypeAndContentSize(bufferType, -1);
        const bufferWriteAllInOne = new bufferWriter_1.BufferWriter(Buffer.allocUnsafe(this.packetSize));
        bufferWriteAllInOne.writeUInt16(this._type);
        switch (bufferType) {
            case BufferType.NegativeInteger:
            case BufferType.PositiveInteger:
                bufferWriteAllInOne.writeUInt32(num);
                break;
            case BufferType.Double:
            case BufferType.Date:
                bufferWriteAllInOne.writeDouble(num);
                break;
        }
        bufferWriteAllInOne.writeByte(footerSeparator);
        bufferWriter.writeBuffer(bufferWriteAllInOne.buffer);
        bufferWriter.popContext();
    }
    write(bufferWriter, data) {
        switch (typeof data) {
            case 'object':
                if (Buffer.isBuffer(data)) {
                    this.writeBuffer(bufferWriter, data);
                }
                else if (Array.isArray(data)) {
                    this.writeArray(bufferWriter, data);
                }
                else if (data instanceof Date) {
                    this.writeDate(bufferWriter, data);
                }
                else {
                    this.writeObject(bufferWriter, data);
                }
                break;
            case 'string':
                this.writeString(bufferWriter, data);
                break;
            case 'number':
                this.writeNumber(bufferWriter, data);
                break;
            case 'boolean':
                this.writeBoolean(bufferWriter, data);
                break;
            case 'undefined':
                this.writeFixedSize(bufferWriter, BufferType.Undefined);
                break;
            case 'symbol':
            default:
                break;
        }
    }
    writeBoolean(bufferWriter, dataBoolean) {
        this.writeFixedSize(bufferWriter, dataBoolean ? BufferType.BooleanTrue : BufferType.BooleanFalse);
    }
    writeNumber(bufferWriter, dataNumber) {
        if (Number.isInteger(dataNumber)) {
            const absDataNumber = Math.abs(dataNumber);
            if (absDataNumber <= 0xFFFFFFFF) {
                if (dataNumber < 0) {
                    this.writeFixedSize(bufferWriter, BufferType.NegativeInteger, absDataNumber);
                }
                else {
                    this.writeFixedSize(bufferWriter, BufferType.PositiveInteger, absDataNumber);
                }
                return;
            }
        }
        this.writeFixedSize(bufferWriter, BufferType.Double, dataNumber);
    }
    writeDate(bufferWriter, data) {
        const t = data.getTime();
        this.writeFixedSize(bufferWriter, BufferType.Date, t);
    }
    writeString(bufferWriter, data, encoding) {
        const buffer = Buffer.from(data, 'utf8');
        this.writeDynamicSizeHeader(bufferWriter, BufferType.String, buffer.length);
        bufferWriter.writeBuffer(buffer);
        this.writeFooter(bufferWriter);
    }
    writeBuffer(bufferWriter, buffer) {
        this.writeDynamicSizeHeader(bufferWriter, BufferType.Buffer, buffer.length);
        bufferWriter.writeBuffer(buffer);
        this.writeFooter(bufferWriter);
    }
    writeObjectDirect1(bufferWriter, dataObject) {
        if (dataObject === null) {
            this.writeFixedSize(bufferWriter, BufferType.Null);
        }
        else {
            const contentBufferWriter = new bufferListWriter_1.BufferListWriter();
            for (let [key, value] of Object.entries(dataObject)) {
                const buffer = Buffer.from(key, 'utf8');
                contentBufferWriter.writeUInt32(buffer.length);
                contentBufferWriter.writeBuffer(buffer);
                this.write(contentBufferWriter, value);
            }
            this.writeDynamicSizeHeader(bufferWriter, BufferType.Object, contentBufferWriter.length);
            bufferWriter.write(contentBufferWriter);
            this.writeFooter(bufferWriter);
        }
    }
    writeObjectDirect2(bufferWriter, dataObject) {
        if (dataObject === null) {
            this.writeFixedSize(bufferWriter, BufferType.Null);
        }
        else {
            const contentBufferWriter = new bufferListWriter_1.BufferListWriter();
            const keys = Object.keys(dataObject);
            for (let i = 0, l = keys.length; i < l; ++i) {
                const key = keys[i];
                const desc = Object.getOwnPropertyDescriptor(dataObject, key);
                if (desc && (typeof desc.value !== 'function')) {
                    const buffer = Buffer.from(key, 'utf8');
                    contentBufferWriter.writeUInt32(buffer.length);
                    contentBufferWriter.writeBuffer(buffer);
                    this.write(contentBufferWriter, desc.value);
                }
            }
            this.writeDynamicSizeHeader(bufferWriter, BufferType.Object, contentBufferWriter.length);
            bufferWriter.write(contentBufferWriter);
            this.writeFooter(bufferWriter);
        }
    }
    writeObjectSTRINGIFY1(bufferWriter, dataObject) {
        if (dataObject === null) {
            this.writeFixedSize(bufferWriter, BufferType.Null);
        }
        else {
            const stringifycation = JSON.stringify(dataObject);
            const buffer = Buffer.from(stringifycation);
            this.writeDynamicSizeHeader(bufferWriter, BufferType.ObjectSTRINGIFY, buffer.length);
            bufferWriter.writeBuffer(buffer);
            this.writeFooter(bufferWriter);
        }
    }
    writeObjectSTRINGIFY2(bufferWriter, dataObject) {
        if (dataObject === null) {
            this.writeFixedSize(bufferWriter, BufferType.Null);
        }
        else {
            const stringifycation = json_helpers_1.JSONParser.stringify(dataObject);
            const buffer = Buffer.from(stringifycation, 'utf8');
            this.writeDynamicSizeHeader(bufferWriter, BufferType.ObjectSTRINGIFY, buffer.length);
            bufferWriter.writeBuffer(buffer);
            this.writeFooter(bufferWriter);
        }
    }
    writeArrayWithSize(bufferWriter, args) {
        const contentBufferWriter = new bufferListWriter_1.BufferListWriter();
        for (let i = 0, l = args.length; i < l; ++i) {
            this.write(contentBufferWriter, args[i]);
        }
        this.writeDynamicSizeHeader(bufferWriter, BufferType.ArrayWithSize, contentBufferWriter.length + 4);
        bufferWriter.writeUInt32(args.length);
        bufferWriter.write(contentBufferWriter);
        this.writeFooter(bufferWriter);
    }
    read(bufferReader) {
        return this._read(0, bufferReader);
    }
    _read(depth, bufferReader) {
        this._readHeader(bufferReader);
        const arg = this._readContent(depth, bufferReader);
        bufferReader.skip(this.footerSize);
        return arg;
    }
    _readContent(depth, bufferReader) {
        let arg;
        switch (this.type) {
            case BufferType.ArrayWithSize:
                arg = this._readArray(depth, bufferReader);
                break;
            case BufferType.Object:
                arg = this._readObjectDirect(depth, bufferReader);
                break;
            case BufferType.ObjectSTRINGIFY:
                arg = this._readObjectSTRINGIFY2(depth, bufferReader);
                break;
            case BufferType.Null:
                arg = null;
                break;
            case BufferType.Undefined:
                arg = undefined;
                break;
            case BufferType.String:
                arg = this._readString(bufferReader, this._contentSize);
                break;
            case BufferType.Buffer:
                arg = bufferReader.slice(this._contentSize);
                break;
            case BufferType.Date:
                arg = new Date(bufferReader.readDouble());
                break;
            case BufferType.Double:
                arg = bufferReader.readDouble();
                break;
            case BufferType.NegativeInteger:
                arg = -bufferReader.readUInt32();
                break;
            case BufferType.PositiveInteger:
                arg = +bufferReader.readUInt32();
                break;
            case BufferType.BooleanTrue:
                arg = true;
                break;
            case BufferType.BooleanFalse:
                arg = false;
                break;
        }
        return arg;
    }
    _readString(bufferReader, len) {
        return bufferReader.readString('utf8', len);
    }
    _readObjectSTRINGIFY2(depth, bufferReader) {
        const data = bufferReader.readString('utf8', this._contentSize);
        return json_helpers_1.JSONParser.parse(data);
    }
    _readObjectDirect(depth, bufferReader) {
        let context;
        if (depth === 0) {
            context = { type: this._type, headerSize: this._headerSize, contentSize: this._contentSize };
        }
        const offsetContentSize = bufferReader.offset + this._contentSize;
        const dataObject = {};
        while (bufferReader.offset < offsetContentSize) {
            let keyLen = bufferReader.readUInt32();
            let key = bufferReader.readString('utf8', keyLen);
            dataObject[key] = this._read(depth + 1, bufferReader);
        }
        if (context) {
            this._type = context.type;
            this._headerSize = context.headerSize;
            this._contentSize = context.contentSize;
        }
        return dataObject;
    }
    _readArray(depth, bufferReader) {
        let context;
        if (depth === 0) {
            context = { type: this._type, headerSize: this._headerSize, contentSize: this._contentSize };
        }
        let argsLen = bufferReader.readUInt32();
        const args = [];
        while (argsLen > 0) {
            let arg = this._read(depth + 1, bufferReader);
            args.push(arg);
            --argsLen;
        }
        if (context) {
            this._type = context.type;
            this._headerSize = context.headerSize;
            this._contentSize = context.contentSize;
        }
        return args;
    }
    _readArrayLength(bufferReader) {
        return bufferReader.readUInt32();
    }
    readArrayLength(bufferReader) {
        this._readHeader(bufferReader);
        if (this.isArray()) {
            return this._readArrayLength(bufferReader);
        }
        return null;
    }
    byPass(bufferReader) {
        this._readHeader(bufferReader);
        bufferReader.skip(this._contentSize + this.footerSize);
    }
    _readArrayAt(bufferReader, index) {
        const argsLen = bufferReader.readUInt32();
        if (index >= argsLen) {
            return null;
        }
        const headerArg = new IpcPacketBufferWrap();
        while (index > 0) {
            headerArg.byPass(bufferReader);
            --index;
        }
        return headerArg.read(bufferReader);
    }
    readArrayAt(bufferReader, index) {
        this._readHeader(bufferReader);
        if (this.isArray()) {
            return this._readArrayAt(bufferReader, index);
        }
        return null;
    }
    _readArraySlice(bufferReader, start, end) {
        const argsLen = bufferReader.readUInt32();
        if (start == null) {
            start = 0;
        }
        else if (start < 0) {
            start = argsLen + start;
        }
        if (start >= argsLen) {
            return [];
        }
        if (end == null) {
            end = argsLen;
        }
        else if (end < 0) {
            end = argsLen + end;
        }
        else {
            end = Math.min(end, argsLen);
        }
        if (end <= start) {
            return [];
        }
        const headerArg = new IpcPacketBufferWrap();
        while (start > 0) {
            headerArg.byPass(bufferReader);
            --start;
            --end;
        }
        const args = [];
        while (end > 0) {
            let arg = headerArg.read(bufferReader);
            args.push(arg);
            --end;
        }
        return args;
    }
    readArraySlice(bufferReader, start, end) {
        this._readHeader(bufferReader);
        if (this.isArray()) {
            return this._readArraySlice(bufferReader, start, end);
        }
        return null;
    }
}
exports.IpcPacketBufferWrap = IpcPacketBufferWrap;

}).call(this,require("buffer").Buffer)
},{"./bufferListWriter":66,"./bufferWriter":68,"buffer":7,"json-helpers":53}],72:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderBase = exports.Reader = void 0;
var Reader;
(function (Reader) {
    function AdjustEnd(offset, maxLen, len) {
        if (len == null) {
            return maxLen;
        }
        else if (len <= 0) {
            return offset;
        }
        else {
            return Math.min(offset + len, maxLen);
        }
    }
    Reader.AdjustEnd = AdjustEnd;
})(Reader = exports.Reader || (exports.Reader = {}));
class ReaderBase {
    constructor(offset) {
        this._offset = offset || 0;
        this._noAssert = true;
    }
    get offset() {
        return this._offset;
    }
    get noAssert() {
        return this._noAssert;
    }
    set noAssert(noAssert) {
        this._noAssert = noAssert;
    }
    reset() {
        this._offset = 0;
    }
    checkEOF(offsetStep) {
        return (this._offset + (offsetStep || 0) > this.length);
    }
    skip(offsetStep) {
        return this.seek(this._offset + (offsetStep || 1));
    }
}
exports.ReaderBase = ReaderBase;
ReaderBase.EmptyBuffer = Buffer.allocUnsafe(0);

}).call(this,require("buffer").Buffer)
},{"buffer":7}],73:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriterBase = void 0;
class WriterBase {
    constructor() {
        this._noAssert = true;
    }
    get noAssert() {
        return this._noAssert;
    }
    set noAssert(noAssert) {
        this._noAssert = noAssert;
    }
}
exports.WriterBase = WriterBase;
WriterBase.EmptyBuffer = Buffer.allocUnsafe(0);

}).call(this,require("buffer").Buffer)
},{"buffer":7}],74:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./socket-serializer-common"), exports);

},{"./socket-serializer-common":75}],75:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcPacketParser = exports.IpcPacketSerializer = exports.BufferListReader = exports.BufferReader = exports.Reader = exports.BufferListWriter = exports.BufferWriter = exports.BufferType = exports.IpcPacketBufferWrap = exports.IpcPacketBuffer = void 0;
var ipcPacketBuffer_1 = require("./code/ipcPacketBuffer");
Object.defineProperty(exports, "IpcPacketBuffer", { enumerable: true, get: function () { return ipcPacketBuffer_1.IpcPacketBuffer; } });
var ipcPacketBufferWrap_1 = require("./code/ipcPacketBufferWrap");
Object.defineProperty(exports, "IpcPacketBufferWrap", { enumerable: true, get: function () { return ipcPacketBufferWrap_1.IpcPacketBufferWrap; } });
var ipcPacketBufferWrap_2 = require("./code/ipcPacketBufferWrap");
Object.defineProperty(exports, "BufferType", { enumerable: true, get: function () { return ipcPacketBufferWrap_2.BufferType; } });
var bufferWriter_1 = require("./code/bufferWriter");
Object.defineProperty(exports, "BufferWriter", { enumerable: true, get: function () { return bufferWriter_1.BufferWriter; } });
var bufferListWriter_1 = require("./code/bufferListWriter");
Object.defineProperty(exports, "BufferListWriter", { enumerable: true, get: function () { return bufferListWriter_1.BufferListWriter; } });
var reader_1 = require("./code/reader");
Object.defineProperty(exports, "Reader", { enumerable: true, get: function () { return reader_1.Reader; } });
var bufferReader_1 = require("./code/bufferReader");
Object.defineProperty(exports, "BufferReader", { enumerable: true, get: function () { return bufferReader_1.BufferReader; } });
var bufferListReader_1 = require("./code/bufferListReader");
Object.defineProperty(exports, "BufferListReader", { enumerable: true, get: function () { return bufferListReader_1.BufferListReader; } });
var ipcPacket_1 = require("./code/ipcPacket");
Object.defineProperty(exports, "IpcPacketSerializer", { enumerable: true, get: function () { return ipcPacket_1.IpcPacketSerializer; } });
Object.defineProperty(exports, "IpcPacketParser", { enumerable: true, get: function () { return ipcPacket_1.IpcPacketParser; } });

},{"./code/bufferListReader":65,"./code/bufferListWriter":66,"./code/bufferReader":67,"./code/bufferWriter":68,"./code/ipcPacket":69,"./code/ipcPacketBuffer":70,"./code/ipcPacketBufferWrap":71,"./code/reader":72}],76:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "v1", {
  enumerable: true,
  get: function () {
    return _v.default;
  }
});
Object.defineProperty(exports, "v3", {
  enumerable: true,
  get: function () {
    return _v2.default;
  }
});
Object.defineProperty(exports, "v4", {
  enumerable: true,
  get: function () {
    return _v3.default;
  }
});
Object.defineProperty(exports, "v5", {
  enumerable: true,
  get: function () {
    return _v4.default;
  }
});
Object.defineProperty(exports, "NIL", {
  enumerable: true,
  get: function () {
    return _nil.default;
  }
});
Object.defineProperty(exports, "version", {
  enumerable: true,
  get: function () {
    return _version.default;
  }
});
Object.defineProperty(exports, "validate", {
  enumerable: true,
  get: function () {
    return _validate.default;
  }
});
Object.defineProperty(exports, "stringify", {
  enumerable: true,
  get: function () {
    return _stringify.default;
  }
});
Object.defineProperty(exports, "parse", {
  enumerable: true,
  get: function () {
    return _parse.default;
  }
});

var _v = _interopRequireDefault(require("./v1.js"));

var _v2 = _interopRequireDefault(require("./v3.js"));

var _v3 = _interopRequireDefault(require("./v4.js"));

var _v4 = _interopRequireDefault(require("./v5.js"));

var _nil = _interopRequireDefault(require("./nil.js"));

var _version = _interopRequireDefault(require("./version.js"));

var _validate = _interopRequireDefault(require("./validate.js"));

var _stringify = _interopRequireDefault(require("./stringify.js"));

var _parse = _interopRequireDefault(require("./parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
},{"./nil.js":78,"./parse.js":79,"./stringify.js":83,"./v1.js":84,"./v3.js":85,"./v4.js":87,"./v5.js":88,"./validate.js":89,"./version.js":90}],77:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

/*
 * Browser-compatible JavaScript MD5
 *
 * Modification of JavaScript MD5
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
function md5(bytes) {
  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = new Uint8Array(msg.length);

    for (let i = 0; i < msg.length; ++i) {
      bytes[i] = msg.charCodeAt(i);
    }
  }

  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
/*
 * Convert an array of little-endian words to an array of bytes
 */


function md5ToHexEncodedArray(input) {
  const output = [];
  const length32 = input.length * 32;
  const hexTab = '0123456789abcdef';

  for (let i = 0; i < length32; i += 8) {
    const x = input[i >> 5] >>> i % 32 & 0xff;
    const hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
    output.push(hex);
  }

  return output;
}
/**
 * Calculate output length with padding and bit length
 */


function getOutputLength(inputLength8) {
  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */


function wordsToMd5(x, len) {
  /* append padding */
  x[len >> 5] |= 0x80 << len % 32;
  x[getOutputLength(len) - 1] = len;
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;
    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return [a, b, c, d];
}
/*
 * Convert an array bytes to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */


function bytesToWords(input) {
  if (input.length === 0) {
    return [];
  }

  const length8 = input.length * 8;
  const output = new Uint32Array(getOutputLength(length8));

  for (let i = 0; i < length8; i += 8) {
    output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
  }

  return output;
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */


function safeAdd(x, y) {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 0xffff;
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */


function bitRotateLeft(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */


function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a, b, c, d, x, s, t) {
  return md5cmn(b & c | ~b & d, a, b, x, s, t);
}

function md5gg(a, b, c, d, x, s, t) {
  return md5cmn(b & d | c & ~d, a, b, x, s, t);
}

function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

var _default = md5;
exports.default = _default;
},{}],78:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = '00000000-0000-0000-0000-000000000000';
exports.default = _default;
},{}],79:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validate = _interopRequireDefault(require("./validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  let v;
  const arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

var _default = parse;
exports.default = _default;
},{"./validate.js":89}],80:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
exports.default = _default;
},{}],81:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = rng;
// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
// getRandomValues needs to be invoked in a context where "this" is a Crypto implementation. Also,
// find the complete implementation of crypto (msCrypto) on IE11.
const getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);
const rnds8 = new Uint8Array(16);

function rng() {
  if (!getRandomValues) {
    throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
  }

  return getRandomValues(rnds8);
}
},{}],82:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

// Adapted from Chris Veness' SHA1 code at
// http://www.movable-type.co.uk/scripts/sha1.html
function f(s, x, y, z) {
  switch (s) {
    case 0:
      return x & y ^ ~x & z;

    case 1:
      return x ^ y ^ z;

    case 2:
      return x & y ^ x & z ^ y & z;

    case 3:
      return x ^ y ^ z;
  }
}

function ROTL(x, n) {
  return x << n | x >>> 32 - n;
}

function sha1(bytes) {
  const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
  const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = [];

    for (let i = 0; i < msg.length; ++i) {
      bytes.push(msg.charCodeAt(i));
    }
  } else if (!Array.isArray(bytes)) {
    // Convert Array-like to Array
    bytes = Array.prototype.slice.call(bytes);
  }

  bytes.push(0x80);
  const l = bytes.length / 4 + 2;
  const N = Math.ceil(l / 16);
  const M = new Array(N);

  for (let i = 0; i < N; ++i) {
    const arr = new Uint32Array(16);

    for (let j = 0; j < 16; ++j) {
      arr[j] = bytes[i * 64 + j * 4] << 24 | bytes[i * 64 + j * 4 + 1] << 16 | bytes[i * 64 + j * 4 + 2] << 8 | bytes[i * 64 + j * 4 + 3];
    }

    M[i] = arr;
  }

  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
  M[N - 1][14] = Math.floor(M[N - 1][14]);
  M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;

  for (let i = 0; i < N; ++i) {
    const W = new Uint32Array(80);

    for (let t = 0; t < 16; ++t) {
      W[t] = M[i][t];
    }

    for (let t = 16; t < 80; ++t) {
      W[t] = ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];

    for (let t = 0; t < 80; ++t) {
      const s = Math.floor(t / 20);
      const T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t] >>> 0;
      e = d;
      d = c;
      c = ROTL(b, 30) >>> 0;
      b = a;
      a = T;
    }

    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
  }

  return [H[0] >> 24 & 0xff, H[0] >> 16 & 0xff, H[0] >> 8 & 0xff, H[0] & 0xff, H[1] >> 24 & 0xff, H[1] >> 16 & 0xff, H[1] >> 8 & 0xff, H[1] & 0xff, H[2] >> 24 & 0xff, H[2] >> 16 & 0xff, H[2] >> 8 & 0xff, H[2] & 0xff, H[3] >> 24 & 0xff, H[3] >> 16 & 0xff, H[3] >> 8 & 0xff, H[3] & 0xff, H[4] >> 24 & 0xff, H[4] >> 16 & 0xff, H[4] >> 8 & 0xff, H[4] & 0xff];
}

var _default = sha1;
exports.default = _default;
},{}],83:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validate = _interopRequireDefault(require("./validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).substr(1));
}

function stringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  const uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

var _default = stringify;
exports.default = _default;
},{"./validate.js":89}],84:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _rng = _interopRequireDefault(require("./rng.js"));

var _stringify = _interopRequireDefault(require("./stringify.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html
let _nodeId;

let _clockseq; // Previous uuid creation time


let _lastMSecs = 0;
let _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
  let i = buf && offset || 0;
  const b = buf || new Array(16);
  options = options || {};
  let node = options.node || _nodeId;
  let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189

  if (node == null || clockseq == null) {
    const seedBytes = options.random || (options.rng || _rng.default)();

    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }

    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


  let msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock

  let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval


  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  } // Per 4.2.1.2 Throw error if too many uuids are requested


  if (nsecs >= 10000) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

  msecs += 12219292800000; // `time_low`

  const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff; // `time_mid`

  const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff; // `time_high_and_version`

  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

  b[i++] = clockseq & 0xff; // `node`

  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf || (0, _stringify.default)(b);
}

var _default = v1;
exports.default = _default;
},{"./rng.js":81,"./stringify.js":83}],85:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _v = _interopRequireDefault(require("./v35.js"));

var _md = _interopRequireDefault(require("./md5.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v3 = (0, _v.default)('v3', 0x30, _md.default);
var _default = v3;
exports.default = _default;
},{"./md5.js":77,"./v35.js":86}],86:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.URL = exports.DNS = void 0;

var _stringify = _interopRequireDefault(require("./stringify.js"));

var _parse = _interopRequireDefault(require("./parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  const bytes = [];

  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
exports.DNS = DNS;
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
exports.URL = URL;

function _default(name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = (0, _parse.default)(namespace);
    }

    if (namespace.length !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    let bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return (0, _stringify.default)(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}
},{"./parse.js":79,"./stringify.js":83}],87:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _rng = _interopRequireDefault(require("./rng.js"));

var _stringify = _interopRequireDefault(require("./stringify.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function v4(options, buf, offset) {
  options = options || {};

  const rnds = options.random || (options.rng || _rng.default)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`


  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return (0, _stringify.default)(rnds);
}

var _default = v4;
exports.default = _default;
},{"./rng.js":81,"./stringify.js":83}],88:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _v = _interopRequireDefault(require("./v35.js"));

var _sha = _interopRequireDefault(require("./sha1.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v5 = (0, _v.default)('v5', 0x50, _sha.default);
var _default = v5;
exports.default = _default;
},{"./sha1.js":82,"./v35.js":86}],89:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _regex = _interopRequireDefault(require("./regex.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function validate(uuid) {
  return typeof uuid === 'string' && _regex.default.test(uuid);
}

var _default = validate;
exports.default = _default;
},{"./regex.js":80}],90:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validate = _interopRequireDefault(require("./validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function version(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  return parseInt(uuid.substr(14, 1), 16);
}

var _default = version;
exports.default = _default;
},{"./validate.js":89}]},{},[13]);
