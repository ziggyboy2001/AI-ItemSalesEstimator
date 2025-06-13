// services/ebayErrorHandlingService.ts
// Phase 3 Step 3.2: Enhanced Error Handling Service

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

    if (error.includes('Payment policy')) {
      return 'Your eBay account needs payment policies set up. Please configure your seller policies in eBay.';
    }

    if (error.includes('Return policy')) {
      return 'Your eBay account needs return policies set up. Please configure your seller policies in eBay.';
    }

    if (error.includes('not a leaf category')) {
      return 'The selected category is too broad. Please choose a more specific category for your item.';
    }

    if (error.includes('item specific') && error.includes('missing')) {
      const match = error.match(/The item specific ([^.]+) is missing/);
      const missingField = match ? match[1] : 'required field';
      return `This category requires "${missingField}" to be specified. Please provide this information.`;
    }

    if (error.includes('item specific') && error.includes('invalid')) {
      const match = error.match(/The item specific ([^.]+) is invalid/);
      const invalidField = match ? match[1] : 'field';
      return `The value for "${invalidField}" is not valid for this category. Please check the allowed values.`;
    }

    if (error.includes('title') && error.includes('too long')) {
      return 'Your listing title is too long. Please shorten it to 80 characters or less.';
    }

    if (error.includes('description') && error.includes('too long')) {
      return 'Your listing description is too long. Please shorten it.';
    }

    if (error.includes('price') && error.includes('invalid')) {
      return 'The price you entered is not valid. Please enter a valid price.';
    }

    if (error.includes('image') && error.includes('too many')) {
      return 'You can only upload up to 12 images per listing. Please remove some images.';
    }

    if (error.includes('unauthorized') || error.includes('401')) {
      return 'Your eBay session has expired. Please reconnect your eBay account.';
    }

    if (error.includes('forbidden') || error.includes('403')) {
      return 'You do not have permission to perform this action. Please check your eBay account permissions.';
    }

    if (error.includes('rate limit') || error.includes('429')) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    if (error.includes('network') || error.includes('timeout')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }

    // Default fallback
    return `eBay listing failed: ${error}. Please try again or contact support.`;
  }

  /**
   * Extract specific error codes from eBay API responses
   */
  static parseEbayError(errorResponse: any): string {
    if (!errorResponse || !errorResponse.errors) {
      return 'Unknown error occurred';
    }

    const firstError = errorResponse.errors[0];
    if (!firstError) {
      return 'Unknown error occurred';
    }

    // Check for specific eBay error codes
    if (firstError.errorId === '25002') {
      return 'CATEGORY_NOT_LEAF';
    }

    if (firstError.errorId === '25003') {
      const message = firstError.message || '';
      const match = message.match(/The item specific ([^.]+) is missing/);
      if (match) {
        return `MISSING_REQUIRED_FIELD:${match[1]}`;
      }
    }

    // Return the raw message for other errors
    return firstError.message || 'Unknown error occurred';
  }

  /**
   * Check if an error is recoverable (user can fix) vs non-recoverable (system issue)
   */
  static isRecoverableError(error: string): boolean {
    const recoverableErrors = [
      'CATEGORY_NOT_LEAF',
      'MISSING_REQUIRED_FIELD',
      'invalid picture URL',
      'title',
      'description',
      'price',
      'image',
    ];

    return recoverableErrors.some(recoverable => error.includes(recoverable));
  }

  /**
   * Get suggested actions for specific errors
   */
  static getSuggestedActions(error: string): string[] {
    if (error === 'CATEGORY_NOT_LEAF') {
      return [
        'Choose a more specific category from the suggestions',
        'Browse eBay categories to find the exact match',
        'Contact support if you cannot find the right category'
      ];
    }

    if (error.startsWith('MISSING_REQUIRED_FIELD:')) {
      const field = error.split(':')[1];
      return [
        `Fill in the "${field}" field`,
        'Check the Additional Information section',
        'Select a different category if this field is not applicable'
      ];
    }

    if (error.includes('unauthorized') || error.includes('401')) {
      return [
        'Go to Account Settings',
        'Disconnect and reconnect your eBay account',
        'Make sure you have seller permissions'
      ];
    }

    if (error.includes('Fulfillment policy')) {
      return [
        'Log into your eBay seller account',
        'Set up shipping policies in Account Settings',
        'Return to BidPeek and try listing again'
      ];
    }

    return [
      'Check your internet connection',
      'Try again in a few moments',
      'Contact support if the problem persists'
    ];
  }
} 