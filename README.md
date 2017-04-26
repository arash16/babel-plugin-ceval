# babel-plugin-ceval

> This plugin allows [Babel](https://babeljs.io) to execute ceval functions at compile time.

## Examples

```javascript
// In:
var envPath = ceval('process.env.PATH');
// Out:
var envPath = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games';
```

```javascript
// In:
var dirname = ceval('__dirname');
// Out:
var dirname = '/home/arash16/Projects/ceval-test';
```

```javascript
// In:
var version = ceval('require("./package.json").version');
// Out:
var version = '1.0.0';
```

```javascript
// In:
ceval(function() {
	var r = '';
	for (var i=0; i<10; ++i)
		r += 'console.log('+i+');';
	return r;
});
// Out:
console.log(0);console.log(1);console.log(2);console.log(3);
```

```javascript
// In:
ceval(function() {
	if (process.env.DEBUG)
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
