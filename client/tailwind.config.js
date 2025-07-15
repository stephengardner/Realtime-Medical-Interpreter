/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        border: "rgb(var(--border))",
        input: "rgb(var(--input))",
        ring: "rgb(var(--ring))",
        background: "rgb(var(--background))",
        foreground: "rgb(var(--foreground))",
        primary: {
          DEFAULT: "rgb(var(--primary))",
          foreground: "rgb(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary))",
          foreground: "rgb(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive))",
          foreground: "rgb(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "rgb(var(--muted))",
          foreground: "rgb(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "rgb(var(--accent))",
          foreground: "rgb(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "rgb(var(--card))",
          foreground: "rgb(var(--card-foreground))",
        },
        success: {
          DEFAULT: "rgb(var(--success))",
          foreground: "rgb(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "rgb(var(--warning))",
          foreground: "rgb(var(--warning-foreground))",
        },
        error: {
          DEFAULT: "rgb(var(--error))",
          foreground: "rgb(var(--error-foreground))",
        },
        // Medical app specific colors
        doctor: {
          DEFAULT: "rgb(var(--doctor))",
          foreground: "rgb(var(--doctor-foreground))",
          text: "rgb(var(--doctor-text))",
          muted: "rgb(var(--doctor-text-muted))",
        },
        patient: {
          DEFAULT: "rgb(var(--patient))",
          foreground: "rgb(var(--patient-foreground))",
          text: "rgb(var(--patient-text))",
          muted: "rgb(var(--patient-text-muted))",
        },
        // Language badge colors
        badge: {
          en: {
            bg: "rgb(var(--badge-en-bg))",
            text: "rgb(var(--badge-en-text))",
            border: "rgb(var(--badge-en-border))",
          },
          es: {
            bg: "rgb(var(--badge-es-bg))",
            text: "rgb(var(--badge-es-text))",
            border: "rgb(var(--badge-es-border))",
          },
        },
        // Conversation bubble colors
        bubble: {
          doctor: {
            bg: "rgb(var(--bubble-doctor-bg))",
            border: "rgb(var(--bubble-doctor-border))",
          },
          patient: {
            bg: "rgb(var(--bubble-patient-bg))",
            border: "rgb(var(--bubble-patient-border))",
          },
          translation: {
            doctor: "rgb(var(--bubble-translation-doctor))",
            patient: "rgb(var(--bubble-translation-patient))",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      dropShadow: {
        sm: "0 1px 1px rgb(0 0 0 / 0.05)",
        DEFAULT: "0 1px 2px rgb(0 0 0 / 0.1)",
        md: "0 4px 3px rgb(0 0 0 / 0.07), 0 2px 2px rgb(0 0 0 / 0.06)",
        lg: "0 10px 8px rgb(0 0 0 / 0.04), 0 4px 3px rgb(0 0 0 / 0.1)",
        xl: "0 20px 13px rgb(0 0 0 / 0.03), 0 8px 5px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 