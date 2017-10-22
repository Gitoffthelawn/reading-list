const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')
const config = require('../config')
const path = require('path')
const WriteFilePlugin = require('write-file-webpack-plugin')
const env = config.build.env

const webpackConfig = {
  entry: {
    popup: path.resolve(__dirname, '..', 'src', 'js', 'popup.js'),
    options: path.resolve(__dirname, '..', 'src', 'js', 'options.js'),
    background: path.resolve(__dirname, '..', 'src', 'js', 'background.js')
  },
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    filename: '[name].bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: [path.resolve(__dirname, '..', 'src')]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': env
    }),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      },
      sourceMap: true
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, '..', 'src', 'popup.html'),
      filename: 'popup.html',
      chunks: ['popup']
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, '..', 'src', 'options.html'),
      filename: 'options.html',
      chunks: ['options']
    }),
    new WriteFilePlugin()
  ]
}

if (config.build.productionGzip) {
  const CompressionWebpackPlugin = require('compression-webpack-plugin')

  webpackConfig.plugins.push(
    new CompressionWebpackPlugin({
      asset: '[path].gz[query]',
      algorithm: 'gzip',
      test: new RegExp(
        '\\.(' +
        config.build.productionGzipExtensions.join('|') +
        ')$'
      ),
      threshold: 10240,
      minRatio: 0.8
    })
  )
}

if (config.build.bundleAnalyzerReport) {
  const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
  webpackConfig.plugins.push(new BundleAnalyzerPlugin())
}

module.exports = webpackConfig
