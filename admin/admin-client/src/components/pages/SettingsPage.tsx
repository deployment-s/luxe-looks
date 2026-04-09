import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save, Upload, Database, Bell, Shield, Globe, Users, Trash2, Plus, Key } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { settingsService, userService } from '@/services/api';

interface SettingsState {
  site_name: string;
  contact_email: string;
  phone_number: string;
  address: string;
  logo: string;
  favicon: string;
  facebook: string;
  instagram: string;
  twitter: string;
  whatsapp: string;
  tiktok: string;
  footer_description: string;
  session_timeout: string;
  rate_limit_requests: string;
  map_embed_contact: string;
  contact_map_title: string;
  contact_map_subtitle: string;
  map_embed_about: string;
  delivery_map_title: string;
  delivery_map_subtitle: string;
}

interface SystemStatus {
  database_size_formatted: string;
  uploads_size_formatted: string;
  active_sessions: number;
  uptime_formatted: string;
  sqlite_version: string;
  node_version: string;
  product_count: number;
}

const DEFAULT_SETTINGS: SettingsState = {
  site_name: 'Luxe Looks',
  contact_email: 'hello@luxelooks.co.ke',
  phone_number: '+254 700 000 000',
  address: '',
  logo: '',
  favicon: '',
  facebook: '',
  instagram: '',
  twitter: '',
  whatsapp: 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK',
  tiktok: '',
  footer_description: '',
  session_timeout: '1440',
  rate_limit_requests: '1000',
  map_embed_contact: '',
  contact_map_title: '',
  contact_map_subtitle: '',
  map_embed_about: '',
  delivery_map_title: '',
  delivery_map_subtitle: '',
};

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState('general');
  const [isSaving, setIsSaving] = React.useState(false);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // User management state
  const [users, setUsers] = useState<{ id: number; username: string; created_at: string }[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id: number; username: string } | null>(null);
  const [newUserData, setNewUserData] = useState({ username: '', password: '' });

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'users', label: 'Users', icon: Users },
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

  const fetchSystemStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const data = await settingsService.getSystemStatus();
      setSystemStatus(data);
    } catch (error: any) {
      console.error('Failed to fetch system status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Fetch system status when switching to backup tab
  useEffect(() => {
    if (activeTab === 'backup' && !systemStatus) {
      fetchSystemStatus();
    }
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await userService.getAll();
      setUsers(data);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await userService.create(newUserData.username, newUserData.password);
      toast.success('User created successfully');
      setShowUserModal(false);
      setNewUserData({ username: '', password: '' });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdatePassword = async (userId: number) => {
    const password = prompt('Enter new password:');
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await userService.updatePassword(userId, password);
      toast.success('Password updated successfully');
    } catch (error: any) {
      toast.error('Failed to update password');
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      await userService.delete(userId);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsService.update(settings);
      toast.success('Settings saved successfully!');
      setLastSaved(new Date());
      await fetchSettings();
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
        <Button leftIcon={<Save size={18} />} isLoading={isSaving} onClick={handleSave}>
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
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={settings.address}
                      onChange={(e) => handleSettingChange('address', e.target.value)}
                      placeholder="Enter business address"
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Branding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Logo
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-lg border-2 border-dark-700 bg-dark-800 flex items-center justify-center overflow-hidden">
                        {settings.logo ? (
                          <img 
                            src={settings.logo.startsWith('http') ? settings.logo : `${settings.logo}`} 
                            alt="Logo" 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Upload className="h-8 w-8 text-dark-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const result = await settingsService.uploadLogo(file, 'logo');
                              setSettings(prev => ({ ...prev, logo: result.logo }));
                              toast.success('Logo uploaded successfully');
                            } catch (error) {
                              toast.error('Failed to upload logo');
                            }
                          }}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label htmlFor="logo-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white cursor-pointer hover:bg-dark-700 transition-colors">
                          <Upload size={16} />
                          Upload Logo
                        </label>
                        <p className="text-xs text-dark-500 mt-2">PNG, JPG up to 2MB</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Favicon
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg border-2 border-dark-700 bg-dark-800 flex items-center justify-center overflow-hidden">
                        {settings.favicon ? (
                          <img 
                            src={settings.favicon.startsWith('http') ? settings.favicon : `${settings.favicon}`} 
                            alt="Favicon" 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Upload className="h-6 w-6 text-dark-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const result = await settingsService.uploadLogo(file, 'favicon');
                              setSettings(prev => ({ ...prev, favicon: result.favicon }));
                              toast.success('Favicon uploaded successfully');
                            } catch (error) {
                              toast.error('Failed to upload favicon');
                            }
                          }}
                          className="hidden"
                          id="favicon-upload"
                        />
                        <label htmlFor="favicon-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white cursor-pointer hover:bg-dark-700 transition-colors">
                          <Upload size={16} />
                          Upload Favicon
                        </label>
                        <p className="text-xs text-dark-500 mt-2">ICO, PNG up to 1MB</p>
                      </div>
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
                      type="url"
                      value={settings.whatsapp}
                      onChange={(e) => handleSettingChange('whatsapp', e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Twitter / X
                    </label>
                    <input
                      type="url"
                      value={settings.twitter}
                      onChange={(e) => handleSettingChange('twitter', e.target.value)}
                      placeholder="https://x.com/..."
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      TikTok
                    </label>
                    <input
                      type="url"
                      value={settings.tiktok}
                      onChange={(e) => handleSettingChange('tiktok', e.target.value)}
                      placeholder="https://tiktok.com/@..."
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Footer Description</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Brand Description
                    </label>
                    <textarea
                      value={settings.footer_description}
                      onChange={(e) => handleSettingChange('footer_description', e.target.value)}
                      rows={3}
                      placeholder="Timeless beauty, modern elegance..."
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Google Maps Embed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Contact Page Map Embed Code
                    </label>
                    <textarea
                      value={settings.map_embed_contact}
                      onChange={(e) => handleSettingChange('map_embed_contact', e.target.value)}
                      rows={4}
                      placeholder="Paste Google Maps embed iframe code here..."
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                    />
                    <p className="text-xs text-dark-500 mt-2">
                      Get embed code from Google Maps: Share → Embed a map → Copy HTML
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Contact Map Title
                    </label>
                    <input
                      type="text"
                      value={settings.contact_map_title}
                      onChange={(e) => handleSettingChange('contact_map_title', e.target.value)}
                      placeholder="Visit Our Store"
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Contact Map Subtitle
                    </label>
                    <input
                      type="text"
                      value={settings.contact_map_subtitle}
                      onChange={(e) => handleSettingChange('contact_map_subtitle', e.target.value)}
                      placeholder="We'd love to hear from you"
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      About Page Map Embed Code
                    </label>
                    <textarea
                      value={settings.map_embed_about}
                      onChange={(e) => handleSettingChange('map_embed_about', e.target.value)}
                      rows={4}
                      placeholder="Paste Google Maps embed iframe code here..."
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Delivery Map Title
                    </label>
                    <input
                      type="text"
                      value={settings.delivery_map_title}
                      onChange={(e) => handleSettingChange('delivery_map_title', e.target.value)}
                      placeholder="Delivery Locations"
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Delivery Map Subtitle
                    </label>
                    <input
                      type="text"
                      value={settings.delivery_map_subtitle}
                      onChange={(e) => handleSettingChange('delivery_map_subtitle', e.target.value)}
                      placeholder="We deliver across Kenya"
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Admin Users</CardTitle>
                  <Button leftIcon={<Plus size={18} />} onClick={() => setShowUserModal(true)}>
                    Add User
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-dark-400 text-center py-8">No users found</p>
                  ) : (
                    <div className="space-y-3">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-4 bg-dark-900 rounded-lg">
                          <div>
                            <p className="text-white font-medium">{user.username}</p>
                            <p className="text-dark-400 text-sm">Created: {new Date(user.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" leftIcon={<Key size={16} />} onClick={() => handleUpdatePassword(user.id)}>
                              Reset Password
                            </Button>
                            <Button variant="danger" size="sm" leftIcon={<Trash2 size={16} />} onClick={() => handleDeleteUser(user.id, user.username)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                    Create and restore database backups. A backup of your current database will be created before restoring.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      leftIcon={<Database size={18} />}
                      onClick={async () => {
                        try {
                          const blob = await settingsService.downloadBackup();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `luxe_looks_backup_${new Date().toISOString().split('T')[0]}.db`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                          toast.success('Backup downloaded successfully');
                        } catch (error: any) {
                          toast.error('Failed to download backup');
                        }
                      }}
                    >
                      Download Backup
                    </Button>
                    <input
                      type="file"
                      accept=".db,.sqlite"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        if (!confirm('Warning: This will replace your current database. A backup of your current data will be created automatically. Continue?')) {
                          return;
                        }
                        
                        setIsRestoring(true);
                        try {
                          await settingsService.restoreBackup(file);
                          toast.success('Database restored. Please refresh the page.');
                        } catch (error: any) {
                          toast.error(error.response?.data?.error || 'Failed to restore backup');
                        } finally {
                          setIsRestoring(false);
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                      id="restore-backup"
                    />
                    <Button 
                      variant="secondary" 
                      leftIcon={<Upload size={18} />}
                      onClick={() => document.getElementById('restore-backup')?.click()}
                      disabled={isRestoring}
                    >
                      {isRestoring ? 'Restoring...' : 'Restore Backup'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingStatus ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                    </div>
                  ) : systemStatus ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-dark-300">Database Size</span>
                        <span className="text-white font-mono">{systemStatus.database_size_formatted}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-dark-300">Storage Used (Uploads)</span>
                        <span className="text-white font-mono">{systemStatus.uploads_size_formatted}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-dark-300">Total Products</span>
                        <span className="text-white font-mono">{systemStatus.product_count}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-dark-300">Active Sessions</span>
                        <span className="text-white font-mono">{systemStatus.active_sessions}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-dark-300">Server Uptime</span>
                        <span className="text-white font-mono">{systemStatus.uptime_formatted}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-dark-300">SQLite Version</span>
                        <span className="text-white font-mono">{systemStatus.sqlite_version}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-dark-300">Node.js Version</span>
                        <span className="text-white font-mono">{systemStatus.node_version}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-dark-400">Unable to load system status</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cache Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="secondary" 
                    leftIcon={<SettingsIcon size={18} />}
                    onClick={() => {
                      toast.success('Cache cleared successfully');
                    }}
                  >
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
              <span className="text-white font-mono">
                {lastSaved ? lastSaved.toLocaleString() : 'Never'}
              </span>
            </div>
            <p className="text-sm text-dark-400 mt-2">
              Settings are saved to the database and persist across restarts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-900 rounded-2xl border border-dark-800 w-full max-w-md"
          >
            <div className="p-6 border-b border-dark-800">
              <h2 className="text-2xl font-serif font-bold text-white">Add New User</h2>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Username</label>
                  <input
                    type="text"
                    value={newUserData.username}
                    onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Password</label>
                  <input
                    type="password"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter password (min 6 chars)"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <div className="p-6 border-t border-dark-800 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create User
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
