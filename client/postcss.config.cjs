// Use the new Tailwind PostCSS plugin package per Vite warning
module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('autoprefixer')
  ]
};
