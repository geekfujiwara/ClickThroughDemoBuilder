import { useCallback, useRef, useState } from 'react';
import { makeStyles, shorthands, tokens, Text, Button, ProgressBar } from '@fluentui/react-components';
import { ArrowUploadRegular } from '@fluentui/react-icons';
import { useMsg } from '@/hooks/useMsg';
import { useDesignerStore } from '@/stores/designerStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { validateVideoFile } from '@/utils/validation';
import { saveVideo, extractVideoMetadata, generateThumbnail } from '@/services/videoService';
import { compressVideo, isCompressionSupported } from '@/services/videoCompressionService';
import { createDefaultProject, type VideoInfo } from '@/types';

/** これを超えるサイズ、または解像度が上限超の場合に圧縮する */
const COMPRESS_SIZE_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

type UploadStage = 'idle' | 'preparing' | 'compressing' | 'uploading';

const useStyles = makeStyles({
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusXLarge,
    padding: '64px',
    cursor: 'pointer',
    transition: 'border-color 200ms, background-color 200ms',
    backgroundColor: tokens.colorNeutralBackground1,
    gap: tokens.spacingVerticalM,
    ':hover': {
      ...shorthands.borderColor(tokens.colorBrandStroke1),
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  dropzoneActive: {
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    marginTop: tokens.spacingVerticalS,
  },
  loading: {
    marginTop: tokens.spacingVerticalS,
  },
  progressWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: tokens.spacingVerticalM,
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: tokens.spacingHorizontalS,
  },
});

export default function VideoUploader() {
  const MSG = useMsg();
  const classes = useStyles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [compressPct, setCompressPct] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);

  const isProcessing = stage !== 'idle';

  const { setProject } = useDesignerStore();
  const { createProject } = useProjectStore();
  const { selectedCreator } = useAuthStore();

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const validationError = validateVideoFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setStage('preparing');
      setCompressPct(0);
      setUploadPct(0);
      try {
        // 動画のメタデータ解析 + サムネイル生成を並行
        const [metadata, thumbnailDataUrl] = await Promise.all([
          extractVideoMetadata(file),
          generateThumbnail(file),
        ]);

        // ── 変動圧縮: 解像度が上限超、または一定サイズ超のときのみ圧縮 ──
        let uploadFile = file;
        let outWidth = metadata.width;
        let outHeight = metadata.height;
        let outMime = file.type as VideoInfo['mimeType'];
        let outName = file.name;

        const overResolution = metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT;
        const shouldCompress =
          isCompressionSupported() && (overResolution || file.size > COMPRESS_SIZE_THRESHOLD);

        if (shouldCompress) {
          setStage('compressing');
          try {
            const result = await compressVideo(
              file,
              { width: metadata.width, height: metadata.height },
              {
                maxWidth: MAX_WIDTH,
                maxHeight: MAX_HEIGHT,
                maxFps: 30,
                onProgress: (f) => setCompressPct(f),
              },
            );
            if (result.compressed) {
              uploadFile = result.file;
              outWidth = result.width;
              outHeight = result.height;
              outMime = 'video/mp4';
              outName = result.file.name;
            }
            setCompressPct(1);
          } catch {
            // 圧縮失敗時は元動画をそのままアップロード
            uploadFile = file;
          }
        }

        const videoInfo: VideoInfo = {
          videoId: '',
          fileName: outName,
          mimeType: outMime,
          duration: metadata.duration,
          width: outWidth,
          height: outHeight,
          thumbnailDataUrl,
        };

        // ファイル名からタイトルを生成（拡張子なし）
        const titleFromFile = file.name.replace(/\.[^.]+$/, '');

        const projectData = createDefaultProject({
          video: videoInfo,
          title: titleFromFile,
          creatorId: selectedCreator?.id,
        });
        const project = await createProject(projectData);

        // プロジェクト作成後に動画をアップロード
        setStage('uploading');
        const { videoId } = await saveVideo(uploadFile, project.id, (f) => setUploadPct(f));
        project.video.videoId = videoId;
        setProject(project);

        // URLを更新してデザイナーに遷移
        window.history.replaceState(null, '', `/designer/${project.id}`);
      } catch (e) {
        setError((e as Error).message || MSG.uploadFailed);
      } finally {
        setStage('idle');
      }
    },
    [setProject, createProject, selectedCreator],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div>
      <div
        className={`${classes.dropzone} ${isDragging ? classes.dropzoneActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <ArrowUploadRegular fontSize={48} />
        <Text align="center" style={{ whiteSpace: 'pre-line' }}>
          {MSG.uploadDropzone}
        </Text>
        <Button appearance="primary" disabled={isProcessing}>
          ファイルを選択
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm"
          hidden
          onChange={handleFileInput}
        />
      </div>
      {isProcessing && (
        <div className={classes.progressWrap}>
          {stage === 'preparing' && (
            <Text align="center">{MSG.uploadStagePreparing}</Text>
          )}
          {stage === 'compressing' && (
            <>
              <div className={classes.progressLabel}>
                <Text size={200}>{MSG.uploadStageCompressing}</Text>
                <Text size={200}>{Math.round(compressPct * 100)}%</Text>
              </div>
              <ProgressBar value={compressPct} thickness="large" />
            </>
          )}
          {stage === 'uploading' && (
            <>
              <div className={classes.progressLabel}>
                <Text size={200}>{MSG.uploadStageUploading}</Text>
                <Text size={200}>{Math.round(uploadPct * 100)}%</Text>
              </div>
              <ProgressBar value={uploadPct} thickness="large" />
            </>
          )}
        </div>
      )}
      {error && (
        <Text className={classes.error} align="center">
          {error}
        </Text>
      )}
    </div>
  );
}
