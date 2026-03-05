const CLOUD_NAME = 'dilt6tl9q';
const UPLOAD_PRESET = 'Notaforge';

export async function uploadToCloudinary(file: File): Promise<{ url: string; publicId: string } | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  // Set resource_type based on file
  const fileType = file.type.split('/')[0];
  const resourceType = ['image', 'video', 'audio'].includes(fileType) ? fileType === 'audio' ? 'video' : fileType : 'raw';

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
      { method: 'POST', body: formData }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message || 'Upload failed');
    }

    const data = await res.json();
    return { url: data.secure_url, publicId: data.public_id };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}
