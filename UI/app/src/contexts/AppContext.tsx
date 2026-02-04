import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Project, Alert, User } from '@/types';
import { mockApiService } from '@/services/mockData';

interface AppContextType {
  // User
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Projects
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  isLoadingProjects: boolean;
  
  // Alerts
  alerts: Alert[];
  unreadAlertsCount: number;
  refreshAlerts: () => Promise<void>;
  markAlertAsRead: (id: string) => Promise<void>;
  isLoadingAlerts: boolean;
  
  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // User State
  const [user] = useState<User | null>({
    id: '1',
    email: 'user@techcorp.com',
    name: 'John Doe',
    avatar: undefined
  });
  
  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  
  // Alerts State
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Computed
  const unreadAlertsCount = alerts.filter(a => !a.read).length;
  
  // Actions
  const refreshProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const data = await mockApiService.getProjects();
      setProjects(data);
      if (!selectedProject && data.length > 0) {
        setSelectedProject(data[0]);
      }
    } finally {
      setIsLoadingProjects(false);
    }
  }, [selectedProject]);
  
  const refreshAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const data = await mockApiService.getAlerts();
      setAlerts(data);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);
  
  const markAlertAsRead = useCallback(async (id: string) => {
    await mockApiService.markAlertRead(id);
    setAlerts(prev => prev.map(a => 
      a.id === id ? { ...a, read: true } : a
    ));
  }, []);
  
  const value: AppContextType = {
    user,
    setUser: () => {},
    projects,
    selectedProject,
    setSelectedProject,
    refreshProjects,
    isLoadingProjects,
    alerts,
    unreadAlertsCount,
    refreshAlerts,
    markAlertAsRead,
    isLoadingAlerts,
    sidebarCollapsed,
    setSidebarCollapsed,
    theme,
    setTheme
  };
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
