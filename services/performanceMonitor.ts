// services/performanceMonitor.ts
// Phase 4 Step 4.2: Performance Monitoring

interface PerformanceMetric {
  event: string;
  duration: number;
  timestamp: number;
  metadata: Record<string, any>;
}

interface PerformanceStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetric[] = [];
  private static readonly MAX_METRICS = 1000; // Keep last 1000 metrics

  /**
   * Track category analysis performance
   */
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

  /**
   * Track dynamic field generation performance
   */
  static async trackDynamicFieldGeneration<T>(
    operation: () => Promise<T>,
    categoryId: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      console.log(
        `🔧 Dynamic field generation completed in ${duration}ms for category: ${categoryId}`
      );

      this.trackMetric('dynamic_field_generation_success', duration, { categoryId });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(
        `❌ Dynamic field generation failed after ${duration}ms for category: ${categoryId}`,
        error
      );

      this.trackMetric('dynamic_field_generation_failure', duration, {
        categoryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Track eBay listing performance
   */
  static async trackEbayListing<T>(
    operation: () => Promise<T>,
    itemTitle: string,
    categoryId: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      console.log(
        `🏪 eBay listing completed in ${duration}ms for: ${itemTitle}`
      );

      this.trackMetric('ebay_listing_success', duration, { itemTitle, categoryId });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(
        `❌ eBay listing failed after ${duration}ms for: ${itemTitle}`,
        error
      );

      this.trackMetric('ebay_listing_failure', duration, {
        itemTitle,
        categoryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Track validation performance
   */
  static async trackValidation<T>(
    operation: () => Promise<T>,
    fieldCount: number
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      console.log(
        `✅ Validation completed in ${duration}ms for ${fieldCount} fields`
      );

      this.trackMetric('validation_success', duration, { fieldCount });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(
        `❌ Validation failed after ${duration}ms for ${fieldCount} fields`,
        error
      );

      this.trackMetric('validation_failure', duration, {
        fieldCount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  private static trackMetric(
    event: string,
    duration: number,
    metadata: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      event,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Keep only the last MAX_METRICS entries
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log performance warnings
    this.checkPerformanceThresholds(event, duration);
  }

  /**
   * Check performance thresholds and log warnings
   */
  private static checkPerformanceThresholds(event: string, duration: number): void {
    const thresholds = {
      category_analysis_success: 3000, // 3 seconds
      dynamic_field_generation_success: 1000, // 1 second
      ebay_listing_success: 10000, // 10 seconds
      validation_success: 1000, // 1 second
    };

    const threshold = thresholds[event as keyof typeof thresholds];
    if (threshold && duration > threshold) {
      console.warn(
        `⚠️ Performance warning: ${event} took ${duration}ms (threshold: ${threshold}ms)`
      );
    }
  }

  /**
   * Get performance statistics for a specific event type
   */
  static getPerformanceStats(eventType?: string): PerformanceStats {
    const filteredMetrics = eventType
      ? this.metrics.filter(m => m.event === eventType)
      : this.metrics;

    if (filteredMetrics.length === 0) {
      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
      };
    }

    const successfulOps = filteredMetrics.filter(m => m.event.includes('success'));
    const failedOps = filteredMetrics.filter(m => m.event.includes('failure'));
    const durations = filteredMetrics.map(m => m.duration);

    return {
      totalOperations: filteredMetrics.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: (successfulOps.length / filteredMetrics.length) * 100,
    };
  }

  /**
   * Get recent performance metrics
   */
  static getRecentMetrics(limit: number = 50): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Clear all performance metrics
   */
  static clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Generate performance report
   */
  static generatePerformanceReport(): string {
    const overallStats = this.getPerformanceStats();
    const categoryStats = this.getPerformanceStats('category_analysis_success');
    const fieldStats = this.getPerformanceStats('dynamic_field_generation_success');
    const listingStats = this.getPerformanceStats('ebay_listing_success');
    const validationStats = this.getPerformanceStats('validation_success');

    return `
📊 PERFORMANCE REPORT
=====================

Overall Performance:
- Total Operations: ${overallStats.totalOperations}
- Success Rate: ${overallStats.successRate.toFixed(1)}%
- Average Duration: ${overallStats.averageDuration.toFixed(0)}ms

Category Analysis:
- Operations: ${categoryStats.totalOperations}
- Success Rate: ${categoryStats.successRate.toFixed(1)}%
- Average Duration: ${categoryStats.averageDuration.toFixed(0)}ms
- Target: <3000ms

Dynamic Field Generation:
- Operations: ${fieldStats.totalOperations}
- Success Rate: ${fieldStats.successRate.toFixed(1)}%
- Average Duration: ${fieldStats.averageDuration.toFixed(0)}ms
- Target: <1000ms

eBay Listing:
- Operations: ${listingStats.totalOperations}
- Success Rate: ${listingStats.successRate.toFixed(1)}%
- Average Duration: ${listingStats.averageDuration.toFixed(0)}ms
- Target: <10000ms

Validation:
- Operations: ${validationStats.totalOperations}
- Success Rate: ${validationStats.successRate.toFixed(1)}%
- Average Duration: ${validationStats.averageDuration.toFixed(0)}ms
- Target: <1000ms

🎯 SUCCESS METRICS STATUS:
- Listing Success Rate: ${listingStats.successRate.toFixed(1)}% (Target: 95%+)
- Category Analysis Speed: ${categoryStats.averageDuration.toFixed(0)}ms (Target: <3000ms)
- Field Generation Speed: ${fieldStats.averageDuration.toFixed(0)}ms (Target: <1000ms)
- Validation Speed: ${validationStats.averageDuration.toFixed(0)}ms (Target: <1000ms)
    `.trim();
  }

  /**
   * Log performance summary
   */
  static logPerformanceSummary(): void {
    console.log(this.generatePerformanceReport());
  }
} 