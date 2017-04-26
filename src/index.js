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

				return transform('(' + JSON.stringify(value) + ')', {code: false}).ast.program.body[0];

			case 'function':
				return transform('(' + value.toString() + ')', {code: false}).ast.program.body[0].expression;

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
				let filename = _path.resolve(node.loc.filename || path.hub.file.opts.filename);
				let params = {
					__filename: filename,
					__dirname: _path.dirname(filename)
				};


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
			}
		}
	}
};
