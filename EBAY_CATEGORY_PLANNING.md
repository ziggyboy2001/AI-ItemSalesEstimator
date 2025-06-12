# eBay Category Intelligence & Dynamic Fields System

## 🎯 **COMPREHENSIVE IMPLEMENTATION GUIDE**

_Based on thorough research of eBay Taxonomy API and current system analysis_

---

## 📋 **EXECUTIVE SUMMARY**

Transform our eBay listing experience from error-prone manual processes to an intelligent, user-friendly system that:

- **Automatically detects** optimal categories using eBay's own suggestion API
- **Dynamically renders** required fields based on category requirements
- **Validates before submission** to prevent cryptic eBay errors
- **Provides smart defaults** while allowing user customization

---

## 🧠 **KEY INSIGHTS FROM eBay TAXONOMY API RESEARCH**

### **🎯 Critical APIs We'll Use:**

1. **`getCategorySuggestions`** - eBay's AI-powered category detection

   - Input: Item title/description
   - Output: Ranked list of suggested leaf categories
   - **This is our golden API for smart category detection**

2. **`getItemAspectsForCategory`** - Dynamic field requirements

   - Input: Category ID
   - Output: All required/optional aspects with validation rules
   - **This drives our dynamic field rendering**

3. **`getDefaultCategoryTreeId`** - Get correct tree for marketplace
   - Returns category tree ID for US marketplace (typically `0`)

### **🔑 Key Data Structures:**

```typescript
// eBay's Category Suggestion Response
interface CategorySuggestion {
  category: {
    categoryId: string;
    categoryName: string;
  };
  categoryTreeNodeLevel: number;
  relevancy: string; // "HIGH", "MEDIUM", "LOW"
}

// eBay's Item Aspects Response
interface ItemAspect {
  localizedAspectName: string;
  aspectConstraint: {
    aspectDataType: 'STRING' | 'STRING_ARRAY' | 'NUMBER' | 'DATE';
    aspectRequired: boolean;
    aspectUsage: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
    expectedRequiredByDate?: string;
    itemToAspectCardinality: 'SINGLE' | 'MULTI';
    aspectValues?: Array<{
      localizedValue: string;
      valueConstraints?: {
        applicableForLocalizedAspectName?: string;
        applicableForLocalizedAspectValue?: string[];
      };
    }>;
  };
}
```

---

## 🚀 **STEP-BY-STEP IMPLEMENTATION PLAN**

### **PHASE 1: eBay Taxonomy API Integration** _(Week 1-2)_

#### **Step 1.1: Create eBay Taxonomy Service**

```typescript
// services/ebayTaxonomyApi.ts

interface EbayTaxonomyConfig {
  baseUrl: string;
  categoryTreeId: string;
  accessToken: string;
}

export class EbayTaxonomyService {
  private config: EbayTaxonomyConfig;

  constructor(accessToken: string) {
    this.config = {
      baseUrl: 'https://api.sandbox.ebay.com/commerce/taxonomy/v1',
      categoryTreeId: '0', // US marketplace
      accessToken,
    };
  }

  // STEP 1: Get category tree ID for marketplace
  async getDefaultCategoryTreeId(): Promise<string> {
    const response = await fetch(
      `${this.config.baseUrl}/get_default_category_tree_id?marketplace_id=EBAY_US`,
      {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = await response.json();
    return data.categoryTreeId;
  }

  // STEP 2: Get category suggestions (THE GOLDEN API)
  async getCategorySuggestions(query: string): Promise<CategorySuggestion[]> {
    const response = await fetch(
      `${this.config.baseUrl}/category_tree/${
        this.config.categoryTreeId
      }/get_category_suggestions?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = await response.json();
    return data.categorySuggestions || [];
  }

  // STEP 3: Get required aspects for category (DYNAMIC FIELDS API)
  async getItemAspectsForCategory(categoryId: string): Promise<ItemAspect[]> {
    const response = await fetch(
      `${this.config.baseUrl}/category_tree/${this.config.categoryTreeId}/get_item_aspects_for_category?category_id=${categoryId}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = await response.json();
    return data.aspects || [];
  }

  // STEP 4: Validate category is leaf (listable)
  async validateLeafCategory(categoryId: string): Promise<boolean> {
    const response = await fetch(
      `${this.config.baseUrl}/category_tree/${this.config.categoryTreeId}/get_category_subtree?category_id=${categoryId}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = await response.json();
    // If no child categories, it's a leaf
    return !data.categorySubtree?.childCategoryTreeNodes?.length;
  }
}
```

#### **Step 1.2: Create Category Intelligence Service**

```typescript
// services/categoryIntelligenceService.ts

interface SmartCategoryResult {
  suggestedCategories: Array<{
    categoryId: string;
    categoryName: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    autoDetectedAspects: Record<string, string[]>;
    requiredUserInput: string[];
  }>;
  recommendedCategory: string;
}

export class CategoryIntelligenceService {
  private taxonomyService: EbayTaxonomyService;

  constructor(accessToken: string) {
    this.taxonomyService = new EbayTaxonomyService(accessToken);
  }

  // MAIN INTELLIGENCE FUNCTION
  async analyzeItem(
    title: string,
    description?: string
  ): Promise<SmartCategoryResult> {
    // Step 1: Get eBay's category suggestions
    const suggestions = await this.taxonomyService.getCategorySuggestions(
      title
    );

    // Step 2: For each suggestion, get required aspects and auto-detect what we can
    const analyzedCategories = await Promise.all(
      suggestions.slice(0, 3).map(async (suggestion) => {
        const aspects = await this.taxonomyService.getItemAspectsForCategory(
          suggestion.category.categoryId
        );

        const autoDetected = this.autoDetectAspects(
          suggestion.category.categoryId,
          title,
          description,
          aspects
        );

        const requiredUserInput = this.getRequiredUserInput(
          aspects,
          autoDetected
        );

        return {
          categoryId: suggestion.category.categoryId,
          categoryName: suggestion.category.categoryName,
          confidence: suggestion.relevancy as 'HIGH' | 'MEDIUM' | 'LOW',
          autoDetectedAspects: autoDetected,
          requiredUserInput,
        };
      })
    );

    return {
      suggestedCategories: analyzedCategories,
      recommendedCategory: analyzedCategories[0]?.categoryId || '',
    };
  }

