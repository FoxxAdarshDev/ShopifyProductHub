import { storage } from "../storage";

/**
 * Cleanup service for draft content
 * Automatically removes old draft content that hasn't been updated in a while
 */

const CLEANUP_INTERVAL_HOURS = 24; // Run cleanup every 24 hours
const DRAFT_EXPIRY_HOURS = 168; // Delete drafts older than 7 days

export class DraftCleanupService {
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    if (this.intervalId) {
      console.log('Draft cleanup service is already running');
      return;
    }

    console.log('Starting draft content cleanup service...');
    
    // Run immediately on start
    this.cleanupExpiredDrafts();
    
    // Set up recurring cleanup
    this.intervalId = setInterval(() => {
      this.cleanupExpiredDrafts();
    }, CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
    
    console.log(`Draft cleanup service started - running every ${CLEANUP_INTERVAL_HOURS} hours`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Draft cleanup service stopped');
    }
  }

  private async cleanupExpiredDrafts() {
    try {
      console.log('Running draft content cleanup...');
      
      const cutoffDate = new Date(Date.now() - (DRAFT_EXPIRY_HOURS * 60 * 60 * 1000));
      
      // Since we don't have a bulk delete with date filter in our storage interface,
      // we'll execute a direct SQL query for efficient cleanup
      const { db } = await import("../db");
      const { draftContent } = await import("@shared/schema");
      const { lt } = await import("drizzle-orm");
      
      const deletedRows = await db
        .delete(draftContent)
        .where(lt(draftContent.updatedAt, cutoffDate));
      
      console.log(`Draft cleanup completed. Removed expired draft entries.`);
      
    } catch (error) {
      console.error('Error during draft cleanup:', error);
    }
  }

  // Manual cleanup method for immediate use
  async forceCleanup() {
    await this.cleanupExpiredDrafts();
  }
}

export const draftCleanupService = new DraftCleanupService();