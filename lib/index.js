'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = function (_ref) {
	var transform = _ref.transform,
	    transformFromAst = _ref.transformFromAst,
	    traverse = _ref.traverse,
	    t = _ref.types;

	function makeLiteral(value) {
		switch (typeof value === 'undefined' ? 'undefined' : _typeof(value)) {
			case 'string':
				return t.stringLiteral(value);
			case 'number':
				return t.numericLiteral(value);
			case 'boolean':
				return t.booleanLiteral(value);
			case 'undefined':
				return t.unaryExpression('void', t.numericLiteral(0), true);
			case 'object':
				if (!value) return t.nullLiteral();

				if (value instanceof RegExp) {
					var vals = value.toString().split('/');
					return t.regExpLiteral(vals[1], vals[2]);
				}

				return transform('(' + JSON.stringify(value) + ')').ast.program.body[0];

			case 'function':
				return transform('(' + value.toString() + ')').ast.program.body[0].expression;

			default:
				throw new Error('Not Implemented.');
		}
	}

	var persistentContext = {};
	function compileFunction(code) {
		var fn = new Function('require', '__dirname', '__filename', code);

		return function (d) {
			function req(mod) {
				if (mod.startsWith('.')) mod = _path.join(d, mod);

				return require(mod);
			}
			var args = [req];
			for (var i = 0; i < arguments.length; ++i) {
				args.push(arguments[i]);
			}var c = process.cwd(),
			    result = void 0;
			try {
				process.chdir(d);
				result = fn.apply(persistentContext, args);
			} finally {
				process.chdir(c);
			}
			return result;
		};
	}

	return {
		visitor: {
			CallExpression: function CallExpression(path, state) {
				var node = path.node;

				if (!t.isIdentifier(node.callee, { name: 'ceval' })) return;
				var args = path.get('arguments').map(function (arg) {
					var t = arg.evaluate();
					return t.confident ? t.value : arg.node;
				});

				var filename = _path.resolve(node.loc.filename || path.hub.file.opts.filename),
				    dirname = _path.dirname(filename);

				var nd = void 0;
				if (typeof args[0] == 'string') {
					var code = args[0];
					if (code.indexOf('return')) code = 'return (' + code + ')';
					var res = compileFunction(code)(dirname, filename);
					nd = makeLiteral(res);
				}

				if (t.isFunction(args[0])) {
					var _code = transformFromAst(t.program(args[0].body.body)).code,
					    _res = compileFunction(_code)(dirname, filename);

					if (typeof _res == 'string') nd = transform(_res).ast.program.body;else nd = makeLiteral(_res);
				}

				if (nd) {
					traverse.removeProperties(nd);
					if (t.isFunction(nd)) {
						if (t.isExpressionStatement(path.parent) && nd.id && nd.id.name) {
							nd.type = 'FunctionDeclaration';
							path.parentPath.replaceWith(nd);
							return;
						} else nd.type = 'FunctionExpression';
					}
					if (Array.isArray(nd)) path.replaceWithMultiple(nd);else path.replaceWith(nd);
				} else path.remove();
			}
		}
	};
};

var fs = require('fs');
var _path = require('path');

;
