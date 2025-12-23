import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 80 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="orbitGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="orbitGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id="orbitGradient3" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#fb7185" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <circle cx="50" cy="50" r="35" fill="url(#centerGlow)" />
      
      <ellipse
        cx="50"
        cy="50"
        rx="40"
        ry="15"
        stroke="url(#orbitGradient1)"
        strokeWidth="2.5"
        fill="none"
        transform="rotate(-30 50 50)"
        filter="url(#glow)"
        opacity="0.9"
      />
      <ellipse
        cx="50"
        cy="50"
        rx="40"
        ry="15"
        stroke="url(#orbitGradient2)"
        strokeWidth="2.5"
        fill="none"
        transform="rotate(30 50 50)"
        filter="url(#glow)"
        opacity="0.9"
      />
      <ellipse
        cx="50"
        cy="50"
        rx="40"
        ry="15"
        stroke="url(#orbitGradient3)"
        strokeWidth="2.5"
        fill="none"
        transform="rotate(90 50 50)"
        filter="url(#glow)"
        opacity="0.9"
      />
      
      <circle cx="50" cy="50" r="12" fill="url(#orbitGradient1)" filter="url(#glow)" />
      <circle cx="50" cy="50" r="8" fill="#1e1b4b" />
      <circle cx="50" cy="50" r="5" fill="url(#centerGlow)" />
      <circle cx="50" cy="50" r="3" fill="white" opacity="0.8" />
      
      <circle cx="20" cy="35" r="2" fill="#06b6d4" filter="url(#glow)" />
      <circle cx="80" cy="35" r="2" fill="#ec4899" filter="url(#glow)" />
      <circle cx="50" cy="15" r="2" fill="#a855f7" filter="url(#glow)" />
      <circle cx="25" cy="70" r="1.5" fill="#22d3ee" filter="url(#glow)" />
      <circle cx="75" cy="70" r="1.5" fill="#f472b6" filter="url(#glow)" />
      <circle cx="35" cy="85" r="1" fill="#67e8f9" />
      <circle cx="65" cy="85" r="1" fill="#fb7185" />
    </svg>
  );
};

export default Logo;
