# babel-plugin-ceval
[![NPM version](https://img.shields.io/npm/v/babel-plugin-ceval.svg)](https://www.npmjs.com/package/babel-plugin-ceval)

This plugin allows [Babel](https://babeljs.io) to execute `ceval` functions at compile time. It can be used for any kind
of code generations that needs to happen at build time. Instead of writing complicated build scripts, you can write
those code generation logics right inside your code.

## Table of Contents
- [Installation](#toc-install)
- [Usage](#toc-usage)
  - [Via .babelrc](#toc-babelrc)
  - [Via CLI](#toc-cli)
- [API](#toc-api)
- [Examples](#toc-examples)
  - [Reading environment variables](#toc-ex1)
  - [Current source directory / filename](#toc-ex2)
  - [Version information from package.json](#toc-ex3)
  - [Generate js code via js code](#toc-ex4)
  - [Return string from ceval(fn: function)](#toc-ex5)
  - [Different functions for different environments](#toc-ex6)
  - [Reading outside variables (they must be statically evaluatable)](#toc-ex7)
  - [Return complete objects](#toc-ex8)
  - [Return a Promise](#toc-ex9)


## <a id="toc-install"></a>Installation

```sh
npm install --save-dev babel-plugin-ceval
```

## <a id="toc-usage"></a>Usage

### <a id="toc-babelrc"></a>Via [.babelrc](http://babeljs.io/docs/usage/babelrc/) (Recommended)

**.babelrc**

```json
{
  "plugins": ["ceval"]
}
```

### <a id="toc-cli"></a>Via CLI

```sh
babel --plugins ceval script.js
```

## <a id="toc-api"></a>API

### `ceval(expression: string)`

Return value is used as is, it cannot return code fragments.

### `ceval(fn: function([args..])[, args..])`

If it returns a string, it is expected to be a code fragment. If you need to return
a string value, simply enclose it with quotations (If string contains quotations, use JSON.stringify).

## <a id="toc-examples"></a>Examples

### <a id="toc-ex1"></a>Reading environment variables

```javascript
// In:
var envPath = ceval('process.env.PATH');
// Out:
var envPath = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games';
```

### <a id="toc-ex2"></a>Current source directory / filename

```javascript
// In:
var dirname = ceval('__dirname');
var filename= ceval('__filename');
// Out:
var dirname = '/home/arash16/Projects/ceval-test';
var filename = '/home/arash16/Projects/ceval-test/test.js';
```

### <a id="toc-ex3"></a>Version information from package.json

```javascript
// In:
var version = ceval('require("./package.json").version');
// Out:
var version = '1.0.0';
```

### <a id="toc-ex4"></a>Generate js code via js code

```javascript
// In:
ceval(function() {
  var r = '';
  for (var i=0; i<4; ++i)
    r += 'console.log('+i+');';
  return r;
});
// Out:
console.log(0);console.log(1);console.log(2);console.log(3);
```

### <a id="toc-ex5"></a>Return string from ceval(fn: function)

```javascript
// In:
var code = ceval(function() {
  var r = '';
  for (var i=0; i<3; ++i)
    r += 'console.log('+i+');';
  return JSON.stringify(r);
});
// Out:
var code = 'console.log(0);console.log(1);console.log(2);';
```

### <a id="toc-ex6"></a>Different functions for different environments

```javascript
// In:
ceval(function() {
  if (process.env.SERVER)
    return function checker(x) { 
      return x>2; 
    };
  
  return function checker(x) { 
    return x>0; 
  };
});
// Out:
function checker(x) {
  return x > 0;
}
```

### <a id="toc-ex7"></a>Reading outside variables (they must be statically evaluatable)

```javascript
// In:
const X = 1, Y = 2;
ceval(function(a, b) {
  return 'console.log(' + (a+b) + ');';
}, X, Y);
// Out:
const X = 1,
      Y = 2;
console.log(3);
```

### <a id="toc-ex8"></a>Return complete objects

```javascript
// In:
var obj = ceval(function() {
  return {
    regex: /abc/g,
    str: 'asdas',
    arr: [1,2, { x: 1}],
    fn: function (a, b) {
      return a + b;
    }
  };
});
// Out:
var obj = {
  'regex': /abc/g,
  'str': 'asdas',
  'arr': [1, 2, {
    'x': 1
  }],
  'fn': function (a, b) {
    return a + b;
  }
};
```

### <a id="toc-ex9"></a>Return a Promise

If you need to return a promise, make sure to install [deasync](https://github.com/abbr/deasync) too.

```sh
npm install --save-dev deasync
```

```javascript
// In:
ceval(function() {
  return Promise
    .resolve('read from database')
    .then(x => `function dyna() {
      return ${JSON.stringify(x.split(' '))};
    }`);
});
// Out:
function dyna() {
  return ["read", "from", "database"];
}
```
