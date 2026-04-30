import { Render } from '../Render';
import { RenderOptions } from '../RenderOptions';
import { Source } from '../Source';
import { LocalRenderer } from './LocalRenderer';
import { LocalRenderOptions, LocalClientOptions } from './LocalRenderOptions';

export class LocalClient {
  private readonly options: LocalClientOptions;

  constructor(options: LocalClientOptions = {}) {
    this.options = options;
  }

  /**
   * Renders locally and awaits completion.
   * @param options Render options.
   * @param timeout Maximum time in seconds to wait (default 1 hour).
   */
  async render(options: LocalRenderOptions, timeout = 3600): Promise<Render[]> {
    const renderer = new LocalRenderer(options, this.options);
    return await renderer.render(timeout);
  }

  /**
   * Starts a local render but doesn't wait for completion.
   * @param options Render options.
   */
  async startRender(options: LocalRenderOptions): Promise<Render[]> {
    const renderer = new LocalRenderer(options, this.options);
    return await renderer.startRender();
  }

  /**
   * Fetches render status (always returns 'completed' for local rendering).
   * @param id Render ID.
   */
  async fetchRender(id: string): Promise<Render> {
    // Local renders are synchronous, status is always completed
    throw new Error('fetchRender not supported for local rendering');
  }
}