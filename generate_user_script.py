beginning = 'userscriptBeginning.js.txt'
ending = 'userscriptEnding.js.txt'
input_files = ['firstInteractiveCore.js', 'activityTrackerUtils.js', 'firstInteractiveDetector.js', 'main.js']
output_file = 'TTI-UserScript.js'

with open(output_file, 'w') as outfile:
    outfile.write(open(beginning).read())
    for input_file in input_files:
        with open(input_file) as infile:
            # Get rid of the 'use strict' directives
            infile.readline()
            infile.readline()
            outfile.write(infile.read())
    outfile.write(open(ending).read())
