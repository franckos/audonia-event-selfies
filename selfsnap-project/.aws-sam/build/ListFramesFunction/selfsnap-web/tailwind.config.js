/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      backgroundImage: {
        "selfsnap-radial":
          "radial-gradient(circle at 50%, #D6EDFF 43%, #8DC7F7 80%)",
      },
    },
  },
  plugins: [],
};

