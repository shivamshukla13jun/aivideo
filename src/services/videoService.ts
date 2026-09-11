import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';

const execAsync = promisify(exec);

export interface RenderSceneOptions {
  id: string;
  imageUrl: string;
  duration: number;
  effect: string;
  subtitles?: Array<{ text: string; startTime: number; endTime: number }>;
}

export interface RenderProjectOptions {
  projectId?: string;
  title?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  fps?: number;
  scenes: RenderSceneOptions[];
  audioUrl?: string;
}

export interface VideoMetadata {
  filename: string;
  videoUrl: string;
  fileSize: number;
  duration: number;
  createdAt: string;
}

export class VideoService {
  private outputDir: string;
  private uploadsDir: string;

  constructor() {
    this.outputDir = config.videosDir;
    this.uploadsDir = config.uploadsDir;

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Checks if ffmpeg is executable on the system PATH
   */
  async checkFFmpeg(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all rendered videos in the storage directory
   */
  async listVideos(): Promise<VideoMetadata[]> {
    if (!fs.existsSync(this.outputDir)) return [];

    const files = fs.readdirSync(this.outputDir);
    const videoFiles = files.filter((f) => f.endsWith('.mp4') || f.endsWith('.webm'));

    return videoFiles.map((file) => {
      const filePath = path.join(this.outputDir, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        videoUrl: `/storage/videos/${file}`,
        fileSize: stats.size,
        duration: 0,
        createdAt: stats.birthtime.toISOString(),
      };
    });
  }

  /**
   * Renders slideshow video with effects using FFmpeg if available
   */
  async renderSlideshow(options: RenderProjectOptions): Promise<{ videoUrl: string; filename: string }> {
    const isFFmpegAvailable = await this.checkFFmpeg();
    if (!isFFmpegAvailable) {
      throw new Error(
        'FFmpeg is not installed on the system PATH. You can export directly from the browser using the high-performance Client-Side Video Exporter in the frontend studio!'
      );
    }

    const {
      scenes,
      aspectRatio = '16:9',
      fps = 30,
      title = 'slideshow',
    } = options;

    if (!scenes || scenes.length === 0) {
      throw new Error('No scenes provided for video rendering.');
    }

    let width = 1920;
    let height = 1080;
    if (aspectRatio === '9:16') {
      width = 1080;
      height = 1920;
    } else if (aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
    }

    const filename = `${title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.mp4`;
    const outputPath = path.join(this.outputDir, filename);

    // Build FFmpeg command for image slideshow with pan/zoom effects
    // For each scene, create a zoomed/panned clip and concatenate
    const tempDir = path.join(this.outputDir, `temp_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const segmentFiles: string[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const segOutput = path.join(tempDir, `seg_${i}.mp4`);
        const duration = Math.max(2, scene.duration);
        const frames = Math.round(duration * fps);

        let zoomFilter = `zoompan=z='min(zoom+0.001,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;

        if (scene.effect === 'zoom-out') {
          zoomFilter = `zoompan=z='if(lte(zoom,1.0),1.15,max(1.0,zoom-0.001))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
        } else if (scene.effect === 'pan-left') {
          zoomFilter = `zoompan=z=1.1:x='if(lte(x,0),0,x-1)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
        } else if (scene.effect === 'pan-right') {
          zoomFilter = `zoompan=z=1.1:x='min(x+1,iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
        }

        let resolvedImageUrl = scene.imageUrl;
        if (scene.imageUrl.startsWith('/suwayomi/')) {
          resolvedImageUrl = `${config.suwayomiUrl}${scene.imageUrl.replace(/^\/suwayomi/, '')}`;
        } else if (scene.imageUrl.startsWith('/storage/uploads/')) {
          resolvedImageUrl = path.join(this.uploadsDir, scene.imageUrl.replace(/^\/storage\/uploads\//, ''));
        }

        const cmd = `ffmpeg -y -loop 1 -i "${resolvedImageUrl}" -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,${zoomFilter},trim=duration=${duration}" -c:v libx264 -pix_fmt yuv420p "${segOutput}"`;
        await execAsync(cmd);
        segmentFiles.push(segOutput);
      }

      // Concat list
      const concatListFile = path.join(tempDir, 'list.txt');
      const concatContent = segmentFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(concatListFile, concatContent);

      // Concat and mix audio if provided
      if (options.audioUrl) {
        let audioPath = options.audioUrl;
        if (options.audioUrl.startsWith('/storage/uploads/')) {
          audioPath = path.join(this.uploadsDir, options.audioUrl.replace(/^\/storage\/uploads\//, ''));
        }
        const videoTemp = path.join(tempDir, 'video_no_audio.mp4');
        await execAsync(`ffmpeg -y -f concat -safe 0 -i "${concatListFile}" -c copy "${videoTemp}"`);
        await execAsync(`ffmpeg -y -i "${videoTemp}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${outputPath}"`);
      } else {
        await execAsync(`ffmpeg -y -f concat -safe 0 -i "${concatListFile}" -c copy "${outputPath}"`);
      }

      // Cleanup temp
      fs.rmSync(tempDir, { recursive: true, force: true });

      return {
        filename,
        videoUrl: `/storage/videos/${filename}`,
      };
    } catch (error: any) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      throw new Error(`Video rendering failed: ${error.message}`);
    }
  }
}

export const videoService = new VideoService();
