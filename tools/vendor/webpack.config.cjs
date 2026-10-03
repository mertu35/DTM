const path = require('node:path');
module.exports = {
  mode: 'production', target: ['web', 'es2022'],
  entry: require.resolve('html2pdf.js/src/index.js'),
  output: { path: path.resolve(__dirname, '../../app/js'), filename: 'html2pdf.bundle.min.js',
    chunkFilename: 'vendor/pdf-export-[contenthash].js',
    library: { name: 'html2pdf', type: 'umd', export: 'default' }, globalObject: 'self' },
  performance: { hints: false },
  resolve: { alias: { 'dompurify$': require.resolve('dompurify') } }
};
