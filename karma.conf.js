var webpack = require("webpack");

module.exports = function(config) {
  var configuration = {
    files: [
      'spec/index.ts'
    ],
    frameworks: [ 'mocha', 'chai' ],
    preprocessors: {
      'spec/*.ts': [ 'webpack' ]
    },
    reporters: ['spec'],
    webpack: {
      mode: 'development',
      devtool: 'eval-source-map',
      resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json']
      },
      module: {
        rules: [
          { test: /\.tsx?$/, loader: 'awesome-typescript-loader' }
        ]
      },
      externals: {
        'request': 'window.request'
      },
    },
    autoWatch: false,
    singleRun: true,
    browsers: [ 'ChromeHeadless' ],
    mime: {
      'text/x-typescript': ['ts']
    }
  };

  if (config.tdd) {
    configuration = Object.assign(configuration, {
      reporters: ['spec'],
      autoWatch: true,
      singleRun: false,
      browsers: [ 'Chrome' ],
      client: {
        mocha: {
          reporter: 'html'
        }
      }
    });
  }

  config.set(configuration);
};