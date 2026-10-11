// Development-only visual inspection of the browser's actual XLSX download.
import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const dir=new URL('./_qa/',import.meta.url);
const path=url=>decodeURIComponent(url.pathname.replace(/^\/(\w:)/,'$1'));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path(new URL('results.xlsx',dir))));
console.log((await wb.inspect({kind:'region',sheetId:'Summary',range:'A7:K10',maxChars:2200,tableMaxCols:11})).ndjson);
for(const [sheetName,range] of [['Summary','A1:K10'],['Bands','A1:M11'],['Inputs','A1:C20']]){
 const p=await wb.render({sheetName,range,scale:1.2,format:'png'});
 await fs.writeFile(new URL('export-'+sheetName+'.png',dir),new Uint8Array(await p.arrayBuffer()));
}
