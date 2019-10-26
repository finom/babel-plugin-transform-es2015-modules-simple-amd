import "better-log/install";
import template from "@babel/template";

const buildModule = template(`
define(IMPORT_PATHS, function(IMPORT_VARS) {
	NAMED_IMPORTS;
	BODY;
});
`);

export default function transformToAmd({types: t}) {
  return {
    visitor: {
      Program: {
        exit(programPath) {
          const bodyPaths = programPath.get("body");
          const sources = [];
          const anonymousSources = [];
          const vars = [];
          const namedImports = [];
          let isModular = false;
          let defaultExportExpression = null;

          for (let i = 0; i < bodyPaths.length; i++) {
            const isLastBodyStatement = i === bodyPaths.length - 1;
            const bodyStatementPath = bodyPaths[i];

            if (t.isExportNamedDeclaration(bodyStatementPath)) {
							// console.log("named export");

              const {specifiers} = bodyStatementPath.node;
              let j = specifiers.length;
              while (j--) {
                const specifier = specifiers[j];
                if (
                  t.isExportSpecifier(specifier) &&
                  specifier.exported.name === "default"
                ) {
                  // import -> export
                  // export {name as default, ...};
                  // export { default } from ....;
                  // export { default as default } from ....;
                  
                  // Not supported:
                  // export {name as default, ...} from ....; 

                  if(specifier.local.name === "default") {
                    // console.log("export { default as default, ... } from ...;");
                    defaultExportExpression = bodyStatementPath.scope.generateUidIdentifier(
                      bodyStatementPath.node.source.value
                    );
                    sources.push(bodyStatementPath.node.source);
                    vars.push(defaultExportExpression);
                  } else if(bodyStatementPath.node.source) {
                    // console.log(`export { ${specifier.local.name} as default, ... } from ...;`);
                    throw new Error("Named imports are not supported.");
                  } else {
                    // console.log(`export { ${specifier.local.name} as default, ... };`);
                    defaultExportExpression = specifier.local;
                  }
                  specifiers.splice(j, 1);
                  isModular = true;
                  break;
                } else if (t.isExportDefaultSpecifier(specifier)) {
                  // console.log("export { default } from ...;");
                  defaultExportExpression = specifier.exported;
                  specifiers.splice(j, 1);
                  isModular = true;
                  break;
                }
              }

              if (specifiers.length === 0) {
                bodyStatementPath.remove();
              }
            } else if (t.isExportDefaultDeclaration(bodyStatementPath)) {
							// console.log("export default x;");

              // Check if a variable is needed. Yes if:
              // - it's a function declaration
              // - it's a class declaration
              // - it's an expression, which could, in principle, be embedded in
              //   the return declaration, however, not if this is not the last
              //   body statement.
              const declaration = bodyStatementPath.get("declaration");
              if (
                t.isFunctionDeclaration(declaration) ||
                t.isClassDeclaration(declaration)
              ) {
                // Does the class or function have a name?
                if (declaration.node.id !== null) {
                  // > export default class foo { ... };

									// console.log("Named class or function isFun=" + t.isFunctionDeclaration(declaration));

                  // Replace the export with the actual declaration.
                  // > class foo { ... };
                  bodyStatementPath.replaceWith(declaration.node);

                  // The return value will be the name of the class or function.
                  defaultExportExpression = declaration.node.id;
                } else {
                  // > export default class { ... };

									// console.log("Anonymous class or function isFun=" + t.isFunctionDeclaration(declaration));

                  // Need a variable to capture the class or function, as an expression.
                  // > var export_default = class { ... };

                  const varName = createDefaultExportVarName(bodyStatementPath.scope);

                  // The variable will contain the anonymous declaration, but as an expression.
                  const varValue = declaration.node;

                  // Change the declaration to a corresponding expression.
                  varValue.type = t.isFunctionDeclaration(declaration)
                    ? "FunctionExpression"
                    : "ClassExpression";

                  const variable = createVariable(t, varName, varValue);

                  bodyStatementPath.replaceWith(variable);

									// The variable will be the function's return value.
									// > return export_default;
                  defaultExportExpression = varName;
                }
              } else if (!isLastBodyStatement) {
								// console.log("expression, not last in body");
                // An expression that needs to be captured as a variable.

                // Need a variable to capture the class or function, as an expression.
                // > var export_default = class { ... };

								const varName = createDefaultExportVarName(bodyStatementPath.scope);

								// The variable will contain the expression.
								const varValue = declaration.node;

                const variable = createVariable(t, varName, varValue);

                bodyStatementPath.replaceWith(variable);

								// The variable will be the function's return value.
								// > return export_default;
                defaultExportExpression = varName;
              } else {
								// console.log("expression, last in body");
								// > export default <expression>;
								// convert to:
								// > return <expression>;

                bodyStatementPath.remove();
                defaultExportExpression = declaration.node;
              }

              isModular = true;
            } else if (t.isImportDeclaration(bodyStatementPath)) {
              const {specifiers} = bodyStatementPath.node;

              if (specifiers.length === 0) {
                anonymousSources.push(bodyStatementPath.node.source);
              } else if (
                specifiers.length === 1 &&
                specifiers[0].type === "ImportDefaultSpecifier"
              ) {
                sources.push(bodyStatementPath.node.source);
                vars.push(specifiers[0].local);
              } else {
                
                // Should not be supported this way, imo.

                const importedID = bodyStatementPath.scope.generateUidIdentifier(
                  bodyStatementPath.node.source.value
                );
                sources.push(bodyStatementPath.node.source);
                vars.push(importedID);

                specifiers.forEach(({imported, local}) => {
                  namedImports.push(
                    t.variableDeclaration("var", [
                      t.variableDeclarator(
                        t.identifier(local.name),
                        t.identifier(importedID.name + "." + imported.name)
                      )
                    ])
                  );
                });
              }

              bodyStatementPath.remove();

              isModular = true;
            }

            if (isLastBodyStatement && defaultExportExpression !== null) {
              // Output the `return defaultExport;` statement.
              // Done within the loop to have access to `bodyStatementPath`.

              // Cannot insertAfter a removed node.
              // Find the previous node which is not removed.
              const returnStatement = t.returnStatement(
                defaultExportExpression
              );
              const closestBeforePath = findClosestNonRemovedBefore(
                bodyStatementPath,
                i,
                bodyPaths
              );

              if (closestBeforePath !== null) {
                closestBeforePath.insertAfter(returnStatement);
              } else {
                programPath.unshiftContainer("body", [returnStatement]);
              }
            }
          }

          if (isModular) {
            programPath.node.body = [
              buildModule({
                IMPORT_PATHS: t.arrayExpression(
                  sources.concat(anonymousSources)
                ),
                IMPORT_VARS: vars,
                BODY: programPath.node.body,
                NAMED_IMPORTS: namedImports
              })
            ];
          }
        }
      }
    }
  };
};

function createDefaultExportVarName(scope) {
  return scope.generateUidIdentifier("export_default");
}

function createVariable(t, id, valueExpression) {
  return t.variableDeclaration("var", [
    t.variableDeclarator(id, valueExpression)
  ]);
}

function findClosestNonRemovedBefore(path, pathIndex, siblingPaths) {
  // Cannot insertAfter a removed node...

  // Find the previous node which is not removed.
  let refPath = path;
  let i = pathIndex;
  while (refPath.removed && i > 0) {
    refPath = siblingPaths[--i];
  }

  return refPath.removed ? null : refPath;
}
