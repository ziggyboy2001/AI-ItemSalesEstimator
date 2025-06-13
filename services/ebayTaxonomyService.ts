// React Native/Expo compatibility
import 'react-native-url-polyfill/auto';

interface EbayTaxonomyConfig {
  baseUrl: string;
  categoryTreeId: string;
  accessToken: string;
}

interface CategorySuggestion {
  category: {
    categoryId: string;
    categoryName: string;
  };
  categoryTreeNodeLevel: number;
  relevancy: string; // "HIGH", "MEDIUM", "LOW"
}

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

export class EbayTaxonomyService {
  private config: EbayTaxonomyConfig;

  constructor(accessToken: string) {
    this.config = {
      baseUrl: 'https://api.ebay.com/commerce/taxonomy/v1',
      categoryTreeId: '0', // US marketplace - will be updated from API
      accessToken,
    };
  }

  // STEP 1: Get category tree ID for marketplace
  async getDefaultCategoryTreeId(): Promise<string> {
    try {
      console.log('🌳 Getting default category tree ID for US marketplace...');
      
      const response = await fetch(
        `${this.config.baseUrl}/get_default_category_tree_id?marketplace_id=EBAY_US`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to get category tree ID:', errorText);
        throw new Error(`Failed to get category tree ID: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const treeId = data.categoryTreeId;
      
      // Update our config with the actual tree ID
      this.config.categoryTreeId = treeId;
      
      console.log('✅ Got category tree ID:', treeId);
      return treeId;
    } catch (error) {
      console.error('❌ getDefaultCategoryTreeId error:', error);
      throw error;
    }
  }

  // STEP 2: Get category suggestions (THE GOLDEN API)
  async getCategorySuggestions(query: string): Promise<CategorySuggestion[]> {
    try {
      console.log('🔍 Getting category suggestions for:', query);
      
      // Ensure we have the tree ID
      if (!this.config.categoryTreeId || this.config.categoryTreeId === '0') {
        await this.getDefaultCategoryTreeId();
      }

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to get category suggestions:', errorText);
        throw new Error(`Failed to get category suggestions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const suggestions = data.categorySuggestions || [];
      
      console.log(`✅ Got ${suggestions.length} category suggestions`);
      suggestions.forEach((suggestion: CategorySuggestion, index: number) => {
        console.log(`  ${index + 1}. ${suggestion.category.categoryName} (${suggestion.relevancy})`);
      });

      return suggestions;
    } catch (error) {
      console.error('❌ getCategorySuggestions error:', error);
      throw error;
    }
  }

  // STEP 3: Get required aspects for category (DYNAMIC FIELDS API)
  async getItemAspectsForCategory(categoryId: string): Promise<ItemAspect[]> {
    try {
      console.log('📋 Getting item aspects for category:', categoryId);
      
      // Ensure we have the tree ID
      if (!this.config.categoryTreeId || this.config.categoryTreeId === '0') {
        await this.getDefaultCategoryTreeId();
      }

      const response = await fetch(
        `${this.config.baseUrl}/category_tree/${this.config.categoryTreeId}/get_item_aspects_for_category?category_id=${categoryId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to get item aspects:', errorText);
        throw new Error(`Failed to get item aspects: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const aspects = data.aspects || [];
      
      const requiredAspects = aspects.filter((aspect: ItemAspect) => aspect.aspectConstraint.aspectRequired);
      const recommendedAspects = aspects.filter((aspect: ItemAspect) => 
        aspect.aspectConstraint.aspectUsage === 'RECOMMENDED'
      );
      
      console.log(`✅ Got ${aspects.length} total aspects (${requiredAspects.length} required, ${recommendedAspects.length} recommended)`);
      console.log('Required aspects:', requiredAspects.map((a: ItemAspect) => a.localizedAspectName));

      return aspects;
    } catch (error) {
      console.error('❌ getItemAspectsForCategory error:', error);
      throw error;
    }
  }

  // STEP 4: Validate category is leaf (listable)
  async validateLeafCategory(categoryId: string): Promise<boolean> {
    try {
      console.log('🍃 Validating if category is leaf (listable):', categoryId);
      
      // Ensure we have the tree ID
      if (!this.config.categoryTreeId || this.config.categoryTreeId === '0') {
        await this.getDefaultCategoryTreeId();
      }

      const response = await fetch(
        `${this.config.baseUrl}/category_tree/${this.config.categoryTreeId}/get_category_subtree?category_id=${categoryId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to validate leaf category:', errorText);
        throw new Error(`Failed to validate leaf category: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // If no child categories, it's a leaf
      const isLeaf = !data.categorySubtree?.childCategoryTreeNodes?.length;
      
      console.log(`✅ Category ${categoryId} is ${isLeaf ? 'a leaf (listable)' : 'NOT a leaf (too broad)'}`);
      
      return isLeaf;
    } catch (error) {
      console.error('❌ validateLeafCategory error:', error);
      throw error;
    }
  }
}

// Export types for use in other services
export type { CategorySuggestion, ItemAspect, EbayTaxonomyConfig }; 