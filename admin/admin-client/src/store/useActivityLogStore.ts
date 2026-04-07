import { create } from 'zustand';
import type { ActivityLog, ActivityLogFilters } from '@/types';
import { activityLogService } from '@/services/api';

interface ActivityLogState {
  logs: ActivityLog[];
  isLoading: boolean;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  filters: ActivityLogFilters;
  fetchLogs: (filters?: ActivityLogFilters) => Promise<void>;
  setFilters: (filters: Partial<ActivityLogFilters>) => void;
  clearFilters: () => void;
  exportLogs: () => Promise<void>;
  cleanupLogs: (days?: number) => Promise<void>;
}

export const useActivityLogStore = create<ActivityLogState>((set, get) => ({
  logs: [],
  isLoading: false,
  totalCount: 0,
  currentPage: 1,
  totalPages: 1,
  filters: {
    page: 1,
    limit: 50,
  },

  fetchLogs: async (filters?: ActivityLogFilters) => {
    set({ isLoading: true });
    try {
      const params = filters || get().filters;
      const response = await activityLogService.getAll(params);
      set({
        logs: response.items,
        totalCount: response.total,
        currentPage: response.page,
        totalPages: response.totalPages,
        filters: params,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters, page: newFilters.page ?? 1 },
    }));
    get().fetchLogs({ ...get().filters, ...newFilters });
  },

  clearFilters: () => {
    const defaultFilters = { page: 1, limit: 50 };
    set({ filters: defaultFilters });
    get().fetchLogs(defaultFilters);
  },

  exportLogs: async () => {
    try {
      const { dateFrom, dateTo } = get().filters;
      const blob = await activityLogService.exportLogs(dateFrom, dateTo);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  },

  cleanupLogs: async (days: number = 90) => {
    try {
      const result = await activityLogService.cleanup(days);
      try {
        await get().fetchLogs();
      } catch {
        // Ignore fetch errors, cleanup still succeeded
      }
      return result;
    } catch (error) {
      console.error('Failed to cleanup logs:', error);
      throw error;
    }
  },
}));
