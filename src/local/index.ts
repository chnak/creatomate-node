/**
 * Local rendering module for creatomate-node.
 * Provides local video rendering capability using @napi-rs/canvas and FFmpeg.
 */

// Main entry point
export { LocalClient } from './LocalClient';
export { LocalRenderer } from './LocalRenderer';
export { LocalClientOptions, LocalRenderOptions } from './LocalRenderOptions';

// Animation
export { AnimationEngine } from './animations/AnimationEngine';
export { easingFunctions, getEasingFunction, lerp } from './animations/EasingFunctions';

// Rendering pipeline
export { Canvas2DRenderer } from './pipeline/Canvas2DRenderer';
export { FrameGenerator } from './pipeline/FrameGenerator';
export { WebGLRenderer } from './pipeline/WebGLRenderer';

// Math utilities
export { TransformMatrix } from './math/TransformMatrix';

// Encoding
export { VideoEncoder } from './encoding/VideoEncoder';

// Element renderers
export { ElementRenderer } from './elements/ElementRenderer';
export { TextElementRenderer } from './elements/TextElementRenderer';
export { ImageElementRenderer } from './elements/ImageElementRenderer';
export { ShapeRenderer } from './elements/ShapeRenderer';
export { CompositionRenderer } from './elements/CompositionRenderer';
export { VideoElementRenderer } from './elements/VideoElementRenderer';