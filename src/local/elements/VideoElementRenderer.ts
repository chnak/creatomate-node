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
  private static batchCache: Map<string, { frames: Buffer[]; timestamps: number[] }> = new Map();
  private static maxCacheSize: number = 100;
  private static tempDir: string = os.tmpdir();
  private static frameExtractionCount: number = 0;
  private static batchExtractionCount: number = 0;

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
      blendMode: string;
      rotation: number;
      scaleX: number;
      scaleY: number;
      blurRadius: number;
      clip: boolean;
      colorOverlay?: string;
    },
    context: { time: number; width: number; height: number; fps?: number }
  ): Promise<void> {
    const props = element.properties as any;
    const source = props.source;
    const fit = props.fit || 'cover';
    const colorOverlay = state.colorOverlay || props.colorOverlay;

    if (!source) return;

    // Get frame at current time using FFmpeg
    const frame = await this.extractFrame(source, context.time, state.width, state.height, fit);

    if (frame) {
      renderer.setOpacity(state.opacity);
      renderer.setBlendMode(state.blendMode);
      if (state.blurRadius > 0) {
        renderer.setBlurRadius(state.blurRadius);
      }

      // Apply clipping before drawing
      if (state.clip) {
        renderer.beginClip(state.x, state.y, state.width, state.height);
      }

      // Calculate draw position and size based on fit mode
      let drawX = state.x;
      let drawY = state.y;
      let drawWidth = state.width;
      let drawHeight = state.height;

      // Apply rotation and scale around element center
      const centerX = state.x + state.width / 2;
      const centerY = state.y + state.height / 2;
      if (state.rotation !== 0 || state.scaleX !== 1 || state.scaleY !== 1) {
        renderer.applyTransforms(state.rotation, state.scaleX, state.scaleY, centerX, centerY);
      }

      try {
        const { loadImage } = await import('@napi-rs/canvas');
        const img = await loadImage(frame);

        if (fit === 'contain') {
          // For contain: video is scaled to fit within bounds, preserving aspect ratio
          // The extracted frame is scaled to fit within state.width x state.height
          // but may not fill the entire area. We compute the actual display size and center it.
          const maxWidth = state.width;
          const maxHeight = state.height;
          const imgAspect = img.width / img.height;
          const boxAspect = maxWidth / maxHeight;

          let scaledWidth: number;
          let scaledHeight: number;

          if (imgAspect > boxAspect) {
            // Image is wider - fit to width (constraint is width)
            scaledWidth = Math.min(img.width, maxWidth);
            scaledHeight = scaledWidth / imgAspect;
          } else {
            // Image is taller - fit to height (constraint is height)
            scaledHeight = Math.min(img.height, maxHeight);
            scaledWidth = scaledHeight * imgAspect;
          }

          drawX = state.x + (maxWidth - scaledWidth) / 2;
          drawY = state.y + (maxHeight - scaledHeight) / 2;
          drawWidth = scaledWidth;
          drawHeight = scaledHeight;
        }

        renderer.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      } catch (e) {
        console.warn('Failed to load video frame:', e);
      }

      // Apply color overlay after drawing the image/video
      if (colorOverlay) {
        renderer.setColorOverlay(colorOverlay, state.x, state.y, state.width, state.height);
      }

      if (state.rotation !== 0 || state.scaleX !== 1 || state.scaleY !== 1) {
        renderer.resetTransform();
      }
      if (state.clip) {
        renderer.endClip();
      }
      if (state.blurRadius > 0) {
        renderer.resetBlur();
      }
      renderer.resetBlendMode();
      renderer.resetOpacity();
    }
  }

  /**
   * Extract a single frame from video at given time using FFmpeg.
   */
  static async extractFrame(
    source: string,
    time: number,
    width: number,
    height: number,
    fit: string = 'cover'
  ): Promise<Buffer | null> {
    // Check batch cache first (for pre-extracted frames)
    const cachedFrame = this.getCachedFrame(source, time, width, height, fit);
    if (cachedFrame) {
      return cachedFrame;
    }

    // Check per-frame cache
    const cacheKey = `${source}_${width}x${height}_${fit}`;
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

    // Build video filter based on fit mode
    // For 'contain', we don't use padding - we scale to fit and draw centered
    // The caller will handle centering when drawing
    let videoFilter: string;
    if (fit === 'contain') {
      // For contain, extract at natural size without padding - we'll center when drawing
      // Use a large max size and force aspect ratio decrease
      videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease`;
    } else if (fit === 'fill') {
      // Stretch to fill, ignoring aspect ratio
      videoFilter = `scale=${width}:${height}`;
    } else {
      // 'cover' - fill entire area, cropping excess
      videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    }

    try {
      await execa('ffmpeg', [
        '-y',
        '-ss', String(time),
        '-i', source,
        '-vframes', '1',
        '-f', 'image2',
        '-pix_fmt', 'rgba',
        '-vf', videoFilter,
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
   * Extract multiple frames from a video in a single FFmpeg execution.
   * This is much faster than extracting one frame at a time.
   */
  static async extractFrames(
    source: string,
    timestamps: number[],
    width: number,
    height: number,
    fit: string = 'cover'
  ): Promise<Map<number, Buffer>> {
    if (timestamps.length === 0) {
      return new Map();
    }

    const cacheKey = `${source}_${width}x${height}_${fit}`;
    const batchKey = `${cacheKey}_batch`;

    // Check if we already have a batch extraction for this video
    if (this.batchCache.has(batchKey)) {
      const cached = this.batchCache.get(batchKey)!;
      const result = new Map<number, Buffer>();
      for (const ts of timestamps) {
        const idx = cached.timestamps.indexOf(ts);
        if (idx >= 0 && cached.frames[idx]) {
          result.set(ts, cached.frames[idx]);
        }
      }
      return result;
    }

    this.batchExtractionCount++;
    const startTime = Date.now();

    // Build video filter based on fit mode
    // For 'contain', extract at scaled size without padding - centering is done when drawing
    let videoFilter: string;
    if (fit === 'contain') {
      videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease`;
    } else if (fit === 'fill') {
      videoFilter = `scale=${width}:${height}`;
    } else {
      videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    }

    // Use FFmpeg to extract multiple frames at once
    const tempDir = path.join(this.tempDir, `video_frames_${Date.now()}_${Math.random()}`);
    await fs.ensureDir(tempDir);

    try {
      // Build FFmpeg command with select filter for specific timestamps
      const timestampStr = timestamps.map(t => String(t)).join('|');
      const outputPattern = path.join(tempDir, 'frame_%06d.png');

      await execa('ffmpeg', [
        '-y',
        '-i', source,
        '-vf', `${videoFilter},select='eq(n\\,${timestamps.map((_, i) => i).join(')+eq(n\\,')})',showinfo`,
        '-vsync', '0',
        '-frame_pts', '1',
        outputPattern
      ]);

      // Read all extracted frames
      const result = new Map<number, Buffer>();
      const files = await fs.readdir(tempDir);

      for (let i = 0; i < timestamps.length && i < files.length; i++) {
        const filePath = path.join(tempDir, files[i]);
        if (await fs.pathExists(filePath)) {
          const frameData = await fs.readFile(filePath);
          result.set(timestamps[i], frameData);
        }
      }

      // Clean up temp directory
      await fs.remove(tempDir);

      console.log(`[VideoElementRenderer] Batch extracted ${result.size} frames in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      console.warn('Failed to batch extract video frames:', error);
      await fs.remove(tempDir).catch(() => {});

      // Fall back to individual extraction
      const result = new Map<number, Buffer>();
      for (const ts of timestamps) {
        const frame = await this.extractFrame(source, ts, width, height, fit);
        if (frame) {
          result.set(ts, frame);
        }
      }
      return result;
    }
  }

  /**
   * Pre-extract all frames for a video source.
   * Call this before rendering starts for faster performance.
   */
  static async preExtractFrames(
    source: string,
    fps: number,
    duration: number,
    width: number,
    height: number,
    fit: string = 'cover'
  ): Promise<void> {
    const cacheKey = `${source}_${width}x${height}_${fit}`;
    const batchKey = `${cacheKey}_batch`;

    // Already cached
    if (this.batchCache.has(batchKey)) {
      return;
    }

    this.batchExtractionCount++;
    const startTime = Date.now();

    // Build video filter based on fit mode
    // For 'contain', extract at scaled size without padding - centering is done when drawing
    let videoFilter: string;
    if (fit === 'contain') {
      videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease`;
    } else if (fit === 'fill') {
      videoFilter = `scale=${width}:${height}`;
    } else {
      videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    }

    // Extract frames at specified FPS
    const tempDir = path.join(this.tempDir, `video_frames_${Date.now()}_${Math.random()}`);
    await fs.ensureDir(tempDir);

    try {
      // Use FFmpeg to extract all frames at once
      await execa('ffmpeg', [
        '-y',
        '-i', source,
        '-vf', videoFilter,
        '-vsync', '0',
        '-frame_pts', '1',
        path.join(tempDir, 'frame_%06d.png')
      ]);

      // Get timestamps for all extracted frames
      const files = (await fs.readdir(tempDir)).filter(f => f.endsWith('.png')).sort();
      const frames: Buffer[] = [];
      const timestamps: number[] = [];

      for (let i = 0; i < files.length; i++) {
        const filePath = path.join(tempDir, files[i]);
        if (await fs.pathExists(filePath)) {
          const frameData = await fs.readFile(filePath);
          // Calculate timestamp based on frame index and fps
          const timestamp = i / fps;
          if (timestamp <= duration) {
            frames.push(frameData);
            timestamps.push(timestamp);
          }
        }
      }

      // Clean up temp directory
      await fs.remove(tempDir);

      // Store in batch cache
      this.batchCache.set(batchKey, { frames, timestamps });

      console.log(`[VideoElementRenderer] Pre-extracted ${frames.length} frames in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.warn('Failed to pre-extract video frames:', error);
      await fs.remove(tempDir).catch(() => {});
    }
  }

  /**
   * Get a pre-extracted frame from cache.
   */
  static getCachedFrame(source: string, timestamp: number, width: number, height: number, fit: string = 'cover'): Buffer | null {
    const cacheKey = `${source}_${width}x${height}_${fit}`;
    const batchKey = `${cacheKey}_batch`;

    if (this.batchCache.has(batchKey)) {
      const cached = this.batchCache.get(batchKey)!;
      // Find closest timestamp
      let closestIdx = -1;
      let closestDiff = Infinity;
      for (let i = 0; i < cached.timestamps.length; i++) {
        const diff = Math.abs(cached.timestamps[i] - timestamp);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIdx = i;
        }
      }
      if (closestIdx >= 0) {
        return cached.frames[closestIdx];
      }
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