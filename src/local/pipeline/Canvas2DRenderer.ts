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

  constructor(canvas: Canvas) {
    this._canvas = canvas;
    this.ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  }

  get canvas(): Canvas {
    return this._canvas;
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
      this.wrapText(text, x, y, width, height, fontSize, style);
    }

    // Draw stroke
    if (style.strokeColor && style.strokeWidth) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeText(text, x, y);
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
}