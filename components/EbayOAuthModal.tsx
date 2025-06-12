import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { X, ExternalLink } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { generateEbayAuthUrl, checkEbayConnection } from '@/services/ebayIntegrationService';

interface EbayOAuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export default function EbayOAuthModal({ 
  visible, 
  onClose, 
  onSuccess, 
  userId 
}: EbayOAuthModalProps) {
  const [loading, setLoading] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');

  const handleOpenEbay = async () => {
    try {
      setLoading(true);
      const url = generateEbayAuthUrl(userId);
      console.log('🔗 Opening eBay OAuth URL:', url);
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open eBay authorization page');
      }
    } catch (error) {
      console.error('Error opening eBay:', error);
      Alert.alert('Error', 'Failed to open eBay authorization page');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckConnection = async () => {
    try {
      const isConnected = await checkEbayConnection(userId);
      if (isConnected) {
        Alert.alert(
          'Connection Successful!',
          'Your eBay account has been connected successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                onSuccess();
                onClose();
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Not Connected Yet',
          'Please complete the eBay authorization process first by tapping "Open eBay".',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      Alert.alert(
        'Connection Check Failed',
        'Unable to verify eBay connection. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[styles.modal, { backgroundColor }]}
          entering={FadeIn.duration(200)}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <ExternalLink size={24} color={tintColor} />
              <Text style={[styles.title, { color: textColor }]}>Connect eBay Account</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Instructions */}
          <View style={styles.content}>
            <Text style={[styles.instructionText, { color: textColor }]}>
              To connect your eBay account:
            </Text>
            
            <View style={styles.stepsList}>
              <View style={styles.step}>
                <Text style={[styles.stepNumber, { color: tintColor }]}>1.</Text>
                <Text style={[styles.stepText, { color: subtleText }]}>
                  Tap "Open eBay" to sign in through your browser
                </Text>
              </View>
              <View style={styles.step}>
                <Text style={[styles.stepNumber, { color: tintColor }]}>2.</Text>
                <Text style={[styles.stepText, { color: subtleText }]}>
                  Grant access permissions for your app
                </Text>
              </View>
              <View style={styles.step}>
                <Text style={[styles.stepNumber, { color: tintColor }]}>3.</Text>
                <Text style={[styles.stepText, { color: subtleText }]}>
                  Return to this app and tap "I've Connected"
                </Text>
              </View>
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: tintColor }]}
                onPress={handleOpenEbay}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={backgroundColor} />
                ) : (
                  <>
                    <ExternalLink size={20} color={backgroundColor} />
                    <Text style={styles.primaryButtonText}>Open eBay</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: tintColor }]}
                onPress={handleCheckConnection}
              >
                <Text style={[styles.secondaryButtonText, { color: tintColor }]}>
                  I've Connected
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    height: '85%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
  },
  stepsList: {
    marginBottom: 32,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 12,
    marginTop: 2,
  },
  stepText: {
    fontSize: 16,
    flex: 1,
    lineHeight: 24,
  },
  buttons: {
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 