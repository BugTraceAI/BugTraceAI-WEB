/**
 * BugTraceAI Tailwind CSS Configuration
 * =====================================
 * Custom theme colors that map to CSS variables in styles/theme.css
 *
 * Usage in components:
 *   - bg-purple-deep    -> #2D1B4D (main background)
 *   - bg-purple-medium  -> #3D2B5F (cards)
 *   - text-coral        -> #FF7F50 (accent)
 *   - text-off-white    -> #F8F9FA (primary text)
 *   - text-purple-gray  -> #B0A8C0 (secondary text)
 *   - bg-success        -> #2ECC71
 *   - bg-warning        -> #FFC107
 *   - bg-error          -> #FF3131
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary Purple Palette (60%)
        'purple': {
          'deep': 'var(--color-purple-deep)',      // Main background
          'medium': 'var(--color-purple-medium)',    // Cards, sections
          'light': 'var(--color-purple-light)',     // Hover states
          'elevated': 'var(--color-purple-elevated)',  // Elevated elements
        },

        // Dashboard Colors (darker variants)
        'dashboard': {
          'bg': 'var(--color-dashboard-bg)',
          'card': 'var(--color-dashboard-card)',
          'card-solid': 'var(--color-dashboard-card-solid)',
        },

        // Accent Colors (10%)
        'coral': {
          DEFAULT: 'var(--color-accent-primary)',
          'hover': 'var(--color-accent-primary-hover)',
          'active': 'var(--color-accent-primary-active)',
        },

        // Custom Accents
        'purple-accent': 'var(--color-accent-soft)',
        'purple-accent-hover': 'var(--color-accent-soft-hover)',

        // Status Colors
        'success': {
          DEFAULT: 'var(--color-success)',
          'bg': 'var(--color-success-bg)',
          'border': 'var(--color-success-border)',
        },
        'warning': {
          DEFAULT: 'var(--color-warning)',
          'bg': 'var(--color-warning-bg)',
          'border': 'var(--color-warning-border)',
        },
        'error': {
          DEFAULT: 'var(--color-error)',
          'bg': 'var(--color-error-bg)',
          'border': 'var(--color-error-border)',
        },

        // Text Colors (30%)
        'off-white': 'var(--color-text-primary)',
        'purple-gray': 'var(--color-purple-gray)',
        'muted': 'var(--color-muted)',

        // Glass Effects
        'glass': {
          'bg': 'var(--color-glass-bg)',
          'border': 'var(--color-glass-border)',
          'hover': 'var(--color-glass-hover)',
        },
      },

      // Box shadows
      boxShadow: {
        'glow-coral': '0 0 20px rgba(255, 127, 80, 0.4)',
        'glow-success': '0 0 20px rgba(46, 204, 113, 0.4)',
        'glow-error': '0 0 20px rgba(255, 49, 49, 0.4)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        // Dashboard shadows
        'dashboard': '0 4px 20px rgba(0, 0, 0, 0.4)',
        'dashboard-hover': '0 8px 30px rgba(0, 0, 0, 0.5)',
        'dashboard-lg': '0 10px 40px rgba(0, 0, 0, 0.5)',
      },

      // Border radius
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        // Dashboard card radius
        'card': '24px',
        'card-lg': '32px',
        'card-xl': '40px',
      },

      // Fonts
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },

      // Animations (matching landing page)
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'hero-glow': 'heroGlow 4s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'orbit': 'orbit 30s linear infinite',
        'scan-progress': 'scanProgress 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },

      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            filter: 'drop-shadow(0 0 4px rgba(255, 49, 49, 0.4))',
          },
          '50%': {
            filter: 'drop-shadow(0 0 12px rgba(255, 49, 49, 0.8)) drop-shadow(0 0 20px rgba(255, 49, 49, 0.4))',
          },
        },
        'slideIn': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fadeIn': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'heroGlow': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.1)' },
        },
        'pulseDot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'orbit': {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        'scanProgress': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },

      // Background images for gradient patterns
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-accent': 'linear-gradient(135deg, #FF7F50 0%, #FF9B70 100%)',
        'gradient-coral-glow': 'linear-gradient(135deg, #FF7F50 0%, #FF6B6B 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(61, 43, 95, 0.8) 0%, rgba(45, 27, 77, 0.9) 100%)',
        'gradient-purple': 'linear-gradient(135deg, #2D1B4D 0%, #3D2B5F 50%, #2D1B4D 100%)',
      },

      // Backdrop blur (for glass effects)
      backdropBlur: {
        'xs': '2px',
        'lg': '20px',
      },

      // Spacing
      spacing: {
        '18': '4.5rem',
        '112': '28rem',
        '128': '32rem',
      },

      // Transitions
      transitionDuration: {
        '400': '400ms',
      },
    },
  },
  plugins: [],
}
