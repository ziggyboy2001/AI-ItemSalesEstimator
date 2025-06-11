import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { X, DollarSign, Package, Tag, FileText } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { Picker } from '@react-native-picker/picker';
import { OPENAI_API_KEY } from '@env';

interface HaulItem {
  id: string;
  title: string;
  image_url?: string;
  sale_price: number;
  purchase_price: number;
}

interface EbayListingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (config: ListingConfiguration) => void;
  item: HaulItem | null;
  loading?: boolean;
}

export interface ListingConfiguration {
  categoryId: string;
  condition: 'NEW' | 'USED_LIKE_NEW' | 'USED_EXCELLENT' | 'USED_VERY_GOOD' | 'USED_GOOD' | 'USED_ACCEPTABLE';
  price?: number;
  description?: string;
}

// Common eBay categories for quick selection
const COMMON_CATEGORIES = [
  { id: '58058', name: 'Electronics > Cell Phones & Smartphones' },
  { id: '175672', name: 'Electronics > Video Games & Consoles' },
  { id: '11450', name: 'Clothing, Shoes & Accessories > Men\'s Clothing' },
  { id: '15724', name: 'Clothing, Shoes & Accessories > Women\'s Clothing' },
  { id: '2984', name: 'Home & Garden > Kitchen, Dining & Bar' },
  { id: '267', name: 'Books, Movies & Music > Books' },
  { id: '293', name: 'Books, Movies & Music > Music' },
  { id: '11232', name: 'Sports & Recreation > Outdoor Sports' },
  { id: '1249', name: 'Toys & Hobbies > Action Figures' },
  { id: '550', name: 'Art & Collectibles > Collectibles' },
];

const CONDITIONS = [
  { value: 'NEW', label: 'New', description: 'Brand new, unused item' },
  { value: 'USED_LIKE_NEW', label: 'Like New', description: 'Used but in excellent condition' },
  { value: 'USED_EXCELLENT', label: 'Excellent', description: 'Minor signs of wear' },
  { value: 'USED_VERY_GOOD', label: 'Very Good', description: 'Some signs of wear' },
  { value: 'USED_GOOD', label: 'Good', description: 'Noticeable wear but fully functional' },
  { value: 'USED_ACCEPTABLE', label: 'Acceptable', description: 'Significant wear but still functional' },
] as const;

