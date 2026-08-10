import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const SmartKhataLogo: React.FC<Props> = ({ size = 'md', className = '' }) => {
  const dimensionMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
  };

  const dim = dimensionMap[size];

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${dim} ${className}`}>
      {/* Outer Ambient Neon Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 via-indigo-500 to-emerald-400 rounded-3xl blur-md opacity-40 animate-pulse" />

      {/* Main Glassmorphic Container */}
      <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-2.5 shadow-2xl border border-white/20 flex items-center justify-center overflow-hidden">
        {/* Background Grid Pattern Accent */}
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:8px_8px] opacity-20" />

        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-md"
        >
          <defs>
            <linearGradient id="bookCover" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2563EB" />
              <stop offset="0.5" stopColor="#1D4ED8" />
              <stop offset="1" stopColor="#1E3A8A" />
            </linearGradient>

            <linearGradient id="goldAccent" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F59E0B" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>

            <linearGradient id="nodeGlow" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#60A5FA" />
              <stop offset="1" stopColor="#34D399" />
            </linearGradient>
          </defs>

          {/* Ledger Book Spine Base */}
          <rect x="18" y="15" width="64" height="70" rx="10" fill="url(#bookCover)" />
          
          {/* Inner Pages Page Stacks */}
          <rect x="26" y="21" width="50" height="58" rx="6" fill="#FFFFFF" fillOpacity="0.95" />
          <line x1="32" y1="32" x2="68" y2="32" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
          <line x1="32" y1="44" x2="58" y2="44" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />

          {/* Credit Check / Arrow Loop (Udhar/Ledger symbol) */}
          <path
            d="M32 60L44 70L68 46"
            stroke="url(#goldAccent)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Ribbon Bookmark Emblem */}
          <path d="M64 15V32L71 27L78 32V15H64Z" fill="#EF4444" />

          {/* Connected Network Nodes (Digital SaaS Ledger touch) */}
          <circle cx="24" cy="74" r="5" fill="url(#nodeGlow)" />
          <circle cx="76" cy="24" r="4" fill="url(#nodeGlow)" />
          <line x1="24" y1="74" x2="18" y2="68" stroke="#60A5FA" strokeWidth="2" strokeDasharray="2 2" />
        </svg>
      </div>
    </div>
  );
};
