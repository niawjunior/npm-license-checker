#!/usr/bin/env node
import { exec } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import * as path from "path";
import * as fs from "fs";

interface PackageInfo {
  name: string;
  version: string;
  license: string;
  description?: string;
  author?: string | { name?: string; email?: string; url?: string };
  homepage?: string;
  repository?: string | { url: string };
  bugs?: string | { url: string };
  dependencies?: { [name: string]: string };
  devDependencies?: { [name: string]: string };
  peerDependencies?: { [name: string]: string };
  keywords?: string[];
  main?: string;
  types?: string;
  scripts?: { [name: string]: string };
  _id?: string;
  _nodeVersion?: string;
  _npmVersion?: string;
  dist?: {
    integrity?: string;
    shasum?: string;
    tarball?: string;
  };
  gitHead?: string;
  _npmUser?: {
    name: string;
    email: string;
  };
  maintainers?: Array<{ name: string; email: string }>;
  contributors?: Array<{ name: string; email?: string; url?: string }>;
  deprecated?: string;
}

interface PackageVersionInfo {
  current: string;
  latest: string;
  wanted: string;
  isOutdated: boolean;
}

interface PackageOutdatedInfo {
  [packageName: string]: PackageVersionInfo;
}

interface Options {
  input: string | null;
  output: string;
  showTree: boolean;
  checkOutdated: boolean;
  detailed: boolean;
}

