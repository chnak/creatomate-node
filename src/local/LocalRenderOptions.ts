import { RenderOptions } from '../RenderOptions';

export interface LocalClientOptions {
  /**
   * Path to FFmpeg executable. Auto-detected if not provided.
   */
  ffmpegPath?: string;

  /**
   * Output directory for rendered files. Defaults to system temp directory.
   */
  outputDir?: string;

  /**
   * Specific output file path. If provided, this exact path will be used.
   * Takes precedence over outputDir.
   */
  outputPath?: string;

  /**
   * Maximum number of parallel workers for frame rendering.
   * @default os.cpus().length
   */
  maxWorkers?: number;

  /**
   * Enable GPU acceleration for WebGL rendering.
   * @default true
   */
  gpuAcceleration?: boolean;
}

export interface LocalRenderOptions extends RenderOptions {
  /**
   * Output file path. If not provided, returns base64 data URLs.
   */
  outputPath?: string;

  /**
   * CRF value for MP4 encoding (17-51). Lower = higher quality.
   * @default 23
   */
  crf?: number;

  /**
   * GIF quality: 'fast' or 'best'.
   * @default 'fast'
   */
  gifQuality?: 'fast' | 'best';

  /**
   * Dump individual frames for debugging.
   * @default false
   */
  dumpFrames?: boolean;

  /**
   * Directory for dumped frames.
   */
  dumpPath?: string;
}