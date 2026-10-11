import fs from "node:fs";
const root = new URL("./", import.meta.url);
const template = fs.readFileSync(new URL("app.template.html", root), "utf8");
const engine = fs.readFileSync(new URL("engine.js", root), "utf8");
const tutorial = fs.readFileSync(new URL("tutorial.html", root), "utf8");
const tutorialScript = fs.readFileSync(new URL("tutorial.js", root), "utf8");
const reference = {
  case: JSON.parse(
    fs.readFileSync(new URL("reference/irvine-2011-case.json", root), "utf8"),
  ),
  benchmark: JSON.parse(
    fs.readFileSync(new URL("reference/benchmark-results.json", root), "utf8"),
  ).published_regression,
};
fs.writeFileSync(
  new URL("vibration_damage_comparison.html", root),
  template
    .replace("/*__ENGINE__*/", () => engine)
    .replace("/*__REFERENCE__*/ null", () => JSON.stringify(reference))
    .replace("<!--__TUTORIAL__-->", () => tutorial)
    .replace("/*__TUTORIAL_SCRIPT__*/", () => tutorialScript),
);
console.log("Built standalone vibration_damage_comparison.html");
