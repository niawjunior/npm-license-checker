#!/usr/bin/env node
import { exec } from "child_process"
import { writeFileSync, mkdirSync } from "fs"
import * as path from "path"
import * as fs from "fs"

interface Options {
  input: string
  output: string
}

function parseOptions(): Options {
  const args = process.argv.slice(2)
  const options: Options = { input: "input.txt", output: "license-report" }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "-i" || arg === "--input") {
      options.input = args[i + 1]
      i++
    } else if (arg === "-o" || arg === "--output") {
      options.output = args[i + 1]
      i++
    }
  }

  return options
}

const options = parseOptions()
// Read the package names from input.txt and format them as an array
const packageNames = fs
  .readFileSync(options.input, "utf-8")
  .split("\n")
  .map((pkg) => pkg.trim())

const licenseInfo: { [packageName: string]: string }[] = []

function getLicenseInfo(
  packageName: string
): Promise<{ [packageName: string]: string }> {
  return new Promise((resolve, reject) => {
    exec(`npm view ${packageName} license`, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      const lines: string[] = stdout.trim().split("\n")
      if (lines.length > 0) {
        const license: string = lines[0].trim()
        resolve({ [packageName]: license })
      } else {
        resolve({ [packageName]: "License information not found" })
      }
    })
  })
}

async function checkLicenses(packageNames: string[]) {
  for (const packageName of packageNames) {
    try {
      const info = await getLicenseInfo(packageName)
      licenseInfo.push(info)
      console.log(info)
    } catch (error: any) {
      console.error(
        `Error checking license for ${packageName}: ${error.message}`
      )
    }
  }
  generateMarkdownFile(packageNames)
}

function generateMarkdownFile(packages: string[]) {
  const projectLicenses: { [license: string]: string[] } = {}

  licenseInfo.forEach((info) => {
    const packageName = Object.keys(info)[0]
    const license = info[packageName]
    if (!projectLicenses[license]) {
      projectLicenses[license] = []
    }
    projectLicenses[license].push(packageName)
  })

  const outputDir = path.resolve(options.output)
  mkdirSync(outputDir, { recursive: true })

  const markdownContent = `
Project Licenses:
-----------------
${Object.entries(projectLicenses)
  .map(([license, packages]) => `- ${license}: ${packages.length} packages`)
  .join("\n")}

Packages with Unknown Licenses:
-------------------------------
${packages
  .filter(
    (pkg: string) => !licenseInfo.some((info) => Object.keys(info)[0] === pkg)
  )
  .join("\n")}

Packages with Licenses:
-------------------------------
${packages
  .filter((pkg: string) =>
    licenseInfo.some((info) => Object.keys(info)[0] === pkg)
  )
  .map(
    (pkg: string) =>
      `- ${pkg}: ${
        licenseInfo.find((info) => Object.keys(info)[0] === pkg)![pkg]
      }`
  )
  .join("\n")}
`

  const outputPath = path.join(outputDir, "license-report.md")

  try {
    writeFileSync(outputPath, markdownContent)
    console.log(`License report generated at ${outputPath}`)
  } catch (error: any) {
    console.error(`Error writing license report: ${error.message}`)
  }
}

checkLicenses(packageNames)
