const fs = require('fs');
const _path = require('path');

export default function ({ transform, transformFromAst, traverse, types: t }) {
	function unPromise(p) {
		if (typeof p != 'object') return p;
		if (typeof (p.then) != 'function') return p;

		let done = false,
			result, err;
		p.then(function(val) {
			done = true;
			result = val;
		}, function(e) {
			done = true;
			err = e;
		});
		require('deasync').loopWhile(function(){ return !done; });
		if (err) throw err;
		return result;
	}

	function makeLiteral(value) {
		switch (typeof value) {
			case 'string': return t.stringLiteral(value);
			case 'number': return t.numericLiteral(value);
			case 'boolean': return t.booleanLiteral(value);
			case 'undefined': return t.unaryExpression('void', t.numericLiteral(0), true);
			case 'function':
				return transform('(' + value.toString() + ')', {code: false}).ast.program.body[0].expression;
			case 'object':
				if (!value)
					return t.nullLiteral();

				if (value instanceof RegExp) {
					let vals = value.toString().split('/');
					return t.regExpLiteral(vals[1], vals[2]);
				}

				if (Array.isArray(value)) {
					let result = t.arrayExpression();
					result.elements = value.map(makeLiteral);
					return result;
				}

				return t.objectExpression(
					Object.keys(value).map(key =>
						t.objectProperty(
							t.stringLiteral(key),
							makeLiteral(value[key])
						)
					)
				);

			default: throw new Error('Not Implemented.');
		}
	}


	let persistentContext = {};
	function compileFunction(code, params) {
		let d = params.__dirname;
		params.require = function req(mod) {
			if (mod[0] == '.')
				mod = _path.join(d, mod);

			return require(mod);
		}

		let orgs = Object.keys(params),
			args = orgs.map(key => params[key]),
			fn = new Function(orgs.join(), code);

		return function () {
			let c = process.cwd(), result;
			try {
				process.chdir(d);
				result = unPromise(fn.apply(persistentContext, args));
			}
			finally {
				process.chdir(c);
			}
			return result;
		};
	}


	return {
		visitor: {
			CallExpression (path, state) {
				const { node } = path;
				if (!t.isIdentifier(node.callee, {name: 'ceval'})) return;
				let filename = _path.resolve(node.loc.filename || path.hub.file.opts.filename);
				let params = Object.assign({
					__filename: filename,
					__dirname: _path.dirname(filename)
				}, state.opts || {});


				let args = path.get('arguments'),
					arg1 = args[0].evaluate(),
					nd;

				if (arg1.confident) {
					if (typeof arg1.value!='string' || args.length>1) return;

					let code = arg1.value;
					if (code.indexOf('return'))
						code = 'return (' + code + ')';
					let res = compileFunction(code, params)();
					nd = makeLiteral(res);
				}
				else if (t.isFunction(args[0])) {
					let funcNode = args[0].node;
					if (funcNode.params.length+1 != args.length) return;

					for (let i=0; i<funcNode.params.length; ++i) {
						let ev = args[i+1].evaluate();
						params[funcNode.params[i].name] = ev.confident ? ev.value : void 0;
					}

					let code = transformFromAst(t.program(funcNode.body.body)).code,
						res = compileFunction(code, params)();

					if (typeof res == 'string') {
						let ast = transform(res, {code: false}).ast;
						nd = !ast.program.body.length && ast.program.directives.length
							? t.stringLiteral(ast.program.directives[0].value.value)
							: ast.program.body;
					}
					else nd = makeLiteral(res);
				}
				else return;

				if (nd) {
					traverse.removeProperties(nd);
					if (t.isFunction(nd)) {
						if (t.isExpressionStatement(path.parent) && nd.id && nd.id.name) {
							nd.type = 'FunctionDeclaration';
							path.parentPath.replaceWith(nd);
							return;
						}

						else nd.type = 'FunctionExpression';
					}
					if (Array.isArray(nd)) {
						if (!nd.length) path.remove();
						else path.replaceWithMultiple(nd);
					}
					else path.replaceWith(nd);
				}
				else path.remove();
			},
			IfStatement: {
				exit(path) {
					let cr = path.get('test').evaluate();
					if (!cr.confident) return;

					const { node } = path;
					let result = cr.value ? node.consequent : node.alternate;
					if (!result) path.remove();
					else if (t.isBlockStatement(result))
						path.replaceWithMultiple(result.body);
					else
						path.replaceWith(result);
				}
			},
			ConditionalExpression: {
				exit(path) {
					let cr = path.get('test').evaluate();
					if (!cr.confident) return;

					const { node } = path;
					path.replaceWith(cr.value ? node.consequent : node.alternate);
				}
			}
		}
	}
};
