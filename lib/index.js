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
			case 'function':
				return transform('(' + value.toString() + ')', { code: false }).ast.program.body[0].expression;
			case 'object':
				if (!value) return t.nullLiteral();

				if (value instanceof RegExp) {
					var vals = value.toString().split('/');
					return t.regExpLiteral(vals[1], vals[2]);
				}

				if (Array.isArray(value)) {
					var result = t.arrayExpression();
					result.elements = value.map(makeLiteral);
					return result;
				}

				return t.objectExpression(Object.keys(value).map(function (key) {
					return t.objectProperty(t.stringLiteral(key), makeLiteral(value[key]));
				}));

			default:
				throw new Error('Not Implemented.');
		}
	}

	var persistentContext = {};
	function compileFunction(code, params) {
		var d = params.__dirname;
		params.require = function req(mod) {
			if (mod[0] == '.') mod = _path.join(d, mod);

			return require(mod);
		};

		var orgs = Object.keys(params),
		    args = orgs.map(function (key) {
			return params[key];
		}),
		    fn = new Function(orgs.join(), code);

		return function () {
			var c = process.cwd(),
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
				var filename = _path.resolve(node.loc.filename || path.hub.file.opts.filename);
				var params = {
					__filename: filename,
					__dirname: _path.dirname(filename)
				};

				var args = path.get('arguments'),
				    arg1 = args[0].evaluate(),
				    nd = void 0;

				if (arg1.confident) {
					if (typeof arg1.value != 'string' || args.length > 1) return;

					var code = arg1.value;
					if (code.indexOf('return')) code = 'return (' + code + ')';
					var res = compileFunction(code, params)();
					nd = makeLiteral(res);
				} else if (t.isFunction(args[0])) {
					var funcNode = args[0].node;
					if (funcNode.params.length + 1 != args.length) return;

					for (var i = 0; i < funcNode.params.length; ++i) {
						var ev = args[i + 1].evaluate();
						params[funcNode.params[i].name] = ev.confident ? ev.value : void 0;
					}

					var _code = transformFromAst(t.program(funcNode.body.body)).code,
					    _res = compileFunction(_code, params)();

					if (typeof _res == 'string') {
						var ast = transform(_res, { code: false }).ast;
						nd = !ast.program.body.length && ast.program.directives.length ? t.stringLiteral(ast.program.directives[0].value.value) : ast.program.body;
					} else nd = makeLiteral(_res);
				} else return;

				if (nd) {
					traverse.removeProperties(nd);
					if (t.isFunction(nd)) {
						if (t.isExpressionStatement(path.parent) && nd.id && nd.id.name) {
							nd.type = 'FunctionDeclaration';
							path.parentPath.replaceWith(nd);
							return;
						} else nd.type = 'FunctionExpression';
					}
					if (Array.isArray(nd)) {
						if (!nd.length) path.remove();else path.replaceWithMultiple(nd);
					} else path.replaceWith(nd);
				} else path.remove();
			}
		}
	};
};

var fs = require('fs');
var _path = require('path');

;
