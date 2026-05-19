import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import execa from 'execa';
import { nanoid } from 'nanoid';
import { ElementBase } from '../../elements/ElementBase';
import { MediaDownloader } from './MediaDownloader';

export interface AudioTrack {
  source: string;
  startTime: number;
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  trimStart?: number;
  trimDuration?: number;
}

/**
 * Audio mixer for combining multiple audio sources.
 */
export class AudioMixer {
  private static instance: AudioMixer;
  private downloader = MediaDownloader.getInstance();
  private tempDir: string;

  private constructor() {
    this.tempDir = path.join(os.tmpdir(), 'creatomate-audio');
  }

  static getInstance(): AudioMixer {
    if (!AudioMixer.instance) {
      AudioMixer.instance = new AudioMixer();
    }
    return AudioMixer.instance;
  }

  /**
   * Collect audio tracks from elements.
   */
  collectAudioTracks(elements: ElementBase<any>[], duration: number): AudioTrack[] {
    const tracks: AudioTrack[] = [];

    const processElement = (el: ElementBase<any>) => {
      const props = el.properties as any;
      const elementTime = typeof props.time === 'number' ? props.time : 0;
      const elementDuration = typeof props.duration === 'number' ? props.duration : duration;

      // Check if this is an audio or video element with audio
      if (props.source) {
        const isVideo = (el as any).type === 'video';
        const isAudio = (el as any).type === 'audio';

        if (isAudio || isVideo) {
          tracks.push({
            source: props.source,
            startTime: elementTime,
            duration: elementDuration,
            volume: typeof props.volume === 'number' ? props.volume / 100 : 1,
            fadeIn: typeof props.audioFadeIn === 'number' ? props.audioFadeIn : undefined,
            fadeOut: typeof props.audioFadeOut === 'number' ? props.audioFadeOut : undefined,
            trimStart: typeof props.trimStart === 'number' ? props.trimStart : undefined,
            trimDuration: typeof props.trimDuration === 'number' ? props.trimDuration : undefined,
          });
        }
      }

      // Process nested elements
      if (props.elements && Array.isArray(props.elements)) {
        for (const child of props.elements) {
          if (child instanceof ElementBase) {
            processElement(child);
          }
        }
      }
    };

    for (const element of elements) {
      processElement(element);
    }

    return tracks;
  }

  /**
   * Mix audio tracks and combine with video.
   */
  async mixAudio(
    videoPath: string,
    audioTracks: AudioTrack[],
    outputPath: string,
    duration: number
  ): Promise<string> {
    if (audioTracks.length === 0) {
      // No audio, just copy the video
      await fs.copy(videoPath, outputPath);
      return outputPath;
    }

    await fs.ensureDir(this.tempDir);

    // Build FFmpeg filter complex for mixing
    const filterParts: string[] = [];
    const inputParts: string[] = [];
    const streamMapping: string[] = [];
    let audioIndex = 0;

    // First, add the video input
    inputParts.push(`-i "${videoPath}"`);

    // Process each audio track
    for (const track of audioTracks) {
      // Download media to local cache if needed
      const localPath = await this.downloader.getLocalPath(track.source);

      inputParts.push(`-i "${localPath}"`);

      let filter = `[${audioIndex}:a]`;

      // Apply trim if specified
      if (track.trimStart !== undefined) {
        filter += `adelay=${Math.round(track.trimStart * 1000)}|${Math.round(track.trimStart * 1000)},`;
      }

      // Apply volume
      filter += `volume=${track.volume},`;

      // Apply fade in
      if (track.fadeIn !== undefined) {
        const fadeSamples = Math.round(track.fadeIn * 44100);
        filter += `afade=t=in:st=0:d=${track.fadeIn},`;
      }

      // Apply fade out
      if (track.fadeOut !== undefined) {
        const fadeStart = track.duration - track.fadeOut;
        filter += `afade=t=out:st=${fadeStart}:d=${track.fadeOut},`;
      }

      // Trim to duration
      filter += `atrim=0:${track.duration},asetpts=PTS-STARTPTS`;

      filterParts.push(filter);

      audioIndex++;
    }

    // Combine all audio tracks
    if (audioTracks.length > 1) {
      filterParts.push(`${audioTracks.map((_, i) => `[${i + 1}:a]`).join('')}amix=inputs=${audioTracks.length}[aout]`);
    } else {
      filterParts.push(`[1:a]anull[aout]`);
    }

    // Build FFmpeg command
    const filterComplex = filterParts.join(';');
    const command = [
      '-y',
      ...inputParts,
      '-filter_complex', filterComplex,
      '-map', '0:v',
      '-map', `[aout]`,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      outputPath
    ].join(' ');

    try {
      await execa('ffmpeg', command.split(' ').filter(s => s));
    } catch (error) {
      console.warn('Audio mixing failed, using original video:', error);
      await fs.copy(videoPath, outputPath);
    }

    return outputPath;
  }

  /**
   * Extract audio from a video file.
   */
  async extractAudio(videoPath: string, outputPath: string): Promise<string> {
    const tempAudio = path.join(this.tempDir, `audio_${nanoid()}.mp3`);

    try {
      await execa('ffmpeg', [
        '-y',
        '-i', videoPath,
        '-vn',
        '-acodec', 'libmp3lame',
        '-q:a', '2',
        tempAudio
      ]);

      await fs.move(tempAudio, outputPath, { overwrite: true });
    } catch (error) {
      console.warn('Failed to extract audio:', error);
    }

    return outputPath;
  }

  /**
   * Clear temporary files.
   */
  async clearTemp(): Promise<void> {
    try {
      await fs.remove(this.tempDir);
    } catch {}
  }
}
