import 'better-log/install';
import template from "babel-template";

let buildModule = template(`
define([IMPORT_PATHS], function(IMPORT_VARS) {
	NAMED_IMPORTS;
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
						namedImports = [],
						isModular = false,
						middleDefaultExportID = false;

					for (let i = 0; i < body.length; i++) {
						let path = body[i],
							isLast = i == body.length - 1;

						if (path.isExportNamedDeclaration()) {
							let declaration = path.get("declaration");
							path.replaceWith(declaration.node);
						} else if (path.isExportDefaultDeclaration()) {
							let declaration = path.get("declaration");

							if(isLast) {
								path.replaceWith(t.returnStatement(declaration.node));
							} else {
								middleDefaultExportID = path.scope.generateUidIdentifier("export_default");
								path.replaceWith(t.variableDeclaration('var', [t.variableDeclarator(middleDefaultExportID, declaration.node)]));
							}

							isModular = true;
						}

						if (path.isImportDeclaration()) {
							let specifiers = path.node.specifiers;

							if(specifiers.length == 0) {
								anonymousSources.push(path.node.source);
							} else if(specifiers.length == 1 && specifiers[0].type == 'ImportDefaultSpecifier') {
								sources.push(path.node.source);
								vars.push(specifiers[0]);
							} else {
								let importedID = path.scope.generateUidIdentifier(path.node.source.value);
								sources.push(path.node.source);
								vars.push(importedID);

								specifiers.forEach(({imported, local}) => {
									namedImports.push(t.variableDeclaration("var", [
										t.variableDeclarator(t.identifier(local.name), t.identifier(importedID.name + '.' + imported.name))
									]));
								});
							}

							path.remove();

							isModular = true;
						}

						if(isLast && middleDefaultExportID) {
							path.insertAfter(t.returnStatement(middleDefaultExportID));
						}
					}

					if(isModular) {
						path.node.body = [
							buildModule({
								IMPORT_PATHS: sources.concat(anonymousSources),
								IMPORT_VARS: vars,
								BODY: path.node.body,
								NAMED_IMPORTS: namedImports
							})
						];
					}
				}
			}
		}
	};
};
