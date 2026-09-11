export type TransitionEffect =
  | 'kenburns'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'fade'
  | 'crossfade'
  | 'wipe'
  | 'none';

export interface SubtitleStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  position: 'top' | 'center' | 'bottom';
  bold: boolean;
  italic: boolean;
  outline: boolean;
}

export interface Subtitle {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  style: SubtitleStyle;
}

export interface AudioClip {
  id: string;
  url: string;
  name: string;
  duration: number;
  startTime: number;
  volume: number;
  type: 'voiceover' | 'bgm' | 'sfx';
}

export type ImageFitMode = 'contain' | 'cover' | 'custom';

export interface ImageCropSettings {
  fitMode: ImageFitMode; // 'contain' (पूरी इमेज बिना कटे), 'cover' (स्क्रीन भरें), 'custom' (फ्री-साइज़)
  scale: number; // 0.5 to 3.0 (default: 1.0)
  positionX: number; // -100 to +100 (%) (default: 0)
  positionY: number; // -100 to +100 (%) (default: 0)
  rotate?: number; // 0, 90, 180, 270 (default: 0)
  backgroundBlur?: boolean; // true / false (default: true)
  backgroundColor?: string; // hex color (default: '#000000')
}

export const DEFAULT_IMAGE_CROP: ImageCropSettings = {
  fitMode: 'contain',
  scale: 1.0,
  positionX: 0,
  positionY: 0,
  rotate: 0,
  backgroundBlur: true,
  backgroundColor: '#000000',
};

export interface Scene {
  id: string;
  slideNumber?: number;
  title?: string;
  imageUrl: string;
  duration: number;
  effect: TransitionEffect;
  narration?: string;
  subtitles: Subtitle[];
  audioClips: AudioClip[];
  imageCrop?: ImageCropSettings;
}

export interface VideoProject {
  id: string;
  title: string;
  description?: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  fps: number;
  width: number;
  height: number;
  scenes: Scene[];
  totalDuration: number;
  bgMusicUrl?: string;
  bgMusicVolume?: number;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 34,
  fontFamily: 'Outfit, Inter, sans-serif',
  color: '#FFFFFF',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  position: 'bottom',
  bold: true,
  italic: false,
  outline: true,
};

export const ASPECT_RATIOS: Record<'16:9' | '9:16' | '1:1', { width: number; height: number; label: string }> = {
  '16:9': { width: 1920, height: 1080, label: '16:9 YouTube / Standard' },
  '9:16': { width: 1080, height: 1920, label: '9:16 TikTok / Reels / Shorts' },
  '1:1': { width: 1080, height: 1080, label: '1:1 Square / Post' },
};
