import React, { useState, useEffect, useMemo } from 'react';
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
import { X, DollarSign, Package, Tag, FileText, Trash2, Plus, Camera, Brain, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { Picker } from '@react-native-picker/picker';
import { OPENAI_API_KEY } from '@env';
import { CategoryIntelligenceService, SmartCategoryResult, DynamicField } from '../services/categoryIntelligenceService';
import { testEbayTaxonomyAPI } from '../services/testEbayAPI';
import { PerformanceMonitor } from '../services/performanceMonitor';

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
  aspects?: Record<string, string[]>; // Phase 2 Step 2.2: Dynamic aspects
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

  // Phase 2: New intelligent state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [categoryAnalysis, setCategoryAnalysis] = useState<SmartCategoryResult | null>(null);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const [userAspects, setUserAspects] = useState<Record<string, string[]>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');
  const borderColor = useThemeColor('tabIconDefault');

  // Phase 2: Initialize intelligence service
  const intelligenceService = useMemo(() => {
    // For now, we'll use the test API to get access token
    // In production, this would use the user's eBay OAuth token
    return null; // Will be initialized when we get the token
  }, []);

  // Phase 2: Auto-analyze item when modal opens
  useEffect(() => {
    if (visible && item) {
      analyzeItemIntelligently();
    }
  }, [visible, item]);

  const analyzeItemIntelligently = async () => {
    setIsAnalyzing(true);
    try {
      console.log('🧠 Phase 2: Starting intelligent analysis for:', item?.title);
      
      // For now, we'll test the API integration
      const testResult = await testEbayTaxonomyAPI();
      if (testResult) {
        console.log('✅ eBay API test successful, ready for intelligent analysis');
        
        // Phase 2 Step 2.2: Create mock analysis to test dynamic fields
        const mockAnalysis: SmartCategoryResult = {
          recommendedCategory: '175672',
          suggestedCategories: [
            {
              categoryId: '175672',
              categoryName: 'Video Games & Consoles > Video Games',
              confidence: 'HIGH' as const,
              autoDetectedAspects: {
                'Platform': ['PlayStation 5'],
                'Genre': ['Action']
              },
              requiredUserInput: ['Brand', 'Game Name', 'Condition Details']
            },
            {
              categoryId: '58058',
              categoryName: 'Electronics > Cell Phones & Smartphones',
              confidence: 'MEDIUM' as const,
              autoDetectedAspects: {
                'Brand': ['Apple']
              },
              requiredUserInput: ['Model', 'Storage Capacity', 'Color']
            }
          ]
        };
        
        setCategoryAnalysis(mockAnalysis);
        
        // Auto-select the recommended category and load its fields
        setCategoryId(mockAnalysis.recommendedCategory);
        await loadDynamicFieldsForCategory(mockAnalysis.recommendedCategory, 0);
        
        console.log('🎯 Mock analysis complete with dynamic fields');
      }
    } catch (error) {
      console.error('❌ Failed to analyze item:', error);
      // Fallback to manual category selection
    } finally {
      setIsAnalyzing(false);
        }
  };

  // Phase 2: Handle category selection change
  const handleCategoryChange = async (newCategoryId: string, suggestionIndex: number) => {
    setCategoryId(newCategoryId);
    setSelectedCategoryIndex(suggestionIndex);
    await loadDynamicFieldsForCategory(newCategoryId, suggestionIndex);
  };

  // Phase 2 Step 2.2: Load dynamic fields when category changes
  const loadDynamicFieldsForCategory = async (categoryId: string, suggestionIndex: number) => {
    if (!categoryAnalysis) return;

    const suggestion = categoryAnalysis.suggestedCategories[suggestionIndex];
    if (!suggestion) return;

    // Set auto-detected aspects
    setUserAspects((prev) => ({
      ...prev,
      ...suggestion.autoDetectedAspects,
    }));

    // Create dynamic fields for required user input
    const fields: DynamicField[] = [];

    try {
      // For now, we'll simulate the dynamic fields based on the suggestion's requiredUserInput
      // In production, this would use: intelligenceService.taxonomyService.getItemAspectsForCategory(categoryId)
      
      for (const requiredField of suggestion.requiredUserInput) {
        const field: DynamicField = {
          name: requiredField,
          label: requiredField,
          type: getFieldTypeForAspect(requiredField),
          required: true,
          options: getOptionsForAspect(requiredField),
          placeholder: `Enter ${requiredField.toLowerCase()}`,
          helpText: 'Required by eBay',
        };

        fields.push(field);
      }

      setDynamicFields(fields);
      console.log('🔧 Loaded dynamic fields for category:', categoryId, fields);
    } catch (error) {
      console.error('Failed to load category aspects:', error);
    }
  };

  // Helper function to determine field type based on aspect name
  const getFieldTypeForAspect = (aspectName: string): DynamicField['type'] => {
    const lowerName = aspectName.toLowerCase();
    if (lowerName.includes('brand') || lowerName.includes('platform') || lowerName.includes('genre') || 
        lowerName.includes('size') || lowerName.includes('color') || lowerName.includes('condition')) {
      return 'select';
    }
    if (lowerName.includes('year') || lowerName.includes('number') || lowerName.includes('count')) {
      return 'number';
    }
    return 'text';
  };

  // Helper function to get options for select fields
  const getOptionsForAspect = (aspectName: string): string[] | undefined => {
    const lowerName = aspectName.toLowerCase();
    
    if (lowerName.includes('brand')) {
      return ['Apple', 'Samsung', 'Sony', 'Nintendo', 'Microsoft', 'LG', 'HP', 'Dell', 'Other'];
    }
    if (lowerName.includes('platform')) {
      return ['PlayStation 5', 'PlayStation 4', 'Xbox Series X', 'Xbox One', 'Nintendo Switch', 'PC', 'Other'];
    }
    if (lowerName.includes('genre')) {
      return ['Action', 'Adventure', 'RPG', 'Sports', 'Racing', 'Puzzle', 'Strategy', 'Other'];
    }
    if (lowerName.includes('size')) {
      return ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Other'];
    }
    if (lowerName.includes('color')) {
      return ['Black', 'White', 'Silver', 'Gold', 'Blue', 'Red', 'Green', 'Other'];
    }
    
    return undefined; // Text input
  };

  // Phase 2 Step 2.2: Handle dynamic field changes
  const handleDynamicFieldChange = (fieldName: string, value: string | string[]) => {
    setUserAspects((prev) => ({
      ...prev,
      [fieldName]: Array.isArray(value) ? value : [value],
    }));
    console.log('📝 Dynamic field changed:', fieldName, value);
  };

  // Phase 2 Step 2.2: Pre-submission validation
  const validateBeforeSubmission = async (): Promise<boolean> => {
    return PerformanceMonitor.trackValidation(async () => {
      setIsValidating(true);
      const errors: string[] = [];

      try {
      // Validate required dynamic fields
      for (const field of dynamicFields) {
        if (field.required && !userAspects[field.name]?.length) {
          errors.push(`${field.label} is required`);
        }
      }

      // Basic validation for other fields
      if (!categoryId) {
        errors.push('Category is required');
      }
      if (!price || parseFloat(price) <= 0) {
        errors.push('Valid price is required');
      }

      // TODO: In production, validate category is leaf using:
      // const isLeaf = await intelligenceService.taxonomyService.validateLeafCategory(categoryId);
      // if (!isLeaf) {
      //   errors.push('Selected category is too broad. Please choose a more specific category.');
      // }

        setValidationErrors(errors);
        return errors.length === 0;
      } catch (error) {
        console.error('Validation failed:', error);
        setValidationErrors(['Validation failed. Please try again.']);
        return false;
      } finally {
        setIsValidating(false);
      }
    }, dynamicFields.length);
  };

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
      setDescription('test');
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

  const handleSubmit = async () => {
    // Phase 2 Step 2.2: Pre-submission validation
    const isValid = await validateBeforeSubmission();
    if (!isValid) {
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
      title: editableTitle.trim() || item?.title || '',
      // Phase 2 Step 2.2: Include dynamic aspects
      aspects: {
        ...categoryAnalysis?.suggestedCategories[selectedCategoryIndex]?.autoDetectedAspects,
        ...userAspects,
      },
    };

    console.log('🚀 Submitting listing with dynamic aspects:', config.aspects);
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

            {/* Phase 2: Analysis Loading State */}
            {isAnalyzing && (
              <Animated.View 
                style={[styles.analysisContainer, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}
                entering={FadeInDown.delay(200).duration(400)}
              >
                <View style={styles.analysisContent}>
                  <ActivityIndicator size="small" color={tintColor} />
                  <Brain size={20} color={tintColor} style={{ marginLeft: 12 }} />
                  <Text style={[styles.analysisText, { color: textColor }]}>
                    Analyzing your item with eBay intelligence...
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Phase 2: Smart Category Suggestions */}
            {categoryAnalysis && !isAnalyzing && (
              <Animated.View 
                style={styles.section}
                entering={FadeInDown.delay(250).duration(400)}
              >
                <View style={styles.sectionHeader}>
                  <Brain size={20} color={tintColor} />
                  <Text style={[styles.sectionTitle, { color: textColor }]}>Smart Category Suggestions</Text>
                </View>
                
                {categoryAnalysis.suggestedCategories.map((suggestion, index) => (
                  <TouchableOpacity
                    key={suggestion.categoryId}
                    style={[
                      styles.categoryOption,
                      { 
                        borderColor: selectedCategoryIndex === index ? tintColor : borderColor + '40',
                        backgroundColor: selectedCategoryIndex === index ? tintColor + '10' : 'transparent'
                      }
                    ]}
                    onPress={() => handleCategoryChange(suggestion.categoryId, index)}
                  >
                    <View style={styles.categoryOptionContent}>
                      <View style={styles.categoryHeader}>
                        <Text style={[styles.categoryName, { color: textColor }]} numberOfLines={2}>
                          {suggestion.categoryName}
                        </Text>
                        <View style={[
                          styles.confidenceBadge,
                          { backgroundColor: suggestion.confidence === 'HIGH' ? '#10B981' : 
                                            suggestion.confidence === 'MEDIUM' ? '#F59E0B' : '#6B7280' }
                        ]}>
                          <Text style={styles.confidenceText}>{suggestion.confidence}</Text>
                        </View>
                      </View>
                      
                      {Object.keys(suggestion.autoDetectedAspects).length > 0 && (
                        <View style={styles.autoDetectedContainer}>
                          <CheckCircle size={14} color="#10B981" />
                          <Text style={[styles.autoDetectedText, { color: subtleText }]}>
                            Auto-detected: {Object.keys(suggestion.autoDetectedAspects).join(', ')}
                          </Text>
                        </View>
                      )}
                      
                      {suggestion.requiredUserInput.length > 0 && (
                        <View style={styles.requiredInputContainer}>
                          <AlertCircle size={14} color="#F59E0B" />
                          <Text style={[styles.requiredInputText, { color: subtleText }]}>
                            You'll need to provide: {suggestion.requiredUserInput.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                
                <Text style={[styles.helperText, { color: subtleText }]}>
                  eBay analyzed your item and suggests these categories. Green items are auto-detected.
                </Text>
              </Animated.View>
            )}

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

            {/* Phase 2 Step 2.2: Dynamic Fields Section */}
            {dynamicFields.length > 0 && (
              <Animated.View 
                style={styles.section}
                entering={FadeInDown.delay(400).duration(400)}
              >
                <View style={styles.sectionHeader}>
                  <Brain size={20} color={tintColor} />
                  <Text style={[styles.sectionTitle, { color: textColor }]}>Additional Information</Text>
                </View>
                
                {dynamicFields.map((field) => (
                  <View key={field.name} style={styles.dynamicField}>
                    <Text style={[styles.fieldLabel, { color: textColor }]}>
                      {field.label}
                      {field.required && <Text style={[styles.required, { color: errorColor }]}> *</Text>}
                    </Text>

                    {field.type === 'select' ? (
                      <View style={[styles.pickerContainer, { borderColor: borderColor + '40' }]}>
                        <Picker
                          selectedValue={userAspects[field.name]?.[0] || ''}
                          onValueChange={(value) => handleDynamicFieldChange(field.name, value)}
                          style={[styles.picker, { color: textColor }]}
                          enabled={!loading}
                        >
                          <Picker.Item label={`Select ${field.label}`} value="" />
                          {field.options?.map((option) => (
                            <Picker.Item key={option} label={option} value={option} />
                          ))}
                        </Picker>
                      </View>
                    ) : field.type === 'number' ? (
                      <TextInput
                        style={[styles.input, { 
                          borderColor: borderColor + '40', 
                          color: textColor 
                        }]}
                        placeholder={field.placeholder}
                        placeholderTextColor={subtleText}
                        value={userAspects[field.name]?.[0] || ''}
                        onChangeText={(value) => handleDynamicFieldChange(field.name, value)}
                        keyboardType="numeric"
                        editable={!loading}
                      />
                    ) : (
                      <TextInput
                        style={[styles.input, { 
                          borderColor: borderColor + '40', 
                          color: textColor 
                        }]}
                        placeholder={field.placeholder}
                        placeholderTextColor={subtleText}
                        value={userAspects[field.name]?.[0] || ''}
                        onChangeText={(value) => handleDynamicFieldChange(field.name, value)}
                        editable={!loading}
                      />
                    )}

                    {field.helpText && (
                      <Text style={[styles.helpText, { color: subtleText }]}>{field.helpText}</Text>
                    )}
                  </View>
                ))}
                
                <Text style={[styles.helperText, { color: subtleText }]}>
                  These fields are required by eBay for this category
                </Text>
              </Animated.View>
            )}

            {/* Phase 2 Step 2.2: Validation Errors */}
            {validationErrors.length > 0 && (
              <Animated.View 
                style={styles.errorSection}
                entering={FadeInDown.delay(450).duration(400)}
              >
                <View style={styles.sectionHeader}>
                  <AlertCircle size={20} color={errorColor} />
                  <Text style={[styles.sectionTitle, { color: errorColor }]}>Please Fix These Issues</Text>
                </View>
                {validationErrors.map((error, index) => (
                  <Text key={index} style={[styles.errorText, { color: errorColor }]}>
                    • {error}
                  </Text>
                ))}
              </Animated.View>
            )}

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
                opacity: (loading || isValidating) ? 0.6 : 1 
              }]}
              onPress={handleSubmit}
              disabled={loading || isValidating}
            >
              {(loading || isValidating) ? (
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
  // Phase 2: Intelligent Analysis Styles
  analysisContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  analysisContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  categoryOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  categoryOptionContent: {
    flex: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  autoDetectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  autoDetectedText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  requiredInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requiredInputText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  // Phase 2 Step 2.2: Dynamic Fields Styles
  dynamicField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    height: 50,
  },
  helpText: {
    fontSize: 12,
    marginTop: 4,
  },
  errorSection: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    fontSize: 14,
    marginBottom: 4,
  },
}); 