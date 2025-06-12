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
  Image,
  Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { X, DollarSign, Package, Tag, FileText, Trash2, Plus, Camera } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { Picker } from '@react-native-picker/picker';
import { OPENAI_API_KEY } from '@env';

interface HaulItem {
  id: string;
  title: string;
  image_url?: string;
  additional_images?: string[];
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
  images?: string[];
  title?: string;
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editableImages, setEditableImages] = useState<string[]>([]);

  // Theme colors
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');
  const borderColor = useThemeColor('tabIconDefault');



  // Handle adding new image
  const handleAddImage = () => {
    if (editableImages.length >= 12) {
      Alert.alert('Maximum Images', 'You can add up to 12 photos per listing.');
      return;
    }

    Alert.alert(
      'Add Photo',
      'Choose how to add a photo of your item',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Camera',
          onPress: takePicture,
        },
        {
          text: 'Photo Library',
          onPress: pickFromLibrary,
        },
      ]
    );
  };

  const takePicture = async () => {
    try {
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        Alert.alert('Camera Permission', 'Sorry, we need camera permissions to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = [...editableImages, result.assets[0].uri];
        setEditableImages(newImages);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'There was an error taking the photo. Please try again.');
    }
  };

  const pickFromLibrary = async () => {
    try {
      // Request media library permissions
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libraryPermission.granted) {
        Alert.alert('Photo Library Permission', 'Sorry, we need photo library permissions to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = [...editableImages, result.assets[0].uri];
        setEditableImages(newImages);
      }
    } catch (error) {
      console.error('Error picking from library:', error);
      Alert.alert('Error', 'There was an error selecting the photo. Please try again.');
    }
  };

  // Helper function to format price to 2 decimals, rounding up
  const formatPriceToTwoDecimals = (value: number | string): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '';
    
    // Round up to nearest cent
    const roundedUp = Math.ceil(numValue * 100) / 100;
    return roundedUp.toFixed(2);
  };

  // Handle price input changes with formatting
  const handlePriceChange = (text: string) => {
    // Allow typing but format on blur or when valid
    if (text === '') {
      setPrice('');
      return;
    }
    
    // Remove any non-numeric characters except decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = cleanText.split('.');
    if (parts.length > 2) return;
    
    // Limit to 2 decimal places while typing
    if (parts[1] && parts[1].length > 2) {
      const formatted = parts[0] + '.' + parts[1].substring(0, 2);
      const numValue = parseFloat(formatted);
      if (!isNaN(numValue)) {
        const roundedUp = Math.ceil(numValue * 100) / 100;
        setPrice(roundedUp.toFixed(2));
      }
      return;
    }
    
    setPrice(cleanText);
  };

  useEffect(() => {
    if (visible && item) {
      // Reset form when modal opens
      setCategoryId('');
      setCondition('USED_EXCELLENT');
      setPrice(formatPriceToTwoDecimals(item.sale_price));
      setEditableTitle(item.title);
      setCurrentImageIndex(0);
      
      // Initialize with empty images - users must upload their own
      setEditableImages([]);
      
      // Generate AI description asynchronously
      // generateDefaultDescription(item).then(description => {
      //   setDescription(description);
      // });
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
- Must be under 500 characters (very important)
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
      
      if (generatedDescription && generatedDescription.length < 600) {
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

    if (editableImages.length === 0) {
      Alert.alert('Missing Photos', 'Please add at least one photo of your item.');
      return;
    }

    const config: ListingConfiguration = {
      categoryId,
      condition,
      price: Number(price),
      description: description.trim() || undefined,
      images: editableImages, // Include user images
      title: editableTitle.trim() || item?.title || ''
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
            {/* User Images Card */}
            <Animated.View 
              style={[styles.imagesCard, { backgroundColor: cardColor }]}
              entering={FadeInDown.delay(50).duration(400)}
            >
              <View style={styles.sectionHeader}>
                <Camera size={20} color={tintColor} />
                <Text style={[styles.sectionTitle, { color: textColor }]}>Your Photos</Text>
              </View>
              
              <View style={styles.userImagesContainer}>
                {editableImages.length > 0 ? (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.userImagesScroll}
                    contentContainerStyle={styles.userImagesContent}
                  >
                    {editableImages.map((imageUrl, index) => (
                      <View key={index} style={styles.userImageWrapper}>
                        <Image 
                          source={{ uri: imageUrl }} 
                          style={styles.userImage} 
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.deleteUserImageButton}
                          onPress={() => {
                            const newImages = editableImages.filter((_, i) => i !== index);
                            setEditableImages(newImages);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Trash2 size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={[styles.noUserImagesPlaceholder, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}>
                    <Camera size={32} color={subtleText} />
                    <Text style={[styles.noUserImagesText, { color: subtleText }]}>Add your own photos</Text>
                    <Text style={[styles.noUserImagesSubtext, { color: subtleText }]}>Take photos of your actual item</Text>
                  </View>
                )}
              </View>
              
              {/* Add Photo Button */}
              <TouchableOpacity
                style={[styles.addImageButton, { borderColor: tintColor }]}
                onPress={handleAddImage}
              >
                <Plus size={16} color={tintColor} />
                <Text style={[styles.addImageText, { color: tintColor }]}>Add Photo</Text>
              </TouchableOpacity>
              
              <Text style={[styles.helperText, { color: subtleText }]}>
                Add 1-12 photos of your actual item. First photo will be the main listing image.
              </Text>
            </Animated.View>

            {/* Item Preview */}
            <Animated.View 
              style={[styles.itemPreview, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}
              entering={FadeInDown.delay(100).duration(400)}
            >
              <View style={styles.itemInfo}>
                <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.originalPrice, { color: subtleText }]}>
                  Using BidPeek's suggested price: ${formatPriceToTwoDecimals(item.sale_price)}
                </Text>
                {item.additional_images && item.additional_images.length > 0 && (
                  <Text style={[styles.imageCount, { color: subtleText }]}>
                    {1 + item.additional_images.length} image{1 + item.additional_images.length !== 1 ? 's' : ''} for eBay listing
                  </Text>
                )}
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
              <Text style={[styles.helperText, { color: subtleText }]}>
                Choose the most appropriate condition of your item
              </Text>
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
                  onChangeText={handlePriceChange}
                  onBlur={() => {
                    // Format price when user finishes editing
                    if (price && price !== '') {
                      const formatted = formatPriceToTwoDecimals(price);
                      if (formatted !== price) {
                        setPrice(formatted);
                      }
                    }
                  }}
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
                <Text style={[styles.sectionTitle, { color: textColor }]}>AI Generated Description</Text>
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
                backgroundColor: backgroundColor,
                borderColor: tintColor,
                borderWidth: 1,
                opacity: loading ? 0.6 : 1 
              }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={tintColor} />
              ) : (
                <Text style={[styles.buttonText, { color: tintColor }]}>List Item</Text>
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
  carouselContainer: {
    width: 120,
    height: 120,
    marginRight: 12,
    position: 'relative',
  },
  imageCarousel: {
    width: 120,
    height: 120,
  },
  carouselContent: {
    alignItems: 'center',
  },
  carouselImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  imageCounter: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  imageCounterText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  noImagePlaceholder: {
    width: 200,
    height: 120,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  imageWrapper: {
    position: 'relative',
  },
  deleteImageButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 4,
    height: 30,
    width: 120,
    marginTop: 10,
  },
  addImageText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  userImagesContainer: {
    width: '100%',
    height: 120,
    marginRight: 12,
    position: 'relative',
  },
  userImagesScroll: {
    width: '100%',
    height: 120,
  },
  userImageWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  userImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  deleteUserImageButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    borderRadius: 12,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noUserImagesPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noUserImagesText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  noUserImagesSubtext: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  imagesCard: {
    backgroundColor: 'transparent',
    marginBottom: 20,
  },
  userImagesContent: {
    alignItems: 'center',
    paddingRight: 16,
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
  imageCount: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
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