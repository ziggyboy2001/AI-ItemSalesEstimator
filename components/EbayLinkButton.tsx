import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking, Alert } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';

interface EbayLinkButtonProps {
  itemUrl?: string;
  isCurrentListing: boolean;
  itemId?: string;
  disabled?: boolean;
}

export default function EbayLinkButton({ 
  itemUrl, 
  isCurrentListing, 
  itemId,
  disabled = false 
}: EbayLinkButtonProps) {
  const tintColor = useThemeColor('tint');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');

  const buildAffiliateUrl = (originalUrl: string, itemId?: string): string => {
    // Get environment variables
    const partnerId = process.env.EXPO_PUBLIC_EBAY_PARTNER_ID;
    const campaignId = process.env.EXPO_PUBLIC_EBAY_CAMPAIGN_ID;
    const affiliateEnabled = process.env.EXPO_PUBLIC_EBAY_AFFILIATE_ENABLED === 'true';

    // If affiliate is disabled or credentials missing, return original URL
    if (!affiliateEnabled || !partnerId || !campaignId) {
      console.log('🔗 Affiliate disabled or credentials missing, using direct URL');
      return originalUrl;
    }

    // Extract item ID from URL if not provided
    let extractedItemId = itemId;
    if (!extractedItemId && originalUrl) {
      const itemMatch = originalUrl.match(/\/itm\/(\d+)/);
      extractedItemId = itemMatch ? itemMatch[1] : undefined;
    }

    // Build eBay affiliate URL using EPN format
    const affiliateUrl = `https://rover.ebay.com/rover/1/711-53200-19255-0/1?` +
      `icep_ff3=2&` +
      `pub=${partnerId}&` +
      `toolid=10001&` +
      `campid=${campaignId}&` +
      `customid=bidpeek_app&` +
      `icep_item=${extractedItemId || ''}&` +
      `ipn=psmain&` +
      `icep_vectorid=229466&` +
      `kwid=902099&` +
      `mtid=824&` +
      `kw=lg`;

    console.log('🎯 Built affiliate URL for item:', extractedItemId);
    return affiliateUrl;
  };

  const handlePress = async () => {
    if (!itemUrl) {
      Alert.alert('Error', 'No eBay link available for this item.');
      return;
    }

    try {
      let finalUrl = itemUrl;

      // For current listings, wrap with affiliate link
      if (isCurrentListing) {
        finalUrl = buildAffiliateUrl(itemUrl, itemId);
        console.log('🛒 Opening current listing with affiliate link');
      } else {
        console.log('📊 Opening sold item with direct link');
      }

      // Open the URL
      const supported = await Linking.canOpenURL(finalUrl);
      if (supported) {
        await Linking.openURL(finalUrl);
      } else {
        Alert.alert('Error', 'Cannot open eBay link on this device.');
      }
    } catch (error) {
      console.error('Error opening eBay link:', error);
      Alert.alert('Error', 'Failed to open eBay link. Please try again.');
    }
  };

  const buttonText = isCurrentListing ? 'Buy on eBay' : 'View on eBay';
  const buttonSubtext = isCurrentListing ? 'Live listing - purchase now' : 'Reference - item already sold';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { 
          borderColor: disabled ? subtleText : tintColor,
          backgroundColor: 'transparent'
        }
      ]}
      onPress={handlePress}
      disabled={disabled || !itemUrl}
      activeOpacity={0.7}
    >
      <ExternalLink 
        size={20} 
        color={disabled ? subtleText : tintColor} 
        style={styles.icon} 
      />
      <Text 
        style={[
          styles.buttonText, 
          { color: disabled ? subtleText : tintColor }
        ]}
      >
        {buttonText}
      </Text>
      <Text 
        style={[
          styles.buttonSubtext, 
          { color: subtleText }
        ]}
      >
        {buttonSubtext}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 40,
    minHeight: 56,
    position: 'relative',
  },
  icon: {
    marginRight: 8,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    flex: 1,
    textAlign: 'center',
  },
  buttonSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
}); 