// React Native/Expo compatibility
import 'react-native-url-polyfill/auto';
import { EbayTaxonomyService, CategorySuggestion, ItemAspect } from './ebayTaxonomyService';
import { PerformanceMonitor } from './performanceMonitor';

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

export class CategoryIntelligenceService {
  public taxonomyService: EbayTaxonomyService;

  constructor(accessToken: string) {
    this.taxonomyService = new EbayTaxonomyService(accessToken);
  }

  // MAIN INTELLIGENCE FUNCTION
  async analyzeItem(
    title: string,
    description?: string
  ): Promise<SmartCategoryResult> {
    return PerformanceMonitor.trackCategoryAnalysis(async () => {
      try {
        console.log('🧠 Analyzing item intelligence for:', title);
        
        // Step 1: Get eBay's category suggestions
        const suggestions = await this.taxonomyService.getCategorySuggestions(title);

      if (suggestions.length === 0) {
        console.log('⚠️ No category suggestions found, returning empty result');
        return {
          suggestedCategories: [],
          recommendedCategory: '',
        };
      }

      // Step 2: For each suggestion, get required aspects and auto-detect what we can
      const analyzedCategories = await Promise.all(
        suggestions.slice(0, 3).map(async (suggestion) => {
          const aspects = await this.taxonomyService.getItemAspectsForCategory(
            suggestion.category.categoryId
          );

          const autoDetected = this.autoDetectAspects(
            suggestion.category.categoryId,
            title,
            description || '',
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

        console.log(`✅ Analyzed ${analyzedCategories.length} categories with intelligence`);

        return {
          suggestedCategories: analyzedCategories,
          recommendedCategory: analyzedCategories[0]?.categoryId || '',
        };
      } catch (error) {
        console.error('❌ analyzeItem error:', error);
        throw error;
      }
    }, title);
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

    console.log('🔍 Auto-detecting aspects for category:', categoryId);

    // Video Game Detection
    if (this.isVideoGameCategory(categoryId)) {
      console.log('🎮 Detected video game category, analyzing...');
      
      // Platform detection
      const platformAspect = aspects.find(
        (a) => a.localizedAspectName === 'Platform'
      );
      if (platformAspect) {
        const platform = this.detectPlatform(titleLower);
        if (platform) {
          detected['Platform'] = [platform];
          console.log('✅ Auto-detected Platform:', platform);
        }
      }

      // Game Name detection
      const gameNameAspect = aspects.find(
        (a) => a.localizedAspectName === 'Game Name'
      );
      if (gameNameAspect) {
        const gameName = this.extractGameName(title);
        if (gameName) {
          detected['Game Name'] = [gameName];
          console.log('✅ Auto-detected Game Name:', gameName);
        }
      }

      // Genre detection
      const genreAspect = aspects.find(
        (a) => a.localizedAspectName === 'Genre'
      );
      if (genreAspect) {
        const genre = this.detectGenre(titleLower + ' ' + descLower);
        if (genre) {
          detected['Genre'] = [genre];
          console.log('✅ Auto-detected Genre:', genre);
        }
      }
    }

    // Electronics Detection
    if (this.isElectronicsCategory(categoryId)) {
      console.log('📱 Detected electronics category, analyzing...');
      
      // Brand detection
      const brandAspect = aspects.find(
        (a) => a.localizedAspectName === 'Brand'
      );
      if (brandAspect) {
        const brand = this.detectBrand(titleLower);
        if (brand) {
          detected['Brand'] = [brand];
          console.log('✅ Auto-detected Brand:', brand);
        }
      }

      // Model detection
      const modelAspect = aspects.find(
        (a) => a.localizedAspectName === 'Model'
      );
      if (modelAspect) {
        const model = this.extractModel(title);
        if (model) {
          detected['Model'] = [model];
          console.log('✅ Auto-detected Model:', model);
        }
      }

      // Color detection for electronics
      const colorAspect = aspects.find(
        (a) => a.localizedAspectName === 'Color'
      );
      if (colorAspect) {
        const color = this.detectColor(titleLower);
        if (color) {
          detected['Color'] = [color];
          console.log('✅ Auto-detected Color:', color);
        }
      }
    }

    const detectedCount = Object.keys(detected).length;
    console.log(`✅ Auto-detected ${detectedCount} aspects:`, Object.keys(detected));

    return detected;
  }

  // DETECTION HELPER METHODS
  private detectPlatform(title: string): string | null {
    const platformMap: Record<string, string> = {
      'gba': 'Nintendo Game Boy Advance',
      'game boy advance': 'Nintendo Game Boy Advance',
      'gameboy advance': 'Nintendo Game Boy Advance',
      'nintendo ds': 'Nintendo DS',
      'ds': 'Nintendo DS',
      '3ds': 'Nintendo 3DS',
      'nintendo 3ds': 'Nintendo 3DS',
      'playstation': 'Sony PlayStation',
      'ps1': 'Sony PlayStation',
      'ps2': 'Sony PlayStation 2',
      'ps3': 'Sony PlayStation 3',
      'ps4': 'Sony PlayStation 4',
      'ps5': 'Sony PlayStation 5',
      'xbox': 'Microsoft Xbox',
      'xbox 360': 'Microsoft Xbox 360',
      'xbox one': 'Microsoft Xbox One',
      'nintendo switch': 'Nintendo Switch',
      'switch': 'Nintendo Switch',
      'wii': 'Nintendo Wii',
      'gamecube': 'Nintendo GameCube',
    };

    for (const [key, platform] of Object.entries(platformMap)) {
      if (title.includes(key)) {
        return platform;
      }
    }
    return null;
  }

  private extractGameName(title: string): string | null {
    // Remove platform indicators and clean up
    const cleaned = title
      .replace(/\b(gba|nintendo|ds|3ds|playstation|ps\d|xbox|switch|wii|gamecube)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || null;
  }

  private detectGenre(text: string): string | null {
    const genreKeywords: Record<string, string[]> = {
      'Action': ['action', 'fighting', 'shooter', 'combat', 'battle'],
      'Adventure': ['adventure', 'quest', 'exploration', 'journey'],
      'RPG': ['rpg', 'role playing', 'fantasy', 'magic', 'pokemon'],
      'Sports': ['sports', 'football', 'basketball', 'soccer', 'racing', 'nfl', 'nba'],
      'Strategy': ['strategy', 'tactical', 'civilization', 'war', 'empire'],
      'Puzzle': ['puzzle', 'brain', 'logic', 'tetris', 'sudoku'],
      'Simulation': ['simulation', 'sim', 'tycoon', 'city', 'farm'],
      'Racing': ['racing', 'driving', 'cars', 'speed', 'formula'],
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
      'apple', 'samsung', 'sony', 'nintendo', 'microsoft', 'google', 'amazon',
      'nike', 'adidas', 'polo', 'tommy', 'calvin klein', 'gap', 'old navy',
      'hp', 'dell', 'lenovo', 'asus', 'acer', 'lg', 'panasonic', 'canon',
      'nikon', 'gopro', 'beats', 'bose', 'jbl'
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

  private detectColor(title: string): string | null {
    const colors = [
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple',
      'pink', 'brown', 'gray', 'grey', 'silver', 'gold', 'rose gold', 'space gray'
    ];
    
    for (const color of colors) {
      if (title.includes(color)) {
        return color.charAt(0).toUpperCase() + color.slice(1);
      }
    }
    return null;
  }

  private isVideoGameCategory(categoryId: string): boolean {
    const videoGameCategories = [
      '139973', // Nintendo Game Boy Advance
      '175672', // Video Games & Consoles
      '1249',   // Action Figures
      '139971', // Nintendo DS
      '139972', // Nintendo 3DS
      '139976', // PlayStation
      '139977', // Xbox
      '139978', // Nintendo Switch
    ];
    return videoGameCategories.includes(categoryId);
  }

  private isElectronicsCategory(categoryId: string): boolean {
    const electronicsCategories = [
      '11450',  // Electronics
      '293',    // Cell Phones & Smartphones
      '58058',  // Cell Phones & Smartphones
      '15032',  // Laptops & Netbooks
      '171485', // Tablets & eBook Readers
    ];
    return electronicsCategories.includes(categoryId);
  }

  public getRequiredUserInput(
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

  // Convert aspects to dynamic fields for UI rendering
  public createDynamicFields(
    aspects: ItemAspect[],
    autoDetected: Record<string, string[]>
  ): DynamicField[] {
    const startTime = Date.now();
    const fields: DynamicField[] = [];

    for (const aspect of aspects) {
      // Skip if already auto-detected
      if (autoDetected[aspect.localizedAspectName]) {
        continue;
      }

      // Only include required or recommended aspects
      if (!aspect.aspectConstraint.aspectRequired && 
          aspect.aspectConstraint.aspectUsage !== 'RECOMMENDED') {
        continue;
      }

      const field: DynamicField = {
        name: aspect.localizedAspectName,
        label: aspect.localizedAspectName,
        type: aspect.aspectConstraint.aspectValues ? 'select' : 'text',
        required: aspect.aspectConstraint.aspectRequired,
        options: aspect.aspectConstraint.aspectValues?.map(
          (v) => v.localizedValue
        ),
        placeholder: `Enter ${aspect.localizedAspectName.toLowerCase()}`,
        helpText:
          aspect.aspectConstraint.aspectUsage === 'REQUIRED'
            ? 'Required by eBay'
            : 'Recommended for better visibility',
      };

      // Handle multi-select fields
      if (aspect.aspectConstraint.itemToAspectCardinality === 'MULTI') {
        field.type = 'multiselect';
      }

      // Handle numeric fields
      if (aspect.aspectConstraint.aspectDataType === 'NUMBER') {
        field.type = 'number';
      }

      fields.push(field);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Created ${fields.length} dynamic fields for user input in ${duration}ms`);
    
    // Track performance manually for synchronous method
    if (duration > 1000) {
      console.warn(`⚠️ Performance warning: Dynamic field generation took ${duration}ms (threshold: 1000ms)`);
    }
    
    return fields;
  }
}

// Export types for use in components
export type { SmartCategoryResult, DynamicField }; 