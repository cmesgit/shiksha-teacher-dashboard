// src/shared/bunnyUpload.js
// Shared TUS upload against Bunny Stream. The backend never hands the
// browser its master AccessKey anymore — it returns a per-video, time-
// limited ticket {video_id, library_id, expire, signature} (see
// config/bunny_signing.py), which this uses against Bunny's TUS endpoint
// instead of the old plain PUT + AccessKey header.
import * as tus from "tus-js-client";

const TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";

// ticket: {video_id, library_id, expire, signature} from a *-signed-upload-url
// backend endpoint. onUploadStart(upload) is called synchronously with the
// tus.Upload instance so a caller can stash it for cancellation (upload.abort()).
export function uploadToBunny(file, ticket, { onProgress, onUploadStart } = {}) {
  const { video_id: videoId, library_id: libraryId, expire, signature } = ticket;
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: TUS_ENDPOINT,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expire),
        VideoId: videoId,
        LibraryId: String(libraryId),
      },
      metadata: {
        filetype: file.type || "application/octet-stream",
        title: file.name,
      },
      onError: reject,
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve(videoId),
    });
    onUploadStart?.(upload);
    upload.start();
  });
}
