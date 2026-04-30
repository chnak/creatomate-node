import { mat4 } from 'gl-matrix';

/**
 * 3D Transform Matrix operations for perspective projection.
 */
export class TransformMatrix {
  /**
   * Create identity matrix.
   */
  static identity(): mat4 {
    return mat4.create();
  }

  /**
   * Create translation matrix.
   */
  static translate(x: number, y: number, z: number): mat4 {
    const m = mat4.create();
    mat4.translate(m, m, [x, y, z]);
    return m;
  }

  /**
   * Create rotation matrix around X axis.
   */
  static rotateX(angle: number): mat4 {
    const m = mat4.create();
    mat4.rotateX(m, m, angle);
    return m;
  }

  /**
   * Create rotation matrix around Y axis.
   */
  static rotateY(angle: number): mat4 {
    const m = mat4.create();
    mat4.rotateY(m, m, angle);
    return m;
  }

  /**
   * Create rotation matrix around Z axis.
   */
  static rotateZ(angle: number): mat4 {
    const m = mat4.create();
    mat4.rotateZ(m, m, angle);
    return m;
  }

  /**
   * Create scale matrix.
   */
  static scale(sx: number, sy: number, sz: number = 1): mat4 {
    const m = mat4.create();
    mat4.scale(m, m, [sx, sy, sz]);
    return m;
  }

  /**
   * Create perspective projection matrix.
   */
  static perspective(fov: number, aspect: number, near: number, far: number): mat4 {
    const m = mat4.create();
    mat4.perspective(m, fov, aspect, near, far);
    return m;
  }

  /**
   * Multiply two matrices.
   */
  static multiply(a: mat4, b: mat4): mat4 {
    return mat4.multiply(mat4.create(), a, b);
  }

  /**
   * Create full transform from element properties.
   */
  static fromElementProps(props: {
    x?: number;
    y?: number;
    xAnchor?: number | string;
    yAnchor?: number | string;
    xScale?: number | string;
    yScale?: number | string;
    xRotation?: number | string;
    yRotation?: number | string;
    zRotation?: number | string;
    perspective?: number | string;
    backfaceVisible?: boolean;
  }): { matrix: mat4; perspective: number; backfaceVisible: boolean } {
    let matrix = mat4.create();

    // Parse values
    const x = typeof props.x === 'number' ? props.x : 0;
    const y = typeof props.y === 'number' ? props.y : 0;
    const xScale = typeof props.xScale === 'number' ? props.xScale / 100 : 1;
    const yScale = typeof props.yScale === 'number' ? props.yScale / 100 : 1;
    const xRotation = this.parseRotation(props.xRotation);
    const yRotation = this.parseRotation(props.yRotation);
    const zRotation = this.parseRotation(props.zRotation);
    const perspective = typeof props.perspective === 'number' ? props.perspective : 1000;
    const backfaceVisible = props.backfaceVisible !== false;

    // Parse anchor
    const xAnchor = this.parseAnchor(props.xAnchor, 0);
    const yAnchor = this.parseAnchor(props.yAnchor, 0);

    // Build transformation matrix
    // 1. Translate to position
    mat4.translate(matrix, matrix, [x, y, 0]);

    // 2. Apply anchor offset (move origin to anchor point)
    mat4.translate(matrix, matrix, [-xAnchor, -yAnchor, 0]);

    // 3. Apply scale
    mat4.scale(matrix, matrix, [xScale, yScale, 1]);

    // 4. Apply rotations
    if (xRotation !== 0) {
      mat4.rotateX(matrix, matrix, xRotation);
    }
    if (yRotation !== 0) {
      mat4.rotateY(matrix, matrix, yRotation);
    }
    if (zRotation !== 0) {
      mat4.rotateZ(matrix, matrix, zRotation);
    }

    return { matrix, perspective, backfaceVisible };
  }

  /**
   * Project 3D point to 2D screen coordinates.
   */
  static project3DTo2D(
    x: number,
    y: number,
    z: number,
    matrix: mat4,
    perspective: number,
    viewportWidth: number,
    viewportHeight: number
  ): { x: number; y: number; z: number; visible: boolean } {
    // Create a 4D point
    const point = [x, y, z, 1];

    // Apply transformation matrix
    const transformed = mat4.multiply(mat4.create(), matrix, point as any);

    // Apply perspective division
    const w = perspective / (perspective + transformed[2]);
    const screenX = transformed[0] * w;
    const screenY = transformed[1] * w;

    // Convert to viewport coordinates (centered)
    const viewportX = viewportWidth / 2 + screenX;
    const viewportY = viewportHeight / 2 - screenY; // Flip Y

    return {
      x: viewportX,
      y: viewportY,
      z: transformed[2],
      visible: w > 0, // Behind camera check
    };
  }

  /**
   * Parse rotation value (handles degrees, radians, turns).
   */
  static parseRotation(value: number | string | undefined): number {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value * (Math.PI / 180);

    const str = String(value).trim();
    if (str.endsWith('°')) {
      return (parseFloat(str) * Math.PI) / 180;
    }
    if (str.endsWith('turn')) {
      return parseFloat(str) * 2 * Math.PI;
    }
    if (str.endsWith('rad')) {
      return parseFloat(str);
    }
    return (parseFloat(str) || 0) * (Math.PI / 180);
  }

  /**
   * Parse anchor value (handles percentages and pixels).
   */
  static parseAnchor(value: number | string | undefined, defaultValue: number): number {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'number') return value;

    const str = String(value).trim();
    if (str.endsWith('%')) {
      return (parseFloat(str) / 100) * defaultValue;
    }
    return parseFloat(str) || defaultValue;
  }
}