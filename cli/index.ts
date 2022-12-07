#!/usr/bin/env node

import glob from 'glob';
import path from 'path';
import fs from 'fs';
import CodeGenerator from '../CodeGenerator';
import assert from 'assert';
import inspector from 'inspector';

export interface IReference {
    path: string;
}

export default (async () => {
    let rootDir = process.cwd();
    let outDir = path.resolve(rootDir,'schema');
    const args = Array.from(process.argv);
    let baseTsConfig: string | null = null;
    const sourceFiles = new Array<string>();
    const references = new Array<IReference>();
    while(args.length > 0) {
        switch(args[0]){
            case process.argv[0]:
            case process.argv[1]:
                args.shift();
                break;
            case '--ts-reference':
                args.shift();
                const newReferencePath = args.shift();
                assert.strict.ok(newReferencePath);
                references.push({
                    path: path.resolve(process.cwd(),newReferencePath)
                });
                break;
            case '--ts-extends':
                args.shift();
                const arg = args.shift();
                assert.strict.ok(arg);
                const newBaseTsConfig = path.resolve(process.cwd(),arg);
                baseTsConfig = path.resolve(process.cwd(),newBaseTsConfig);
                break;
            case '--exclude': {
                args.shift();
                const pattern = args.shift();
                assert.strict.ok(typeof pattern === 'string');
                for(let i = 0; i < sourceFiles.length; i++){
                    const sourceFile = sourceFiles[i];
                    if(
                        typeof sourceFile === 'string' &&
                        (new RegExp(pattern).test(sourceFile))
                    ){
                        sourceFiles.splice(i,1);
                    }
                }
                break;
            }
            case '--inspect':
                args.shift();
                inspector.open();
                break;
            case '--include':
                args.shift();
                const pattern = args.shift();
                assert.strict.ok(typeof pattern === 'string');
                sourceFiles.push(...glob.sync(path.resolve(process.cwd(),pattern)));
                break;
            case '--output':
            case '-o': {
                args.shift();
                const newOutDir = args.shift();
                assert.strict.ok(typeof newOutDir === 'string');
                outDir = path.resolve(process.cwd(),newOutDir);
                break;
            }
            default:
                console.log(
                    'invalid argument: %s',
                    args[0]
                );
                process.exit(1);
        }
    }

    const files = await new CodeGenerator({
        rootDir,
        destinationFolder: outDir,
        include: sourceFiles
    }).generate();

    await fs.promises.rm(outDir,{
        recursive: true,
        force: true
    });

    await fs.promises.mkdir(outDir);

    assert.strict.ok(files !== null);

    for(const f of files){
        if(!f.contents){
            continue;
        }
        const outFile = path.resolve(outDir,f.outFile);
        await fs.promises.mkdir(path.dirname(outFile),{
            recursive: true
        });
        await fs.promises.writeFile(
            outFile,
            f.contents
        );
    }

    if(baseTsConfig){
        await fs.promises.writeFile(path.resolve(outDir,'tsconfig.json'),JSON.stringify({
            extends: path.relative(outDir, baseTsConfig),
            references: references.map(r => ({
                ...r,
                path: path.relative(outDir,r.path)
            }))
        },null,4));
    }
})().catch(reason => {
    console.error(reason);
    process.exitCode = 1;
});