function getDependenciesFromPackageJson(): string[] {
  try {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    const deps = [
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
      ...Object.keys(packageJson.peerDependencies || {}),
    ];
    return [...new Set(deps)]; // Remove duplicates
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error reading package.json:", errorMessage);
    process.exit(1);
  }
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    input: null,
    output: "license-report",
    showTree: false,
    checkOutdated: false,
    detailed: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-i" || arg === "--input") {
      options.input = args[i + 1];
      i++;
    } else if (arg === "-o" || arg === "--output") {
      options.output = args[i + 1];
      i++;
    } else if (arg === "--tree") {
      options.showTree = true;
    } else if (arg === "--outdated") {
      options.checkOutdated = true;
    } else if (arg === "--detailed" || arg === "-d") {
      options.detailed = true;
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

const licenseInfo: { [packageName: string]: string }[] = [];

async function getPackageInfo(packageName: string): Promise<PackageInfo> {
  return new Promise((resolve, reject) => {
    exec(
      `npm view ${packageName} --json`,
      { maxBuffer: 1024 * 1024 * 5 },
      (error, stdout, stderr) => {
        if (error) {
          // If package not found, try with @latest
          if (error.message.includes("E404")) {
            exec(
              `npm view ${packageName}@latest --json`,
              { maxBuffer: 1024 * 1024 * 5 },
              (error, stdout) => {
                if (error) {
                  resolve({
                    name: packageName,
                    version: "unknown",
                    license: "Not found",
                    description: "Package not found in npm registry",
                    dependencies: {},
                  });
                  return;
                }
                try {
                  const info = JSON.parse(stdout);
                  resolve(processPackageInfo(info, packageName));
                } catch (e) {
                  resolve({
                    name: packageName,
                    version: "unknown",
                    license: "Error parsing",
                    description: "Error parsing package information",
                    dependencies: {},
                  });
                }
              }
            );
            return;
          }
          reject(error);
          return;
        }
        try {
          const info = JSON.parse(stdout);
          resolve(processPackageInfo(info, packageName));
        } catch (e) {
          resolve({
            name: packageName,
            version: "unknown",
            license: "Error parsing",
            description: "Error parsing package information",
            dependencies: {},
          });
        }
      }
    );
  });
}

function processPackageInfo(info: any, packageName: string): PackageInfo {
  // Handle repository field which can be string or object
  let repository = info.repository;
  if (typeof repository === "object" && repository.url) {
    // Clean up common repository URL formats
    repository = repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
  }

  // Handle author field which can be string or object
  let author = info.author;
  if (typeof author === "string") {
    // Try to parse author string in format: "Name <email> (url)"
    const authorMatch = author.match(
      /^([^<(]+?)(?:\s*<([^>]+)>)?(?:\s*\(([^)]+)\))?/
    );
    if (authorMatch) {
      author = {
        name: authorMatch[1].trim(),
        email: authorMatch[2]?.trim(),
        url: authorMatch[3]?.trim(),
      };
    }
  }

  return {
    name: info.name || packageName,
    version: info.version || "unknown",
    license: info.license || "Unknown",
    description: info.description,
    author: author,
    homepage: info.homepage,
    repository: repository,
    bugs: info.bugs,
    dependencies: info.dependencies || {},
    devDependencies: info.devDependencies,
    peerDependencies: info.peerDependencies,
    keywords: info.keywords,
    main: info.main,
    types: info.types || info.typings,
    scripts: info.scripts,
    _id: info._id,
    _nodeVersion: info._nodeVersion,
    _npmVersion: info._npmVersion,
    dist: info.dist,
    gitHead: info.gitHead,
    _npmUser: info._npmUser,
    maintainers: info.maintainers,
    contributors: info.contributors,
    deprecated: info.deprecated,
  };
}

async function buildDependencyTree(
  packageName: string,
  depth = 0,
  seen = new Set<string>()
): Promise<string> {
  if (seen.has(packageName) || depth > 5) {
    // Prevent infinite loops and too deep trees
    return "";
  }
  seen.add(packageName);

  try {
    const pkgInfo = await getPackageInfo(packageName);
    let tree = `${"  ".repeat(depth)}- ${pkgInfo.name}@${pkgInfo.version} (${
      pkgInfo.license
    })`;

    const deps = pkgInfo.dependencies || {};
    if (Object.keys(deps).length > 0) {
      tree +=
        "\n" +
        (await Promise.all(
          Object.entries(deps).map(async ([depName, version]) => {
            return await buildDependencyTree(depName, depth + 1, new Set(seen));
          })
        ).then((results) => results.join("\n")));
    }

    return tree;
  } catch (error) {
    return `${"  ".repeat(depth)}- ${packageName} (Error fetching info)`;
  }
}

async function checkLicenses(packageNames: string[]) {
  const processedPackages = new Set<string>();

  for (const packageName of packageNames) {
    if (processedPackages.has(packageName)) continue;

    try {
      const pkgInfo = await getPackageInfo(packageName);
      licenseInfo.push({
        [pkgInfo.name]: `${pkgInfo.license} (${pkgInfo.version})`,
      });
      processedPackages.add(packageName);

      console.log(
        `Processed: ${pkgInfo.name}@${pkgInfo.version} (${pkgInfo.license})`
      );
    } catch (error: any) {
      console.error(`Error processing ${packageName}:`, error.message);
    }
  }

  await generateMarkdownFile(packageNames);
}

async function checkOutdatedPackages(
  packages: string[]
): Promise<PackageOutdatedInfo> {
  const outdatedInfo: PackageOutdatedInfo = {};

  try {
    // Run npm outdated command
    const { stdout } = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        exec(
          "npm outdated --json --long",
          { maxBuffer: 1024 * 1024 * 5 },
          (error, stdout, stderr) => {
            if (error && error.code !== 1) {
              // npm outdated exits with 1 when there are outdated packages
              reject(error);
              return;
            }
            resolve({ stdout, stderr });
          }
        );
      }
    );

    const outdatedData = JSON.parse(stdout || "{}");

    // Process each outdated package
    for (const [pkg, data] of Object.entries(
      outdatedData as Record<string, any>
    )) {
      outdatedInfo[pkg] = {
        current: data.current,
        latest: data.latest,
        wanted: data.wanted,
        isOutdated: data.current !== data.latest,
      };
    }
  } catch (error) {
    console.error("Error checking for outdated packages:", error);
  }

  return outdatedInfo;
}

function formatAuthor(author: any): string {
  if (!author) return "Unknown";
  if (typeof author === "string") return author;

  let result = author.name || "Unknown";
  if (author.email) result += ` <${author.email}>`;
  if (author.url) result += ` (${author.url})`;
  return result;
}

function formatDependencies(
  deps: { [name: string]: string } | undefined
): string {
  if (!deps) return "None";
  return Object.entries(deps)
    .map(([name, version]) => `- ${name}: ${version}`)
    .join("\n");
}

