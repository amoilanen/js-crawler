var webpack = require("webpack");

module.exports = function(config) {
  var configuration = {
    files: [
      'spec/crawler.spec.ts'
    ],
    frameworks: [ 'jasmine'],
    preprocessors: {
      'spec/crawler.spec.ts': [ 'webpack' ]
    },
    reporters: ['spec'],
    webpack: {
      devtool: 'source-map',
      resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json']
      },
      module: {
        rules: [
          { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },
          { enforce: "pre", test: /\.js$/, loader: 'source-map-loader' }
        ]
      },
      externals: {
        'request': 'window.request'
      },
    },
    autoWatch: false,
    singleRun: true,
    browsers: [ 'PhantomJS' ],
    mime: {
      'text/x-typescript': ['ts']
    }
  };

  if (config.tdd) {
    configuration = Object.assign(configuration, {
      reporters: ['spec', 'kjhtml'],
      autoWatch: true,
      singleRun: false,
      browsers: [ 'Chrome' ]
    });
  }

  config.set(configuration);
};