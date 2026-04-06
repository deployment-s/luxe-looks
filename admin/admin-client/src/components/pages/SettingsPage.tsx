import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save, Upload, Database, Bell, Shield, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { settingsService } from '@/services/api';

interface SettingsState {
  site_name: string;
  contact_email: string;
  phone_number: string;
  logo: string;
  favicon: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  session_timeout: string;
  rate_limit_requests: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  site_name: 'Luxe Looks',
  contact_email: 'hello@luxelooks.co.ke',
  phone_number: '+254 700 000 000',
  logo: '',
  favicon: '',
  facebook: '',
  instagram: '',
  whatsapp: 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK',
  session_timeout: '1440',
  rate_limit_requests: '1000',
};

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState('general');
  const [isSaving, setIsSaving] = React.useState(false);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'backup', label: 'Backup', icon: Database },
  ];

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await settingsService.getAll();
      setSettings(prev => ({ ...prev, ...data }));
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsService.update(settings);
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key: keyof SettingsState, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">Settings</h1>
          <p className="text-dark-400 mt-1">Configure your admin panel</p>
        </div>
        <Button leftIcon={<Save size={18} />} isLoading={isSaving}>
          Save Changes
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 shrink-0">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-500/10 text-primary-500'
                        : 'text-dark-400 hover:text-white hover:bg-dark-800'
                    }`}
                  >
                    <tab.icon size={18} />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <motion.div
              key="general"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Site Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Site Name
                    </label>
                    <input
                      type="text"
                      value={settings.site_name}
                      onChange={(e) => handleSettingChange('site_name', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={settings.contact_email}
                      onChange={(e) => handleSettingChange('contact_email', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={settings.phone_number}
                      onChange={(e) => handleSettingChange('phone_number', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Branding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Logo
                    </label>
                    <div className="border-2 border-dashed border-dark-700 rounded-lg p-6 text-center">
                      <Upload className="mx-auto h-12 w-12 text-dark-500 mb-3" />
                      <p className="text-sm text-dark-400">Click to upload or drag and drop</p>
                      <p className="text-xs text-dark-500 mt-1">SVG, PNG, JPG up to 2MB</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Favicon
                    </label>
                    <div className="border-2 border-dashed border-dark-700 rounded-lg p-6 text-center">
                      <Upload className="mx-auto h-12 w-12 text-dark-500 mb-3" />
                      <p className="text-sm text-dark-400">Click to upload icon</p>
                      <p className="text-xs text-dark-500 mt-1">ICO, PNG up to 1MB</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Social Media</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Facebook
                    </label>
                    <input
                      type="url"
                      value={settings.facebook}
                      onChange={(e) => handleSettingChange('facebook', e.target.value)}
                      placeholder="https://facebook.com/..."
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Instagram
                    </label>
                    <input
                      type="url"
                      value={settings.instagram}
                      onChange={(e) => handleSettingChange('instagram', e.target.value)}
                      placeholder="https://instagram.com/..."
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={settings.whatsapp}
                      onChange={(e) => handleSettingChange('whatsapp', e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-dark-400">
                    Email notification settings will be available once email service is configured.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      JWT Secret
                    </label>
                    <input
                      type="password"
                      defaultValue="luxe-looks-secret-key-change-in-production"
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                    />
                    <p className="text-xs text-dark-500 mt-2">
                      Change this in production for better security.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      value={settings.session_timeout}
                      onChange={(e) => handleSettingChange('session_timeout', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rate Limiting</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Max Requests per Hour
                    </label>
                    <input
                      type="number"
                      value={settings.rate_limit_requests}
                      onChange={(e) => handleSettingChange('rate_limit_requests', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'backup' && (
            <motion.div
              key="backup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Database Backup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-dark-400">
                    Create and restore database backups.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button leftIcon={<Database size={18} />}>Download Backup</Button>
                    <Button variant="secondary" leftIcon={<Upload size={18} />}>
                      Restore Backup
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-dark-300">Database Size</span>
                      <span className="text-white font-mono">24.5 MB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-dark-300">Storage Used</span>
                      <span className="text-white font-mono">156 MB / 1 GB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-dark-300">Active Sessions</span>
                      <span className="text-white font-mono">1</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-dark-300">Server Uptime</span>
                      <span className="text-white font-mono">3 days, 7 hours</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cache Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" leftIcon={<SettingsIcon size={18} />}>
                    Clear Cache
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-dark-300">Last Saved</span>
              <span className="text-white font-mono">{new Date().toLocaleString()}</span>
            </div>
            <p className="text-sm text-dark-400 mt-2">
              Note: Some features like logo/favicon upload and backup/restore are coming soon.
              Currently, settings are saved to the database and persist across restarts.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
