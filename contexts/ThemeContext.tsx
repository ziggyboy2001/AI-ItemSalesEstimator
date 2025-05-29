import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { supabase } from '@/services/supabaseClient';

type ColorScheme = 'light' | 'dark';

interface ThemeContextType {
  colorScheme: ColorScheme;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorScheme>(systemColorScheme || 'light');
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Try to fetch user settings
        const { data: settings, error } = await supabase
          .from('user_settings')
          .select('dark_mode')
          .eq('user_id', user.id)
          .single();

        if (settings && !error) {
          setColorScheme(settings.dark_mode ? 'dark' : 'light');
        } else if (error && error.code === 'PGRST116') {
          // No settings found, create default settings
          await supabase
            .from('user_settings')
            .insert({
              user_id: user.id,
              dark_mode: false,
              notifications: true,
              default_filters: {}
            });
          setColorScheme('light');
        }
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      // Fallback to system preference
      setColorScheme(systemColorScheme || 'light');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDarkMode = async () => {
    const newColorScheme: ColorScheme = colorScheme === 'light' ? 'dark' : 'light';
    setColorScheme(newColorScheme);

    if (userId) {
      try {
        // Update or insert user settings
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: userId,
            dark_mode: newColorScheme === 'dark',
            notifications: true,
            default_filters: {}
          });

        if (error) {
          console.error('Error saving dark mode preference:', error);
        }
      } catch (error) {
        console.error('Error updating user settings:', error);
      }
    }
  };

  const isDarkMode = colorScheme === 'dark';

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        isDarkMode,
        toggleDarkMode,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
} 