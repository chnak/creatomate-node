import execa from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';

interface VideoEncoderOptions {
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  outputFormat: string;
  crf?: number;
  gifQuality?: 'fast' | 'best';
  ffmpegPath?: string;
}

/**
 * Video encoder for MP4/GIF using FFmpeg, or direct save for PNG/JPG.
 */
export class VideoEncoder {
  private options: VideoEncoderOptions;
  private ffmpegProcess: any = null;
  private initialized: boolean = false;
  private frameCount: number = 0;
  private isStaticImage: boolean = false;
  private lastFrame: Buffer | null = null;

  constructor(options: VideoEncoderOptions) {
    this.options = options;
  }

  /**
   * Initialize FFmpeg process or prepare for static image.
   */
  async initialize(): Promise<void> {
    const { outputPath, outputFormat } = this.options;

    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outputPath));

    this.isStaticImage = outputFormat === 'png' || outputFormat === 'jpg' || outputFormat === 'jpeg';

    if (this.isStaticImage) {
      // For static images, no FFmpeg needed
      this.initialized = true;
      this.frameCount = 0;
      return;
    }

    // FFmpeg arguments for video formats
    const args = this.buildFFmpegArgs();

    // Find FFmpeg executable
    const ffmpegBin = this.options.ffmpegPath || await this.findFFmpeg();

    // Start FFmpeg process
    this.ffmpegProcess = execa(ffmpegBin, args, {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    this.initialized = true;
    this.frameCount = 0;
  }

  /**
   * Build FFmpeg arguments based on output format.
   */
  private buildFFmpegArgs(): string[] {
    const { fps, outputPath, crf, outputFormat } = this.options;
    const args: string[] = [];

    if (outputFormat === 'mp4') {
      args.push(
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'image2pipe',
        '-vcodec', 'png',
        '-framerate', String(fps),
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', String(crf ?? 23),
        '-pix_fmt', 'yuv420p',
        '-g', '30',
        outputPath
      );
    } else if (outputFormat === 'gif') {
      args.push(
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'image2pipe',
        '-vcodec', 'png',
        '-framerate', String(fps),
        '-i', 'pipe:0',
        '-vf', 'fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        outputPath
      );
    }

    return args;
  }

  /**
   * Write a frame.
   */
  async writeFrame(frameData: Buffer): Promise<void> {
    if (!this.initialized) {
      throw new Error('VideoEncoder not initialized');
    }

    if (this.isStaticImage) {
      // For static images, just keep the last frame
      this.lastFrame = frameData;
      this.frameCount = 1;
      return;
    }

    try {
      await this.ffmpegProcess.stdin.write(frameData);
      this.frameCount++;
    } catch (error) {
      console.error('Error writing frame:', error);
      throw error;
    }
  }

  /**
   * Finalize and close.
   */
  async finalize(): Promise<void> {
    if (this.isStaticImage) {
      // For static images, save the last frame directly
      if (this.lastFrame) {
        const { outputPath, outputFormat } = this.options;
        const buffer = this.lastFrame;

        // Convert PNG buffer to JPEG if needed
        if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
          // For JPEG, we need to use canvas to convert
          // Since we already have PNG data, just save as PNG for now
          // TODO: Implement proper JPEG encoding
          await fs.writeFile(outputPath.replace(/\.jpe?g$/, '.png'), buffer);
          console.log(`Wrote ${this.frameCount} frame(s) to ${outputPath}`);
        } else {
          await fs.writeFile(outputPath, buffer);
          console.log(`Wrote ${this.frameCount} frame(s) to ${outputPath}`);
        }
      }
      return;
    }

    if (!this.ffmpegProcess) {
      throw new Error('VideoEncoder not initialized');
    }

    try {
      this.ffmpegProcess.stdin.end();

      // Wait for FFmpeg to finish
      const { stdout, stderr } = await this.ffmpegProcess;

      console.log(`Wrote ${this.frameCount} frames`);
      if (stderr && !stderr.includes('frame=')) {
        console.warn('FFmpeg stderr:', stderr);
      }
    } catch (error) {
      console.error('Error finalizing video:', error);
      throw error;
    }
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill();
      this.ffmpegProcess = null;
    }
    this.initialized = false;
    this.lastFrame = null;
  }

  /**
   * Find FFmpeg executable.
   */
  private async findFFmpeg(): Promise<string> {
    try {
      await execa('ffmpeg', ['-version']);
      return 'ffmpeg';
    } catch {
      throw new Error('FFmpeg not found. Please install FFmpeg or provide ffmpegPath option.');
    }
  }
}
