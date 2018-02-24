module.exports = {
  entry: './crawler.ts',
  output: {
    filename: "bundle.js",
    path: __dirname + "/webpack.dist"
  },
  devtool: "source-map",

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
    'request': 'Request'
  },
};