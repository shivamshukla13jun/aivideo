import { Response } from 'express';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { VideoProject, Track, VideoClip } from '../../src/types/index';

export const getVideoProjects = async (req: AuthRequest, res: Response) => {
  const projects = Array.from(db.videoProjects.values());
  return res.json(projects);
};

export const getVideoProjectById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const project = db.videoProjects.get(id);
  if (!project) {
    return res.status(404).json({ message: 'Video project not found' });
  }
  return res.json(project);
};

/**
 * Rebuilds the auto-generated timeline tracks (V1 comic pages, V4 subtitles,
 * A1 narration) from the chapter's latest saved pages, scenes and narrations.
 */
const buildChapterTracks = (chapterId: string, baseTracks: Track[]): Track[] => {
  const pages = (db.pages.get(chapterId) || []).sort((a, b) => a.pageNumber - b.pageNumber);
  const scenes = db.scenes.get(chapterId) || [];
  const narrations = db.narrations.get(chapterId) || [];

  const pageClips: VideoClip[] = [];
  const narrationClips: VideoClip[] = [];
  const subtitleClips: VideoClip[] = [];

  let currentTimelineTime = 0;

  pages.forEach((pg, index) => {
    const pageScene = scenes.find((s) => s.pageId === pg.id);
    const clipDuration = pageScene ? Math.max(4, pageScene.duration) : 5;

    // Comic Page Clip on V1 with Cinematic Camera Preset keyframes!
    pageClips.push({
      id: `clp_v1_${pg.id}`,
      trackId: 'trk_v1',
      assetId: pg.id,
      title: `Page ${pg.pageNumber}`,
      mediaType: 'image',
      url: pg.imageUrl,
      start: currentTimelineTime,
      duration: clipDuration,
      transform: {
        x: 0,
        y: 0,
        scaleX: 1.0,
        scaleY: 1.0,
        rotation: 0,
        opacity: 1.0
      },
      keyframes: [
        { id: `kf_1_${index}`, time: 0, value: 1.0, property: 'scaleX', interpolation: 'linear' },
        { id: `kf_2_${index}`, time: clipDuration, value: 1.15, property: 'scaleX', interpolation: 'linear' },
        { id: `kf_3_${index}`, time: 0, value: 1.0, property: 'scaleY', interpolation: 'linear' },
        { id: `kf_4_${index}`, time: clipDuration, value: 1.15, property: 'scaleY', interpolation: 'linear' }
      ],
      effects: [
        { id: `eff_vignette_${index}`, type: 'vignette', enabled: true, value: 20 }
      ],
      transitionIn: { type: 'crossDissolve', duration: 0.5 }
    });

    // Subtitle Clip on V4 if scene dialogue exists
    if (pageScene && (pageScene.narration || pageScene.dialogue)) {
      subtitleClips.push({
        id: `clp_sub_${pageScene.id}`,
        trackId: 'trk_v4',
        title: `Scene ${pageScene.sceneNumber} Captions`,
        mediaType: 'text',
        text: pageScene.dialogue || pageScene.narration,
        textStyle: {
          fontFamily: 'Inter',
          fontSize: 28,
          fontWeight: '600',
          color: '#FFFFFF',
          backgroundColor: 'rgba(0,0,0,0.65)',
          align: 'center',
          letterSpacing: 0.5,
          lineHeight: 1.3
        },
        start: currentTimelineTime,
        duration: clipDuration,
        transform: { x: 0, y: 380, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        keyframes: [],
        effects: []
      });
    }

    currentTimelineTime += clipDuration;
  });

  // Add generated narration audio clip on A1
  if (narrations.length > 0 && narrations[0].audioUrl) {
    narrationClips.push({
      id: `clp_a1_nar_${narrations[0].id}`,
      trackId: 'trk_a1',
      title: 'Full Chapter Narration',
      mediaType: 'narration',
      url: narrations[0].audioUrl,
      start: 0,
      duration: Math.max(currentTimelineTime, narrations[0].duration || 15),
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      keyframes: [],
      effects: [],
      volume: 1.0
    });
  }

  return baseTracks.map((trk) => {
    if (trk.id === 'trk_v1') return { ...trk, clips: pageClips };
    if (trk.id === 'trk_v4') return { ...trk, clips: subtitleClips };
    if (trk.id === 'trk_a1') return { ...trk, clips: narrationClips };
    return trk;
  });
};

export const createVideoProject = async (req: AuthRequest, res: Response) => {
  const { chapterId, title, settings, autoGenerateFromChapter } = req.body;

  const defaultTracks: Track[] = [
    { id: 'trk_v5', name: 'V5 Graphics', type: 'video', clips: [], locked: false, hidden: false, muted: false, solo: false, height: 64 },
    { id: 'trk_v4', name: 'V4 Subtitles', type: 'text', clips: [], locked: false, hidden: false, muted: false, solo: false, height: 64 },
    { id: 'trk_v3', name: 'V3 Overlays', type: 'video', clips: [], locked: false, hidden: false, muted: false, solo: false, height: 64 },
    { id: 'trk_v2', name: 'V2 Effects', type: 'video', clips: [], locked: false, hidden: false, muted: false, solo: false, height: 64 },
    { id: 'trk_v1', name: 'V1 Comic Pages', type: 'video', clips: [], locked: false, hidden: false, muted: false, solo: false, height: 64 },
    { id: 'trk_a1', name: 'A1 Narration', type: 'audio', clips: [], locked: false, hidden: false, muted: false, solo: false, height: 64 },
    { id: 'trk_a2', name: 'A2 Dialogue', type: 'audio', clips: [], locked: false, hidden: false, muted: false, solo: false, height: 64 },
    { id: 'trk_a3', name: 'A3 Music', type: 'audio', clips: [], locked: false, hidden: false, muted: false, solo: false, height: 64 },
    { id: 'trk_a4', name: 'A4 SFX', type: 'audio', clips: [], locked: false, hidden: false, muted: false, solo: false, height: 64 }
  ];

  const projectId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

  let createdTracks = defaultTracks;

  // If auto-generate requested for a chapter, populate clips automatically!
  if (chapterId && autoGenerateFromChapter) {
    createdTracks = buildChapterTracks(chapterId, defaultTracks);
  }

  const project: VideoProject = {
    id: projectId,
    chapterId,
    title: title || 'Untitled Comic Video Project',
    settings: settings || {
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: '16:9',
      quality: 'high'
    },
    tracks: createdTracks,
    markers: [
      { id: 'mrk_1', time: 0, label: 'Intro', color: '#10B981' },
      { id: 'mrk_2', time: 10, label: 'Climax', color: '#EF4444' }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.videoProjects.set(projectId, project);

  // Update chapter status
  if (chapterId) {
    const chapter = db.chapters.get(chapterId);
    if (chapter) {
      db.chapters.set(chapterId, { ...chapter, videoProjectId: projectId, status: 'video-editing', updatedAt: new Date().toISOString() });
    }
  }

  return res.status(201).json(project);
};

export const updateVideoProject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const project = db.videoProjects.get(id);
  if (!project) {
    return res.status(404).json({ message: 'Video project not found' });
  }

  const updated: VideoProject = {
    ...project,
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  db.videoProjects.set(id, updated);
  return res.json(updated);
};

export const deleteVideoProject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!db.videoProjects.has(id)) {
    return res.status(404).json({ message: 'Video project not found' });
  }

  db.videoProjects.delete(id);
  return res.json({ message: 'Video project deleted' });
};

/**
 * Re-syncs a project's auto-generated tracks (V1 pages, V4 scene subtitles,
 * A1 narration) from the chapter's latest saved pages, scenes and narrations.
 */
export const syncVideoProject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const project = db.videoProjects.get(id);
  if (!project) {
    return res.status(404).json({ message: 'Video project not found' });
  }
  if (!project.chapterId) {
    return res.status(400).json({ message: 'Project is not linked to a chapter' });
  }

  const generated = buildChapterTracks(project.chapterId, project.tracks);

  // Skip the write when the generated tracks are already up to date
  const unchanged = generated.every((gen) => {
    const existing = project.tracks.find((t) => t.id === gen.id);
    return existing && JSON.stringify(existing.clips) === JSON.stringify(gen.clips);
  });

  if (!unchanged) {
    project.tracks = generated;
    project.updatedAt = new Date().toISOString();
    db.videoProjects.set(id, project);
    db.saveToDisk();
  }

  return res.json(project);
};
