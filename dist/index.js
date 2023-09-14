"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function parseOptions() {
    const args = process.argv.slice(2);
    const options = { input: "input.txt", output: "license-report" };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "-i" || arg === "--input") {
            options.input = args[i + 1];
            i++;
        }
        else if (arg === "-o" || arg === "--output") {
            options.output = args[i + 1];
            i++;
        }
    }
    return options;
}
const options = parseOptions();
// Read the package names from input.txt and format them as an array
const packageNames = fs
    .readFileSync(options.input, "utf-8")
    .split("\n")
    .map((pkg) => pkg.trim());
const licenseInfo = [];
function getLicenseInfo(packageName) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`npm view ${packageName} license`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            const lines = stdout.trim().split("\n");
            if (lines.length > 0) {
                const license = lines[0].trim();
                resolve({ [packageName]: license });
            }
            else {
                resolve({ [packageName]: "License information not found" });
            }
        });
    });
}
async function checkLicenses(packageNames) {
    for (const packageName of packageNames) {
        try {
            const info = await getLicenseInfo(packageName);
            licenseInfo.push(info);
            console.log(info);
        }
        catch (error) {
            console.error(`Error checking license for ${packageName}: ${error.message}`);
        }
    }
    generateMarkdownFile(packageNames);
}
function generateMarkdownFile(packages) {
    const projectLicenses = {};
    licenseInfo.forEach((info) => {
        const packageName = Object.keys(info)[0];
        const license = info[packageName];
        if (!projectLicenses[license]) {
            projectLicenses[license] = [];
        }
        projectLicenses[license].push(packageName);
    });
    const outputDir = path.resolve(options.output);
    (0, fs_1.mkdirSync)(outputDir, { recursive: true });
    const markdownContent = `
Project Licenses:
-----------------
${Object.entries(projectLicenses)
        .map(([license, packages]) => `- ${license}: ${packages.length} packages`)
        .join("\n")}

Packages with Unknown Licenses:
-------------------------------
${packages
        .filter((pkg) => !licenseInfo.some((info) => Object.keys(info)[0] === pkg))
        .join("\n")}

Packages with Licenses:
-------------------------------
${packages
        .filter((pkg) => licenseInfo.some((info) => Object.keys(info)[0] === pkg))
        .map((pkg) => `- ${pkg}: ${licenseInfo.find((info) => Object.keys(info)[0] === pkg)[pkg]}`)
        .join("\n")}
`;
    const outputPath = path.join(outputDir, "license-report.md");
    try {
        (0, fs_1.writeFileSync)(outputPath, markdownContent);
        console.log(`License report generated at ${outputPath}`);
    }
    catch (error) {
        console.error(`Error writing license report: ${error.message}`);
    }
}
checkLicenses(packageNames);
