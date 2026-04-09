import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Toaster } from 'react-hot-toast';
import { settingsService } from '@/services/api';

const ASSETS_URL = '';

export const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logo, setLogo] = useState<string>('');
  const [siteName, setSiteName] = useState<string>('Luxe Looks');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await settingsService.getAll();
        if (settings.logo) {
          const logoUrl = settings.logo.startsWith('http') 
            ? settings.logo 
            : `${ASSETS_URL}${settings.logo}`;
          setLogo(logoUrl);
        }
        if (settings.site_name) {
          setSiteName(settings.site_name);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

  return (
    <div className="min-h-screen bg-dark-950">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        logo={logo}
        siteName={siteName}
      />
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'
        }`}
      >
        <Topbar toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
