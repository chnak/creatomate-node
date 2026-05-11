import { createCanvas, Canvas } from '@napi-rs/canvas';

interface RenderContext {
  time: number;
  width: number;
  height: number;
}

/**
 * Canvas 2D Renderer for drawing elements.
 */
export class Canvas2DRenderer {
  private _canvas: Canvas;
  private ctx: any;
  private _offscreenCanvas: Canvas | null = null;

  constructor(canvas: Canvas) {
    this._canvas = canvas;
    this.ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  }

  get canvas(): Canvas {
    return this._canvas;
  }

  /**
   * Get or create offscreen canvas for buffer rendering.
   */
  getOffscreenCanvas(width: number, height: number): Canvas {
    if (!this._offscreenCanvas || this._offscreenCanvas.width !== width || this._offscreenCanvas.height !== height) {
      this._offscreenCanvas = createCanvas(width, height);
    }
    return this._offscreenCanvas;
  }

  /**
   * Create a temporary buffer canvas.
   */
  createBuffer(width: number, height: number): Canvas {
    return createCanvas(width, height);
  }

  /**
   * Copy canvas contents to a buffer.
   */
  copyToBuffer(canvas: Canvas): Buffer {
    return canvas.toBuffer('image/png');
  }

  /**
   * Draw buffer to this canvas at specified position with optional alpha.
   */
  drawBuffer(buffer: Buffer, x: number, y: number, width: number, height: number, alpha = 1): void {
    // For buffer-based drawing, we need to reload the image
    // This is a limitation - for efficiency, use canvas references where possible
  }

  /**
   * Draw another canvas onto this canvas.
   */
  drawCanvas(sourceCanvas: Canvas, x: number, y: number, width: number, height: number, alpha = 1): void {
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(sourceCanvas, x, y, width, height);
    this.ctx.globalAlpha = 1;
  }

  /**
   * Clear the canvas with background color.
   */
  clear(backgroundColor: string | undefined): void {
    if (backgroundColor) {
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    } else {
      this.ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  /**
   * Draw text element.
   */
  drawText(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    style: {
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      fontStyle: string;
      fillColor: string;
      strokeColor?: string;
      strokeWidth?: number;
      shadowColor?: string;
      shadowBlur?: number;
      shadowOffsetX?: number;
      shadowOffsetY?: number;
      xAlignment?: number | string;
      yAlignment?: number | string;
    },
    _context: RenderContext
  ): void {
    const ctx = this.ctx;

    // Set font
    const fontStyle = style.fontStyle || 'normal';
    const fontWeight = style.fontWeight || 400;
    const fontSize = style.fontSize;
    const fontFamily = style.fontFamily || 'Arial';
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
    ctx.textBaseline = 'top';

    // Calculate alignment offsets
    let alignX = 0;
    let alignY = 0;

    // Handle xAlignment (0-100% or 0-1 for 0%-100%)
    // Note: For xAlignment, we measure the first line of text
    const firstLine = text.split('\n')[0];
    const textWidth = ctx.measureText(firstLine).width;
    const lineHeight = fontSize * 1.2;

    if (style.xAlignment !== undefined) {
      if (typeof style.xAlignment === 'string' && style.xAlignment.endsWith('%')) {
        alignX = (parseFloat(style.xAlignment) / 100) * width - textWidth / 2;
      } else if (typeof style.xAlignment === 'number') {
        if (style.xAlignment > 1) {
          // Assume pixel value
          alignX = style.xAlignment - textWidth / 2;
        } else {
          // Assume 0-1 range
          alignX = style.xAlignment * width - textWidth / 2;
        }
      }
    }

    // Handle yAlignment
    if (style.yAlignment !== undefined) {
      if (typeof style.yAlignment === 'string' && style.yAlignment.endsWith('%')) {
        alignY = (parseFloat(style.yAlignment) / 100) * height - lineHeight / 2;
      } else if (typeof style.yAlignment === 'number') {
        if (style.yAlignment > 1) {
          // Assume pixel value
          alignY = style.yAlignment - lineHeight / 2;
        } else {
          // Assume 0-1 range
          alignY = style.yAlignment * height - lineHeight / 2;
        }
      }
    }

    // Apply shadow
    if (style.shadowColor && style.shadowBlur) {
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur;
      ctx.shadowOffsetX = style.shadowOffsetX || 0;
      ctx.shadowOffsetY = style.shadowOffsetY || 0;
    }

    // Draw fill
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      this.wrapText(text, x + alignX, y + alignY, width, height, fontSize, style);
    }

    // Draw stroke
    if (style.strokeColor && style.strokeWidth) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeText(text, x + alignX, y + alignY);
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  /**
   * Wrap text to fit within bounds.
   */
  private wrapText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    fontSize: number,
    _style: any
  ): void {
    const lines = text.split('\n');
    let currentY = y;
    const lineHeight = fontSize * 1.2;

    for (const line of lines) {
      if (currentY + lineHeight > y + maxHeight) break;

      const words = line.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = this.ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          this.ctx.fillText(currentLine, x, currentY);
          currentLine = word;
          currentY += lineHeight;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        this.ctx.fillText(currentLine, x, currentY);
        currentY += lineHeight;
      }
    }
  }

