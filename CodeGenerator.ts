import path from "path";
import ts from "typescript";
import TextStream from "@textstream/core";

export interface ICodeGeneratorOptions {
  rootDir: string;
  include: string[];
  destinationFolder: string;
  indentationSize?: number | null;
}

export interface IGeneratedFile {
  outFile: string;
  contents: string;
  requirements: Set<string>;
  sourceFile: ts.SourceFile;
  requires: Map<string, Set<string>>;
}

export default class CodeGenerator extends TextStream {
  readonly #destinationFolder;
  readonly #include;
  readonly #outFiles;
  readonly #program;
  readonly #rootDir;
  #current: IGeneratedFile | null;
  public constructor({
    include,
    destinationFolder,
    rootDir,
    indentationSize = null,
  }: ICodeGeneratorOptions) {
    super({ indentationSize });
    this.#outFiles = new Array<IGeneratedFile>();
    this.#destinationFolder = destinationFolder;
    this.#rootDir = rootDir;
    this.#current = null;
    this.#include = Array.from(new Set(include));
    this.#program = ts.createProgram({
      options: {
        target: ts.ScriptTarget.ESNext,
      },
      rootNames: this.#include,
    });
  }
  public async generate(): Promise<IGeneratedFile[] | null> {
    let interfaceName: string;
    const header = new TextStream();
    for (const sourceFile of this.#program.getSourceFiles()) {
      if (
        /\.d\.ts$/.test(sourceFile.fileName) ||
        !/\.tsx?$/.test(sourceFile.fileName)
      ) {
        continue;
      }
      console.log("Reading file: %s", sourceFile.fileName);
      interfaceName = path
        .basename(sourceFile.fileName)
        .replace(/\.[a-zA-Z0-9]+$/, "");
      interfaceName = `${interfaceName[0]?.toLocaleUpperCase()}${interfaceName.substring(
        1
      )}`;
      const current: IGeneratedFile = {
        sourceFile,
        requires: new Map(),
        contents: "",
        requirements: new Set(),
        outFile: path.join(
          path
            .dirname(sourceFile.fileName)
            .replace(new RegExp(`^${this.#rootDir}\/?`), ""),
          path.basename(sourceFile.fileName)
        ),
      };
      {
        this.#current = current;
        if (!(await this.#onNode(sourceFile))) {
          console.error(
            "Failed to generate files for file kind: %d",
            sourceFile.kind
          );
          return null;
        }
        this.#current = null;
      }
      for (const r of current.requires) {
        const destFolder = path.resolve(
          this.#destinationFolder,
          path.dirname(current.outFile)
        );
        header.write(
          `import {\n`,
          () => {
            for (const a of r[1]) {
              header.write(`${a},\n`);
            }
          },
          "}"
        );
        header.append(
          ` from '${path.relative(
            destFolder,
            r[0].replace(/\.(js|ts)x?$/, "")
          )}';\n`
        );
      }
      /**
       * import necessary helpers
       */
      {
        const helperFunctions = new Map(
          Object.entries({
            isUnknownObject: () =>
              header.write(
                "function isUnknownObject(value: unknown): value is Record<string,unknown> {\n",
                () => {
                  header.write(
                    `return typeof value === 'object' && value !== null;\n`
                  );
                },
                "}\n"
              ),
            validateVector: () =>
              header.write(
                "function validateVector<T>(value: unknown, validate: (val: unknown) => boolean): value is T[] {\n",
                () => {
                  header.write("if(!Array.isArray(value)) return false;\n");
                  header.write(
                    `for(const i of value) if(!validate(i)) return false;\n`
                  );
                  header.write("return true;\n");
                },
                "}\n"
              ),
          })
        );
        let importHelper: boolean;
        for (const helperFn of helperFunctions) {
          importHelper = false;
          for (const r of current.requirements) {
            if (helperFn[0] === r) {
              importHelper = true;
              break;
            }
          }
          if (importHelper) {
            helperFn[1]();
          }
        }
      }
      header.append(this.value());
      current.contents = header.value();
      this.#outFiles.push(current);
    }
    return this.#outFiles;
  }
  #generateDefaultInterfaceDeclaration({
    declaration,
    castTo,
    extendExpression,
  }: {
    declaration: ts.InterfaceDeclaration;
    extendExpression?: string;
    castTo?: string;
  }) {
    const { members } = declaration;
    this.append("Object.freeze(Object.seal({\n");
    this.indentBlock(() => {
      let lastMember: ts.TypeElement | null = null;
      for (const member of members) {
        lastMember = member;
      }
      for (const member of members) {
        if (
          !member.name ||
          !ts.isIdentifier(member.name) ||
          !ts.isPropertySignature(member)
        ) {
          continue;
        }
        if (!member.type) {
          continue;
        }
        this.write(`"${member.name.escapedText}": `);
        if (
          !this.#generateDefaultExpression({
            typeNode: member.type,
          })
        ) {
          console.error(
            "failed to generate default expression for member kind: %d",
            member.type.kind
          );
          continue;
        }
        if (member !== lastMember || extendExpression) {
          this.append(",");
        }
        this.append("\n");
      }
      if (extendExpression) {
        this.write(`...${extendExpression}\n`);
      }
    });
    this.write("}");
    if (castTo) {
      this.append(` as ${castTo}`);
    }
    this.append("));\n");
  }
  #generateDefaultExpression({ typeNode }: { typeNode: ts.TypeNode }) {
    const resolved = this.#program
      .getTypeChecker()
      .getTypeFromTypeNode(typeNode);
    if (resolved.isClass()) {
      this.append(`new ${resolved.symbol.escapedName.toString()}()`);
      return true;
    } else if (resolved.isClassOrInterface()) {
      switch (resolved.symbol.escapedName) {
        case "Date":
          this.append("new Date(0)");
          break;
        default: {
          const { members } = resolved.symbol;
          if (!members) {
            console.error(
              "no members property available on resolved type: %o",
              resolved
            );
            return false;
          }
          this.append("Object.seal(Object.freeze({\n");
          this.indentBlock(() => {
            let lastMember: ts.Symbol | null = null;
            const symbols = new Set<ts.Symbol>();
            members.forEach((member) => {
              symbols.add(member);
              lastMember = member;
            });
            for (const member of symbols) {
              const { valueDeclaration } = member;
              if (
                !valueDeclaration ||
                !ts.isPropertySignature(valueDeclaration) ||
                !ts.isIdentifier(valueDeclaration.name) ||
                !valueDeclaration.type
              ) {
                console.error(
                  "validation failed for node: %o",
                  valueDeclaration
                );
                return;
              }
              this.write(`"${valueDeclaration.name.escapedText}": `);
              if (
                !this.#generateDefaultExpression({
                  typeNode: valueDeclaration.type,
                })
              ) {
                console.error(
                  "failed to generate default expression for node kind: %d",
                  valueDeclaration.type.kind
                );
                return;
              }
              if (member !== lastMember) {
                this.append(",");
              }
              this.append("\n");
            }
          });
          this.write("}))");
        }
      }
      return true;
    } else if (resolved.isUnion()) {
      const [type] = resolved.types;
      if (!type) {
        console.error("union with no types: %o", resolved.types);
        return false;
      }
      const typeNode = this.#program
        .getTypeChecker()
        .typeToTypeNode(type, undefined, undefined);
      if (!typeNode) {
        console.error("failed to get type node from type: %o", type);
        return false;
      }
      if (
        !this.#generateDefaultExpression({
          typeNode,
        })
      ) {
        console.error(
          "failed to generate default expression for type node: %o",
          typeNode
        );
        return false;
      }
      return true;
    } else if (ts.isTypeLiteralNode(typeNode)) {
      this.append("{\n");
      this.indentBlock(() => {
        const lastMember = typeNode.members[typeNode.members.length - 1];
        for (const m of typeNode.members) {
          if (!m.name) {
            console.error(
              'a member of type node does not come with a "%s" property: %o',
              "name",
              m
            );
            continue;
          }
          if (!ts.isPropertySignature(m) || !m.type) {
            console.error("could not handle member: %o", m);
            continue;
          }
          this.write(`"${m.name.getText()}": `);
          if (
            !this.#generateDefaultExpression({
              typeNode: m.type,
            })
          ) {
            console.error(
              "failed to generate default expression kind: %d",
              m.type.kind
            );
            continue;
          }
          if (m !== lastMember) {
            this.append(",");
          }
          this.append("\n");
        }
      });
      this.write("}");
      return true;
    } else if (ts.isUnionTypeNode(typeNode)) {
      const [first] = typeNode.types;
      if (!first) {
        console.error("type node from union type node was empty");
        return false;
      }
      if (
        !this.#generateDefaultExpression({
          typeNode: first,
        })
      ) {
        console.error(
          "failed to generate default expression for node kind: %d",
          first.kind
        );
        return false;
      }
      return true;
    } else if (resolved.isStringLiteral()) {
      this.append(`"${resolved.value}"`);
      return true;
    } else if (ts.isLiteralTypeNode(typeNode)) {
      const { literal } = typeNode;
      return this.#getDefaultExpressionFromTypeNode(literal);
    } else if (ts.isTypeReferenceNode(typeNode)) {
      if (ts.isPropertySignature(typeNode.parent)) {
        if (typeNode.parent.questionToken) {
          this.append("undefined");
          return true;
        }
      }
      return false;
    }
    return this.#getDefaultExpressionFromTypeNode(typeNode);
  }
  #getDefaultExpressionFromTypeNode(
    typeNode:
      | ts.TypeNode
      | ts.NullLiteral
      | ts.BooleanLiteral
      | ts.LiteralExpression
      | ts.PrefixUnaryExpression
  ) {
    if (ts.isStringLiteral(typeNode)) {
      this.append(`"${typeNode.text}"`);
      return true;
    }
    switch (typeNode.kind) {
      case ts.SyntaxKind.NumberKeyword:
        this.append("0");
        break;
      case ts.SyntaxKind.StringKeyword:
        this.append("''");
        break;
      case ts.SyntaxKind.NullKeyword:
        this.append("null");
        break;
      case ts.SyntaxKind.ArrayType:
        this.append("[]");
        break;
      case ts.SyntaxKind.BooleanKeyword:
        this.append("false");
        break;
      case ts.SyntaxKind.TrueKeyword:
        this.append("true");
        break;
      case ts.SyntaxKind.FalseKeyword:
        this.append("false");
        break;
      default:
        return false;
    }
    return true;
  }
  #generateValidateDeclarationFile(node: ts.InterfaceDeclaration) {
    const current = this.#current;
    if (!current) {
      return false;
    }
    let result = true;
    const interfaceName = `${node.name.escapedText}`;
    this.#import([interfaceName.toString()], current.sourceFile.fileName);
    this.write(
      `export function create${interfaceName}(params: Partial<${interfaceName}> = {}): ${interfaceName} {\n`,
      () => {
        this.write("return ");
        this.#generateDefaultInterfaceDeclaration({
          extendExpression: "params",
          declaration: node,
          castTo: interfaceName,
        });
        // this.write('return Object.seal(Object.freeze({\n', () => {
        //     for(const member of node.members){
        //         if(
        //             !ts.isPropertySignature(member) || !ts.isIdentifier(member.name) ||
        //             !member.type
        //         ){
        //             continue;
        //         }
        //         this.write(`"${member.name.escapedText}": `);
        //         this.#generateDefaultExpression({
        //             typeNode: member.type
        //         });
        //         if(member !== node.members[node.members.length - 1]){
        //             this.append(',')
        //         }
        //         this.append('\n');
        //     }
        // },'}));\n');
      },
      "}\n"
    );
    this.write(
      `export function is${interfaceName}(value: unknown): value is ${interfaceName} {\n`,
      async () => {
        this.write(
          `if(!${this.#require("isUnknownObject")}(value)) return false;\n`
        );
        for (const member of node.members) {
          if (
            !ts.isPropertySignature(member) ||
            !ts.isIdentifier(member.name) ||
            !member.type
          ) {
            continue;
          }
          if (
            !this.#generateTypeNodeValidationCode({
              typeNode: member.type,
              varName: `value['${member.name.escapedText}']`,
            })
          ) {
            debugger;
            console.error(
              "failed to generate type node validation code for type node kind: %d",
              member.type.kind
            );
            result = false;
            break;
          }
        }
        this.write("return true;\n");
      },
      "}\n"
    );
    return result;
  }
  // #generateTypeValidationExpression({
  //     varName,
  //     typeNode
  // }:{
  //     typeNode: ts.TypeNode;
  //     varName: string;
  // }) {
  //     if(ts.isUnionTypeNode(typeNode)){
  //         this.write('if(\n', () => {
  //             const lastTypeNode = typeNode.types[typeNode.types.length - 1];
  //             for(const t of typeNode.types){
  //                 this.write('!(\m', () => {
  //                     if(!this.#generateTypeNodeValidationCode({
  //                         typeNode: t,
  //                         varName
  //                     })){
  //                         console.error('failed to generate type validation code for node: %o',t);
  //                     }
  //                 },')');
  //                 if(t !== lastTypeNode){
  //                     this.append(' &&');
  //                 }
  //                 this.append('\n');
  //             }

  //         },') return false;')
  //         return true;
  //     } else if(ts.isLiteralTypeNode(typeNode)){
  //         this.#generateTypeValidationExpression({
  //             typeNode: typeNode.literal
  //         })
  //     }
  //     // const resolved = this.#program.getTypeChecker().getTypeFromTypeNode(typeNode);
  //     let typeOfCheck: string | null;
  //     switch(typeNode.kind){
  //         case ts.SyntaxKind.NumberKeyword:
  //             typeOfCheck = 'number';
  //             break;
  //         case ts.SyntaxKind.BigIntKeyword:
  //             typeOfCheck = 'bigint';
  //             break;
  //         case ts.SyntaxKind.StringKeyword:
  //             typeOfCheck = 'string';
  //             break;
  //         case ts.SyntaxKind.NullKeyword:
  //             this.append(`${varName} === null`);
  //             return true;
  //         // default: {
  //         //     const c = this.#program.getTypeChecker().getTypeFromTypeNode(typeNode);
  //         //     if(c.isClassOrInterface()) {
  //         //         if(!this.#generateTypeValidationCode({
  //         //             expression: {
  //         //                 type: c
  //         //             },
  //         //             varName
  //         //         })){
  //         //             return false;
  //         //         }
  //         //     } else {
  //         //         this.append(`${varName} instanceof ${c.symbol.escapedName}`);
  //         //     }
  //         //     return true;
  //         // }
  //         default:
  //             return false;
  //     }
  //     this.append(`typeof ${varName} === '${typeOfCheck}'`);
  //     return true;
  // }
  #import(modules: string[], file: string) {
    let oldModules = this.#current?.requires.get(file);
    if (!oldModules) {
      oldModules = new Set<string>();
      this.#current?.requires.set(file, oldModules);
    }
    for (const m of modules) oldModules.add(m);
  }
  #require(id: string) {
    this.#current?.requirements.add(id);
    return id;
  }
  #generateTypeNodeValidationCode({
    typeNode,
    varName,
  }: {
    typeNode: ts.TypeNode;
    varName: string;
  }) {
    const tsType = this.#program.getTypeChecker().getTypeFromTypeNode(typeNode);
    // const current = this.#current;
    // if(!current){
    //     return false;
    // }
    let result = true;
    if (tsType.isClass() || tsType.isClassOrInterface()) {
      switch (tsType.symbol.escapedName) {
        case "Date":
          this.write(`if(!(${varName} instanceof Date))  return false;\n`);
          break;
        default: {
          const members = new Set<ts.Symbol>();
          this.write(
            `if(!${this.#require(
              "isUnknownObject"
            )}(${varName})) return false;\n`
          );
          tsType.symbol.members?.forEach((m) => {
            members.add(m);
          });
          for (const m of members) {
            const { valueDeclaration } = m;
            if (
              !valueDeclaration ||
              !ts.isPropertySignature(valueDeclaration) ||
              !valueDeclaration.type
            ) {
              // console.log('ignoring property: %s',m.name)
              continue;
            }
            if (
              !this.#generateTypeNodeValidationCode({
                varName: `${varName}['${m.name}']`,
                typeNode: valueDeclaration.type,
              })
            ) {
              return false;
            }
          }
        }
      }
    } else if (ts.isArrayTypeNode(typeNode)) {
      this.write(
        `if(!${this.#require("validateVector")}(${varName}, value => {\n`,
        () => {
          if (
            !this.#generateTypeNodeValidationCode({
              typeNode: typeNode.elementType,
              varName: `value`,
            })
          ) {
            console.error(
              "failed to generate validation code for type kind: %d",
              typeNode.elementType.kind
            );
          }
          this.write("return true;\n");
        },
        "})) return false;\n"
      );
    } else if (ts.isTypeLiteralNode(typeNode)) {
      const validateObject = this.#require("isUnknownObject");
      this.write(`if(!${validateObject}(${varName})) return false;\n`);
      for (const m of typeNode.members) {
        if (!ts.isPropertySignature(m) || !m.type || !ts.isIdentifier(m.name)) {
          continue;
        }
        if (
          !this.#generateTypeNodeValidationCode({
            typeNode: m.type,
            varName: `${varName}['${m.name.escapedText}']`,
          })
        ) {
          return false;
        }
      }
    } else if (ts.isUnionTypeNode(typeNode)) {
      let status = true;
      this.write(
        "if(\n",
        () => {
          const lastType = typeNode.types[typeNode.types.length - 1];
          for (const type of typeNode.types) {
            this.write(
              "!(() => {\n",
              () => {
                if (
                  !this.#generateTypeNodeValidationCode({
                    typeNode: type,
                    varName,
                  })
                ) {
                  console.error(
                    "failed to generate type validation expression for kind: %d",
                    type.kind
                  );
                  status = false;
                }
                this.write("return true;\n");
              },
              "})()"
            );
            if (type !== lastType) {
              this.append(" &&");
            }
            this.append("\n");
          }
        },
        ") return false;\n"
      );
      if (!status) {
        console.error(
          "failed to generate code for union type node: %o",
          typeNode
        );
        return false;
      }
    } else {
      let expression: string | null;
      let typeOfCheck: string | null;
      let target:
        | ts.TypeNode
        | ts.NullLiteral
        | ts.BooleanLiteral
        | ts.LiteralExpression
        | ts.PrefixUnaryExpression;
      if (ts.isLiteralTypeNode(typeNode)) {
        const { literal } = typeNode;
        target = literal;
      } else {
        target = typeNode;
      }
      switch (target.kind) {
        case ts.SyntaxKind.LiteralType:
          if (tsType.isLiteral()) {
            if (typeof tsType.value === "string") {
              expression = `${varName} === "${tsType.value}"`;
            } else if (typeof tsType.value === "number") {
              expression = `${varName} === ${tsType.value}`;
            } else {
              expression = null;
            }
          } else {
            expression = null;
          }
          typeOfCheck = null;
          break;
        case ts.SyntaxKind.NumberKeyword:
          typeOfCheck = "number";
          expression = null;
          break;
        case ts.SyntaxKind.BigIntKeyword:
          typeOfCheck = "bigint";
          expression = null;
          break;
        case ts.SyntaxKind.StringKeyword:
          typeOfCheck = "string";
          expression = null;
          break;
        case ts.SyntaxKind.ArrayType:
          expression = `Array.isArray(${varName})`;
          typeOfCheck = null;
          break;
        case ts.SyntaxKind.StringLiteral:
          if (!ts.isStringLiteral(target)) {
            expression = typeOfCheck = null;
            break;
          }
          expression = `${varName} === "${target.text}"`;
          typeOfCheck = null;
          break;
        case ts.SyntaxKind.NullKeyword:
          expression = `${varName} === null`;
          typeOfCheck = null;
          break;
        case ts.SyntaxKind.FunctionType:
          expression = null;
          typeOfCheck = "function";
          break;
        /**
         * if we reach here, it probably means that we
         * have an interface that is using template arguments,
         * so right now is not possible to test them
         */
        case ts.SyntaxKind.TypeReference:
          expression = "true";
          typeOfCheck = null;
          break;
        case ts.SyntaxKind.BooleanKeyword:
          expression = null;
          typeOfCheck = "boolean";
          break;
        case ts.SyntaxKind.TrueKeyword:
          expression = `${varName} === true`;
          typeOfCheck = null;
          break;
        case ts.SyntaxKind.FalseKeyword:
          expression = `${varName} === false`;
          typeOfCheck = null;
          break;
        default:
          expression = typeOfCheck = null;
      }
      if (expression === null && typeOfCheck === null) {
        debugger;
        console.error("unhandled node kind: %d", typeNode.kind);
        return false;
      }
      if (expression === null && typeOfCheck !== null) {
        expression = `typeof ${varName} === '${typeOfCheck}'`;
      }
      if (expression !== null) {
        this.write(`if(!(${expression})) return false;\n`);
      }
      return true;
    }
    return result;
  }
  async #onNode(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node)) {
      if (!this.#generateValidateDeclarationFile(node)) {
        console.error(
          "failed to generate validation declaration file for node kind: %d",
          node.kind
        );
        return false;
      }
      return true;
    }
    if (ts.isImportDeclaration(node)) {
      return true;
    }
    for (const child of node.getChildren()) {
      if (!(await this.#onNode(child))) {
        console.error("failed to parse node kind: %d", child.kind);
        return false;
      }
    }
    return true;
  }
}
