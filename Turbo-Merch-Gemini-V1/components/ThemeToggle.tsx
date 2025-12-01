'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative inline-flex items-center
        ${compact ? 'h-7 w-14' : 'h-8 w-16'}
        rounded-full
        bg-gray-200 dark:bg-dark-700
        border border-gray-300 dark:border-white/10
        transition-colors duration-300 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-dark-900
      `}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Track background icons */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5">
        <Sun className={`
          ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}
          text-amber-500
          transition-opacity duration-200
          ${isDark ? 'opacity-40' : 'opacity-0'}
        `} />
        <Moon className={`
          ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}
          text-blue-400
          transition-opacity duration-200
          ${isDark ? 'opacity-0' : 'opacity-40'}
        `} />
      </span>

      {/* Sliding thumb */}
      <span
        className={`
          ${compact ? 'h-5 w-5' : 'h-6 w-6'}
          transform rounded-full
          bg-white dark:bg-dark-900
          shadow-md
          ring-0
          transition-all duration-300 ease-in-out
          flex items-center justify-center
          ${isDark
            ? (compact ? 'translate-x-[30px]' : 'translate-x-[34px]')
            : 'translate-x-[3px]'
          }
        `}
      >
        {/* Icon inside thumb */}
        <Sun className={`
          ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
          text-amber-500
          absolute
          transition-all duration-300
          ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}
        `} />
        <Moon className={`
          ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
          text-blue-400
          absolute
          transition-all duration-300
          ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}
        `} />
      </span>
    </button>
  );
};

export default ThemeToggle;
