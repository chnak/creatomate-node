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
 * Video encoder using FFmpeg for MP4/GIF output.
 */
export class VideoEncoder {
  private options: VideoEncoderOptions;
  private ffmpegProcess: any = null;
  private frameQueue: Buffer[] = [];
  private initialized: boolean = false;
  private frameCount: number = 0;

  constructor(options: VideoEncoderOptions) {
    this.options = options;
  }

  /**
   * Initialize FFmpeg process.
   */
  async initialize(): Promise<void> {
    const { outputPath, width, height, fps, outputFormat, crf, gifQuality, ffmpegPath } = this.options;

    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outputPath));

    // FFmpeg arguments
    const args = this.buildFFmpegArgs();

    // Find FFmpeg executable
    const ffmpegBin = ffmpegPath || await this.findFFmpeg();

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
    const { width, height, fps, outputPath, crf, outputFormat } = this.options;
    const args: string[] = [];

    // Use PNG image pipe format (works with @napi-rs/canvas toBuffer)
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
        '-y', outputPath
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
        '-y', outputPath
      );
    }

    return args;
  }

  /**
   * Write a frame to FFmpeg stdin.
   */
  async writeFrame(frameData: Buffer): Promise<void> {
    if (!this.initialized || !this.ffmpegProcess) {
      throw new Error('VideoEncoder not initialized');
    }

    try {
      // Wrap PNG data as simple packet
      await this.ffmpegProcess.stdin.write(frameData);
      this.frameCount++;
    } catch (error) {
      console.error('Error writing frame:', error);
      throw error;
    }
  }

  /**
   * Finalize and close FFmpeg process.
   */
  async finalize(): Promise<void> {
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
  }

  /**
   * Find FFmpeg executable.
   */
  private async findFFmpeg(): Promise<string> {
    try {
      const result = await execa('ffmpeg', ['-version']);
      return 'ffmpeg';
    } catch {
      throw new Error('FFmpeg not found. Please install FFmpeg or provide ffmpegPath option.');
    }
  }
}