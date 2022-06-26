/*
usage: node bump_version.js BUMP_TYPE [minAppVersion]
*/

const fs = require("fs")
const process = require("process")
const exec = require('child_process').exec;

const shresult = function (command, cb) {
    console.log(command)
    exec(command, function (err, stdout, stderr) {
        if (err != null) {
            return cb(new Error(err), null);
        } else if (typeof (stderr) != "string") {
            return cb(new Error(stderr), null);
        } else {
            return cb(null, stdout);
        }
    });
}


const verReg = /\d+.\d+.\d+/

let bump_idx = 0
switch (process.argv[2]) {
    case "major":
        bump_idx = 0
        break;
    case "minor":
        bump_idx = 1
        break;
    case "patch":
        bump_idx = 2
        break;
    default:
        throw "bump type(major|minor|patch) should be assigned"
}

let minAppVersion = process.argv[3]
if (minAppVersion != undefined && !verReg.test(minAppVersion)) {
    throw "bad format: minAppVersion"
}

const manifest = JSON.parse(fs.readFileSync("manifest.json", encoding = "utf8"))
const pkg = JSON.parse(fs.readFileSync("package.json", encoding = "utf8"))
const versions = JSON.parse(fs.readFileSync("versions.json", encoding = "utf8"))

const verParts = manifest.version.split(".").map(x => parseInt(x))
verParts[bump_idx] += 1
const targetVersion = verParts.join('.')
minAppVersion = minAppVersion === undefined ? manifest.minAppVersion : minAppVersion

manifest.version = targetVersion
manifest.minAppVersion = minAppVersion

pkg.version = targetVersion
versions[targetVersion] = minAppVersion

console.log("Bump to new version: %s, minAppVersion: %s", targetVersion, minAppVersion)

fs.writeFileSync('versions.json', JSON.stringify(versions, null, 4))
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4))
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 4))


const throwOrPrint = (err, stdout) => {
    if (err != null) {
        throw err
    } else {
        console.log(stdout)
    }
}

shresult(`git commit -a -m 'bump to ${targetVersion}'`, throwOrPrint)
shresult(`git tag ${targetVersion}`, throwOrPrint)
shresult(`git push origin --tags`, throwOrPrint)
