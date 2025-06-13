// Phase 1 Step 1.4: Test eBay Taxonomy API Integration
import { EbayTaxonomyService } from './ebayTaxonomyService';

// Test configuration - using client credentials flow for public API access
const EBAY_CLIENT_ID = 'KeithZah-bidpeek-PRD-9efff03ae-f2d8c8c1';
const EBAY_CLIENT_SECRET = 'PRD-efff03ae1b85-75a1-442e-8910-1b22';

async function getClientCredentialsToken(): Promise<string> {
  try {
    // Base64 encode credentials for Expo/React Native
    const credentials = btoa(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`);
    
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });

    if (!response.ok) {
      throw new Error(`Auth failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Successfully obtained access token');
    return data.access_token;
  } catch (error) {
    console.error('❌ Failed to get access token:', error);
    throw error;
  }
}

export async function testEbayTaxonomyAPI(): Promise<boolean> {
  try {
    console.log('🧪 Phase 1 Step 1.4: Testing eBay Taxonomy API Integration...');
    
    // Step 1: Get access token
    const accessToken = await getClientCredentialsToken();
    
    // Step 2: Initialize taxonomy service
    const taxonomyService = new EbayTaxonomyService(accessToken);
    
    // Step 3: Test category tree ID
    console.log('📋 Testing category tree ID...');
    const treeId = await taxonomyService.getDefaultCategoryTreeId();
    console.log('✅ Category tree ID obtained:', treeId);
    
    // Step 4: Test category suggestions (core functionality)
    console.log('🔍 Testing category suggestions...');
    const testQuery = 'Nintendo Game Boy Advance Pokemon Ruby';
    const suggestions = await taxonomyService.getCategorySuggestions(testQuery);
    
    if (suggestions.length === 0) {
      console.log('⚠️ No category suggestions found');
      return false;
    }
    
    console.log(`✅ Got ${suggestions.length} category suggestions:`);
    suggestions.slice(0, 3).forEach((suggestion, index) => {
      console.log(`  ${index + 1}. ${suggestion.category.categoryName} (${suggestion.relevancy})`);
    });
    
    // Step 5: Test aspects for first category
    if (suggestions.length > 0) {
      console.log('📋 Testing item aspects...');
      const firstCategoryId = suggestions[0].category.categoryId;
      const aspects = await taxonomyService.getItemAspectsForCategory(firstCategoryId);
      
      const requiredAspects = aspects.filter(a => a.aspectConstraint.aspectRequired);
      console.log(`✅ Found ${aspects.length} total aspects (${requiredAspects.length} required)`);
      
      if (requiredAspects.length > 0) {
        console.log('Required aspects:', requiredAspects.map(a => a.localizedAspectName).join(', '));
      }
    }
    
    console.log('🎉 Phase 1 Step 1.4: All tests passed! eBay Taxonomy API integration working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Phase 1 Step 1.4: Test failed:', error);
    return false;
  }
} 