// Copyright 2017 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


const {rollup} = require('rollup');
const babel = require('rollup-plugin-babel');
const uglify = require('rollup-plugin-uglify');

export default {
  entry: './src/index.js',
  plugins: [
    babel({
      babelrc: false,
      plugins: ['external-helpers'],
      presets: [['es2015', {modules: false}]],
    }),
    uglify(),
  ],
};
