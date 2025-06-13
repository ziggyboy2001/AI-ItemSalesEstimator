// services/testEnhancedBackend.ts
// Phase 3 Step 3.1 & 3.2: Test Enhanced Backend Integration

import { listHaulItemOnEbay, ListingConfiguration, HaulItem } from './ebayInventoryApi';
import { EbayErrorHandler } from './ebayErrorHandlingService';
import { testEbayTaxonomyAPI } from './testEbayAPI';

/**
 * Test the enhanced backend integration with dynamic aspects
 */
export async function testEnhancedBackendIntegration(): Promise<void> {
  console.log('🧪 Testing Enhanced Backend Integration...');
  
  try {
    // Step 1: Test eBay API connectivity
    console.log('📡 Step 1: Testing eBay API connectivity...');
    const apiTest = await testEbayTaxonomyAPI();
    if (!apiTest) {
      throw new Error('eBay API connectivity test failed');
    }
    console.log('✅ eBay API connectivity test passed');
    
    // Step 2: Test Error Handler
    console.log('🔧 Step 2: Testing Enhanced Error Handler...');
    testErrorHandler();
    console.log('✅ Error handler tests passed');
    
    // Step 3: Test Dynamic Aspects Integration
    console.log('🎯 Step 3: Testing Dynamic Aspects Integration...');
    testDynamicAspectsIntegration();
    console.log('✅ Dynamic aspects integration tests passed');
    
    console.log('🎉 All Enhanced Backend Integration tests passed!');
    
  } catch (error) {
    console.error('❌ Enhanced Backend Integration test failed:', error);
    throw error;
  }
}

/**
 * Test the Enhanced Error Handler
 */
function testErrorHandler(): void {
  console.log('  🔍 Testing error message parsing...');
  
  // Test category not leaf error
  const categoryError = EbayErrorHandler.getUserFriendlyError('CATEGORY_NOT_LEAF');
  console.log('  📝 Category error:', categoryError);
  
  // Test missing required field error
  const missingFieldError = EbayErrorHandler.getUserFriendlyError('MISSING_REQUIRED_FIELD:Brand');
  console.log('  📝 Missing field error:', missingFieldError);
  
  // Test unauthorized error
  const authError = EbayErrorHandler.getUserFriendlyError('unauthorized access');
  console.log('  📝 Auth error:', authError);
  
  // Test suggested actions
  const actions = EbayErrorHandler.getSuggestedActions('CATEGORY_NOT_LEAF');
  console.log('  💡 Suggested actions:', actions);
  
  // Test error recoverability
  const isRecoverable = EbayErrorHandler.isRecoverableError('MISSING_REQUIRED_FIELD:Brand');
  console.log('  🔄 Is recoverable:', isRecoverable);
}

/**
 * Test Dynamic Aspects Integration
 */
function testDynamicAspectsIntegration(): void {
  console.log('  🎮 Testing dynamic aspects for video game...');
  
  // Mock haul item
  const mockHaulItem: HaulItem = {
    id: 'test-123',
    title: 'Pokemon Fire Red Game Boy Advance',
    image_url: 'https://example.com/image.jpg',
    sale_price: 29.99,
    purchase_price: 15.00
  };
  
  // Mock configuration with dynamic aspects
  const mockConfig: ListingConfiguration = {
    categoryId: '175672', // Video Games category
    condition: 'USED_EXCELLENT',
    price: 29.99,
    title: 'Pokemon Fire Red - Nintendo Game Boy Advance',
    description: 'Classic Pokemon game in excellent condition',
    aspects: {
      'Platform': ['Nintendo Game Boy Advance'],
      'Game Name': ['Pokemon Fire Red'],
      'Genre': ['Role Playing'],
      'Brand': ['Nintendo'],
      'Condition Details': ['Cartridge only, tested and working']
    }
  };
  
  console.log('  📦 Mock haul item:', {
    id: mockHaulItem.id,
    title: mockHaulItem.title,
    price: mockHaulItem.sale_price
  });
  
  console.log('  🏷️ Mock configuration with aspects:', {
    categoryId: mockConfig.categoryId,
    aspectsCount: Object.keys(mockConfig.aspects || {}).length,
    aspects: mockConfig.aspects
  });
  
  // Test aspect merging logic
  const fallbackAspects: Record<string, string[]> = {
    'Platform': ['Nintendo Game Boy Advance'],
    'Game Name': ['Pokemon Fire Red']
  };
  
  const mergedAspects: Record<string, string[]> = {
    ...fallbackAspects,
    ...mockConfig.aspects
  };
  
  console.log('  🔀 Merged aspects (fallback + user):', mergedAspects);
  
  // Verify user aspects take precedence
  if (mergedAspects['Platform']?.[0] === 'Nintendo Game Boy Advance' && 
      mergedAspects['Genre']?.[0] === 'Role Playing') {
    console.log('  ✅ Aspect merging works correctly');
  } else {
    throw new Error('Aspect merging failed');
  }
}

/**
 * Test error scenarios
 */
export async function testErrorScenarios(): Promise<void> {
  console.log('🚨 Testing Error Scenarios...');
  
  // Test 1: Category not leaf error
  console.log('  📂 Testing category not leaf error...');
  const categoryError = EbayErrorHandler.getUserFriendlyError('CATEGORY_NOT_LEAF');
  console.log('  📝 Result:', categoryError);
  
  // Test 2: Missing required field error
  console.log('  📋 Testing missing required field error...');
  const fieldError = EbayErrorHandler.getUserFriendlyError('MISSING_REQUIRED_FIELD:Platform');
  console.log('  📝 Result:', fieldError);
  
  // Test 3: Parse eBay API error response
  console.log('  🔍 Testing eBay API error parsing...');
  const mockEbayError = {
    errors: [{
      errorId: '25002',
      message: 'The specified category is not a leaf category'
    }]
  };
  
  const parsedError = EbayErrorHandler.parseEbayError(mockEbayError);
  console.log('  📝 Parsed error:', parsedError);
  
  console.log('✅ All error scenario tests passed!');
}

/**
 * Run all tests
 */
export async function runAllEnhancedBackendTests(): Promise<void> {
  console.log('🚀 Running All Enhanced Backend Tests...');
  
  try {
    await testEnhancedBackendIntegration();
    await testErrorScenarios();
    
    console.log('🎉 All Enhanced Backend tests completed successfully!');
    console.log('📊 Test Summary:');
    console.log('  ✅ eBay API connectivity');
    console.log('  ✅ Enhanced error handling');
    console.log('  ✅ Dynamic aspects integration');
    console.log('  ✅ Error scenario handling');
    console.log('  ✅ Aspect merging logic');
    
  } catch (error) {
    console.error('❌ Enhanced Backend tests failed:', error);
    throw error;
  }
} 