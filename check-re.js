const fs = require("fs");
const content = fs.readFileSync("packages/scraper-engine/src/adapters/google-maps.adapter.ts", "utf8");
const tmplStart = content.indexOf("`(function() {");
const tmplEnd = content.indexOf("})()`", tmplStart);
const templateLiteral = content.substring(tmplStart + 1, tmplEnd - 1);
const blockedDomainsArr = JSON.stringify(["google.com"]);
const fn = templateLiteral.replace("${blockedDomainsArr}", blockedDomainsArr);

// Find the cleanAddressStr regex
const idx = fn.indexOf("var cleanAddressStr = part.replace(/");
const snippet = fn.substring(idx, idx + 100);
console.log("Snippet:", JSON.stringify(snippet));
