const path = require('path')

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: {
    index: './src/index.ts',
    scan: './src/server/scan.ts',
    'build-docs': './src/script/build-docs.ts'
  },
  target: 'node',
  mode: 'none',
  resolve: {
    mainFields: ['module', 'main'],
    extensions: ['.js', '.ts']
  },
  externals: {
    'coc.nvim': 'commonjs coc.nvim'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  output: {
    path: path.join(__dirname, 'out'),
    filename: '[name].js',
    libraryTarget: 'commonjs'
  },
  plugins: [],
  node: {
    __dirname: false,
    __filename: false
  }
}