export default function EbayListingModal({ 
  visible, 
  onClose, 
  onSubmit, 
  item, 
  loading = false 
}: EbayListingModalProps) {
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState<ListingConfiguration['condition']>('USED_EXCELLENT');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [editableTitle, setEditableTitle] = useState('');

  // Theme colors
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');
  const borderColor = useThemeColor('tabIconDefault');

  useEffect(() => {
    if (visible && item) {
      // Reset form when modal opens
      setCategoryId('');
      setCondition('USED_EXCELLENT');
      setPrice(item.sale_price.toString());
      setEditableTitle(item.title);
      
      // Generate AI description asynchronously
      generateDefaultDescription(item).then(description => {
        setDescription(description);
      });
    }
  }, [visible, item]);

  const generateDefaultDescription = async (item: HaulItem) => {
    try {
      if (!OPENAI_API_KEY) {
        return generateFallbackDescription(item);
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: `Write a professional eBay listing description for: "${item.title}"

Requirements:
- Must be under 301 characters (very important)
- Detailed and accurate
- Professional and trustworthy tone
- Include authenticity and condition
- No bullet points or special formatting
- Focus on what buyers care about most

Return only the description text, nothing else.`
            }
          ],
          max_tokens: 120,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        console.error('OpenAI API error:', response.status);
        return generateFallbackDescription(item);
      }

      const data = await response.json();
      const generatedDescription = data.choices?.[0]?.message?.content?.trim();
      
      if (generatedDescription && generatedDescription.length < 301) {
        console.log('✅ AI generated description:', generatedDescription.length, 'chars');
        return generatedDescription;
      }
      
      // If too long, use fallback
      console.log('⚠️ AI description too long, using fallback');
      return generateFallbackDescription(item);
    } catch (error) {
      console.error('Error generating AI description:', error);
      return generateFallbackDescription(item);
    }
  };

  const generateFallbackDescription = (item: HaulItem) => {
    const maxTitleLength = 80;
    const title = item.title.length > maxTitleLength ? item.title.substring(0, maxTitleLength) + '...' : item.title;
    const description = `${title} in excellent condition. Authentic item, carefully inspected and ready to ship. Fast shipping with tracking. Returns accepted. Item exactly as described.`;
    
    // Ensure fallback is also under 301 characters
    return description.length < 301 ? description : description.substring(0, 300);
  };

  const handleSubmit = () => {
    if (!categoryId) {
      Alert.alert('Missing Information', 'Please select a category for your listing.');
      return;
    }

    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price for your listing.');
      return;
    }

    const config: ListingConfiguration = {
      categoryId,
      condition,
      price: Number(price),
      description: description.trim() || undefined
    };

    onSubmit(config);
  };

  if (!item) return null;

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
            <Text style={[styles.title, { color: textColor }]}>List on eBay</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <X size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Item Preview */}
            <Animated.View 
              style={[styles.itemPreview, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}
              entering={FadeInDown.delay(100).duration(400)}
            >
              {item.image_url && (
                <Image source={{ uri: item.image_url }} style={styles.itemImage} />
              )}
              <View style={styles.itemInfo}>
                <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.originalPrice, { color: subtleText }]}>
                  BidPeek's suggested price: ${item.sale_price.toFixed(2)}
                </Text>
              </View>
            </Animated.View>

            {/* Editable Title */}
            <Animated.View 
              style={styles.section}
              entering={FadeInDown.delay(150).duration(400)}
            >
              <View style={styles.sectionHeader}>
                <FileText size={20} color={tintColor} />
                <Text style={[styles.sectionTitle, { color: textColor }]}>Listing Title</Text>
              </View>
              <TextInput
                style={[styles.titleInput, { 
                  borderColor: borderColor + '40', 
                  color: textColor 
                }]}
                value={editableTitle}
                onChangeText={setEditableTitle}
                placeholder="Enter listing title..."
                placeholderTextColor={subtleText}
                maxLength={80}
                editable={!loading}
              />
              <Text style={[styles.helperText, { color: subtleText }]}>
                Create an attractive title for your listing (max 80 characters)
              </Text>
            </Animated.View>

            {/* Category Selection */}
            <Animated.View 
              style={styles.section}
              entering={FadeInDown.delay(250).duration(400)}
            >
              <View style={styles.sectionHeader}>
                <Tag size={20} color={tintColor} />
                <Text style={[styles.sectionTitle, { color: textColor }]}>Category</Text>
              </View>
              <View style={[styles.pickerContainer, { borderColor: borderColor + '40' }]}>
                <Picker
                  selectedValue={categoryId}
                  onValueChange={setCategoryId}
                  style={[styles.picker, { color: textColor }]}
                  enabled={!loading}
                >
                  <Picker.Item label="Select a category..." value="" />
                  {COMMON_CATEGORIES.map((category) => (
                    <Picker.Item 
                      key={category.id} 
                      label={category.name} 
                      value={category.id} 
                    />
                  ))}
                </Picker>
              </View>
              <Text style={[styles.helperText, { color: subtleText }]}>
                Choose the most appropriate category for your item
              </Text>
            </Animated.View>

            {/* Condition Selection */}
            <Animated.View 
              style={styles.section}
              entering={FadeInDown.delay(350).duration(400)}
            >
              <View style={styles.sectionHeader}>
                <Package size={20} color={tintColor} />
                <Text style={[styles.sectionTitle, { color: textColor }]}>Condition</Text>
              </View>
              <View style={[styles.pickerContainer, { borderColor: borderColor + '40' }]}>
                <Picker
                  selectedValue={condition}
                  onValueChange={setCondition}
                  style={[styles.picker, { color: textColor }]}
                  enabled={!loading}
                >
                  {CONDITIONS.map((cond) => (
                    <Picker.Item 
                      key={cond.value} 
                      label={`${cond.label} - ${cond.description}`} 
                      value={cond.value} 
                    />
                  ))}
                </Picker>
              </View>
            </Animated.View>

            {/* Price */}
            <Animated.View 
              style={styles.section}
              entering={FadeInDown.delay(450).duration(400)}
            >
              <View style={styles.sectionHeader}>
                <DollarSign size={20} color={tintColor} />
                <Text style={[styles.sectionTitle, { color: textColor }]}>Listing Price</Text>
              </View>
              <View style={[styles.inputContainer, { borderColor: borderColor + '40' }]}>
                <Text style={[styles.currencySymbol, { color: textColor }]}>$</Text>
                <TextInput
                  style={[styles.priceInput, { color: textColor }]}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  placeholderTextColor={subtleText}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>
              <Text style={[styles.helperText, { color: subtleText }]}>
                Set a competitive price for your item
              </Text>
            </Animated.View>

            {/* Description */}
            <Animated.View 
              style={styles.section}
              entering={FadeInDown.delay(550).duration(400)}
            >
              <View style={styles.sectionHeader}>
                <FileText size={20} color={tintColor} />
                <Text style={[styles.sectionTitle, { color: textColor }]}>Description</Text>
              </View>
              <TextInput
                style={[styles.descriptionInput, { 
                  borderColor: borderColor + '40', 
                  color: textColor 
                }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your item..."
                placeholderTextColor={subtleText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={!loading}
              />
              <Text style={[styles.helperText, { color: subtleText }]}>
                Provide detailed information about your item's condition and features
              </Text>
            </Animated.View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: errorColor }]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: errorColor }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.submitButton, { 
                backgroundColor: tintColor,
                opacity: loading ? 0.6 : 1 
              }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={[styles.buttonText, { color: 'white' }]}>List Item</Text>
              )}
            </TouchableOpacity>
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
    maxWidth: 500,
    height: '80%',
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  itemPreview: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
  },
  picker: {
    height: 50,
    marginBottom: 150,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '500',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    height: 50,
  },
  descriptionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    fontSize: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  submitButton: {
    // backgroundColor set via style prop
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 