  // AUTO-DETECTION LOGIC
  private autoDetectAspects(
    categoryId: string,
    title: string,
    description: string = '',
    aspects: ItemAspect[]
  ): Record<string, string[]> {
    const detected: Record<string, string[]> = {};
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();

    // Video Game Detection
    if (this.isVideoGameCategory(categoryId)) {
      // Platform detection
      const platformAspect = aspects.find(
        (a) => a.localizedAspectName === 'Platform'
      );
      if (platformAspect) {
        const platform = this.detectPlatform(titleLower);
        if (platform) detected['Platform'] = [platform];
      }

      // Game Name detection
      const gameNameAspect = aspects.find(
        (a) => a.localizedAspectName === 'Game Name'
      );
      if (gameNameAspect) {
        const gameName = this.extractGameName(title);
        if (gameName) detected['Game Name'] = [gameName];
      }

      // Genre detection
      const genreAspect = aspects.find(
        (a) => a.localizedAspectName === 'Genre'
      );
      if (genreAspect) {
        const genre = this.detectGenre(titleLower + ' ' + descLower);
        if (genre) detected['Genre'] = [genre];
      }
    }

    // Electronics Detection
    if (this.isElectronicsCategory(categoryId)) {
      // Brand detection
      const brandAspect = aspects.find(
        (a) => a.localizedAspectName === 'Brand'
      );
      if (brandAspect) {
        const brand = this.detectBrand(titleLower);
        if (brand) detected['Brand'] = [brand];
      }

      // Model detection
      const modelAspect = aspects.find(
        (a) => a.localizedAspectName === 'Model'
      );
      if (modelAspect) {
        const model = this.extractModel(title);
        if (model) detected['Model'] = [model];
      }
    }

    return detected;
  }

  // DETECTION HELPER METHODS
  private detectPlatform(title: string): string | null {
    const platformMap = {
      gba: 'Nintendo Game Boy Advance',
      'game boy advance': 'Nintendo Game Boy Advance',
      'nintendo ds': 'Nintendo DS',
      '3ds': 'Nintendo 3DS',
      playstation: 'Sony PlayStation',
      ps4: 'Sony PlayStation 4',
      ps5: 'Sony PlayStation 5',
      xbox: 'Microsoft Xbox',
      'nintendo switch': 'Nintendo Switch',
    };

    for (const [key, platform] of Object.entries(platformMap)) {
      if (title.includes(key)) return platform;
    }
    return null;
  }

  private extractGameName(title: string): string | null {
    // Remove platform indicators and clean up
    const cleaned = title
      .replace(/\b(gba|nintendo|ds|3ds|playstation|ps\d|xbox|switch)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || null;
  }

  private detectGenre(text: string): string | null {
    const genreKeywords = {
      Action: ['action', 'fighting', 'shooter', 'combat'],
      Adventure: ['adventure', 'quest', 'exploration'],
      RPG: ['rpg', 'role playing', 'fantasy', 'magic'],
      Sports: ['sports', 'football', 'basketball', 'soccer', 'racing'],
      Strategy: ['strategy', 'tactical', 'civilization'],
      Puzzle: ['puzzle', 'brain', 'logic', 'tetris'],
    };

    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        return genre;
      }
    }
    return null;
  }

  private detectBrand(title: string): string | null {
    const brands = [
      'apple',
      'samsung',
      'sony',
      'nintendo',
      'microsoft',
      'google',
      'amazon',
    ];
    for (const brand of brands) {
      if (title.includes(brand)) {
        return brand.charAt(0).toUpperCase() + brand.slice(1);
      }
    }
    return null;
  }

  private extractModel(title: string): string | null {
    // Extract model numbers/names (this is basic - can be enhanced)
    const modelMatch = title.match(/\b([A-Z0-9-]+\d+[A-Z0-9-]*)\b/);
    return modelMatch ? modelMatch[1] : null;
  }

  private isVideoGameCategory(categoryId: string): boolean {
    const videoGameCategories = ['139973', '175672', '1249']; // Add more as needed
    return videoGameCategories.includes(categoryId);
  }

  private isElectronicsCategory(categoryId: string): boolean {
    const electronicsCategories = ['11450', '293']; // Add more as needed
    return electronicsCategories.includes(categoryId);
  }

  private getRequiredUserInput(
    aspects: ItemAspect[],
    autoDetected: Record<string, string[]>
  ): string[] {
    return aspects
      .filter(
        (aspect) =>
          aspect.aspectConstraint.aspectRequired &&
          !autoDetected[aspect.localizedAspectName]
      )
      .map((aspect) => aspect.localizedAspectName);
  }
}
```

### **PHASE 2: Enhanced Listing Modal with Dynamic Fields** _(Week 3-4)_

#### **Step 2.1: Update eBay Listing Modal Component**

```typescript
// components/EbayListingModal.tsx - Enhanced Version

interface DynamicField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'number';
  required: boolean;
  options?: string[];
  placeholder?: string;
  validation?: RegExp;
  helpText?: string;
}

