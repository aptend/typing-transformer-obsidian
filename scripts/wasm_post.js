// For cross platform, use scripts to do these simple tasks

const fs = require("fs")
const filename = "./liberty-web/charliberty.js"
fs.writeFileSync(filename, fs.readFileSync(filename).toString().replace("import.meta.url", "''"))
