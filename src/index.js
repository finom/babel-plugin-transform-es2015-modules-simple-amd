import 'better-log/install';
import template from "babel-template";

let buildModule = template(`
define([IMPORT_PATHS], function(IMPORT_VARS) {
	BODY;
});
`);

module.exports = function({ types: t }) {
	return {
		visitor: {
			Program: {
				exit(path, file) {
					let body = path.get("body"),
						sources = [],
						vars = [];

					for (let path of body) {
						if (path.isExportDefaultDeclaration()) {
							let declaration = path.get("declaration");
							path.replaceWith(t.returnStatement(declaration.node))
						}

						if (path.isImportDeclaration()) {
							let key = path.node.source.value,
								specifiers = path.node.specifiers;

							if (specifiers.length != 1) {
								throw Error(`Not allowed to use ${specifiers.length} specificators`);
							}

							sources.push(path.node.source);
							vars.push(specifiers[0]);

							path.remove();
						}
					}

					path.node.body = [
						buildModule({
							IMPORT_PATHS: sources,
							IMPORT_VARS: vars,
							BODY: path.node.body
						})
					];
				}
			}
		}
	};
};
