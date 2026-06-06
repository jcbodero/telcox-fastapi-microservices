module.exports = {
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        telecom: {
          50: '#eefcff',
          100: '#d7f8ff',
          200: '#b6f0ff',
          300: '#86d9ff',
          400: '#39b4f2',
          500: '#0f7ecf',
          600: '#0a64ab',
          700: '#0c4d82',
          800: '#10375f',
          900: '#0e2647',
        },
      },
      boxShadow: {
        telecard: '0 30px 80px rgba(14,165,233,0.18)',
      },
    },
  },
  plugins: [],
}
