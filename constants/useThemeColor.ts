import { useColorScheme } from 'react-native';
import Colors from './Colors';

export function useThemeColor(colorName: keyof typeof Colors.light) {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark[colorName] : Colors.light[colorName];
} 