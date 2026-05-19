import { ElementBase } from '../../elements/ElementBase';
import { MediaDownloader } from '../utils/MediaDownloader';
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
  private static downloader = MediaDownloader.getInstance();

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
      skewX: number;
      skewY: number;
      clip?: boolean;
    },
    context: { time: number; width: number; height: number; fps?: number }
  ): Promise<void> {
    const props = element.properties as any;
    const source = props.source;
    const blendMode = props.blendMode;
    const colorFilter = props.colorFilter;
    const colorFilterValue = props.colorFilterValue;

    if (!source) return;

    // Download media to local cache if needed
    const localPath = await this.downloader.getLocalPath(source);

    // Get frame at current time using FFmpeg
    const frame = await this.extractFrame(localPath, context.time, state.width, state.height);

    if (frame) {
      renderer.setOpacity(state.opacity);

      // Apply blend mode if specified
      if (blendMode && blendMode !== 'none') {
        renderer.setBlendMode(blendMode);
      }

      try {
        const { loadImage } = await import('@napi-rs/canvas');
        const img = await loadImage(frame);

        // Calculate draw area based on fit property
        const { drawX, drawY, drawWidth, drawHeight } = this.calculateFit(
          img.width, img.height,
          state.x, state.y, state.width, state.height,
          props.fit
        );

        // Apply clip if needed
        if (state.clip) {
          renderer.ctx.save();
          renderer.ctx.beginPath();
          renderer.ctx.rect(state.x, state.y, state.width, state.height);
          renderer.ctx.clip();
        }

        // Apply skew transformation
        if (state.skewX !== 0 || state.skewY !== 0) {
          const centerX = state.x + state.width / 2;
          const centerY = state.y + state.height / 2;
          renderer.ctx.translate(centerX, centerY);
          renderer.ctx.transform(1, Math.tan(state.skewY), Math.tan(state.skewX), 1, 0, 0);
          renderer.ctx.translate(-centerX, -centerY);
        }

        // Apply color filter before drawing
        if (colorFilter && colorFilter !== 'none') {
          renderer.applyColorFilter(colorFilter, colorFilterValue);
        }

        // Apply blur effect
        if (props.blurRadius && props.blurRadius > 0) {
          // Apply blur using canvas filter
          const blurAmount = Math.min(props.blurRadius, 100);
          renderer.ctx.filter = `blur(${blurAmount}px)`;
          renderer.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          renderer.ctx.filter = 'none';
        } else {
          renderer.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        }

        // Apply color overlay
        if (props.colorOverlay) {
          renderer.ctx.fillStyle = props.colorOverlay;
          renderer.ctx.fillRect(state.x, state.y, state.width, state.height);
        }

        if (state.clip) {
          renderer.ctx.restore();
        }
      } catch (e) {
        // If loading fails, draw a placeholder
        console.warn('Failed to load video frame:', e);
      }

      // Reset blend mode
      if (blendMode && blendMode !== 'none') {
        renderer.resetBlendMode();
      }

      // Reset color filter
      if (colorFilter && colorFilter !== 'none') {
        renderer.resetColorFilter();
      }

      renderer.resetOpacity();
    }
  }

  /**
   * Calculate draw position and size based on fit property.
   */
  private static calculateFit(
    srcWidth: number, srcHeight: number,
    destX: number, destY: number, destWidth: number, destHeight: number,
    fit?: string
  ): { drawX: number; drawY: number; drawWidth: number; drawHeight: number } {
    const srcAspect = srcWidth / srcHeight;
    const destAspect = destWidth / destHeight;

    let drawWidth = destWidth;
    let drawHeight = destHeight;
    let drawX = destX;
    let drawY = destY;

    if (fit === 'contain') {
      if (srcAspect > destAspect) {
        drawHeight = destWidth / srcAspect;
        drawY = destY + (destHeight - drawHeight) / 2;
      } else {
        drawWidth = destHeight * srcAspect;
        drawX = destX + (destWidth - drawWidth) / 2;
      }
    } else if (fit === 'cover') {
      if (srcAspect > destAspect) {
        drawWidth = destHeight * srcAspect;
        drawX = destX + (destWidth - drawWidth) / 2;
      } else {
        drawHeight = destWidth / srcAspect;
        drawY = destY + (destHeight - drawHeight) / 2;
      }
    } else if (fit === 'fill') {
      // fill just uses the full destination area (default behavior)
    } else {
      // Default to cover for video
      if (srcAspect > destAspect) {
        drawWidth = destHeight * srcAspect;
        drawX = destX + (destWidth - drawWidth) / 2;
      } else {
        drawHeight = destWidth / srcAspect;
        drawY = destY + (destHeight - drawHeight) / 2;
      }
    }

    return { drawX, drawY, drawWidth, drawHeight };
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