  /**
   * Draw image from URL or file path.
   */
  async drawImage(
    source: string,
    x: number,
    y: number,
    width: number,
    height: number,
    _context: RenderContext
  ): Promise<void> {
    try {
      const { loadImage } = await import('@napi-rs/canvas');
      const image = await loadImage(source);

      // Handle aspect ratio
      const sourceAspect = image.width / image.height;
      const targetAspect = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let drawX = x;
      let drawY = y;

      if (sourceAspect > targetAspect) {
        drawHeight = width / sourceAspect;
        drawY = y + (height - drawHeight) / 2;
      } else {
        drawWidth = height * sourceAspect;
        drawX = x + (width - drawWidth) / 2;
      }

      this.ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    } catch (error) {
      console.warn('Failed to load image:', source, error);
    }
  }

  /**
   * Draw rectangle shape.
   */
  drawRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: string | undefined,
    strokeColor: string | undefined,
    strokeWidth: number,
    borderRadius: number,
    _context: RenderContext
  ): void {
    const ctx = this.ctx;

    ctx.beginPath();
    if (borderRadius > 0) {
      this.roundRect(x, y, width, height, borderRadius);
    } else {
      ctx.rect(x, y, width, height);
    }

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    if (strokeColor && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }

  /**
   * Draw ellipse shape.
   */
  drawEllipse(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: string | undefined,
    strokeColor: string | undefined,
    strokeWidth: number,
    _context: RenderContext
  ): void {
    const ctx = this.ctx;

    ctx.beginPath();
    ctx.ellipse(
      x + width / 2,
      y + height / 2,
      width / 2,
      height / 2,
      0,
      0,
      Math.PI * 2
    );

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    if (strokeColor && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }

  /**
   * Draw a rounded rectangle path.
   */
  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    const ctx = this.ctx;
    const r = Math.min(radius, width / 2, height / 2);

    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
   * Get PNG buffer from canvas.
   */
  getBuffer(): Buffer {
    return this._canvas.toBuffer('image/png');
  }

  /**
   * Save canvas to file.
   */
  async saveToFile(filePath: string): Promise<void> {
    const fs = await import('fs-extra');
    const data = this._canvas.toBuffer('image/png');
    await fs.writeFile(filePath, data);
  }

  /**
   * Set global alpha.
   */
  setOpacity(alpha: number): void {
    this.ctx.globalAlpha = alpha;
  }

  /**
   * Reset global alpha.
   */
  resetOpacity(): void {
    this.ctx.globalAlpha = 1;
  }

  /**
   * Apply blend mode.
   */
  setBlendMode(mode: string): void {
    this.ctx.globalCompositeOperation = mode as GlobalCompositeOperation;
  }

  /**
   * Reset blend mode.
   */
  resetBlendMode(): void {
    this.ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Apply blur filter.
   */
  setBlurRadius(radius: number): void {
    if (radius > 0) {
      this.ctx.filter = `blur(${radius}px)`;
    }
  }

  /**
   * Reset blur filter.
   */
  resetBlur(): void {
    this.ctx.filter = 'none';
  }

  /**
   * Begin clipping region for rectangular clip.
   */
  beginClip(x: number, y: number, width: number, height: number): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, width, height);
    this.ctx.clip();
  }

  /**
   * End clipping region.
   */
  endClip(): void {
    this.ctx.restore();
  }

  /**
   * Apply shadow.
   */
  setShadow(color: string, blur: number, offsetX: number, offsetY: number): void {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = blur;
    this.ctx.shadowOffsetX = offsetX;
    this.ctx.shadowOffsetY = offsetY;
  }

  /**
   * Reset shadow.
   */
  resetShadow(): void {
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
  }

  /**
   * Apply color overlay (e.g., 'rgba(0,0,0,0.15)').
   */
  setColorOverlay(color: string, x: number, y: number, width: number, height: number): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.restore();
  }

  /**
   * Apply rotation transform around a point.
   */
  applyRotation(radians: number, centerX: number, centerY: number): void {
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(radians);
    this.ctx.translate(-centerX, -centerY);
  }

  /**
   * Apply scale transform around a point.
   */
  applyScale(scaleX: number, scaleY: number, centerX: number, centerY: number): void {
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(scaleX, scaleY);
    this.ctx.translate(-centerX, -centerY);
  }

  /**
   * Apply both rotation and scale transforms around a point.
   */
  applyTransforms(rotation: number, scaleX: number, scaleY: number, centerX: number, centerY: number): void {
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    if (rotation !== 0) {
      this.ctx.rotate(rotation);
    }
    if (scaleX !== 1 || scaleY !== 1) {
      this.ctx.scale(scaleX, scaleY);
    }
    this.ctx.translate(-centerX, -centerY);
  }

  /**
   * Reset transform (must be called after applyTransforms).
   */
  resetTransform(): void {
    this.ctx.restore();
  }

  /**
   * Draw circular wipe transition.
   * @param fromCanvas Previous frame canvas
   * @param toCanvas Current frame canvas
   * @param progress 0-1 transition progress
   * @param xAnchor X anchor point (0-1 normalized)
   * @param yAnchor Y anchor point (0-1 normalized)
   * @param ringWidth Width of the wipe ring
   * @param ringColor Color of the ring border
   * @param fade Whether to fade the outgoing content
   */
  drawCircularWipe(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    xAnchor: number,
    yAnchor: number,
    ringWidth: number,
    ringColor: string | undefined,
    fade: boolean
  ): void {
    const ctx = this.ctx;
    const width = this._canvas.width;
    const height = this._canvas.height;
    const centerX = width * xAnchor;
    const centerY = height * yAnchor;
    const maxRadius = Math.sqrt(width * width + height * height);
    const currentRadius = maxRadius * progress;

    // Draw from canvas with clipping
    ctx.save();

    if (fade) {
      ctx.globalAlpha = 1 - progress;
    }

    // Create circular clip path
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    ctx.clip();

    // Draw the from canvas (revealed area)
    ctx.drawImage(fromCanvas, 0, 0);

    ctx.restore();

    // Draw the to canvas (wiping area)
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.globalAlpha = 1;
    ctx.drawImage(toCanvas, 0, 0);
    ctx.restore();

    // Draw ring border if specified
    if (ringColor && ringWidth > 0) {
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = ringWidth;
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /**
   * Draw fade transition.
   * @param fromCanvas Previous frame canvas
   * @param toCanvas Current frame canvas
   * @param progress 0-1 transition progress
   */
  drawFade(fromCanvas: Canvas, toCanvas: Canvas, progress: number): void {
    const ctx = this.ctx;

    // Draw from canvas with fading alpha
    ctx.globalAlpha = 1 - progress;
    ctx.drawImage(fromCanvas, 0, 0);

    // Draw to canvas with increasing alpha
    ctx.globalAlpha = progress;
    ctx.drawImage(toCanvas, 0, 0);

    ctx.globalAlpha = 1;
  }
}