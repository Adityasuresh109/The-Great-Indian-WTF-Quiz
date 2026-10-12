import {mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
const files=['index.html','style.css','app.js','backend.js','quiz.js','host-key.js'];
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const file of files) await copyFile(file,`dist/${file}`);
await writeFile('dist/.nojekyll','');
console.log('Prepared static GitHub Pages release:',files.join(', '));
