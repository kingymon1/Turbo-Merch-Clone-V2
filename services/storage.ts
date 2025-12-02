import { SavedListing, SavedIdea } from '../types';

const STORAGE_KEYS = {
  LIBRARY: 'turbomerch_library',
  IDEAS_VAULT: 'turbomerch_ideas_vault',
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

  // ==================== IDEAS VAULT ====================

  /**
   * Save ideas vault to localStorage
   */
  saveIdeasVault(ideas: SavedIdea[]): boolean {
    try {
      const data = JSON.stringify(ideas);
      localStorage.setItem(STORAGE_KEYS.IDEAS_VAULT, data);
      return true;
    } catch (error) {
      console.error('Failed to save ideas vault:', error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Consider clearing old ideas.');
      }
      return false;
    }
  },

  /**
   * Load ideas vault from localStorage
   */
  loadIdeasVault(): SavedIdea[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.IDEAS_VAULT);
      if (!data) return [];
      return JSON.parse(data) as SavedIdea[];
    } catch (error) {
      console.error('Failed to load ideas vault:', error);
      return [];
    }
  },

  /**
   * Add a single idea to vault
   */
  addToIdeasVault(idea: SavedIdea): boolean {
    const vault = this.loadIdeasVault();
    // Check for duplicates by topic
    const exists = vault.some(i => i.trend.topic === idea.trend.topic);
    if (exists) {
      console.log('Idea already exists in vault:', idea.trend.topic);
      return false;
    }
    vault.unshift(idea);
    return this.saveIdeasVault(vault);
  },

  /**
   * Add multiple ideas to vault (from a research session)
   */
  addMultipleToIdeasVault(ideas: SavedIdea[]): { added: number; skipped: number } {
    const vault = this.loadIdeasVault();
    const existingTopics = new Set(vault.map(i => i.trend.topic));

    let added = 0;
    let skipped = 0;

    for (const idea of ideas) {
      if (!existingTopics.has(idea.trend.topic)) {
        vault.unshift(idea);
        existingTopics.add(idea.trend.topic);
        added++;
      } else {
        skipped++;
      }
    }

    if (added > 0) {
      this.saveIdeasVault(vault);
    }

    return { added, skipped };
  },

  /**
   * Remove idea from vault by ID
   */
  removeFromIdeasVault(id: string): boolean {
    const vault = this.loadIdeasVault();
    const filtered = vault.filter(idea => idea.id !== id);
    return this.saveIdeasVault(filtered);
  },

  /**
   * Mark idea as used
   */
  markIdeaAsUsed(id: string): boolean {
    const vault = this.loadIdeasVault();
    const updated = vault.map(idea =>
      idea.id === id
        ? { ...idea, isUsed: true, usedAt: Date.now() }
        : idea
    );
    return this.saveIdeasVault(updated);
  },

  /**
   * Update idea notes
   */
  updateIdeaNotes(id: string, notes: string): boolean {
    const vault = this.loadIdeasVault();
    const updated = vault.map(idea =>
      idea.id === id
        ? { ...idea, notes }
        : idea
    );
    return this.saveIdeasVault(updated);
  },

  /**
   * Clear all ideas from vault
   */
  clearIdeasVault(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEYS.IDEAS_VAULT);
      return true;
    } catch (error) {
      console.error('Failed to clear ideas vault:', error);
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
