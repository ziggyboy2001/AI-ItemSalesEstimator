import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { AlertCircle, Search, Clock, Bookmark } from 'lucide-react-native';
import Colors from '@/constants/Colors';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: 'AlertCircle' | 'Search' | 'Clock' | 'Bookmark';
  action?: {
    label: string;
    onPress: () => void;
  };
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  const renderIcon = () => {
    const size = 48;
    const color = '#bbb';

    switch (icon) {
      case 'AlertCircle':
        return <AlertCircle size={size} color={color} />;
      case 'Search':
        return <Search size={size} color={color} />;
      case 'Clock':
        return <Clock size={size} color={color} />;
      case 'Bookmark':
        return <Bookmark size={size} color={color} />;
      default:
        return <AlertCircle size={size} color={color} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {renderIcon()}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {action && (
        <TouchableOpacity style={styles.actionButton} onPress={action.onPress}>
          <Text style={styles.actionButtonText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  actionButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
});