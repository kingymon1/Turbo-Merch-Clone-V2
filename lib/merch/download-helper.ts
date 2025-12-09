/**
 * Download Helpers for Merch Generator
 *
 * Utilities for downloading images and exporting listing data.
 */

import { MerchDesign } from './types';

/**
 * Download a single image
 */
export function downloadImage(imageUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Sanitize filename by removing invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}

/**
 * Download listing data as CSV
 */
export function downloadListingData(
  designs: MerchDesign[],
  filename: string = 'listings.csv'
): void {
  // CSV headers
  const headers = [
    'ID',
    'Phrase',
    'Niche',
    'Style',
    'Tone',
    'Title',
    'Bullet 1',
    'Bullet 2',
    'Bullet 3',
    'Bullet 4',
    'Bullet 5',
    'Description',
    'Image URL',
  ];

  // Create rows
  const rows = designs.map(d => {
    const bullets = d.listingBullets || [];
    return [
      d.id,
      d.phrase,
      d.niche,
      d.style || '',
      d.tone || '',
      d.listingTitle,
      bullets[0] || '',
      bullets[1] || '',
      bullets[2] || '',
      bullets[3] || '',
      bullets[4] || '',
      d.listingDesc,
      d.imageUrl,
    ];
  });

  // Escape CSV values
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Build CSV content
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCSV(String(cell))).join(',')),
  ].join('\n');

  // Create and download blob
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Download all variations (images + CSV)
 */
export function downloadAllVariations(
  variations: MerchDesign[],
  basePhrase: string
): void {
  const sanitizedPhrase = sanitizeFilename(basePhrase);

  // Download images one by one with staggered timing
  variations.forEach((v, i) => {
    setTimeout(() => {
      const filename = `${sanitizedPhrase}_v${i + 1}.png`;
      downloadImage(v.imageUrl, filename);
    }, i * 500); // 500ms between downloads
  });

  // Download CSV with all listing data after images start
  setTimeout(() => {
    downloadListingData(variations, `${sanitizedPhrase}_listings.csv`);
  }, 1000);
}

/**
 * Convert base64 image to blob for download
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Download base64 image
 */
export function downloadBase64Image(base64: string, filename: string): void {
  if (base64.startsWith('data:')) {
    // It's a data URL, create blob and download
    const blob = base64ToBlob(base64);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } else {
    // It's a regular URL
    downloadImage(base64, filename);
  }
}

/**
 * Create a ZIP file of all variations (requires JSZip library)
 * This is a placeholder - actual implementation would need JSZip
 */
export async function createVariationsZip(
  variations: MerchDesign[],
  basePhrase: string
): Promise<Blob | null> {
  // Note: Full implementation would require adding JSZip library
  // For now, use the staggered download approach instead
  console.warn('ZIP download not implemented - using individual downloads');
  downloadAllVariations(variations, basePhrase);
  return null;
}

/**
 * Export variations to JSON format
 */
export function exportToJSON(
  variations: MerchDesign[],
  filename: string = 'variations.json'
): void {
  const data = variations.map(v => ({
    id: v.id,
    phrase: v.phrase,
    niche: v.niche,
    style: v.style,
    tone: v.tone,
    listing: {
      title: v.listingTitle,
      bullets: v.listingBullets,
      description: v.listingDesc,
    },
    imageUrl: v.imageUrl,
    imagePrompt: v.imagePrompt,
    createdAt: v.createdAt,
  }));

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
