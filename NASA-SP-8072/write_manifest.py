"""Record release file hashes and optionally locally downloaded source hashes."""
import hashlib,json,platform
from pathlib import Path
R=Path(__file__).resolve().parent
files=['rocket_acoustics.html','engine.js','app.js','app.template.html','workbook-export.js','workbook-template.json','create_workbook_template.mjs','package_workbook_template.py','test_workbook.py','model-data.json','vendor/saturn-directivity.json','vendor/SATURN-LICENSE.txt','NOTICE.txt','README.md','RESEARCH.md','TECHNICAL_AUDIT.md','reference/engine-test-results.json','reference/independent-results.json','reference/dsm2-independent-results.json','reference/browser-test-results.json','reference/workbook-test-results.json','reference/example-case.json','reference/atlas-stationary-case.json','reference/example-report.html','reference/example-results.xlsx']
files += ['.gitattributes','reference/example-results.csv','geometry.js','approach-guide.html','approach.css','method-details.html','method-references.html','extract_reference_figures.py','test_geometry.cjs','test_browser.cjs','reference/geometry-test-results.json']
files += [str(p.relative_to(R)).replace('\\','/') for p in sorted((R/'figures').glob('*'))]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
sources={}
for file in ['sp8072.pdf','haynes2009.pdf','stennis2011.pdf','mathews2025.pdf','saturn/src/data/DI_v1_SATURN.mat']:
    p=R/'research'/file
    if p.exists():sources[file]=sha(p)
result={'release':'1.0.0','review_date':'2026-10-11','saturn_commit':'7c6d1c3b38ebb32512f704fb281d7516b73fd9d6','python':platform.python_version(),'sha256':{f:sha(R/f) for f in files},'local_source_sha256':sources,'verification':'Numerical/software checks; no end-to-end experimental validation. See TECHNICAL_AUDIT.md.'}
(R/'reference/audit-manifest.json').write_text(json.dumps(result,indent=2))
print('Recorded',len(files),'release file hashes and',len(sources),'source hashes.')
