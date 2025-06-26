#!/usr/bin/env node
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function getDependenciesFromPackageJson() {
    try {
        const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
        const deps = [
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {}),
            ...Object.keys(packageJson.peerDependencies || {}),
        ];
        return [...new Set(deps)]; // Remove duplicates
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Error reading package.json:", errorMessage);
        process.exit(1);
    }
}
function parseOptions() {
    const args = process.argv.slice(2);
    const options = {
        input: null,
        output: "license-report",
        showTree: false,
        checkOutdated: false,
    };
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
        else if (arg === "--tree") {
            options.showTree = true;
        }
        else if (arg === "--outdated") {
            options.checkOutdated = true;
        }
    }
    return options;
}
const options = parseOptions();
// Get package names either from input file or package.json
const packageNames = options.input
    ? fs
        .readFileSync(options.input, "utf-8")
        .split("\n")
        .map((pkg) => pkg.trim())
        .filter(Boolean) // Remove empty lines
    : getDependenciesFromPackageJson();
const licenseInfo = [];
async function getPackageInfo(packageName) {
    return new Promise((resolve, reject) => {
        // Get package info including version and dependencies
        (0, child_process_1.exec)(`npm view ${packageName} --json`, (error, stdout, stderr) => {
            if (error) {
                // If package not found, try with @latest
                if (error.message.includes("E404")) {
                    (0, child_process_1.exec)(`npm view ${packageName}@latest --json`, (error, stdout) => {
                        if (error) {
                            resolve({
                                name: packageName,
                                version: "unknown",
                                license: "Not found",
                                dependencies: {},
                            });
                            return;
                        }
                        try {
                            const info = JSON.parse(stdout);
                            resolve({
                                name: info.name || packageName,
                                version: info.version || "unknown",
                                license: info.license || "Unknown",
                                dependencies: info.dependencies || {},
                            });
                        }
                        catch (e) {
                            resolve({
                                name: packageName,
                                version: "unknown",
                                license: "Error parsing",
                                dependencies: {},
                            });
                        }
                    });
                    return;
                }
                reject(error);
                return;
            }
            try {
                const info = JSON.parse(stdout);
                resolve({
                    name: info.name || packageName,
                    version: info.version || "unknown",
                    license: info.license || "Unknown",
                    dependencies: info.dependencies || {},
                });
            }
            catch (e) {
                resolve({
                    name: packageName,
                    version: "unknown",
                    license: "Error parsing",
                    dependencies: {},
                });
            }
        });
    });
}
async function buildDependencyTree(packageName, depth = 0, seen = new Set()) {
    if (seen.has(packageName) || depth > 5) {
        // Prevent infinite loops and too deep trees
        return "";
    }
    seen.add(packageName);
    try {
        const pkgInfo = await getPackageInfo(packageName);
        let tree = `${"  ".repeat(depth)}- ${pkgInfo.name}@${pkgInfo.version} (${pkgInfo.license})`;
        const deps = pkgInfo.dependencies || {};
        if (Object.keys(deps).length > 0) {
            tree +=
                "\n" +
                    (await Promise.all(Object.entries(deps).map(async ([depName, version]) => {
                        return await buildDependencyTree(depName, depth + 1, new Set(seen));
                    })).then((results) => results.join("\n")));
        }
        return tree;
    }
    catch (error) {
        return `${"  ".repeat(depth)}- ${packageName} (Error fetching info)`;
    }
}
async function checkLicenses(packageNames) {
    const processedPackages = new Set();
    for (const packageName of packageNames) {
        if (processedPackages.has(packageName))
            continue;
        try {
            const pkgInfo = await getPackageInfo(packageName);
            licenseInfo.push({
                [pkgInfo.name]: `${pkgInfo.license} (${pkgInfo.version})`,
            });
            processedPackages.add(packageName);
            console.log(`Processed: ${pkgInfo.name}@${pkgInfo.version} (${pkgInfo.license})`);
        }
        catch (error) {
            console.error(`Error processing ${packageName}:`, error.message);
        }
    }
    await generateMarkdownFile(packageNames);
}
async function checkOutdatedPackages(packages) {
    const outdatedInfo = {};
    try {
        // Run npm outdated command
        const { stdout } = await new Promise((resolve, reject) => {
            (0, child_process_1.exec)("npm outdated --json --long", { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
                if (error && error.code !== 1) {
                    // npm outdated exits with 1 when there are outdated packages
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            });
        });
        const outdatedData = JSON.parse(stdout || "{}");
        // Process each outdated package
        for (const [pkg, data] of Object.entries(outdatedData)) {
            outdatedInfo[pkg] = {
                current: data.current,
                latest: data.latest,
                wanted: data.wanted,
                isOutdated: data.current !== data.latest,
            };
        }
    }
    catch (error) {
        console.error("Error checking for outdated packages:", error);
    }
    return outdatedInfo;
}
async function generateMarkdownFile(packages) {
    const projectLicenses = {};
    const packageVersions = {};
    // Helper function to find duplicate package versions
    function findDuplicatePackages(packages) {
        const versionMap = {};
        // Extract package names and versions
        packages.forEach((pkg) => {
            const versionMatch = pkg.match(/(.+)@([^@]+)$/);
            if (versionMatch) {
                const [, name, version] = versionMatch;
                if (!versionMap[name]) {
                    versionMap[name] = new Set();
                }
                versionMap[name].add(version);
            }
        });
        // Filter for packages with multiple versions
        return Object.entries(versionMap)
            .filter(([_, versions]) => versions.size > 1)
            .map(([name, versions]) => ({
            name,
            versions: Array.from(versions),
        }));
    }
    // Process license information
    licenseInfo.forEach((info) => {
        const packageFullName = Object.keys(info)[0];
        const [packageName, version] = packageFullName.split("@");
        const license = info[packageFullName];
        if (!projectLicenses[license]) {
            projectLicenses[license] = [];
        }
        projectLicenses[license].push(packageFullName);
        if (version && version !== "unknown") {
            if (!packageVersions[packageName]) {
                packageVersions[packageName] = [];
            }
            if (!packageVersions[packageName].includes(version)) {
                packageVersions[packageName].push(version);
            }
        }
    });
    const outputDir = path.resolve(options.output);
    (0, fs_1.mkdirSync)(outputDir, { recursive: true });
    // Check for outdated packages if requested
    let outdatedSection = "";
    if (options.checkOutdated) {
        const outdatedPackages = await checkOutdatedPackages(packages);
        const outdatedList = Object.entries(outdatedPackages)
            .filter(([_, info]) => info.isOutdated)
            .map(([pkg, info]) => `- **${pkg}**: ${info.current} → ${info.latest} (wanted: ${info.wanted})`);
        if (outdatedList.length > 0) {
            outdatedSection = `
## Outdated Dependencies

The following packages have newer versions available:

${outdatedList.join("\n")}

To update, run: \`npm update\`
`;
        }
        else {
            outdatedSection =
                "\n## Dependencies\n\nAll dependencies are up to date! 🎉\n";
        }
    }
    // Generate dependency tree if enabled
    let dependencyTreeSection = "";
    if (options.showTree) {
        const trees = await Promise.all(packages.map((pkg) => buildDependencyTree(pkg)));
        dependencyTreeSection = `
## Dependency Tree

\`\`\`
${trees.join("\n\n")}
\`\`\`
`;
    }
    // Generate duplicate packages section
    const duplicateVersions = findDuplicatePackages(packages);
    let duplicatesSection = "";
    if (duplicateVersions.length > 0) {
        duplicatesSection = `
## Potential Version Conflicts

The following packages have multiple versions in use:

${duplicateVersions
            .map(({ name, versions }) => `- **${name}**: ${versions.join(", ")}`)
            .join("\n")}
`;
    }
    const markdownContent = `# Dependency License Report

## Summary

### License Distribution
${Object.entries(projectLicenses)
        .map(([license, pkgs]) => `- **${license}**: ${pkgs.length} packages`)
        .join("\n")}

## Packages with Licenses
${packages
        .filter((pkg) => licenseInfo.some((info) => Object.keys(info)[0] === pkg))
        .map((pkg) => {
        const info = licenseInfo.find((info) => Object.keys(info)[0] === pkg);
        return `- **${pkg}**: ${info[pkg]}`;
    })
        .join("\n")}

## Missing License Information
${packages.filter((pkg) => !licenseInfo.some((info) => Object.keys(info)[0] === pkg)).length > 0
        ? packages
            .filter((pkg) => !licenseInfo.some((info) => Object.keys(info)[0] === pkg))
            .map((pkg) => `- ${pkg}`)
            .join("\n")
        : "No packages with missing license information"}

${outdatedSection}
${duplicatesSection}
${dependencyTreeSection}

> Generated at: ${new Date().toISOString()}
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
