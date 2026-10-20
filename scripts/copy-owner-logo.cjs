const fs = require("node:fs");
const path = require("node:path");

const source = "C:/Users/USER/Downloads/Logo Resmi BTRD25.png";
const target = path.join(process.cwd(), "public", "assets", "Logo_Resmi_BTRD25_Source.png");
fs.copyFileSync(source, target);
console.log(target);
