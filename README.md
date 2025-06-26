[![npm version](https://badge.fury.io/js/npm-license-checker.svg)](https://badge.fury.io/js/npm-license-checker)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white)](https://github.com/niawjunior/npm-license-checker)

# npm-license-checker

`npm-license-checker` is a lightweight and easy-to-use command-line tool for checking and displaying the licenses of npm packages. It can read package names from either a text file or directly from your project's `package.json`.

## Installation

You can install `npm-license-checker` globally using npm:

```bash
npm install -g npm-license-checker
```

Or use it directly with `npx`:

```bash
npx npm-license-checker
```

## Usage

### Option 1: Using package.json (Default)

Simply run the following command in your project directory:

```bash
npm-license-checker -o output-directory
```

This will automatically check all dependencies, devDependencies, and peerDependencies listed in your `package.json` file.

### Option 2: Using a custom package list

1. Create a text file (e.g., `input.txt`) that contains the list of npm package names, one per line:

```
@angular/animations
@angular/cdk
@angular/common
```

2. Run the npm-license-checker command with the input file:

```bash
npm-license-checker -i input.txt -o output-directory
```

## Command Line Options

- `-i, --input`: Path to input file containing package names (one per line)
- `-o, --output`: Output directory for the license report (default: "license-report")

## Output

The tool will generate a markdown report in the specified output directory. The report includes:

- Summary of all licenses found
- List of packages with unknown licenses
- Detailed list of all packages with their licenses

Example output in `license-report/license-report.md`:

```
Project Licenses:
-----------------
- MIT: 15 packages
- ISC: 8 packages
- Apache-2.0: 5 packages

Packages with Unknown Licenses:
-------------------------------
package-name-1
package-name-2

Packages with Licenses:
----------------------
@angular/animations: MIT
@angular/cdk: MIT
typescript: Apache-2.0
...
```

## Version History

### v1.1.0

- Added support for reading dependencies from `package.json` by default
- Improved command-line interface
- Better error handling and reporting

```

![alt](img-1.png)
![alt](img-2.png)
```