function generatePackageDetails(pkg: PackageInfo): string {
  const details = [
    `### ${pkg.name}@${pkg.version}`,
    `**License:** ${pkg.license || "Not specified"}`,
    `**Description:** ${pkg.description || "No description"}`,
    `**Author:** ${formatAuthor(pkg.author)}`,
    `**Homepage:** ${pkg.homepage || "Not specified"}`,
    `**Repository:** ${typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url || "Not specified"}`,
    `**Bugs:** ${typeof pkg.bugs === "string" ? pkg.bugs : pkg.bugs?.url || "Not specified"}`,
    `**Main File:** ${pkg.main || "Not specified"}`,
    `**TypeScript Types:** ${pkg.types || "Not specified"}`,
    `**Deprecated:** ${pkg.deprecated || "No"}`,
    `**Dependencies:**\n${formatDependencies(pkg.dependencies)}`,
    `**Dev Dependencies:**\n${formatDependencies(pkg.devDependencies)}`,
    `**Peer Dependencies:**\n${formatDependencies(pkg.peerDependencies)}`,
    `**Keywords:** ${pkg.keywords ? pkg.keywords.join(", ") : "None"}`,
    `**NPM Version:** ${pkg._npmVersion || "Unknown"}`,
    `**Node Version Required:** ${pkg._nodeVersion || "Not specified"}`,
  ];

  return details.join("\n\n");
}

async function generateMarkdownFile(packages: string[]) {
  const projectLicenses: { [license: string]: string[] } = {};
  const packageVersions: { [name: string]: string[] } = {};
  const packageDetails: { [name: string]: string } = {};
  const detailedPackages: PackageInfo[] = [];

  // Helper function to find duplicate package versions
  function findDuplicatePackages(packages: string[]) {
    const versionMap: { [name: string]: Set<string> } = {};

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

  // Process license information and collect detailed package info
  for (const info of licenseInfo) {
    const packageFullName = Object.keys(info)[0];
    const [packageName, version] = packageFullName.split("@");
    const license = info[packageFullName];
    const pkgInfo = await getPackageInfo(packageFullName);

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

    // Store detailed package info if detailed mode is enabled
    if (options.detailed) {
      detailedPackages.push(pkgInfo);
    }
  }

  const outputDir = path.resolve(options.output);
  mkdirSync(outputDir, { recursive: true });

  // Check for outdated packages if requested
  let outdatedSection = "";
  if (options.checkOutdated) {
    const outdatedPackages = await checkOutdatedPackages(packages);
    const outdatedList = Object.entries(outdatedPackages)
      .filter(([_, info]) => info.isOutdated)
      .map(
        ([pkg, info]) =>
          `- **${pkg}**: ${info.current} → ${info.latest} (wanted: ${info.wanted})`
      );

    if (outdatedList.length > 0) {
      outdatedSection = `
## Outdated Dependencies

The following packages have newer versions available:

${outdatedList.join("\n")}

To update, run: \`npm update\`
`;
    } else {
      outdatedSection =
        "\n## Dependencies\n\nAll dependencies are up to date! 🎉\n";
    }
  }

  // Generate dependency tree if enabled
  let dependencyTreeSection = "";
  if (options.showTree) {
    const trees = await Promise.all(
      packages.map((pkg) => buildDependencyTree(pkg))
    );

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

  // Generate detailed packages section if enabled
  let detailedSection = "";
  if (options.detailed && detailedPackages.length > 0) {
    detailedSection = `
## Detailed Package Information

${detailedPackages.map((pkg) => generatePackageDetails(pkg)).join("\n\n---\n\n")}
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
    const info = licenseInfo.find((info) => Object.keys(info)[0] === pkg)!;
    return `- **${pkg}**: ${info[pkg]}`;
  })
  .join("\n")}

## Missing License Information
${
  packages.filter(
    (pkg) => !licenseInfo.some((info) => Object.keys(info)[0] === pkg)
  ).length > 0
    ? packages
        .filter(
          (pkg) => !licenseInfo.some((info) => Object.keys(info)[0] === pkg)
        )
        .map((pkg) => `- ${pkg}`)
        .join("\n")
    : "No packages with missing license information"
}

${outdatedSection}
${duplicatesSection}
${dependencyTreeSection}
${detailedSection}

> Generated at: ${new Date().toISOString()}
`;

  const outputPath = path.join(outputDir, "license-report.md");

  try {
    writeFileSync(outputPath, markdownContent);
    console.log(`License report generated at ${outputPath}`);
  } catch (error: any) {
    console.error(`Error writing license report: ${error.message}`);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  checkLicenses(packageNames);
}
