# babel-plugin-ceval

> This plugin allows [Babel](https://babeljs.io) to execute ceval functions at compile time.

## API

### `ceval(expression: string)`

Return value is used as is, it cannot return code fragments.

### `ceval(fn: function([args..])[, args..])`

If it returns a string, it is expected to be a code fragment. If you need to return
a string value, simply enclose it with quotations (If string contains quotations, use JSON.stringify).

## Examples

### Reading environment variables

```javascript
// In:
var envPath = ceval('process.env.PATH');
// Out:
var envPath = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games';
```

### Current source directory / filename

```javascript
// In:
var dirname = ceval('__dirname');
var filename= ceval('__filename');
// Out:
var dirname = '/home/arash16/Projects/ceval-test';
var filename = '/home/arash16/Projects/ceval-test/test.js';
```

### Version information inside package.json

```javascript
// In:
var version = ceval('require("./package.json").version');
// Out:
var version = '1.0.0';
```

### Generate js code via js code

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

### Return string from ceval(fn: function)

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

### Different functions for different environments

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

### Reading outside variables (they must be statically evaluatable)

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

### Return complete objects

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

## Installation

```sh
npm install --save-dev babel-plugin-ceval
```

## Usage

### Via [.babelrc](http://babeljs.io/docs/usage/babelrc/) (Recommended)

**.babelrc**

```json
{
  "plugins": ["ceval"]
}
```

### Via CLI

```sh
babel --plugins ceval script.js
```

### Via Node API

```javascript
require("babel-core").transform("code", {
  plugins: ["ceval"]
});
```
