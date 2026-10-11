import fs from "node:fs";
const root = new URL("./", import.meta.url);
const template = fs.readFileSync(new URL("app.template.html", root), "utf8");
const engine = fs.readFileSync(new URL("engine.js", root), "utf8");
fs.writeFileSync(
  new URL("vibration_damage_comparison.html", root),
  template.replace("/*__ENGINE__*/", () => engine),
);
console.log("Built standalone vibration_damage_comparison.html");
