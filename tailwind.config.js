/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        sidebar: "var(--sidebar)",
        "sidebar-foreground": "var(--sidebar-foreground)",
        "sidebar-primary": "var(--sidebar-primary)",
        "sidebar-primary-foreground": "var(--sidebar-primary-foreground)",
        "sidebar-accent": "var(--sidebar-accent)",
      },
      backgroundColor: {
        sidebar: "var(--sidebar)",
      },
      textColor: {
        "sidebar-foreground": "var(--sidebar-foreground)",
      },
    },
  },
  plugins: [],
  safelist: ["md:hidden", "md:flex", "md:block", "md:p-6", "p-4", "md:p-4"],
};
