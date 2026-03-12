export const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';
const UPLOAD_PRESET = 'galleryos'; // your unsigned preset name

export type UploadResult = {
    url: string;
    mediaType: 'image' | 'video' | 'audio';
};

export const uploadToCloudinary = async (
    file: File,
    onProgress?: (percent: number) => void,
    resourceType: 'auto' | 'raw' = 'auto'
): Promise<UploadResult> => {
    if (CLOUD_NAME === 'demo') {
        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += 20;
                if (onProgress) onProgress(progress);
                if (progress >= 100) {
                    clearInterval(interval);
                    const isVideo = file.type.startsWith('video');
                    const isAudio = file.type.startsWith('audio');
                    resolve({
                        url: isVideo ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                            : isAudio ? "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                                : "https://picsum.photos/seed/newart/800/600",
                        mediaType: isVideo ? 'video' : isAudio ? 'audio' : 'image'
                    });
                }
            }, 500);
        });
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                const mediaType = file.type.startsWith('video') ? 'video'
                    : file.type.startsWith('audio') ? 'audio'
                        : 'image';
                resolve({ url: data.secure_url, mediaType });
            } else {
                reject(new Error('Upload failed'));
            }
        };

        xhr.onerror = () => reject(new Error('Upload error'));
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);
        xhr.send(formData);
    });
};
