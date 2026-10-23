import {build} from 'vite';
import ts from 'typescript';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
await build();
await mkdir('dist/server',{recursive:true});
for(const name of ['model','validation']){
 const source=(await readFile(`src/${name}.ts`,'utf8')).replace("'./model'","'./model.mjs'");
 await writeFile(`dist/server/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
}
