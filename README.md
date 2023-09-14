# npm-license-checker

`npm-license-checker` is a lightweight and easy-to-use command-line tool for checking and displaying the licenses of npm packages.

## Installation

You can install `npm-license-checker` globally using npm:

```bash
npm install -g npm-license-checker
```

To check and generate a license report for a list of npm packages, follow these steps:

1. Create a text file (e.g., input.txt) that contains the list of npm package names, one per line:

```
@angular/animations
@angular/cdk
@angular/common
```

2. Run the npm-license-checker command with the input file and specify an output directory where the license report will be generated:

`npm-license-checker -i input.txt -o output-directory`

3. Replace input.txt with the path to your package list file and output-directory with the desired output directory for the license report.

The tool will fetch license information for the specified packages and generate a report in the specified output directory. The report will include a summary of licenses and any packages with unknown licenses.

4. You can view the generated license report in the specified output directory.

```
Example Output
Project Licenses:
MIT: 28 packages
Apache-2.0: 12 packages
ISC: 8 packages
BSD-3-Clause: 5 packages

...
Packages with Unknown Licenses:
package-name-1
package-name-2
...

Packages with Licenses
package-name-3: MIT
package-name-4: Apache-2.0
...

```

![alt](img-1.png)
![alt](img-2.png)
