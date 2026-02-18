import { useEffect, useCallback, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  Tooltip,
  Badge,
  Input,
  Textarea,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Label,
  Select,
  Spinner,
} from '@fluentui/react-components';
import {
  ArrowLeftRegular,
  SaveRegular,
  PlayRegular,
  CursorClickRegular,
  SettingsRegular,
  ArrowUndoRegular,
  ArrowRedoRegular,
  VideoRegular,
  ArrowExportRegular,
  DeleteRegular,
} from '@fluentui/react-icons';
import { useDesignerStore } from '@/stores/designerStore';
import { useProjectStore } from '@/stores/projectStore';
import { exportDemoToFolder } from '@/services/exportService';
import * as groupService from '@/services/groupService';
import * as creatorService from '@/services/creatorService';
import { validateVideoFile } from '@/utils/validation';
import { saveVideo, extractVideoMetadata, generateThumbnail, getVideoUrl } from '@/services/videoService';
import { MSG } from '@/constants/messages';
import VideoUploader from '@/components/designer/VideoUploader';
import DesignerCanvas from '@/components/designer/DesignerCanvas';
import VideoControls from '@/components/designer/VideoControls';
import Timeline from '@/components/designer/Timeline';
import PropertyPanel from '@/components/designer/PropertyPanel';
import ClickPointList from '@/components/designer/ClickPointList';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import type { DemoCreator, DemoGroup, VideoInfo } from '@/types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    height: '48px',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    gap: tokens.spacingHorizontalS,
  },
  topBarTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  topBarTitleInput: {
    flex: 1,
    minWidth: 0,
  },
  demoNumberBadge: {
    flexShrink: 0,
  },
  settingsPopover: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacingVerticalM,
    minWidth: '320px',
  },
  settingsField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacingVerticalXS,
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '240px',
    minWidth: '240px',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarTools: {
    padding: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  sidebarContent: {
    flex: 1,
    overflow: 'auto',
    padding: tokens.spacingVerticalS,
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  canvasArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: tokens.spacingVerticalM,
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  controlsArea: {
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  rightPanel: {
    width: '300px',
    minWidth: '300px',
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'auto',
    padding: tokens.spacingVerticalM,
  },
});

export default function DesignerPage() {
  const classes = useStyles();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoReplaceInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoUrlLoading, setIsVideoUrlLoading] = useState(false);
  const [showVideoReplaceConfirm, setShowVideoReplaceConfirm] = useState(false);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [creators, setCreators] = useState<DemoCreator[]>([]);

  // requestAnimationFrame で高精度にcurrentTimeを追跡 (~60Hz)
  useEffect(() => {
    const tick = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        setCurrentTime(video.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const {
    currentProject,
    isDirty,
    activeTool,
    undoStack,
    redoStack,
    setProject,
    setActiveTool,
    updateProjectMeta,
    undo,
    redo,
    markSaved,
    replaceVideo,
    resetDesigner,
  } = useDesignerStore();

  const { getProject, updateProject, createProject, deleteProject } = useProjectStore();

  // プロジェクト読み込み
  useEffect(() => {
    if (projectId) {
      getProject(projectId).then((p) => {
        if (p) setProject(p);
      });
      return;
    }
    resetDesigner();
    setVideoUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [projectId, getProject, setProject, resetDesigner]);

  const loadGroups = useCallback(async () => {
    try {
      const all = await groupService.getAllGroups();
      setGroups(all);
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const loadCreators = useCallback(async () => {
    try {
      const all = await creatorService.getAllCreators();
      setCreators(all);
    } catch {
      setCreators([]);
    }
  }, []);

  useEffect(() => {
    void loadCreators();
  }, [loadCreators]);

  // 動画URL管理 (SAS URL)
  useEffect(() => {
    if (!currentProject?.video?.videoId) {
      setVideoUrl(null);
      setIsVideoUrlLoading(false);
      return;
    }
    setVideoUrl(null);
    setIsVideoUrlLoading(true);
    let cancelled = false;
    void getVideoUrl(currentProject.video.videoId)
      .then((url) => {
        if (cancelled) return;
        if (url) {
          setVideoUrl(url);
        } else {
          setIsVideoUrlLoading(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setIsVideoUrlLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentProject?.video?.videoId]);

  // 自動保存 (3秒デバウンス)
  useEffect(() => {
    if (!isDirty || !currentProject) return;
    const timer = setTimeout(async () => {
      if (currentProject.id) {
        await updateProject(currentProject.id, currentProject);
      }
      markSaved();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isDirty, currentProject, updateProject, markSaved]);

  // キーボードショートカット
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === ' ' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'Delete') {
        // TODO: 選択要素の削除
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleSave = useCallback(async () => {
    if (!currentProject) return;
    if (currentProject.id) {
      await updateProject(currentProject.id, currentProject);
    } else {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = currentProject;
      await createProject(rest);
    }
    markSaved();
  }, [currentProject, updateProject, createProject, markSaved]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  // onTimeUpdate はフォールバック (一時停止中のシーク等)
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
  }, []);

  /** 動画アイコンクリック → ファイル選択 */
  const handleVideoIconClick = useCallback(() => {
    if (currentProject?.video) {
      // 既に動画がある場合はファイル選択を開き、選択後に確認
      videoReplaceInputRef.current?.click();
    }
  }, [currentProject?.video]);

  /** ファイル選択後 → 確認ダイアログ */
  const handleVideoFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const validationError = validateVideoFile(file);
      if (validationError) {
        alert(validationError);
        return;
      }
      setPendingVideoFile(file);
      setShowVideoReplaceConfirm(true);
      // input をリセットして同じファイルも再選択可能に
      e.target.value = '';
    },
    [],
  );

  /** 動画差し替え実行 */
  const handleVideoReplace = useCallback(async () => {
    if (!pendingVideoFile || !currentProject) return;
    setShowVideoReplaceConfirm(false);
    try {
      const [metadata, thumbnailDataUrl, { videoId, mimeType }] = await Promise.all([
        extractVideoMetadata(pendingVideoFile),
        generateThumbnail(pendingVideoFile),
        saveVideo(pendingVideoFile, currentProject.id),
      ]);
      const videoInfo: VideoInfo = {
        videoId,
        fileName: pendingVideoFile.name,
        mimeType: mimeType as VideoInfo['mimeType'],
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        thumbnailDataUrl,
      };
      replaceVideo({ ...currentProject, video: videoInfo });
    } catch (err) {
      alert((err as Error).message || MSG.uploadFailed);
    } finally {
      setPendingVideoFile(null);
    }
  }, [pendingVideoFile, currentProject, replaceVideo]);

  /** プロジェクト削除 */
  const handleDeleteProject = useCallback(async () => {
    if (!currentProject?.id) return;
    await deleteProject(currentProject.id);
    setShowDeleteProjectConfirm(false);
    navigate('/projects');
  }, [currentProject?.id, deleteProject, navigate]);

  return (
    <div className={classes.root}>
      {/* トップバー */}
      <div className={classes.topBar}>
        <Tooltip content={MSG.designerBack} relationship="label">
          <Button
            icon={<ArrowLeftRegular />}
            appearance="subtle"
            onClick={() => navigate(-1)}
          />
        </Tooltip>
        {currentProject?.demoNumber ? (
          <Badge appearance="outline" size="medium" className={classes.demoNumberBadge}>
            #{currentProject.demoNumber}
          </Badge>
        ) : null}
        <Input
          className={classes.topBarTitleInput}
          appearance="underline"
          placeholder="デモタイトルを入力..."
          value={currentProject?.title || ''}
          onChange={(_, data) => updateProjectMeta({ title: data.value })}
        />
        {isDirty && (
          <Badge appearance="filled" color="warning" size="small">
            {MSG.designerUnsaved}
          </Badge>
        )}
        <Popover trapFocus>
          <PopoverTrigger disableButtonEnhancement>
            <Tooltip content={MSG.settingsTitle} relationship="label">
              <Button icon={<SettingsRegular />} appearance="subtle" />
            </Tooltip>
          </PopoverTrigger>
          <PopoverSurface>
            <div className={classes.settingsPopover}>
              <Text weight="semibold">{MSG.settingsTitle}</Text>
              <div className={classes.settingsField}>
                <Label>{MSG.settingsDemoTitle}</Label>
                <Input
                  value={currentProject?.title || ''}
                  onChange={(_, data) => updateProjectMeta({ title: data.value })}
                />
              </div>
              <div className={classes.settingsField}>
                <Label>{MSG.settingsDescription}</Label>
                <Textarea
                  resize="vertical"
                  rows={3}
                  value={currentProject?.description || ''}
                  onChange={(_, data) => updateProjectMeta({ description: data.value })}
                />
              </div>
              <div className={classes.settingsField}>
                <Label>{MSG.projectsGroupFilter}</Label>
                <Select
                  value={currentProject?.groupId ?? ''}
                  onChange={(_, data) => updateProjectMeta({ groupId: data.value || undefined })}
                >
                  <option value="">{MSG.projectsNoGroup}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </Select>
              </div>
              <div className={classes.settingsField}>
                <Label>{MSG.projectsCreatorFilter}</Label>
                <Select
                  value={currentProject?.creatorId ?? ''}
                  onChange={(_, data) => updateProjectMeta({ creatorId: data.value || undefined })}
                >
                  <option value="">{MSG.projectsNoCreator}</option>
                  {creators.map((creator) => (
                    <option key={creator.id} value={creator.id}>{creator.name}</option>
                  ))}
                </Select>
              </div>
              {currentProject?.demoNumber ? (
                <div className={classes.settingsField}>
                  <Label>{MSG.demoNumber}</Label>
                  <Text>#{currentProject.demoNumber}</Text>
                </div>
              ) : null}
            </div>
          </PopoverSurface>
        </Popover>
        <Tooltip content={MSG.exportDemo} relationship="label">
          <Button
            icon={<ArrowExportRegular />}
            appearance="subtle"
            disabled={!currentProject?.video}
            onClick={async () => {
              if (currentProject) {
                await handleSave();
                const folderPath = await exportDemoToFolder(currentProject);
                if (folderPath) {
                  updateProjectMeta({
                    lastExportFolderName: folderPath,
                    lastExportedAt: new Date().toISOString(),
                  });
                }
              }
            }}
          />
        </Tooltip>
        <Tooltip content={MSG.designerPreview} relationship="label">
          <Button
            icon={<PlayRegular />}
            appearance="subtle"
            disabled={!currentProject?.video}
            onClick={() => {
              if (currentProject?.id) navigate(`/player/${currentProject.id}`);
            }}
          />
        </Tooltip>
        <Tooltip content={MSG.designerDeleteProject} relationship="label">
          <Button
            icon={<DeleteRegular />}
            appearance="subtle"
            disabled={!currentProject?.id}
            onClick={() => setShowDeleteProjectConfirm(true)}
          />
        </Tooltip>
        <Tooltip content={MSG.save} relationship="label">
          <Button
            icon={<SaveRegular />}
            appearance="primary"
            onClick={handleSave}
          >
            {MSG.save}
          </Button>
        </Tooltip>
      </div>

      {/* ボディ */}
      <div className={classes.body}>
        {/* 左サイドバー */}
        <div className={classes.sidebar}>
          <div className={classes.sidebarTools}>
            <Toolbar size="small">
              <Tooltip content={currentProject?.video ? MSG.designerReplaceVideo : MSG.toolVideo} relationship="label">
                <ToolbarButton
                  icon={<VideoRegular />}
                  onClick={currentProject?.video ? handleVideoIconClick : () => setActiveTool('select')}
                />
              </Tooltip>
              <Tooltip content={MSG.toolClickPoint} relationship="label">
                <ToolbarButton
                  icon={<CursorClickRegular />}
                  appearance={activeTool === 'addClickPoint' ? 'primary' : undefined}
                  onClick={() => setActiveTool(activeTool === 'addClickPoint' ? 'select' : 'addClickPoint')}
                />
              </Tooltip>
              <ToolbarDivider />
              <Tooltip content="Undo" relationship="label">
                <ToolbarButton
                  icon={<ArrowUndoRegular />}
                  disabled={undoStack.length === 0}
                  onClick={undo}
                />
              </Tooltip>
              <Tooltip content="Redo" relationship="label">
                <ToolbarButton
                  icon={<ArrowRedoRegular />}
                  disabled={redoStack.length === 0}
                  onClick={redo}
                />
              </Tooltip>

            </Toolbar>
          </div>
          <div className={classes.sidebarContent}>
            <ClickPointList onSeek={handleSeek} />
          </div>
        </div>

        {/* 中央エリア */}
        <div className={classes.center}>
          <div className={classes.canvasArea}>
            {!currentProject?.video ? (
              <VideoUploader />
            ) : videoUrl ? (
              <DesignerCanvas
                videoRef={videoRef}
                videoUrl={videoUrl}
                currentTime={currentTime}
                onTimeUpdate={handleTimeUpdate}
                onVideoLoaded={() => setIsVideoUrlLoading(false)}
                onVideoLoadError={() => setIsVideoUrlLoading(false)}
              />
            ) : isVideoUrlLoading || !videoUrl ? (
              <div className={classes.loadingState}>
                <Spinner label={MSG.loading} size="large" />
              </div>
            ) : null}
          </div>
          {currentProject?.video && (
            <div className={classes.controlsArea}>
              <VideoControls
                videoRef={videoRef}
                currentTime={currentTime}
                duration={currentProject.video.duration}
                isPlaying={isPlaying}
                onPlayPause={togglePlayPause}
              />
              <Timeline
                duration={currentProject.video.duration}
                currentTime={currentTime}
                clickPoints={currentProject.clickPoints}
                onSeek={handleSeek}
              />
            </div>
          )}
        </div>

        {/* 右プロパティパネル */}
        <div className={classes.rightPanel}>
          <PropertyPanel />
        </div>
      </div>

      {/* 動画差し替え用の隠し input */}
      <input
        ref={videoReplaceInputRef}
        type="file"
        accept="video/mp4,video/webm"
        hidden
        onChange={handleVideoFileSelect}
      />

      {/* 動画差し替え確認ダイアログ */}
      <ConfirmDialog
        open={showVideoReplaceConfirm}
        title={MSG.designerReplaceVideo}
        message={MSG.uploadReplaceConfirm}
        confirmLabel={MSG.confirm}
        danger
        onConfirm={handleVideoReplace}
        onCancel={() => {
          setShowVideoReplaceConfirm(false);
          setPendingVideoFile(null);
        }}
      />

      {/* プロジェクト削除確認ダイアログ */}
      <ConfirmDialog
        open={showDeleteProjectConfirm}
        title={MSG.designerDeleteProject}
        message={MSG.designerDeleteProjectConfirm}
        confirmLabel={MSG.delete}
        danger
        onConfirm={handleDeleteProject}
        onCancel={() => setShowDeleteProjectConfirm(false)}
      />
    </div>
  );
}
