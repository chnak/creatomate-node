import { createCanvas, Canvas } from '@napi-rs/canvas';
import { Render } from '../Render';
import { Source } from '../Source';
import { ElementBase } from '../elements/ElementBase';
import { LocalRenderOptions, LocalClientOptions } from './LocalRenderOptions';
import { AnimationEngine } from './animations/AnimationEngine';
import { Canvas2DRenderer } from './pipeline/Canvas2DRenderer';
import { FrameGenerator } from './pipeline/FrameGenerator';
import { VideoEncoder } from './encoding/VideoEncoder';
import { VideoElementRenderer } from './elements/VideoElementRenderer';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { nanoid } from 'nanoid';

export class LocalRenderer {
  private source: Source;
  private options: LocalRenderOptions;
  private clientOptions: LocalClientOptions;
  private canvas: Canvas;
  private animationEngine: AnimationEngine;
  private renderer: Canvas2DRenderer;
  private frameGenerator!: FrameGenerator;
  private videoEncoder: VideoEncoder | null = null;
  private outputPath: string;

  constructor(options: LocalRenderOptions, clientOptions: LocalClientOptions = {}) {
    this.options = options;
    this.clientOptions = clientOptions;
    this.source = options.source as Source;

    // Create canvas
    const width = this.source.properties.width || 1920;
    const height = this.source.properties.height || 1080;
    this.canvas = createCanvas(width, height);

    // Initialize components
    this.animationEngine = new AnimationEngine();
    this.renderer = new Canvas2DRenderer(this.canvas);

    // Determine output path
    const outputFormat = this.source.properties.outputFormat || 'mp4';
    const ext = outputFormat === 'jpg' ? 'jpg' : outputFormat;
    this.outputPath = options.outputPath || clientOptions.outputPath || path.join(
      clientOptions.outputDir || os.tmpdir(),
      `creatomate-${nanoid()}.${ext}`
    );
  }

  /**
   * Start render without waiting for completion.
   */
  async startRender(): Promise<Render[]> {
    const render: Render = {
      id: nanoid(),
      status: 'waiting',
      url: '',
      outputFormat: this.source.properties.outputFormat || 'mp4',
      renderScale: this.options.renderScale || 1,
      width: this.source.properties.width,
      height: this.source.properties.height,
      frameRate: this.source.properties.frameRate,
      duration: this.source.properties.duration,
    };

    // Start render in background
    this.renderInternal().then((url) => {
      render.status = 'succeeded';
      render.url = url;
    }).catch((error) => {
      render.status = 'failed';
      render.errorMessage = error.message;
    });

    return [render];
  }

  /**
   * Render and wait for completion.
   */
  async render(timeout = 3600): Promise<Render[]> {
    try {
      const outputUrl = await this.renderInternal();

      return [{
        id: nanoid(),
        status: 'succeeded',
        url: outputUrl,
        outputFormat: this.source.properties.outputFormat || 'mp4',
        renderScale: this.options.renderScale || 1,
        width: this.source.properties.width,
        height: this.source.properties.height,
        frameRate: this.source.properties.frameRate,
        duration: this.source.properties.duration,
        fileSize: fs.existsSync(outputUrl) ? fs.statSync(outputUrl).size : undefined,
      }];
    } catch (error: any) {
      return [{
        id: nanoid(),
        status: 'failed',
        url: '',
        outputFormat: this.source.properties.outputFormat || 'mp4',
        renderScale: this.options.renderScale || 1,
        errorMessage: error.message,
      }];
    }
  }

  /**
   * Internal render implementation.
   */
  private async renderInternal(): Promise<string> {
    const width = this.source.properties.width || 1920;
    const height = this.source.properties.height || 1080;
    const fps = this.source.properties.frameRate || 30;
    const duration = this.source.properties.duration || 5;
    const outputFormat = this.source.properties.outputFormat || 'mp4';

    // Initialize frame generator
    this.frameGenerator = new FrameGenerator(
      this.canvas,
      this.renderer,
      this.animationEngine,
      this.source,
      { width, height, fps, duration }
    );

    // Initialize video encoder
    this.videoEncoder = new VideoEncoder({
      outputPath: this.outputPath,
      width,
      height,
      fps,
      outputFormat,
      crf: this.options.crf,
      gifQuality: this.options.gifQuality,
      ffmpegPath: this.clientOptions.ffmpegPath,
    });

    await this.videoEncoder.initialize();

    // Pre-extract all video frames for better performance
    await this.preExtractVideoFrames(this.source, width, height, fps, duration);

    // Render each frame
    const totalFrames = Math.ceil(fps * duration);
    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / fps;
      const frameData = await this.frameGenerator.renderFrame(time);

      // Dump frame if requested
      if (this.options.dumpFrames) {
        const dumpDir = this.options.dumpPath || path.join(process.cwd(), 'frames');
        await fs.ensureDir(dumpDir);
        const framePath = path.join(dumpDir, `frame-${String(frame).padStart(5, '0')}.png`);
        await fs.writeFile(framePath, frameData);
      }

      await this.videoEncoder.writeFrame(frameData);
    }

    // Finalize video
    await this.videoEncoder.finalize();
    await this.videoEncoder.dispose();

    return this.outputPath;
  }

  /**
   * Get canvas for direct manipulation.
   */
  getCanvas(): Canvas {
    return this.canvas;
  }

  /**
   * Pre-extract video frames for all video elements to improve rendering performance.
   */
  private async preExtractVideoFrames(source: Source, width: number, height: number, fps: number, duration: number): Promise<void> {
    const elements = this.flattenElements(source.properties.elements || []);

    for (const element of elements) {
      if (element instanceof ElementBase && (element as any).type === 'video') {
        const props = element.properties as any;
        const videoSrc = props.source;
        const fit = props.fit || 'cover';

        if (videoSrc) {
          console.log(`[LocalRenderer] Pre-extracting frames for: ${videoSrc}`);
          await VideoElementRenderer.preExtractFrames(videoSrc, fps, duration, width, height, fit);
        }
      }
    }
  }

  /**
   * Flatten nested elements (except composition children which are handled separately).
   */
  private flattenElements(elements: Array<any>): Array<any> {
    const result: Array<any> = [];
    for (const element of elements) {
      if (element instanceof ElementBase) {
        result.push(element);
      }
    }
    return result;
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    if (this.videoEncoder) {
      this.videoEncoder.dispose();
    }
  }
}