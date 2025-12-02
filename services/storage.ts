import { SavedListing } from '../types';

const STORAGE_KEYS = {
  LIBRARY: 'turbomerch_library',
  USER_PREFERENCES: 'turbomerch_preferences',
  LAST_SYNC: 'turbomerch_last_sync'
} as const;

/**
 * Storage service for managing localStorage operations
 * Provides type-safe access to app data with error handling
 */
export const StorageService = {
  /**
   * Save library items to localStorage
   */
  saveLibrary(items: SavedListing[]): boolean {
    try {
      const data = JSON.stringify(items);
      localStorage.setItem(STORAGE_KEYS.LIBRARY, data);
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Failed to save library:', error);
      // Check if quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Consider clearing old items.');
      }
      return false;
    }
  },

  /**
   * Load library items from localStorage
   */
  loadLibrary(): SavedListing[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LIBRARY);
      if (!data) return [];
      return JSON.parse(data) as SavedListing[];
    } catch (error) {
      console.error('Failed to load library:', error);
      return [];
    }
  },

  /**
   * Add a single item to library
   */
  addToLibrary(item: SavedListing): boolean {
    const library = this.loadLibrary();
    library.unshift(item); // Add to beginning
    return this.saveLibrary(library);
  },

  /**
   * Remove item from library by ID
   */
  removeFromLibrary(id: string): boolean {
    const library = this.loadLibrary();
    const filtered = library.filter(item => item.id !== id);
    return this.saveLibrary(filtered);
  },

  /**
   * Clear all library items
   */
  clearLibrary(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEYS.LIBRARY);
      return true;
    } catch (error) {
      console.error('Failed to clear library:', error);
      return false;
    }
  },

  /**
   * Get storage usage information
   */
  getStorageInfo(): { used: number; available: number; percentage: number } {
    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }

      // Most browsers have ~5-10MB limit
      const available = 5 * 1024 * 1024; // 5MB estimate
      const percentage = (used / available) * 100;

      return { used, available, percentage };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { used: 0, available: 0, percentage: 0 };
    }
  },

  /**
   * Check if storage is available
   */
  isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get last sync timestamp
   */
  getLastSync(): Date | null {
    try {
      const timestamp = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      return null;
    }
  }
};

export default StorageService;
