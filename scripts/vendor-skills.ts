// runner/scripts/vendor-skills.ts  — run: npm run vendor
import { cpSync, mkdirSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MARKETING_SKILLS } from "../src/team.js";

const home = homedir();
const skillsSrc = join(home, ".claude", "skills");
const agentsSrc = join(home, ".claude", "agents");
const destClaude = join(process.cwd(), ".claude");
mkdirSync(join(destClaude, "skills"), { recursive: true });
mkdirSync(join(destClaude, "agents"), { recursive: true });

for (const s of MARKETING_SKILLS) {
  cpSync(join(skillsSrc, s), join(destClaude, "skills", s), { recursive: true });
}
for (const id of ["seo-content-lead","paid-ads","social-brand","lifecycle-email","growth-cro","product-marketing","demand-gen"]) {
  copyFileSync(join(agentsSrc, `marketing-${id}.md`), join(destClaude, "agents", `marketing-${id}.md`));
}
console.log(`Vendored ${MARKETING_SKILLS.length} skills + 7 agents into ${destClaude}`);
