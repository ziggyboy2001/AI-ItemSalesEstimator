# BidPeek Scan Tracking Implementation Plan

## Overview

Implement a robust database-driven scan tracking system with 3 distinct search types and subscription-based limits.

## 1. Search Types & Scan Classification

### 3 Search Types:

1. **Current Listings - Text Search** (`current_text`)

   - `handleEbayBrowseSearch()` with text input only
   - Uses eBay Browse API

2. **Current Listings - Image Search** (`current_image`)

   - `handleSearch()` with selectedImage + optional text
   - Uses eBay Image Search API
   - Higher value scan type

3. **Sold Items - Text/AI Search** (`sold_text`)
   - `handleEbaySearch()` with text input
   - `handleIdentifyItem()` -> AI identification -> sold search
   - Uses eBay Completed Items API

### Database Schema Updates:

```sql
-- Update user_scans.scan_type check constraint
ALTER TABLE user_scans DROP CONSTRAINT IF EXISTS user_scans_scan_type_check;
ALTER TABLE user_scans ADD CONSTRAINT user_scans_scan_type_check
CHECK (scan_type IN ('current_text', 'current_image', 'sold_text'));
```

## 2. Subscription Tiers & Scan Limits

### Updated Subscription Limits:

- **Free**: 3 scans/month (1 of each type to try features)
- **Basic**: 25 scans/month (focus on text searches)
- **Premium**: 100 scans/month (includes image searches)
- **Unlimited**: Unlimited scans

### Subscription Value Proposition:

- **Free**: "Try all search types"
- **Basic**: "Perfect for casual resellers"
- **Premium**: "Power up with image searches"
- **Unlimited**: "No limits for professional resellers"

## 3. User & Device Tracking

### Implementation Strategy:

- **Primary**: User ID (when authenticated)
- **Fallback**: Device ID (for anonymous users)
- **Anti-abuse**: Track both user_id and device_id to prevent multi-account abuse

### Database Schema:

```sql
-- Add device_id to user_scans
ALTER TABLE user_scans ADD COLUMN device_id TEXT;
-- Add device_id to user_subscriptions
ALTER TABLE user_subscriptions ADD COLUMN device_id TEXT;
-- Add unique constraint to prevent device abuse
ALTER TABLE user_subscriptions ADD CONSTRAINT unique_device_subscription
UNIQUE(device_id) WHERE user_id IS NULL;
```

## 4. Database-Driven Subscription Context

### Replace AsyncStorage with Database:

- Primary source: `user_subscriptions` table
- Usage tracking: `monthly_usage_summary` table
- Real-time updates: Direct database queries
- Fallback: AsyncStorage for offline mode only

## 5. SubscriptionService Implementation

### Core Methods:

```typescript
class SubscriptionService {
  // Limit checking
  static async canUserScan(
    userId: string,
    deviceId: string,
    scanType: string
  ): Promise<{ canScan: boolean; reason?: string; usageInfo: any }>;

  // Scan recording
  static async recordScan(
    userId: string,
    deviceId: string,
    scanType: string,
    searchId: string,
    metadata?: any
  ): Promise<void>;

  // Subscription management
  static async getUserSubscription(
    userId: string,
    deviceId: string
  ): Promise<UserSubscription>;
  static async createFreeSubscription(
    userId: string,
    deviceId: string
  ): Promise<void>;
  static async getCurrentMonthUsage(
    userId: string,
    deviceId: string
  ): Promise<number>;

  // Usage queries
  static async getUsageBreakdown(
    userId: string,
    deviceId: string
  ): Promise<{
    current_text: number;
    current_image: number;
    sold_text: number;
  }>;
}
```

## 6. Implementation Steps

### Phase 1: Database Updates

1. Update `user_scans` scan_type constraint
2. Add `device_id` columns to tables
3. Create indexes for performance
4. Migrate existing scan data

### Phase 2: SubscriptionService

1. Create new `SubscriptionService` class
2. Implement all core methods
3. Add device ID generation utility
4. Add comprehensive error handling

### Phase 3: Authentication & Device Tracking

1. Create device ID hook (`useDeviceId`)
2. Update `useAuth` to work with SubscriptionService
3. Implement user + device tracking logic

### Phase 4: Subscription Context Update

1. Replace AsyncStorage with database calls
2. Add real-time usage tracking
3. Update subscription loading logic
4. Add device-based fallback

### Phase 5: Search Integration

1. Add scan limit checks to all 3 search types
2. Add scan recording after successful searches
3. Update search UI to show scan usage
4. Add upgrade prompts when limits reached

### Phase 6: Subscription Screen Updates

1. Remove unsupported features from subscription cards
2. Focus on scan limits as primary value prop
3. Add usage breakdown by scan type
4. Update pricing messaging

### Phase 7: Testing & Validation

1. Test all 3 search types with limits
2. Test multi-device scenarios
3. Test subscription upgrades/downgrades
4. Test offline mode fallbacks

## 7. Files to Modify

### Core Services:

- `services/SubscriptionService.ts` (recreate)
- `hooks/useDeviceId.ts` (create)
- `hooks/useAuth.ts` (update)

### Context & State:

- `contexts/SubscriptionContext.tsx` (major update)

### UI Components:

- `app/(tabs)/index.tsx` (add scan tracking to all searches)
- `app/(tabs)/subscription.tsx` (update features & messaging)

### Database:

- Migration files for schema updates
- Data migration for existing scans

## 8. Success Criteria

### Functional Requirements:

- ✅ All 3 search types tracked separately
- ✅ Accurate scan limits enforced
- ✅ Real-time usage updates
- ✅ Device + user tracking prevents abuse
- ✅ Seamless upgrade flow

### Technical Requirements:

- ✅ Database as primary data source
- ✅ AsyncStorage only as offline fallback
- ✅ Robust error handling
- ✅ Performance optimized queries
- ✅ Clean separation of concerns

### Business Requirements:

- ✅ Clear subscription value proposition
- ✅ Encourages upgrades at right moments
- ✅ Prevents free trial abuse
- ✅ Accurate billing integration ready

## Next Steps

1. Choose which phase to start with
2. Review and approve database schema changes
3. Begin implementation phase by phase
4. Test each phase before moving to next
