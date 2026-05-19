import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { nanoid } from 'nanoid';
import { ElementBase } from '../../elements/ElementBase';

/**
 * Media downloader for caching remote media files locally.
 */
export class MediaDownloader {
  private static instance: MediaDownloader;
  private cacheDir: string;
  private cache: Map<string, string>;
  private pendingDownloads: Map<string, Promise<string>>;

  private constructor() {
    this.cacheDir = path.join(os.tmpdir(), 'creatomate-media');
    this.cache = new Map();
    this.pendingDownloads = new Map();
  }

  static getInstance(): MediaDownloader {
    if (!MediaDownloader.instance) {
      MediaDownloader.instance = new MediaDownloader();
    }
    return MediaDownloader.instance;
  }

  /**
   * Get local path for a media source.
   * Downloads the file if not already cached.
   */
  async getLocalPath(source: string): Promise<string> {
    // Check if already cached
    if (this.cache.has(source)) {
      return this.cache.get(source)!;
    }

    // Check if download is in progress
    if (this.pendingDownloads.has(source)) {
      return this.pendingDownloads.get(source)!;
    }

    // Start download
    const downloadPromise = this.download(source);
    this.pendingDownloads.set(source, downloadPromise);

    try {
      const localPath = await downloadPromise;
      this.cache.set(source, localPath);
      return localPath;
    } finally {
      this.pendingDownloads.delete(source);
    }
  }

  /**
   * Download a remote media file to local cache.
   */
  private async download(source: string): Promise<string> {
    await fs.ensureDir(this.cacheDir);

    // Determine file extension from URL or default to .mp4
    const urlObj = new URL(source);
    const pathname = urlObj.pathname;
    const ext = path.extname(pathname) || '.mp4';

    const localFileName = `${nanoid()}${ext}`;
    const localPath = path.join(this.cacheDir, localFileName);

    // Check if source is a remote URL
    if (source.startsWith('http://') || source.startsWith('https://')) {
      try {
        // Download from remote URL
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        await fs.writeFile(localPath, Buffer.from(buffer));
      } catch (error) {
        // If download fails, return original source URL for fallback rendering
        console.warn(`Failed to download media: ${source}, using original source`);
        return source;
      }
    } else {
      // Local file - just copy
      await fs.copy(source, localPath);
    }

    return localPath;
  }

  /**
   * Pre-download all media from a source's elements.
   */
  async preloadElements(elements: ElementBase<any>[]): Promise<void> {
    const mediaUrls: string[] = [];

    const collectMedia = (els: ElementBase<any>[]) => {
      for (const el of els) {
        const props = el.properties as any;
        if (props.source) {
          mediaUrls.push(props.source);
        }
        // Check for nested elements (composition)
        if (props.elements && Array.isArray(props.elements)) {
          collectMedia(props.elements as ElementBase<any>[]);
        }
      }
    };

    collectMedia(elements);

    // Download all media in parallel
    await Promise.all(mediaUrls.map(url => this.getLocalPath(url)));
  }

  /**
   * Clear the download cache.
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    try {
      await fs.remove(this.cacheDir);
    } catch {}
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; count: number } {
    return {
      size: this.cache.size,
      count: this.cache.size
    };
  }
}
