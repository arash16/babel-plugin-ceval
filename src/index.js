const fs = require('fs');
const _path = require('path');

export default function ({ transform, transformFromAst, traverse, types: t }) {
	function makeLiteral(value) {
		switch (typeof value) {
			case 'string': return t.stringLiteral(value);
			case 'number': return t.numericLiteral(value);
			case 'boolean': return t.booleanLiteral(value);
			case 'undefined': return t.unaryExpression('void', t.numericLiteral(0), true);
			case 'object':
				if (!value)
					return t.nullLiteral();

				if (value instanceof RegExp) {
					let vals = value.toString().split('/');
					return t.regExpLiteral(vals[1], vals[2]);
				}

				return transform('(' + JSON.stringify(value) + ')').ast.program.body[0];

			case 'function':
				return transform('(' + value.toString() + ')').ast.program.body[0].expression;

			default: throw new Error('Not Implemented.');
		}
	}


	let persistentContext = {};
	function compileFunction(code) {
		var fn = new Function('require', '__dirname', '__filename', code);

		return function (d) {
			function req(mod) {
				if (mod.startsWith('.'))
					mod = _path.join(d, mod);

				return require(mod);
			}
			let args = [req];
			for (let i=0; i<arguments.length; ++i)
				args.push(arguments[i]);


			let c = process.cwd(), result;
			try {
				process.chdir(d);
				result = fn.apply(persistentContext, args);
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
				let args = path.get('arguments').map(arg => {
					let t = arg.evaluate();
					return t.confident ? t.value : arg.node;
				});

				let filename = _path.resolve(node.loc.filename || path.hub.file.opts.filename),
					dirname = _path.dirname(filename);

				let nd;
				if (typeof args[0] == 'string') {
					let code = args[0];
					if (code.indexOf('return'))
						code = 'return (' + code + ')';
					let res = compileFunction(code)(dirname, filename);
					nd = makeLiteral(res);
				}

				if (t.isFunction(args[0])) {
					let code = transformFromAst(t.program(args[0].body.body)).code,
						res = compileFunction(code)(dirname, filename);

					if (typeof res == 'string')
						nd = transform(res).ast.program.body;
					else nd = makeLiteral(res);
				}

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
					if (Array.isArray(nd))
						path.replaceWithMultiple(nd);
					else path.replaceWith(nd);
				}
				else path.remove();
			}
		}
	}
};
