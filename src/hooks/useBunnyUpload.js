// src/hooks/useBunnyUpload.js
// Reusable Bunny.net Stream upload: create video slot → signed upload URL →
// direct XHR PUT (with progress) straight to Bunny. Extracted from the
// class-recording flow in UploadRecording.jsx once a second call site
// (the expert intro-video field in ExpertProfileEdit.jsx) needed the same
// upload dance.
import { useRef, useState } from "react";
import api from "../shared/apiClient";

export function useBunnyUpload({ createUrl, signUrl }) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const xhrRef = useRef(null);

  const upload = async (file, { title } = {}) => {
    setUploading(true);
    setProgress(0);
    try {
      const { data: createData } = await api.post(createUrl, { title });
      const videoId = createData.video_id;

      const { data: signData } = await api.post(signUrl, { video_id: videoId });
      const { upload_url, access_key } = signData;

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", upload_url, true);
        xhr.setRequestHeader("AccessKey", access_key);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) resolve();
          else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(file);
      });

      return videoId;
    } finally {
      setUploading(false);
    }
  };

  const cancel = () => xhrRef.current?.abort();

  return { upload, cancel, progress, uploading };
}
