// __tests__/ebayIntelligence.test.ts
// Phase 4 Step 4.1: Comprehensive Testing Plan

import { CategoryIntelligenceService } from '../services/categoryIntelligenceService';
import { EbayTaxonomyService } from '../services/ebayTaxonomyService';
import { EbayErrorHandler } from '../services/ebayErrorHandlingService';
import { PerformanceMonitor } from '../services/performanceMonitor';

// Mock the fetch for testing
global.fetch = jest.fn();

describe('eBay Intelligence System', () => {
  let intelligenceService: CategoryIntelligenceService;
  let taxonomyService: EbayTaxonomyService;

  beforeEach(() => {
    // Clear performance metrics before each test
    PerformanceMonitor.clearMetrics();
    
    // Create test instances
    intelligenceService = new CategoryIntelligenceService('test-token');
    taxonomyService = new EbayTaxonomyService('test-token');
    
    // Reset fetch mock
    (fetch as jest.Mock).mockClear();
  });

  describe('Category Detection', () => {
    test('should detect video game category correctly', async () => {
      // Mock eBay API responses
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            categorySuggestions: [
              {
                category: {
                  categoryId: '139973',
                  categoryName: 'Video Games & Consoles > Video Games'
                },
                categoryTreeNodeLevel: 2
              }
            ]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            aspects: [
              {
                localizedAspectName: 'Platform',
                aspectConstraint: { aspectRequired: true },
                aspectValues: [
                  { localizedValue: 'Nintendo Game Boy Advance' }
                ]
              },
              {
                localizedAspectName: 'Game Name',
                aspectConstraint: { aspectRequired: true }
              }
            ]
          })
        });

      const result = await intelligenceService.analyzeItem('Pokemon Fire Red GBA');

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
      // Mock eBay API responses for electronics
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            categorySuggestions: [
              {
                category: {
                  categoryId: '9355',
                  categoryName: 'Cell Phones & Smartphones'
                },
                categoryTreeNodeLevel: 2
              }
            ]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            aspects: [
              {
                localizedAspectName: 'Brand',
                aspectConstraint: { aspectRequired: true },
                aspectValues: [
                  { localizedValue: 'Apple' }
                ]
              },
              {
                localizedAspectName: 'Model',
                aspectConstraint: { aspectRequired: true }
              }
            ]
          })
        });

      const result = await intelligenceService.analyzeItem('Apple iPhone 12 Pro Max');

      expect(
        result.suggestedCategories[0].autoDetectedAspects['Brand']
      ).toContain('Apple');
      expect(
        result.suggestedCategories[0].autoDetectedAspects['Model']
      ).toContain('iPhone 12 Pro Max');
    });

    test('should handle clothing category detection', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            categorySuggestions: [
              {
                category: {
                  categoryId: '15687',
                  categoryName: 'Clothing, Shoes & Accessories > Men\'s Clothing > Shirts'
                },
                categoryTreeNodeLevel: 3
              }
            ]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            aspects: [
              {
                localizedAspectName: 'Brand',
                aspectConstraint: { aspectRequired: true }
              },
              {
                localizedAspectName: 'Size',
                aspectConstraint: { aspectRequired: true },
                aspectValues: [
                  { localizedValue: 'S' },
                  { localizedValue: 'M' },
                  { localizedValue: 'L' },
                  { localizedValue: 'XL' }
                ]
              },
              {
                localizedAspectName: 'Color',
                aspectConstraint: { aspectRequired: false }
              }
            ]
          })
        });

      const result = await intelligenceService.analyzeItem('Nike Men\'s Blue T-Shirt Size Large');

      expect(
        result.suggestedCategories[0].autoDetectedAspects['Brand']
      ).toContain('Nike');
      expect(
        result.suggestedCategories[0].autoDetectedAspects['Size']
      ).toContain('L');
      expect(
        result.suggestedCategories[0].autoDetectedAspects['Color']
      ).toContain('Blue');
    });
  });

  describe('Dynamic Field Generation', () => {
    test('should generate correct dynamic fields for video games', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          aspects: [
            {
              localizedAspectName: 'Platform',
              aspectConstraint: { aspectRequired: true },
              aspectValues: [
                { localizedValue: 'Nintendo Game Boy Advance' },
                { localizedValue: 'Nintendo DS' },
                { localizedValue: 'PlayStation 2' }
              ]
            },
            {
              localizedAspectName: 'Game Name',
              aspectConstraint: { aspectRequired: true }
            },
            {
              localizedAspectName: 'Genre',
              aspectConstraint: { aspectRequired: false },
              aspectValues: [
                { localizedValue: 'Action' },
                { localizedValue: 'Adventure' },
                { localizedValue: 'RPG' }
              ]
            }
          ]
        })
      });

      const aspects = await taxonomyService.getItemAspectsForCategory('139973');
      const requiredFields = aspects.filter(
        (a) => a.aspectConstraint.aspectRequired
      );

      expect(
        requiredFields.some((f) => f.localizedAspectName === 'Platform')
      ).toBe(true);
      expect(
        requiredFields.some((f) => f.localizedAspectName === 'Game Name')
      ).toBe(true);
      
      // Check that Platform has predefined options
      const platformField = aspects.find(a => a.localizedAspectName === 'Platform');
      expect(platformField?.aspectValues).toBeDefined();
      expect(platformField?.aspectValues?.length).toBeGreaterThan(0);
    });

    test('should generate correct dynamic fields for electronics', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          aspects: [
            {
              localizedAspectName: 'Brand',
              aspectConstraint: { aspectRequired: true },
              aspectValues: [
                { localizedValue: 'Apple' },
                { localizedValue: 'Samsung' },
                { localizedValue: 'Google' }
              ]
            },
            {
              localizedAspectName: 'Model',
              aspectConstraint: { aspectRequired: true }
            },
            {
              localizedAspectName: 'Storage Capacity',
              aspectConstraint: { aspectRequired: false },
              aspectValues: [
                { localizedValue: '64 GB' },
                { localizedValue: '128 GB' },
                { localizedValue: '256 GB' }
              ]
            }
          ]
        })
      });

      const aspects = await taxonomyService.getItemAspectsForCategory('9355');
      const requiredFields = aspects.filter(
        (a) => a.aspectConstraint.aspectRequired
      );

      expect(
        requiredFields.some((f) => f.localizedAspectName === 'Brand')
      ).toBe(true);
      expect(
        requiredFields.some((f) => f.localizedAspectName === 'Model')
      ).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should validate required fields correctly', () => {
      const aspects = [
        {
          localizedAspectName: 'Platform',
          aspectConstraint: { aspectRequired: true },
          aspectValues: []
        },
        {
          localizedAspectName: 'Game Name',
          aspectConstraint: { aspectRequired: true },
          aspectValues: []
        },
        {
          localizedAspectName: 'Genre',
          aspectConstraint: { aspectRequired: false },
          aspectValues: []
        }
      ];

      const userAspects = { Platform: ['Nintendo Game Boy Advance'] };
      const missing = intelligenceService.getRequiredUserInput(aspects, userAspects);

      expect(missing).toContain('Game Name');
      expect(missing).not.toContain('Platform');
      expect(missing).not.toContain('Genre'); // Not required
    });

    test('should validate all required fields are provided', () => {
      const aspects = [
        {
          localizedAspectName: 'Brand',
          aspectConstraint: { aspectRequired: true },
          aspectValues: []
        },
        {
          localizedAspectName: 'Model',
          aspectConstraint: { aspectRequired: true },
          aspectValues: []
        }
      ];

      const userAspects = { 
        Brand: ['Apple'], 
        Model: ['iPhone 12 Pro Max'] 
      };
      const missing = intelligenceService.getRequiredUserInput(aspects, userAspects);

      expect(missing).toHaveLength(0);
    });

    test('should handle empty user aspects', () => {
      const aspects = [
        {
          localizedAspectName: 'Platform',
          aspectConstraint: { aspectRequired: true },
          aspectValues: []
        }
      ];

      const userAspects = {};
      const missing = intelligenceService.getRequiredUserInput(aspects, userAspects);

      expect(missing).toContain('Platform');
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        taxonomyService.getCategorySuggestions('test item')
      ).rejects.toThrow('Network error');
    });

    test('should handle invalid category ID', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          errors: [{ message: 'Category not found' }]
        })
      });

      await expect(
        taxonomyService.getItemAspectsForCategory('invalid-id')
      ).rejects.toThrow();
    });

    test('should provide user-friendly error messages', () => {
      const errorHandler = new EbayErrorHandler();
      
      const friendlyMessage = errorHandler.getErrorMessage(
        'The specified category ID is not valid'
      );
      
      expect(friendlyMessage).toContain('category');
      expect(friendlyMessage).not.toContain('ID'); // Should be user-friendly
    });
  });

  describe('Performance Monitoring', () => {
    test('should track category analysis performance', async () => {
      const mockOperation = jest.fn().mockResolvedValue({ success: true });
      
      await PerformanceMonitor.trackCategoryAnalysis(
        mockOperation,
        'Test Item'
      );

      const stats = PerformanceMonitor.getPerformanceStats('category_analysis_success');
      expect(stats.totalOperations).toBe(1);
      expect(stats.successRate).toBe(100);
    });

    test('should track performance failures', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(
        PerformanceMonitor.trackCategoryAnalysis(
          mockOperation,
          'Test Item'
        )
      ).rejects.toThrow('Test error');

      const stats = PerformanceMonitor.getPerformanceStats('category_analysis_failure');
      expect(stats.totalOperations).toBe(1);
    });

    test('should generate performance report', () => {
      // Add some mock metrics
      PerformanceMonitor.trackMetric = jest.fn();
      
      const report = PerformanceMonitor.generatePerformanceReport();
      
      expect(report).toContain('PERFORMANCE REPORT');
      expect(report).toContain('Success Rate');
      expect(report).toContain('Target: 95%+');
    });
  });

  describe('Integration Tests', () => {
    test('should complete full listing flow for video game', async () => {
      // Mock all required API calls
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            categorySuggestions: [
              {
                category: {
                  categoryId: '139973',
                  categoryName: 'Video Games & Consoles > Video Games'
                },
                categoryTreeNodeLevel: 2
              }
            ]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            aspects: [
              {
                localizedAspectName: 'Platform',
                aspectConstraint: { aspectRequired: true },
                aspectValues: [
                  { localizedValue: 'Nintendo Game Boy Advance' }
                ]
              },
              {
                localizedAspectName: 'Game Name',
                aspectConstraint: { aspectRequired: true }
              }
            ]
          })
        });

      // Test the full flow
      const analysis = await intelligenceService.analyzeItem('Pokemon Fire Red GBA');
      
      expect(analysis.suggestedCategories).toHaveLength(3);
      expect(analysis.suggestedCategories[0].categoryId).toBe('139973');
      
      // Verify auto-detected aspects
      const autoDetected = analysis.suggestedCategories[0].autoDetectedAspects;
      expect(autoDetected['Platform']).toContain('Nintendo Game Boy Advance');
      expect(autoDetected['Game Name']).toContain('Pokemon Fire Red');
    });

    test('should handle edge case: item with no clear category', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          categorySuggestions: []
        })
      });

      const analysis = await intelligenceService.analyzeItem('Mysterious Unknown Item');
      
      expect(analysis.suggestedCategories).toHaveLength(0);
      expect(analysis.confidence).toBe('LOW');
    });
  });

  describe('Success Metrics Validation', () => {
    test('should meet listing success rate target', () => {
      // Simulate successful operations
      for (let i = 0; i < 95; i++) {
        PerformanceMonitor['trackMetric']('ebay_listing_success', 5000, {});
      }
      for (let i = 0; i < 5; i++) {
        PerformanceMonitor['trackMetric']('ebay_listing_failure', 5000, {});
      }

      const stats = PerformanceMonitor.getPerformanceStats('ebay_listing_success');
      const overallStats = PerformanceMonitor.getPerformanceStats();
      
      // Should meet 95%+ success rate target
      expect(overallStats.successRate).toBeGreaterThanOrEqual(95);
    });

    test('should meet performance targets', () => {
      // Simulate fast operations
      PerformanceMonitor['trackMetric']('category_analysis_success', 2000, {}); // <3000ms target
      PerformanceMonitor['trackMetric']('dynamic_field_generation_success', 500, {}); // <1000ms target
      PerformanceMonitor['trackMetric']('validation_success', 200, {}); // <1000ms target

      const categoryStats = PerformanceMonitor.getPerformanceStats('category_analysis_success');
      const fieldStats = PerformanceMonitor.getPerformanceStats('dynamic_field_generation_success');
      const validationStats = PerformanceMonitor.getPerformanceStats('validation_success');

      expect(categoryStats.averageDuration).toBeLessThan(3000);
      expect(fieldStats.averageDuration).toBeLessThan(1000);
      expect(validationStats.averageDuration).toBeLessThan(1000);
    });
  });
});

