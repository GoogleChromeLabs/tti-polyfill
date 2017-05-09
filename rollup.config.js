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
