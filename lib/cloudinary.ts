import { API_BASE_URL } from "./api";

export async function uploadToCloudinary(file: File, folder?: string): Promise<string> {
  // 1. Try backend /api/upload first
  try {
    const backendFormData = new FormData();
    backendFormData.append("file", file, file.name || "passport.jpg");
    if (folder) backendFormData.append("folder", folder);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      body: backendFormData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.url) return data.url;
    }
  } catch (backendErr) {
    console.warn("Backend /api/upload failed, trying direct Cloudinary:", backendErr);
  }

  // 2. Direct Cloudinary
  const cloudName =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "dgz03k6l4";
  const uploadPreset =
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET || "upload";

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    if (folder) formData.append("folder", folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const json = await res.json();
      if (json.secure_url) return json.secure_url as string;
    }
  } catch (directErr) {
    console.warn("Direct Cloudinary failed, falling back to base64:", directErr);
  }

  // 3. Fallback to Base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read image"));
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

