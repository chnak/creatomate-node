import { ElementBase } from '../../elements/ElementBase';
import execa from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

/**
 * Video element renderer using FFmpeg for frame extraction.
 */
export class VideoElementRenderer {
  private static frameCache: Map<string, Map<number, Buffer>> = new Map();
  private static maxCacheSize: number = 100;
  private static tempDir: string = os.tmpdir();

  /**
   * Render video element at the given time.
   */
  static async render(
    renderer: any,
    element: ElementBase<any>,
    state: {
      x: number;
      y: number;
      width: number;
      height: number;
      opacity: number;
    },
    context: { time: number; width: number; height: number; fps?: number }
  ): Promise<void> {
    const props = element.properties as any;
    const source = props.source;

    if (!source) return;

    // Get frame at current time using FFmpeg
    const frame = await this.extractFrame(source, context.time, state.width, state.height);

    if (frame) {
      renderer.setOpacity(state.opacity);

      try {
        const { loadImage } = await import('@napi-rs/canvas');
        const img = await loadImage(frame);
        renderer.ctx.drawImage(img, state.x, state.y, state.width, state.height);
      } catch (e) {
        // If loading fails, draw a placeholder
        console.warn('Failed to load video frame:', e);
      }

      renderer.resetOpacity();
    }
  }

  /**
   * Extract a single frame from video at given time using FFmpeg.
   */
  private static async extractFrame(
    source: string,
    time: number,
    width: number,
    height: number
  ): Promise<Buffer | null> {
    // Check cache first
    const cacheKey = `${source}_${width}x${height}`;
    if (!this.frameCache.has(cacheKey)) {
      this.frameCache.set(cacheKey, new Map());
    }
    const cache = this.frameCache.get(cacheKey)!;

    const frameIndex = Math.round(time * 100); // Use 100 fps for better precision
    if (cache.has(frameIndex)) {
      return cache.get(frameIndex)!;
    }

    // Extract frame using FFmpeg
    const tempFile = path.join(this.tempDir, `video_frame_${Date.now()}_${Math.random()}.png`);

    try {
      await execa('ffmpeg', [
        '-y',
        '-ss', String(time),
        '-i', source,
        '-vframes', '1',
        '-f', 'image2',
        '-pix_fmt', 'rgba',
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        tempFile
      ]);

      // Read the extracted frame
      if (await fs.pathExists(tempFile)) {
        const frameData = await fs.readFile(tempFile);

        // Manage cache size with FIFO eviction
        if (cache.size >= this.maxCacheSize) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        cache.set(frameIndex, frameData);

        // Clean up temp file
        await fs.remove(tempFile);

        return frameData;
      }
    } catch (error) {
      console.warn('Failed to extract video frame:', error);
    } finally {
      // Clean up temp file on error
      try {
        if (await fs.pathExists(tempFile)) {
          await fs.remove(tempFile);
        }
      } catch {}
    }

    return null;
  }

  /**
   * Clear cache for a specific video.
   */
  static clearCache(source?: string): void {
    if (source) {
      // Clear specific video's cache
      for (const key of this.frameCache.keys()) {
        if (key.startsWith(source)) {
          this.frameCache.get(key)?.clear();
          this.frameCache.delete(key);
        }
      }
    } else {
      // Clear all caches
      this.frameCache.forEach(cache => cache.clear());
      this.frameCache.clear();
    }
  }

  /**
   * Clear all caches.
   */
  static clearAllCaches(): void {
    this.frameCache.forEach(cache => cache.clear());
    this.frameCache.clear();
  }
}