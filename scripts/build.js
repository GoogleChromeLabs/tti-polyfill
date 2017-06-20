/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/* eslint-env node */
/* eslint-disable no-console, require-jsdoc */


const chalk = require('chalk');
const fs = require('fs-extra');
const {compile}= require('google-closure-compiler-js');
const gzipSize = require('gzip-size');
const {rollup} = require('rollup');
const nodeResolve = require('rollup-plugin-node-resolve');
const path = require('path');
const {SourceMapGenerator, SourceMapConsumer} = require('source-map');


const generateRollupBundle = (entryFilePath, outputFilePath) => {
  return rollup({
    entry: entryFilePath,
    plugins: [nodeResolve()],
  }).then((bundle) => {
    return bundle.generate({
      format: 'es',
      dest: outputFilePath,
      sourceMap: true,
    });
  });
};


const compileRollupBundle = (outputFilePath, defines, rollupBundle) => {
  const closureResult = compile({
    jsCode: [{
      src: rollupBundle.code,
      path: path.basename(outputFilePath),
    }],
    defines: defines,
    compilationLevel: 'ADVANCED',
    useTypesForOptimization: true,
    outputWrapper:
        '(function(){%output%})();\n' +
        `//# sourceMappingURL=${path.basename(outputFilePath)}.map`,
    assumeFunctionWrapper: true,
    rewritePolyfills: false,
    warningLevel: 'VERBOSE',
    createSourceMap: true,
    externs: [{
      src: fs.readFileSync('./src/externs.js', 'utf-8'),
    }],
  });

  if (closureResult.errors.length || closureResult.warnings.length) {
    const rollupMap = new SourceMapConsumer(rollupBundle.map);

    // Remap errors from the closure compiler output to the original
    // files before rollup bundled them.
    const remap = (type) => (item) => {
      let {line, column, source} = rollupMap.originalPositionFor({
        line: item.lineNo,
        column: item.charNo,
      });
      source = String(source); // Source can be null in some cases.
      return {type, line, column, source, desc: item.description};
    };

    reportCompileErrorsAndExit(outputFilePath, [
      ...closureResult.errors.map(remap('error')),
      ...closureResult.warnings.map(remap('warning')),
    ]);
  } else {
    // Currently, closure compiler doesn't support applying its generated
    // source map to an existing source map, so we do it manually.
    const fromMap = JSON.parse(closureResult.sourceMap);
    const toMap = rollupBundle.map;

    const generator = SourceMapGenerator.fromSourceMap(
        new SourceMapConsumer(fromMap));

    generator.applySourceMap(
        new SourceMapConsumer(toMap), path.basename(outputFilePath));

    const sourceMap = generator.toString();

    return {
      code: closureResult.compiledCode,
      map: sourceMap,
    };
  }
};


const saveCompiledBundle = (outputFilePath, compiledBundle) => {
  const {code, map} = compiledBundle;

  fs.outputFileSync(outputFilePath, code, 'utf-8');
  fs.outputFileSync(outputFilePath + '.map', map, 'utf-8');
  const size = (gzipSize.sync(code) / 1000).toFixed(1);
  console.log(`Built ${outputFilePath} (${size} Kb gzipped)`);
};


const reportCompileErrorsAndExit = (outputFilePath, errors) => {
  console.error(`\nOops, there were issue compiling ${outputFilePath}\n`);
  for (let {source, line, column, desc, type} of errors) {
    const color = chalk[type == 'error' ? 'red' : 'yellow'];

    console.error(`${color(`[${type}]`)} ${desc}`);
    console.error(chalk.gray(`${source} [${line}:${column}]\n`));
  }
  process.exit(1);
};


const build = (entryFilePath, outputFilePath, defines) => {
  generateRollupBundle(entryFilePath, outputFilePath)
      .then((rollupBundle) => {
        return compileRollupBundle(outputFilePath, defines, rollupBundle);
      })
      .then((compiledBundle) => {
        return saveCompiledBundle(outputFilePath, compiledBundle);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
};


build('src/umd-wrapper.js', 'tti-polyfill.js', {DEBUG: false});
build('src/umd-wrapper.js', 'tti-polyfill-debug.js', {DEBUG: true});