export const EbayListingModal = ({ haulItem, isVisible, onClose }: Props) => {
  // Existing state
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('USED_EXCELLENT');

  // New intelligent state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [categoryAnalysis, setCategoryAnalysis] =
    useState<SmartCategoryResult | null>(null);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const [userAspects, setUserAspects] = useState<Record<string, string[]>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Initialize intelligence service
  const intelligenceService = useMemo(() => {
    return new CategoryIntelligenceService(ebayAccessToken);
  }, [ebayAccessToken]);

  // STEP 1: Auto-analyze item when modal opens
  useEffect(() => {
    if (isVisible && haulItem) {
      analyzeItemIntelligently();
    }
  }, [isVisible, haulItem]);

  const analyzeItemIntelligently = async () => {
    setIsAnalyzing(true);
    try {
      const analysis = await intelligenceService.analyzeItem(
        haulItem.title,
        haulItem.description
      );

      setCategoryAnalysis(analysis);

      // Auto-select the recommended category
      if (analysis.recommendedCategory) {
        setCategoryId(analysis.recommendedCategory);
        await loadDynamicFieldsForCategory(analysis.recommendedCategory, 0);
      }
    } catch (error) {
      console.error('Failed to analyze item:', error);
      // Fallback to manual category selection
    } finally {
      setIsAnalyzing(false);
    }
  };

  // STEP 2: Load dynamic fields when category changes
  const loadDynamicFieldsForCategory = async (
    categoryId: string,
    suggestionIndex: number
  ) => {
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
      const aspects =
        await intelligenceService.taxonomyService.getItemAspectsForCategory(
          categoryId
        );

      for (const aspect of aspects) {
        if (
          aspect.aspectConstraint.aspectRequired &&
          !suggestion.autoDetectedAspects[aspect.localizedAspectName]
        ) {
          const field: DynamicField = {
            name: aspect.localizedAspectName,
            label: aspect.localizedAspectName,
            type: aspect.aspectConstraint.aspectValues ? 'select' : 'text',
            required: true,
            options: aspect.aspectConstraint.aspectValues?.map(
              (v) => v.localizedValue
            ),
            placeholder: `Enter ${aspect.localizedAspectName.toLowerCase()}`,
            helpText:
              aspect.aspectConstraint.aspectUsage === 'REQUIRED'
                ? 'Required by eBay'
                : 'Recommended',
          };

          fields.push(field);
        }
      }

      setDynamicFields(fields);
    } catch (error) {
      console.error('Failed to load category aspects:', error);
    }
  };

  // STEP 3: Handle category selection change
  const handleCategoryChange = async (
    newCategoryId: string,
    suggestionIndex: number
  ) => {
    setCategoryId(newCategoryId);
    setSelectedCategoryIndex(suggestionIndex);
    await loadDynamicFieldsForCategory(newCategoryId, suggestionIndex);
  };

  // STEP 4: Handle dynamic field changes
  const handleDynamicFieldChange = (
    fieldName: string,
    value: string | string[]
  ) => {
    setUserAspects((prev) => ({
      ...prev,
      [fieldName]: Array.isArray(value) ? value : [value],
    }));
  };

  // STEP 5: Pre-submission validation
  const validateBeforeSubmission = async (): Promise<boolean> => {
    setIsValidating(true);
    const errors: string[] = [];

    try {
      // Validate required dynamic fields
      for (const field of dynamicFields) {
        if (field.required && !userAspects[field.name]?.length) {
          errors.push(`${field.label} is required`);
        }
      }

      // Validate category is leaf
      const isLeaf =
        await intelligenceService.taxonomyService.validateLeafCategory(
          categoryId
        );
      if (!isLeaf) {
        errors.push(
          'Selected category is too broad. Please choose a more specific category.'
        );
      }

      setValidationErrors(errors);
      return errors.length === 0;
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationErrors(['Validation failed. Please try again.']);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // STEP 6: Enhanced submission with all aspects
  const handleSubmitListing = async () => {
    // Pre-flight validation
    const isValid = await validateBeforeSubmission();
    if (!isValid) return;

    const listingConfig = {
      categoryId,
      price: parseFloat(price),
      condition,
      title: haulItem.title,
      description: haulItem.description,
      images: [haulItem.image_url, ...(haulItem.additional_images || [])],
      // Include all aspects (auto-detected + user-provided)
      aspects: {
        ...categoryAnalysis?.suggestedCategories[selectedCategoryIndex]
          ?.autoDetectedAspects,
        ...userAspects,
      },
    };

    try {
      setIsSubmitting(true);
      const result = await listHaulItem(haulItem.id, listingConfig);

      if (result.success) {
        onClose();
        // Show success message
      } else {
        // Handle specific errors with user-friendly messages
        setError(result.error || 'Failed to list item');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={isVisible} onClose={onClose}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>List on eBay</Text>

        {/* STEP 1: Loading/Analysis State */}
        {isAnalyzing && (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" />
            <Text>Analyzing your item...</Text>
          </View>
        )}

        {/* STEP 2: Smart Category Suggestions */}
        {categoryAnalysis && !isAnalyzing && (
          <View style={styles.categorySection}>
            <Text style={styles.sectionTitle}>Suggested Categories</Text>
            {categoryAnalysis.suggestedCategories.map((suggestion, index) => (
              <TouchableOpacity
                key={suggestion.categoryId}
                style={[
                  styles.categoryOption,
                  selectedCategoryIndex === index && styles.selectedCategory,
                ]}
                onPress={() =>
                  handleCategoryChange(suggestion.categoryId, index)
                }
              >
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>
                    {suggestion.categoryName}
                  </Text>
                  <View
                    style={[
                      styles.confidenceBadge,
                      styles[`confidence${suggestion.confidence}`],
                    ]}
                  >
                    <Text style={styles.confidenceText}>
                      {suggestion.confidence}
                    </Text>
                  </View>
                </View>

                {/* Show auto-detected aspects */}
                {Object.keys(suggestion.autoDetectedAspects).length > 0 && (
                  <View style={styles.autoDetectedSection}>
                    <Text style={styles.autoDetectedTitle}>Auto-detected:</Text>
                    {Object.entries(suggestion.autoDetectedAspects).map(
                      ([key, values]) => (
                        <Text key={key} style={styles.autoDetectedItem}>
                          {key}: {values.join(', ')}
                        </Text>
                      )
                    )}
                  </View>
                )}

                {/* Show required user input */}
                {suggestion.requiredUserInput.length > 0 && (
                  <Text style={styles.requiredInput}>
                    Requires: {suggestion.requiredUserInput.join(', ')}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 3: Basic Fields */}
        <View style={styles.basicFields}>
          <TextInput
            style={styles.input}
            placeholder="Price (USD)"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          <Picker
            selectedValue={condition}
            onValueChange={setCondition}
            style={styles.picker}
          >
            <Picker.Item label="Used - Excellent" value="USED_EXCELLENT" />
            <Picker.Item label="Used - Very Good" value="USED_VERY_GOOD" />
            <Picker.Item label="Used - Good" value="USED_GOOD" />
            <Picker.Item label="Used - Acceptable" value="USED_ACCEPTABLE" />
            <Picker.Item label="New" value="NEW" />
          </Picker>
        </View>

        {/* STEP 4: Dynamic Fields */}
        {dynamicFields.length > 0 && (
          <View style={styles.dynamicFieldsSection}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            {dynamicFields.map((field) => (
              <View key={field.name} style={styles.dynamicField}>
                <Text style={styles.fieldLabel}>
                  {field.label}
                  {field.required && <Text style={styles.required}> *</Text>}
                </Text>

                {field.type === 'select' ? (
                  <Picker
                    selectedValue={userAspects[field.name]?.[0] || ''}
                    onValueChange={(value) =>
                      handleDynamicFieldChange(field.name, value)
                    }
                    style={styles.picker}
                  >
                    <Picker.Item label={`Select ${field.label}`} value="" />
                    {field.options?.map((option) => (
                      <Picker.Item key={option} label={option} value={option} />
                    ))}
                  </Picker>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder={field.placeholder}
                    value={userAspects[field.name]?.[0] || ''}
                    onChangeText={(value) =>
                      handleDynamicFieldChange(field.name, value)
                    }
                  />
                )}

                {field.helpText && (
                  <Text style={styles.helpText}>{field.helpText}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* STEP 5: Validation Errors */}
        {validationErrors.length > 0 && (
          <View style={styles.errorSection}>
            {validationErrors.map((error, index) => (
              <Text key={index} style={styles.errorText}>
                {error}
              </Text>
            ))}
          </View>
        )}

        {/* STEP 6: Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSubmitting || isValidating) && styles.disabledButton,
            ]}
            onPress={handleSubmitListing}
            disabled={isSubmitting || isValidating}
          >
            {isSubmitting || isValidating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>List on eBay</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
};
```

### **PHASE 3: Enhanced Backend Integration** _(Week 5-6)_

#### **Step 3.1: Update Inventory API with Dynamic Aspects**

```typescript
// services/ebayInventoryApi.ts - Enhanced Version

export const listHaulItemOnEbay = async (
  haulItem: HaulItem,
  config: {
    categoryId: string;
    price: number;
    condition: string;
    title?: string;
    description?: string;
    images?: string[];
    aspects?: Record<string, string[]>; // NEW: Dynamic aspects
  },
  ebayAccount: EbayAccount
): Promise<{ success: boolean; offerId?: string; error?: string }> => {
  const sku = `haul${haulItem.haul_id}${haulItem.id}${Date.now()}`;

  // Enhanced image handling (existing code)
  const ensureProtocol = (url: string): string => {
    if (!url) return url;
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('ftp://')
    ) {
      return url;
    }
    return `https://${url}`;
  };

  const allImages = [];
  if (haulItem.image_url) allImages.push(ensureProtocol(haulItem.image_url));
  if (haulItem.additional_images)
    allImages.push(...haulItem.additional_images.map(ensureProtocol));

  // ENHANCED: Create inventory item with dynamic aspects
  const inventoryItem: EbayInventoryItem = {
    sku,
    product: {
      title: config.title || haulItem.title,
      description: config.description || generateDescription(haulItem),
      imageUrls: (config.images
        ? config.images.map(ensureProtocol)
        : allImages
      ).slice(0, 12),
      // ENHANCED: Include all aspects (auto-detected + user-provided)
      aspects: {
        ...generateItemAspects(config.categoryId, haulItem.title), // Fallback aspects
        ...config.aspects, // User-provided aspects take precedence
      },
    },
    condition: config.condition,
    availability: {
      shipToLocationAvailability: {
        quantity: 1,
      },
    },
  };

  try {
    // Step 1: Create inventory item
    console.log(
      '📦 Creating inventory item with aspects:',
      inventoryItem.product.aspects
    );
    const inventoryResponse = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${sku}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ebayAccount.access_token}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US',
        },
        body: JSON.stringify(inventoryItem),
      }
    );

    if (!inventoryResponse.ok) {
      const errorData = await inventoryResponse.json();
      console.error('❌ Inventory creation failed:', errorData);
      throw new Error(
        `Inventory creation failed: ${
          errorData.errors?.[0]?.message || 'Unknown error'
        }`
      );
    }

    console.log('✅ Inventory item created successfully');

    // Step 2: Create offer (existing logic)
    const offer = {
      sku,
      marketplaceId: 'EBAY_US',
      categoryId: config.categoryId,
      format: 'FIXED_PRICE',
      availableQuantity: 1,
      pricingSummary: {
        price: {
          value: config.price.toString(),
          currency: 'USD',
        },
      },
      listingPolicies: {
        fulfillmentPolicyId: ebayAccount.fulfillment_policy_id,
        paymentPolicyId: ebayAccount.payment_policy_id,
        returnPolicyId: ebayAccount.return_policy_id,
      },
      merchantLocationKey: ebayAccount.merchant_location_key || 'default',
    };

    console.log('📄 Creating offer...');
    const offerResponse = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/offer`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ebayAccount.access_token}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US',
        },
        body: JSON.stringify(offer),
      }
    );

    if (!offerResponse.ok) {
      const errorData = await offerResponse.json();
      console.error('❌ Offer creation failed:', errorData);
      throw new Error(
        `Offer creation failed: ${
          errorData.errors?.[0]?.message || 'Unknown error'
        }`
      );
    }

    const offerData = await offerResponse.json();
    const offerId = offerData.offerId;
    console.log('✅ Offer created:', offerId);

    // Step 3: Publish offer (existing logic)
    console.log('🚀 Publishing offer...');
    const publishResponse = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/offer/${offerId}/publish`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ebayAccount.access_token}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US',
        },
      }
    );

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json();
      console.error('❌ Offer publishing failed:', errorData);

      // Enhanced error handling for common issues
      const errorMessage = errorData.errors?.[0]?.message || 'Unknown error';

      if (errorMessage.includes('not a leaf category')) {
        throw new Error('CATEGORY_NOT_LEAF');
      } else if (
        errorMessage.includes('item specific') &&
        errorMessage.includes('missing')
      ) {
        const match = errorMessage.match(
          /The item specific ([^.]+) is missing/
        );
        const missingField = match ? match[1] : 'required field';
        throw new Error(`MISSING_REQUIRED_FIELD:${missingField}`);
      } else {
        throw new Error(`Publishing failed: ${errorMessage}`);
      }
    }

    const publishData = await publishResponse.json();
    console.log('🎉 Item successfully listed on eBay!', publishData);

    return {
      success: true,
      offerId: offerId,
    };
  } catch (error) {
    console.error('❌ listHaulItemOnEbay: Error occurred:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};
```

#### **Step 3.2: Enhanced Error Handling Service**

```typescript
// services/ebayErrorHandlingService.ts

export class EbayErrorHandler {
  static getUserFriendlyError(error: string): string {
    if (error === 'CATEGORY_NOT_LEAF') {
      return 'The selected category is too broad. Please choose a more specific category for your item.';
    }

    if (error.startsWith('MISSING_REQUIRED_FIELD:')) {
      const field = error.split(':')[1];
      return `This category requires "${field}" to be specified. Please provide this information or select a different category.`;
    }

    if (error.includes('invalid picture URL')) {
      return 'One or more of your images has an invalid URL. Please check your images and try again.';
    }

    if (error.includes('Location information not found')) {
      return 'eBay account setup incomplete. Please check your seller account settings.';
    }

    if (error.includes('Fulfillment policy')) {
      return 'Your eBay account needs shipping policies set up. Please configure your seller policies in eBay.';
    }

    // Default fallback
    return `eBay listing failed: ${error}. Please try again or contact support.`;
  }
}
```

### **PHASE 4: Testing & Optimization** _(Week 7-8)_

#### **Step 4.1: Comprehensive Testing Plan**

```typescript
// __tests__/ebayIntelligence.test.ts

describe('eBay Intelligence System', () => {
  let intelligenceService: CategoryIntelligenceService;

  beforeEach(() => {
    intelligenceService = new CategoryIntelligenceService('test-token');
  });

  describe('Category Detection', () => {
    test('should detect video game category correctly', async () => {
      const result = await intelligenceService.analyzeItem(
        'Pokemon Fire Red GBA'
      );

      expect(result.suggestedCategories).toHaveLength(3);
      expect(result.suggestedCategories[0].categoryId).toBe('139973');
      expect(
        result.suggestedCategories[0].autoDetectedAspects['Platform']
      ).toContain('Nintendo Game Boy Advance');
      expect(
        result.suggestedCategories[0].autoDetectedAspects['Game Name']
      ).toContain('Pokemon Fire Red');
    });

    test('should detect electronics category correctly', async () => {
      const result = await intelligenceService.analyzeItem(
        'Apple iPhone 12 Pro Max'
      );

      expect(
        result.suggestedCategories[0].autoDetectedAspects['Brand']
      ).toContain('Apple');
      expect(
        result.suggestedCategories[0].autoDetectedAspects['Model']
      ).toContain('iPhone 12 Pro Max');
    });
  });

  describe('Dynamic Field Generation', () => {
    test('should generate correct dynamic fields for video games', async () => {
      const aspects =
        await intelligenceService.taxonomyService.getItemAspectsForCategory(
          '139973'
        );
      const requiredFields = aspects.filter(
        (a) => a.aspectConstraint.aspectRequired
      );

      expect(
        requiredFields.some((f) => f.localizedAspectName === 'Platform')
      ).toBe(true);
      expect(
        requiredFields.some((f) => f.localizedAspectName === 'Game Name')
      ).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should validate required fields correctly', () => {
      const aspects = [
        {
          localizedAspectName: 'Platform',
          aspectConstraint: { aspectRequired: true },
        },
        {
          localizedAspectName: 'Game Name',
          aspectConstraint: { aspectRequired: true },
        },
      ];

      const userAspects = { Platform: ['Nintendo Game Boy Advance'] };
      const missing = intelligenceService.getRequiredUserInput(
        aspects,
        userAspects
      );

      expect(missing).toContain('Game Name');
      expect(missing).not.toContain('Platform');
    });
  });
});
```

#### **Step 4.2: Performance Monitoring**

```typescript
// services/performanceMonitor.ts

export class PerformanceMonitor {
  static async trackCategoryAnalysis<T>(
    operation: () => Promise<T>,
    itemTitle: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      console.log(
        `📊 Category analysis completed in ${duration}ms for: ${itemTitle}`
      );

      // Track success metrics
      this.trackMetric('category_analysis_success', duration, { itemTitle });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(
        `❌ Category analysis failed after ${duration}ms for: ${itemTitle}`,
        error
      );

      // Track failure metrics
      this.trackMetric('category_analysis_failure', duration, {
        itemTitle,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private static trackMetric(
    event: string,
    duration: number,
    metadata: Record<string, any>
  ) {
    // Implement your analytics tracking here
    // Could be Firebase Analytics, Mixpanel, etc.
  }
}
```

---

## 🎯 **SUCCESS METRICS & VALIDATION**

### **Key Performance Indicators:**

1. **Listing Success Rate**: Target 95%+ (vs current ~60%)
2. **User Experience**: Reduce listing time from 5+ minutes to <2 minutes
3. **Error Reduction**: Eliminate 90%+ of category/aspect-related errors
4. **Auto-Detection Accuracy**: 80%+ of aspects correctly auto-detected

### **Testing Scenarios:**

1. **Video Games**: Pokemon, Mario, Call of Duty across different platforms
2. **Electronics**: iPhones, Samsung phones, gaming consoles
3. **Collectibles**: Trading cards, vintage items
4. **Fashion**: Clothing, shoes, accessories
5. **Edge Cases**: Unusual items, multiple categories, missing information

---

## 🚀 **DEPLOYMENT STRATEGY**

### **Week 1-2**: Foundation

- [ ] Implement eBay Taxonomy API service
- [ ] Create category intelligence service
- [ ] Add comprehensive error handling
- [ ] Unit tests for core logic

### **Week 3-4**: UI Enhancement

- [ ] Update listing modal with dynamic fields
- [ ] Implement category suggestion UI
- [ ] Add validation and error display
- [ ] Integration testing

### **Week 5-6**: Backend Integration

- [ ] Enhance inventory API with dynamic aspects
- [ ] Update error handling throughout the flow
- [ ] Add performance monitoring
- [ ] End-to-end testing

### **Week 7-8**: Polish & Launch

- [ ] User acceptance testing
- [ ] Performance optimization
- [ ] Documentation and training
- [ ] Gradual rollout to users

---

## 🔧 **TECHNICAL REQUIREMENTS**

### **API Access:**

- eBay Commerce Taxonomy API access
- Proper OAuth scopes for category data
- Rate limiting considerations (1000 calls/day for sandbox)

### **Caching Strategy:**

- Cache category trees (refresh daily)
- Cache item aspects per category (refresh weekly)
- Cache category suggestions for common queries

### **Error Handling:**

- Graceful degradation when APIs are unavailable
- Fallback to manual category selection
- Clear user feedback for all error states

### **Performance:**

- Category analysis should complete in <3 seconds
- Dynamic field rendering should be instant
- Validation should complete in <1 second

---

This comprehensive implementation guide provides a complete roadmap for transforming your eBay listing experience from error-prone manual processes to an intelligent, user-friendly system that leverages eBay's own APIs for maximum accuracy and success rates.

### **EXAMPLE FLOW:**

- User lists "Sony WH-1000XM4 Wireless Headphones Black"

- Step 1: eBay suggests categories
  getCategorySuggestions("Sony WH-1000XM4 Wireless Headphones Black")
  → Returns: "Consumer Electronics > Portable Audio > Headphones"

- Step 2: Get requirements for that category
  getItemAspectsForCategory("15052")
  → Returns: Brand (required), Model (required), Color (required), Connectivity (required)

- Step 3: Auto-detect what we can
  autoDetect("Sony WH-1000XM4 Wireless Headphones Black")
  → Brand: "Sony", Model: "WH-1000XM4", Color: "Black", Connectivity: "Wireless"

- Step 4: All required fields filled automatically!
  → User just needs to set price and condition

## 📱 **UI/UX INTEGRATION WITH CURRENT EbayListingModal.tsx**

### **🔄 Current State Analysis**

Your existing modal has these components that will be **enhanced/replaced**:

#### **Current Components:**

- ✅ **Keep**: Photo upload system, price input, condition picker, description
- 🔄 **Replace**: Hardcoded category picker (`COMMON_CATEGORIES`)
- ➕ **Add**: Dynamic fields, category suggestions, auto-detection, validation

#### **Current Category Section (Lines 680-700):**

```typescript
// THIS WILL BE REPLACED
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
```

---

### **🎨 NEW ENHANCED UI FLOW**

#### **Step 1: Modal Opens → Immediate Intelligence**

```typescript
// NEW: Auto-analysis when modal opens
useEffect(() => {
  if (visible && item) {
    // Existing initialization...
    setCategoryId('');
    setCondition('USED_EXCELLENT');
    setPrice(formatPriceToTwoDecimals(item.sale_price));
    setEditableTitle(item.title);
    setEditableImages([]);

    // NEW: Start intelligent analysis
    analyzeItemIntelligently();
  }
}, [visible, item]);

const analyzeItemIntelligently = async () => {
  setIsAnalyzing(true);
  try {
    const analysis = await intelligenceService.analyzeItem(
      item.title,
      item.description || ''
    );

    setCategoryAnalysis(analysis);

    // Auto-select best category
    if (analysis.recommendedCategory) {
      setCategoryId(analysis.recommendedCategory);
      await loadDynamicFieldsForCategory(analysis.recommendedCategory, 0);
    }
  } catch (error) {
    console.error('Analysis failed:', error);
    // Graceful fallback to manual selection
  } finally {
    setIsAnalyzing(false);
  }
};
```

#### **Step 2: Replace Category Section with Smart Suggestions**

```typescript
// REPLACE the current category picker with this:

{
  /* NEW: Analysis Loading State */
}
{
  isAnalyzing && (
    <Animated.View
      style={[styles.analysisCard, { backgroundColor: cardColor }]}
      entering={FadeInDown.delay(100).duration(400)}
    >
      <View style={styles.analysisHeader}>
        <ActivityIndicator size="small" color={tintColor} />
        <Text style={[styles.analysisText, { color: textColor }]}>
          Analyzing your item...
        </Text>
      </View>
      <Text style={[styles.analysisSubtext, { color: subtleText }]}>
        Finding the best category and detecting item details
      </Text>
    </Animated.View>
  );
}

{
  /* NEW: Smart Category Suggestions */
}
{
  categoryAnalysis && !isAnalyzing && (
    <Animated.View
      style={styles.section}
      entering={FadeInDown.delay(200).duration(400)}
    >
      <View style={styles.sectionHeader}>
        <Tag size={20} color={tintColor} />
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Suggested Categories
        </Text>
        <View style={[styles.aiBadge, { backgroundColor: tintColor + '20' }]}>
          <Text style={[styles.aiBadgeText, { color: tintColor }]}>AI</Text>
        </View>
      </View>

      {categoryAnalysis.suggestedCategories.map((suggestion, index) => (
        <TouchableOpacity
          key={suggestion.categoryId}
          style={[
            styles.categoryCard,
            {
              backgroundColor: cardColor,
              borderColor:
                selectedCategoryIndex === index
                  ? tintColor
                  : borderColor + '40',
              borderWidth: selectedCategoryIndex === index ? 2 : 1,
            },
          ]}
          onPress={() => handleCategoryChange(suggestion.categoryId, index)}
        >
          <View style={styles.categoryHeader}>
            <View style={styles.categoryInfo}>
              <Text
                style={[styles.categoryName, { color: textColor }]}
                numberOfLines={2}
              >
                {suggestion.categoryName}
              </Text>
              <View
                style={[
                  styles.confidenceBadge,
                  {
                    backgroundColor: getConfidenceColor(suggestion.confidence),
                  },
                ]}
              >
                <Text style={styles.confidenceText}>
                  {suggestion.confidence}
                </Text>
              </View>
            </View>

            {selectedCategoryIndex === index && (
              <View
                style={[
                  styles.selectedIndicator,
                  { backgroundColor: tintColor },
                ]}
              >
                <Text style={styles.selectedText}>✓</Text>
              </View>
            )}
          </View>

          {/* Auto-detected aspects preview */}
          {Object.keys(suggestion.autoDetectedAspects).length > 0 && (
            <View style={styles.autoDetectedPreview}>
              <Text style={[styles.autoDetectedTitle, { color: tintColor }]}>
                Auto-detected:
              </Text>
              <View style={styles.aspectTags}>
                {Object.entries(suggestion.autoDetectedAspects)
                  .slice(0, 3)
                  .map(([key, values]) => (
                    <View
                      key={key}
                      style={[
                        styles.aspectTag,
                        { backgroundColor: tintColor + '15' },
                      ]}
                    >
                      <Text
                        style={[styles.aspectTagText, { color: tintColor }]}
                      >
                        {key}: {values[0]}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Required input preview */}
          {suggestion.requiredUserInput.length > 0 && (
            <View style={styles.requiredInputPreview}>
              <Text style={[styles.requiredInputTitle, { color: errorColor }]}>
                Needs: {suggestion.requiredUserInput.slice(0, 2).join(', ')}
                {suggestion.requiredUserInput.length > 2 &&
                  ` +${suggestion.requiredUserInput.length - 2} more`}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Manual category fallback */}
      <TouchableOpacity
        style={[
          styles.manualCategoryButton,
          { borderColor: borderColor + '40' },
        ]}
        onPress={() => setShowManualCategory(true)}
      >
        <Text style={[styles.manualCategoryText, { color: subtleText }]}>
          Choose category manually
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
```

#### **Step 3: Add Dynamic Fields Section**

```typescript
// NEW: Dynamic fields based on selected category
{
  dynamicFields.length > 0 && (
    <Animated.View
      style={styles.section}
      entering={FadeInDown.delay(400).duration(400)}
    >
      <View style={styles.sectionHeader}>
        <Package size={20} color={tintColor} />
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Additional Information
        </Text>
        <Text style={[styles.requiredFieldsCount, { color: errorColor }]}>
          {dynamicFields.filter((f) => f.required).length} required
        </Text>
      </View>

      {dynamicFields.map((field) => (
        <View key={field.name} style={styles.dynamicFieldContainer}>
          <Text style={[styles.fieldLabel, { color: textColor }]}>
            {field.label}
            {field.required && (
              <Text style={[styles.required, { color: errorColor }]}> *</Text>
            )}
          </Text>

          {field.type === 'select' ? (
            <View
              style={[
                styles.pickerContainer,
                { borderColor: borderColor + '40' },
              ]}
            >
              <Picker
                selectedValue={userAspects[field.name]?.[0] || ''}
                onValueChange={(value) =>
                  handleDynamicFieldChange(field.name, value)
                }
                style={[styles.picker, { color: textColor }]}
                enabled={!loading}
              >
                <Picker.Item label={`Select ${field.label}`} value="" />
                {field.options?.map((option) => (
                  <Picker.Item key={option} label={option} value={option} />
                ))}
              </Picker>
            </View>
          ) : field.type === 'multiselect' ? (
            <View style={styles.multiselectContainer}>
              {field.options?.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.multiselectOption,
                    {
                      backgroundColor: userAspects[field.name]?.includes(option)
                        ? tintColor + '20'
                        : 'transparent',
                      borderColor: userAspects[field.name]?.includes(option)
                        ? tintColor
                        : borderColor + '40',
                    },
                  ]}
                  onPress={() => handleMultiselectChange(field.name, option)}
                >
                  <Text
                    style={[
                      styles.multiselectText,
                      {
                        color: userAspects[field.name]?.includes(option)
                          ? tintColor
                          : textColor,
                      },
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TextInput
              style={[
                styles.dynamicFieldInput,
                {
                  borderColor: borderColor + '40',
                  color: textColor,
                },
              ]}
              placeholder={field.placeholder}
              placeholderTextColor={subtleText}
              value={userAspects[field.name]?.[0] || ''}
              onChangeText={(value) =>
                handleDynamicFieldChange(field.name, value)
              }
              editable={!loading}
            />
          )}

          {field.helpText && (
            <Text style={[styles.fieldHelpText, { color: subtleText }]}>
              {field.helpText}
            </Text>
          )}

          {/* Validation error for this field */}
          {validationErrors.some((error) => error.includes(field.label)) && (
            <Text style={[styles.fieldError, { color: errorColor }]}>
              {field.label} is required
            </Text>
          )}
        </View>
      ))}
    </Animated.View>
  );
}
```

#### **Step 4: Enhanced Validation Section**

```typescript
// NEW: Pre-submission validation display
{
  validationErrors.length > 0 && (
    <Animated.View
      style={[styles.validationCard, { backgroundColor: errorColor + '10' }]}
      entering={FadeInDown.duration(300)}
    >
      <View style={styles.validationHeader}>
        <Text style={[styles.validationTitle, { color: errorColor }]}>
          Please fix these issues:
        </Text>
      </View>
      {validationErrors.map((error, index) => (
        <View key={index} style={styles.validationError}>
          <Text style={[styles.validationErrorText, { color: errorColor }]}>
            • {error}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
}
```

#### **Step 5: Enhanced Submit Button**

```typescript
// ENHANCED: Submit button with validation
<TouchableOpacity
  style={[
    styles.button,
    styles.submitButton,
    {
      backgroundColor: backgroundColor,
      borderColor: tintColor,
      borderWidth: 1,
      opacity: loading || isValidating || validationErrors.length > 0 ? 0.6 : 1,
    },
  ]}
  onPress={handleEnhancedSubmit}
  disabled={loading || isValidating || validationErrors.length > 0}
>
  {loading ? (
    <ActivityIndicator size="small" color={tintColor} />
  ) : isValidating ? (
    <View style={styles.validatingContainer}>
      <ActivityIndicator size="small" color={tintColor} />
      <Text style={[styles.buttonText, { color: tintColor, marginLeft: 8 }]}>
        Validating...
      </Text>
    </View>
  ) : (
    <Text style={[styles.buttonText, { color: tintColor }]}>List Item</Text>
  )}
</TouchableOpacity>
```

---

### **🔧 NEW STATE MANAGEMENT**

```typescript
// ADD these new state variables to your existing ones:

// Existing state (keep as-is)
const [categoryId, setCategoryId] = useState('');
const [condition, setCondition] =
  useState<ListingConfiguration['condition']>('USED_EXCELLENT');
const [price, setPrice] = useState('');
const [description, setDescription] = useState('');
const [editableTitle, setEditableTitle] = useState('');
const [editableImages, setEditableImages] = useState<string[]>([]);

// NEW: Intelligence state
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [categoryAnalysis, setCategoryAnalysis] =
  useState<SmartCategoryResult | null>(null);
const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
const [showManualCategory, setShowManualCategory] = useState(false);

// NEW: Dynamic fields state
const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
const [userAspects, setUserAspects] = useState<Record<string, string[]>>({});

// NEW: Validation state
const [validationErrors, setValidationErrors] = useState<string[]>([]);
const [isValidating, setIsValidating] = useState(false);

// NEW: Services
const intelligenceService = useMemo(() => {
  return new CategoryIntelligenceService(ebayAccessToken);
}, [ebayAccessToken]);
```

---

### **🎯 NEW HANDLER FUNCTIONS**

```typescript
// NEW: Handle category selection from suggestions
const handleCategoryChange = async (
  newCategoryId: string,
  suggestionIndex: number
) => {
  setCategoryId(newCategoryId);
  setSelectedCategoryIndex(suggestionIndex);
  await loadDynamicFieldsForCategory(newCategoryId, suggestionIndex);
};

// NEW: Load dynamic fields for selected category
const loadDynamicFieldsForCategory = async (
  categoryId: string,
  suggestionIndex: number
) => {
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
    const aspects =
      await intelligenceService.taxonomyService.getItemAspectsForCategory(
        categoryId
      );

    for (const aspect of aspects) {
      if (
        aspect.aspectConstraint.aspectRequired &&
        !suggestion.autoDetectedAspects[aspect.localizedAspectName]
      ) {
        const field: DynamicField = {
          name: aspect.localizedAspectName,
          label: aspect.localizedAspectName,
          type: aspect.aspectConstraint.aspectValues ? 'select' : 'text',
          required: true,
          options: aspect.aspectConstraint.aspectValues?.map(
            (v) => v.localizedValue
          ),
          placeholder: `Enter ${aspect.localizedAspectName.toLowerCase()}`,
          helpText:
            aspect.aspectConstraint.aspectUsage === 'REQUIRED'
              ? 'Required by eBay'
              : 'Recommended',
        };

        fields.push(field);
      }
    }

    setDynamicFields(fields);
  } catch (error) {
    console.error('Failed to load category aspects:', error);
  }
};

// NEW: Handle dynamic field changes
const handleDynamicFieldChange = (
  fieldName: string,
  value: string | string[]
) => {
  setUserAspects((prev) => ({
    ...prev,
    [fieldName]: Array.isArray(value) ? value : [value],
  }));

  // Clear validation error for this field
  setValidationErrors((prev) =>
    prev.filter((error) => !error.includes(fieldName))
  );
};

// NEW: Handle multiselect changes
const handleMultiselectChange = (fieldName: string, option: string) => {
  setUserAspects((prev) => {
    const currentValues = prev[fieldName] || [];
    const newValues = currentValues.includes(option)
      ? currentValues.filter((v) => v !== option)
      : [...currentValues, option];

    return {
      ...prev,
      [fieldName]: newValues,
    };
  });
};

// NEW: Pre-submission validation
const validateBeforeSubmission = async (): Promise<boolean> => {
  setIsValidating(true);
  const errors: string[] = [];

  try {
    // Validate required dynamic fields
    for (const field of dynamicFields) {
      if (field.required && !userAspects[field.name]?.length) {
        errors.push(`${field.label} is required`);
      }
    }

    // Validate category is leaf
    const isLeaf =
      await intelligenceService.taxonomyService.validateLeafCategory(
        categoryId
      );
    if (!isLeaf) {
      errors.push(
        'Selected category is too broad. Please choose a more specific category.'
      );
    }

    setValidationErrors(errors);
    return errors.length === 0;
  } catch (error) {
    console.error('Validation failed:', error);
    setValidationErrors(['Validation failed. Please try again.']);
    return false;
  } finally {
    setIsValidating(false);
  }
};

// ENHANCED: Submit with validation and aspects
const handleEnhancedSubmit = async () => {
  // Pre-flight validation
  const isValid = await validateBeforeSubmission();
  if (!isValid) return;

  // Your existing validation
  if (!categoryId) {
    Alert.alert(
      'Missing Information',
      'Please select a category for your listing.'
    );
    return;
  }

  if (!price || isNaN(Number(price)) || Number(price) <= 0) {
    Alert.alert(
      'Invalid Price',
      'Please enter a valid price for your listing.'
    );
    return;
  }

  if (editableImages.length === 0) {
    Alert.alert(
      'Missing Photos',
      'Please add at least one photo of your item.'
    );
    return;
  }

  // ENHANCED: Include all aspects
  const config: ListingConfiguration = {
    categoryId,
    condition,
    price: Number(price),
    description: description.trim() || undefined,
    images: editableImages,
    title: editableTitle.trim() || item?.title || '',
    // NEW: Include all aspects (auto-detected + user-provided)
    aspects: {
      ...categoryAnalysis?.suggestedCategories[selectedCategoryIndex]
        ?.autoDetectedAspects,
      ...userAspects,
    },
  };

  onSubmit(config);
};
```

---

### **🎨 NEW STYLES TO ADD**

```typescript
// ADD these new styles to your existing StyleSheet:

const newStyles = StyleSheet.create({
  // Analysis loading
  analysisCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  analysisSubtext: {
    fontSize: 14,
    marginLeft: 32,
  },

  // AI badge
  aiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Category cards
  categoryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },

  // Auto-detected aspects
  autoDetectedPreview: {
    marginBottom: 8,
  },
  autoDetectedTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  aspectTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  aspectTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aspectTagText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Required input
  requiredInputPreview: {
    marginTop: 8,
  },
  requiredInputTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  requiredFieldsCount: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Manual category
  manualCategoryButton: {
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  manualCategoryText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Dynamic fields
  dynamicFieldContainer: {
    marginBottom: 20,
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
  dynamicFieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    height: 50,
  },
  fieldHelpText: {
    fontSize: 12,
    marginTop: 4,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  // Multiselect
  multiselectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  multiselectOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  multiselectText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Validation
  validationCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  validationHeader: {
    marginBottom: 8,
  },
  validationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  validationError: {
    marginBottom: 4,
  },
  validationErrorText: {
    fontSize: 14,
  },

  // Enhanced submit
  validatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// Helper function for confidence colors
const getConfidenceColor = (confidence: string) => {
  switch (confidence) {
    case 'HIGH':
      return '#10B981'; // Green
    case 'MEDIUM':
      return '#F59E0B'; // Orange
    case 'LOW':
      return '#EF4444'; // Red
    default:
      return '#6B7280'; // Gray
  }
};
```

---

### **🔄 ENHANCED ListingConfiguration INTERFACE**

```typescript
// UPDATE your existing interface:
export interface ListingConfiguration {
  categoryId: string;
  condition:
    | 'NEW'
    | 'USED_LIKE_NEW'
    | 'USED_EXCELLENT'
    | 'USED_VERY_GOOD'
    | 'USED_GOOD'
    | 'USED_ACCEPTABLE';
  price?: number;
  description?: string;
  images?: string[];
  title?: string;
  // NEW: Dynamic aspects
  aspects?: Record<string, string[]>;
}
```

---

### **🎯 COMPLETE USER EXPERIENCE FLOW**

1. **User opens modal** → Immediate analysis starts
2. **Analysis completes** → Shows 3 smart category suggestions with confidence levels
3. **User selects category** → Auto-detected aspects appear, dynamic fields render for missing required fields
4. **User fills required fields** → Real-time validation, clear error messages
5. **User submits** → Pre-flight validation, enhanced error handling, successful listing

### **🔧 CONSIDERATIONS FOR DIFFERENT CATEGORIES**

#### **Electronics** (Phones, Laptops, etc.)

- **Auto-detect**: Brand, Model, Storage, Color, Connectivity
- **Dynamic fields**: Condition Details, Network Compatibility, Operating System
- **Validation**: Model number format, storage capacity options

#### **Fashion** (Clothing, Shoes, etc.)

- **Auto-detect**: Brand, Size, Color, Material
- **Dynamic fields**: Fit Type, Occasion, Season, Care Instructions
- **Validation**: Size chart compatibility, material composition

#### **Automotive** (Parts, Accessories, etc.)

- **Auto-detect**: Vehicle Make, Model, Year, Part Type
- **Dynamic fields**: Fitment Details, OEM/Aftermarket, Condition
- **Validation**: Vehicle compatibility, part number verification

#### **Home & Garden** (Appliances, Tools, etc.)

- **Auto-detect**: Brand, Type, Capacity, Power Source
- **Dynamic fields**: Energy Rating, Dimensions, Installation Type
- **Validation**: Safety certifications, power requirements

#### **Collectibles** (Cards, Coins, etc.)

- **Auto-detect**: Type, Era, Condition Grade
- **Dynamic fields**: Authentication, Rarity, Certification
- **Validation**: Grading standards, authenticity verification

This comprehensive integration maintains your existing UI/UX while adding powerful intelligence that works across ALL product categories, not just games. The system gracefully handles edge cases and provides clear fallbacks when auto-detection isn't possible.
