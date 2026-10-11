"""Package the artifact-tool-authored Excel template for offline browser use."""
import json, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
root=Path(__file__).resolve().parent
ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(root/'_qa/workbook-template.xlsx') as z:
    files={n:z.read(n).decode('utf-8') for n in z.namelist()}
sheets=[]
for i in range(1,4):
    filename=f'xl/worksheets/sheet{i}.xml'
    xml=ET.fromstring(files[filename])
    cells={c.attrib['r']:c for c in xml.findall('.//x:c',ns)}
    headers=[c.find('x:v',ns).text for c in xml.findall('.//x:row[@r="7"]/x:c',ns)]
    sheets.append({'file':filename,'headers':headers,'styles':{a:c.attrib.get('s','0') for a,c in cells.items()}})
(root/'workbook-template.json').write_text(json.dumps({'files':files,'sheets':sheets},ensure_ascii=False),encoding='utf-8')
print('Packaged three styled worksheets for offline export.')
