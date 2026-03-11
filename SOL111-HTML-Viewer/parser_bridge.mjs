const target = window.PCHParser || {};
await import("./pch_parser.js");
const updated = window.PCHParser || {};
Object.keys(target).forEach(key => { delete target[key]; });
Object.assign(target, updated);
window.PCHParser = target;
