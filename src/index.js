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
						anonymousSources = [],
						vars = [],
						isModular = false;

					for (let path of body) {
						if (path.isExportDefaultDeclaration()) {
							let declaration = path.get("declaration");
							path.replaceWith(t.returnStatement(declaration.node));

							isModular = true;
						}

						if (path.isImportDeclaration()) {
							let key = path.node.source.value,
								specifiers = path.node.specifiers;


							if(specifiers.length == 0) {
								anonymousSources.push(path.node.source);
							} else if(specifiers.length == 1) {
								sources.push(path.node.source);
								vars.push(specifiers[0]);
							} else {
								throw Error(`Not allowed to use ${specifiers.length} specifiers`);
							}

							path.remove();

							isModular = true;
						}
					}

					if(isModular) {
						path.node.body = [
							buildModule({
								IMPORT_PATHS: sources.concat(anonymousSources),
								IMPORT_VARS: vars,
								BODY: path.node.body
							})
						];
					}
				}
			}
		}
	};
};