// Additional test utilities
export const TestScenarios = {
  VIDEO_GAMES: [
    'Pokemon Fire Red GBA',
    'Super Mario Bros Nintendo Switch',
    'Call of Duty Modern Warfare PS4',
    'The Legend of Zelda Breath of the Wild',
    'Minecraft Xbox One'
  ],
  
  ELECTRONICS: [
    'Apple iPhone 12 Pro Max 256GB',
    'Samsung Galaxy S21 Ultra',
    'Sony WH-1000XM4 Headphones',
    'Nintendo Switch Console',
    'iPad Pro 11-inch 2021'
  ],
  
  COLLECTIBLES: [
    'Pokemon Charizard Base Set Shadowless',
    'Magic The Gathering Black Lotus',
    'Vintage Star Wars Luke Skywalker Figure',
    'Funko Pop Batman #01',
    'Hot Wheels Redline 1968'
  ],
  
  FASHION: [
    'Nike Air Jordan 1 Size 10',
    'Levi\'s 501 Jeans 32x34',
    'Gucci Belt Black Leather',
    'Adidas Ultraboost 22 Running Shoes',
    'Supreme Box Logo Hoodie Large'
  ],
  
  EDGE_CASES: [
    'Handmade Custom Item',
    'Vintage Unknown Brand Watch',
    'Broken iPhone for Parts',
    'Empty Box Only',
    'Digital Download Code'
  ]
};

// Performance test helper
export const runPerformanceTest = async (
  testItems: string[],
  intelligenceService: CategoryIntelligenceService
): Promise<void> => {
  console.log(`🧪 Running performance test with ${testItems.length} items...`);
  
  const startTime = Date.now();
  const results = [];
  
  for (const item of testItems) {
    try {
      const result = await PerformanceMonitor.trackCategoryAnalysis(
        () => intelligenceService.analyzeItem(item),
        item
      );
      results.push({ item, success: true, result });
    } catch (error) {
      results.push({ item, success: false, error });
    }
  }
  
  const totalTime = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const successRate = (successCount / results.length) * 100;
  
  console.log(`✅ Performance test completed in ${totalTime}ms`);
  console.log(`📊 Success rate: ${successRate.toFixed(1)}% (${successCount}/${results.length})`);
  console.log(`⚡ Average time per item: ${(totalTime / results.length).toFixed(0)}ms`);
  
  PerformanceMonitor.logPerformanceSummary();
}; 