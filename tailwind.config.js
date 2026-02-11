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
          'deep': '#2D1B4D',      // Main background
          'medium': '#3D2B5F',    // Cards, sections
          'light': '#4D3B6F',     // Hover states
          'elevated': '#5D4B7F',  // Elevated elements
        },

        // Dashboard Colors (darker variants)
        'dashboard': {
          'bg': '#1A0F2E',                    // Darkest - almost black-purple
          'card': 'rgba(26, 15, 46, 0.9)',    // Card with transparency
          'card-solid': '#1A0F2E',            // Solid card background
        },

        // Accent Colors (10%)
        'coral': {
          DEFAULT: '#FF7F50',     // Primary CTA
          'hover': '#FF9B70',
          'active': '#E56B3C',
        },

        // Status Colors
        'success': {
          DEFAULT: '#2ECC71',
          'bg': 'rgba(46, 204, 113, 0.15)',
          'border': 'rgba(46, 204, 113, 0.3)',
        },
        'warning': {
          DEFAULT: '#FFC107',
          'bg': 'rgba(255, 193, 7, 0.15)',
          'border': 'rgba(255, 193, 7, 0.3)',
        },
        'error': {
          DEFAULT: '#FF3131',
          'bg': 'rgba(255, 49, 49, 0.15)',
          'border': 'rgba(255, 49, 49, 0.3)',
        },

        // Text Colors (30%)
        'off-white': '#F8F9FA',   // Primary text
        'purple-gray': '#B0A8C0', // Secondary text
        'muted': '#8A7FA8',       // Tertiary text

        // Glass Effects
        'glass': {
          'bg': 'rgba(61, 43, 95, 0.6)',
          'border': 'rgba(93, 75, 127, 0.4)',
          'hover': 'rgba(77, 59, 111, 0.8)',
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
