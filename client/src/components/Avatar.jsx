import React from 'react';

export default function Avatar({ name, online, size = 40, src }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  return (
    <div className="relative inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-700 shadow-soft" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <span className="font-semibold">{initials}</span>
      )}
      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${online ? 'bg-emerald-400' : 'bg-gray-400'}`} />
    </div>
  );
}
