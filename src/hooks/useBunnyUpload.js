// src/hooks/useBunnyUpload.js
// Reusable Bunny.net Stream upload: create video slot → signed TUS ticket →
// resumable upload (with progress) straight to Bunny, never touching the
// library's master AccessKey (see src/shared/bunnyUpload.js). Extracted from
// the class-recording flow in UploadRecording.jsx once a second call site
// (the expert intro-video field in ExpertProfileEdit.jsx) needed the same
// upload dance.
import { useRef, useState } from "react";
import api from "../shared/apiClient";
import { uploadToBunny } from "../shared/bunnyUpload";

export function useBunnyUpload({ createUrl, signUrl }) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef(null);

  const upload = async (file, { title } = {}) => {
    setUploading(true);
    setProgress(0);
    try {
      const { data: createData } = await api.post(createUrl, { title });
      const videoId = createData.video_id;

      const { data: ticket } = await api.post(signUrl, { video_id: videoId });

      await uploadToBunny(file, ticket, {
        onProgress: setProgress,
        onUploadStart: (u) => { uploadRef.current = u; },
      });

      return videoId;
    } finally {
      setUploading(false);
    }
  };

  const cancel = () => uploadRef.current?.abort();

  return { upload, cancel, progress, uploading };
}
