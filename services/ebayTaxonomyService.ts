// React Native/Expo compatibility
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';

interface EbayTaxonomyConfig {
  baseUrl: string;
  categoryTreeId: string;
  accessToken: string;
}

interface Category {
  categoryId: string;
  categoryName: string;
}

interface CategorySuggestion {
  category: Category;
  categoryTreeNodeLevel: number;
  categoryTreeNodeAncestors?: Category[];
  relevancy?: string;
}

interface CategorySuggestionsResponse {
  categorySuggestions: CategorySuggestion[];
}

interface CategoryTreeResponse {
  categoryTreeId: string;
  categoryTreeVersion: string;
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
      const url = `${this.config.baseUrl}/get_default_category_tree_id?marketplace_id=EBAY_US`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get category tree: ${response.status} - ${errorText}`);
      }

      const data: CategoryTreeResponse = await response.json();
      this.config.categoryTreeId = data.categoryTreeId;
      
      console.log('✅ Got category tree ID:', data.categoryTreeId);
      return data.categoryTreeId;
    } catch (error) {
      console.error('❌ Failed to get default category tree ID:', error);
      throw error;
    }
  }

  // STEP 2: Get category suggestions (THE GOLDEN API)
  async getCategorySuggestions(query: string): Promise<CategorySuggestion[]> {
    try {

      const encodedQuery = encodeURIComponent(query);
      const url = `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodedQuery}`;
      
      console.log('🔍 Making production getCategorySuggestions request:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Category suggestions error response:', errorText);
        throw new Error(`Failed to get category suggestions: ${response.status} - ${errorText}`);
      }

      const data: CategorySuggestionsResponse = await response.json();
      console.log('✅ Got category suggestions:', data.categorySuggestions?.length || 0, 'suggestions');
      
      return data.categorySuggestions || [];
    } catch (error) {
      console.error('❌ Failed to get category suggestions:', error);
      throw error;
    }
  }

  // STEP 3: Get required aspects for category (DYNAMIC FIELDS API)
  async getItemAspectsForCategory(categoryId: string): Promise<ItemAspect[]> {
    try {
      const url = `${this.config.baseUrl}/category_tree/${this.config.categoryTreeId}/get_item_aspects_for_category?category_id=${categoryId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get item aspects: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Got item aspects for category:', categoryId);
      
      const aspects = data.aspects || [];
      
      const requiredAspects = aspects.filter((aspect: ItemAspect) => aspect.aspectConstraint.aspectRequired);
      const recommendedAspects = aspects.filter((aspect: ItemAspect) => 
        aspect.aspectConstraint.aspectUsage === 'RECOMMENDED'
      );
      
      console.log(`✅ Got ${aspects.length} total aspects (${requiredAspects.length} required, ${recommendedAspects.length} recommended)`);
      console.log('Required aspects:', requiredAspects.map((a: ItemAspect) => a.localizedAspectName));

      return aspects;
    } catch (error) {
      console.error('❌ Failed to get item aspects for category:', error);
      throw error;
    }
  }

  // STEP 4: Extract category ancestry from suggestion data
  extractAncestryFromSuggestion(suggestion: any): Category[] {
    const ancestry: Category[] = [];
    
    // Add ancestors in order (from root to parent)
    if (suggestion.categoryTreeNodeAncestors) {
      suggestion.categoryTreeNodeAncestors.forEach((ancestor: any) => {
        ancestry.push({
          categoryId: ancestor.categoryId,
          categoryName: ancestor.categoryName
        });
      });
    }
    
    // Add the final category - handle both formats
    if (suggestion.category) {
      // eBay API format: { category: { categoryId, categoryName } }
      ancestry.push({
        categoryId: suggestion.category.categoryId,
        categoryName: suggestion.category.categoryName
      });
    } else if (suggestion.categoryId && suggestion.categoryName) {
      // CategoryIntelligenceService format: { categoryId, categoryName }
      ancestry.push({
        categoryId: suggestion.categoryId,
        categoryName: suggestion.categoryName
      });
    }
    
    console.log(`✅ Extracted ancestry:`, ancestry.map(c => c.categoryName).join(' > '));
    return ancestry;
  }

  // STEP 5: Get root level categories (first level categories)
  async getRootCategories(): Promise<Category[]> {
    try {
      console.log('🌳 Getting root level categories...');
      
      // Ensure we have the tree ID
      if (!this.config.categoryTreeId || this.config.categoryTreeId === '0') {
        await this.getDefaultCategoryTreeId();
      }

      const response = await fetch(
        `${this.config.baseUrl}/category_tree/${this.config.categoryTreeId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to get category tree:', errorText);
        throw new Error(`Failed to get category tree: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract root level categories (immediate children of root node)
      const rootCategories: Category[] = [];
      
      if (data.rootCategoryNode?.childCategoryTreeNodes) {
        data.rootCategoryNode.childCategoryTreeNodes.forEach((node: any) => {
          rootCategories.push({
            categoryId: node.category.categoryId,
            categoryName: node.category.categoryName
          });
        });
      }
      
      console.log(`✅ Found ${rootCategories.length} root categories`);
      
      return rootCategories;
    } catch (error) {
      console.error('❌ getRootCategories error:', error);
      throw error;
    }
  }

  // STEP 6: Get child categories for a parent category
  async getChildCategories(parentCategoryId: string): Promise<Category[]> {
    try {
      console.log('👶 Getting child categories for parent:', parentCategoryId);
      
      // Ensure we have the tree ID
      if (!this.config.categoryTreeId || this.config.categoryTreeId === '0') {
        await this.getDefaultCategoryTreeId();
      }

      const response = await fetch(
        `${this.config.baseUrl}/category_tree/${this.config.categoryTreeId}/get_category_subtree?category_id=${parentCategoryId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to get child categories:', errorText);
        
        // If this category doesn't have children, it might be a leaf category
        if (response.status === 404 || errorText.includes('not found')) {
          console.log('ℹ️ Category appears to be a leaf category (no children)');
          return [];
        }
        
        throw new Error(`Failed to get child categories: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 Raw API response structure:', JSON.stringify(data, null, 2));
      
      // Extract child categories - correct API response structure is categorySubtreeNode
      const children = data.categorySubtreeNode?.childCategoryTreeNodes?.map((node: any) => ({
        categoryId: node.category.categoryId,
        categoryName: node.category.categoryName
      })) || [];
      
      console.log(`✅ Found ${children.length} child categories for ${parentCategoryId}`);
      if (children.length > 0) {
        console.log('Children:', children.map((c: Category) => `${c.categoryId}: ${c.categoryName}`));
      } else {
        console.log('ℹ️ No child categories found - this might be a leaf category');
      }
      
      return children;
    } catch (error) {
      console.error('❌ getChildCategories error:', error);
      throw error;
    }
  }

  // STEP 7: Validate category is leaf (listable)
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
            'Accept-Encoding': 'gzip',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to validate leaf category:', errorText);
        throw new Error(`Failed to validate leaf category: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // If no child categories, it's a leaf - correct API response structure is categorySubtreeNode
      const isLeaf = !data.categorySubtreeNode?.childCategoryTreeNodes?.length;
      
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