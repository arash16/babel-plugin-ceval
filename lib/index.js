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

	function unPromise(p) {
		if ((typeof p === 'undefined' ? 'undefined' : _typeof(p)) != 'object') return p;
		if (typeof p.then != 'function') return p;

		var done = false,
		    result = void 0,
		    err = void 0;
		p.then(function (val) {
			done = true;
			result = val;
		}, function (e) {
			done = true;
			err = e;
		});
		require('deasync').loopWhile(function () {
			return !done;
		});
		if (err) throw err;
		return result;
	}

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
				result = unPromise(fn.apply(persistentContext, args));
			} finally {
				process.chdir(c);
			}
			return result;
		};
	}

	return {
		pre: function pre(file) {
			var opts = file.opts.plugins.filter(function (x) {
				return x[0].key == 'ceval';
			})[0][1] || {};
			traverse(file.ast, {
				CallExpression: function CallExpression(path) {
					var node = path.node;

					if (!t.isIdentifier(node.callee, { name: 'ceval' })) return;
					var filename = _path.resolve(node.loc.filename || path.hub.file.opts.filename);
					var params = Object.assign({
						__filename: filename,
						__dirname: _path.dirname(filename)
					}, opts || {});

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
			});
		},

		visitor: {
			IfStatement: {
				exit: function exit(path) {
					var cr = path.get('test').evaluate();
					if (!cr.confident) return;

					var node = path.node;

					var result = cr.value ? node.consequent : node.alternate;
					if (!result) path.remove();else if (t.isBlockStatement(result)) path.replaceWithMultiple(result.body);else path.replaceWith(result);
				}
			},
			ConditionalExpression: {
				exit: function exit(path) {
					var cr = path.get('test').evaluate();
					if (!cr.confident) return;

					var node = path.node;

					path.replaceWith(cr.value ? node.consequent : node.alternate);
				}
			}
		}
	};
};

var fs = require('fs');
var _path = require('path');

;
