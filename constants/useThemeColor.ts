import Colors from './Colors';
import { useTheme } from '@/contexts/ThemeContext';

export function useThemeColor(colorName: keyof typeof Colors.light) {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? Colors.dark[colorName] : Colors.light[colorName];
} 