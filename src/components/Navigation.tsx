import React from 'react';
import { Map, Upload, User, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

export const Navigation: React.FC = () => {
  const location = useLocation();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md border border-white/10 p-2 rounded-full shadow-lg">
        <NavItem to="/map" icon={<Map size={20} />} isActive={location.pathname === '/map' || location.pathname === '/'} />
        <NavItem to="/discover" icon={<Search size={20} />} isActive={location.pathname === '/discover'} />
        <NavItem to="/upload" icon={<Upload size={20} />} isActive={location.pathname === '/upload'} />
        <NavItem to="/profile" icon={<User size={20} />} isActive={location.pathname === '/profile'} />
      </div>
    </div>
  );
};

const NavItem: React.FC<{ to: string; icon: React.ReactNode; isActive: boolean }> = ({ to, icon, isActive }) => (
  <Link
    to={to}
    className={clsx(
      "p-3 rounded-full transition-all duration-200",
      isActive ? "bg-accent text-white shadow-[0_0_10px_rgba(68,136,255,0.5)]" : "text-text-secondary hover:text-white hover:bg-white/5"
    )}
  >
    {icon}
  </Link>
);
