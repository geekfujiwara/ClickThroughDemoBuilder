import { useCallback, useRef, useState } from 'react';
import { makeStyles, shorthands, tokens, Text, Button } from '@fluentui/react-components';
import { ArrowUploadRegular } from '@fluentui/react-icons';
import { MSG } from '@/constants/messages';
import { useDesignerStore } from '@/stores/designerStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { validateVideoFile } from '@/utils/validation';
import { saveVideo, extractVideoMetadata, generateThumbnail } from '@/services/videoService';
import { createDefaultProject, type VideoInfo } from '@/types';

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
});

export default function VideoUploader() {
  const classes = useStyles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

      setIsProcessing(true);
      try {
        // 動画のメタデータ解析 + サムネイル生成を並行
        const [metadata, thumbnailDataUrl] = await Promise.all([
          extractVideoMetadata(file),
          generateThumbnail(file),
        ]);

        const videoInfo: VideoInfo = {
          videoId: '',
          fileName: file.name,
          mimeType: file.type as VideoInfo['mimeType'],
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
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
        const { videoId } = await saveVideo(file, project.id);
        project.video.videoId = videoId;
        setProject(project);

        // URLを更新してデザイナーに遷移
        window.history.replaceState(null, '', `/designer/${project.id}`);
      } catch (e) {
        setError((e as Error).message || MSG.uploadFailed);
      } finally {
        setIsProcessing(false);
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
        <Text className={classes.loading} align="center">
          {MSG.loading}
        </Text>
      )}
      {error && (
        <Text className={classes.error} align="center">
          {error}
        </Text>
      )}
    </div>
  );
}
