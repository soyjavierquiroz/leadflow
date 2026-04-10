"use client";

const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;
const OUTPUT_MIME_TYPE = "image/webp";

const UI_IDENTITY_MAX_DIMENSION = 500;
const UI_IDENTITY_MAX_BYTES = 150 * 1024;
const UI_IDENTITY_QUALITY_STEPS = [0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5];
const UI_IDENTITY_SCALE_STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6];

const FUNNEL_ASSET_QUALITY_STEPS = [0.85, 0.83, 0.8];

export const UI_IDENTITY_AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";
export const UI_IDENTITY_BRANDING_ACCEPT =
  "image/png,image/jpeg,image/webp,image/svg+xml";
export const UI_IDENTITY_UPLOAD_HINT =
  "PNG, JPG, WEBP o SVG. Se convierte a WebP en máximo 500x500px y hasta 150KB.";
export const FUNNEL_ASSET_IMAGE_ACCEPT = "image/*";

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No pudimos leer la imagen seleccionada."));
    };

    image.src = objectUrl;
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No pudimos optimizar la imagen."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });

const replaceExtension = (fileName: string, nextExtension: string) => {
  const normalizedExtension = nextExtension.startsWith(".")
    ? nextExtension
    : `.${nextExtension}`;
  const trimmed = fileName.trim();

  if (!trimmed) {
    return `media${normalizedExtension}`;
  }

  return trimmed.replace(/\.[^.]+$/u, "") + normalizedExtension;
};

const fileFromBlob = (blob: Blob, originalFileName: string) =>
  new File([blob], replaceExtension(originalFileName, ".webp"), {
    type: blob.type,
    lastModified: Date.now(),
  });

const assertImageInput = (file: File, message: string) => {
  if (!file.type.startsWith("image/")) {
    throw new Error(message);
  }

  if (file.size > MAX_INPUT_IMAGE_BYTES) {
    throw new Error("La imagen supera el límite de 10MB antes de optimizarla.");
  }
};

const buildCanvas = (
  image: HTMLImageElement,
  width: number,
  height: number,
) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Tu navegador no pudo preparar el canvas para la imagen.");
  }

  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas;
};

export const optimizeUiIdentityImage = async (file: File): Promise<File> => {
  assertImageInput(file, "Selecciona una imagen válida para identidad visual.");

  const image = await loadImage(file);
  const ratio = Math.min(
    1,
    UI_IDENTITY_MAX_DIMENSION /
      Math.max(image.naturalWidth, image.naturalHeight),
  );
  const baseWidth = Math.max(1, Math.round(image.naturalWidth * ratio));
  const baseHeight = Math.max(1, Math.round(image.naturalHeight * ratio));

  let bestBlob: Blob | null = null;
  let bestWidth = baseWidth;
  let bestHeight = baseHeight;

  for (const scale of UI_IDENTITY_SCALE_STEPS) {
    const width = Math.max(1, Math.round(baseWidth * scale));
    const height = Math.max(1, Math.round(baseHeight * scale));
    const canvas = buildCanvas(image, width, height);

    for (const quality of UI_IDENTITY_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, OUTPUT_MIME_TYPE, quality);

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestWidth = width;
        bestHeight = height;
      }

      if (blob.size <= UI_IDENTITY_MAX_BYTES) {
        return fileFromBlob(blob, file.name);
      }
    }
  }

  if (!bestBlob) {
    throw new Error("No pudimos generar una versión optimizada de la imagen.");
  }

  throw new Error(
    `No logramos bajar la imagen a 150KB. Prueba con una imagen más simple o recórtala antes de subirla. Último intento: ${bestWidth}x${bestHeight}px.`,
  );
};

export const optimizeFunnelAssetImage = async (file: File): Promise<File> => {
  assertImageInput(file, "Selecciona una imagen válida para el funnel.");

  const image = await loadImage(file);
  const canvas = buildCanvas(image, image.naturalWidth, image.naturalHeight);
  let bestBlob: Blob | null = null;

  for (const quality of FUNNEL_ASSET_QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, OUTPUT_MIME_TYPE, quality);

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob;
    }
  }

  if (!bestBlob) {
    throw new Error("No pudimos optimizar el asset del funnel.");
  }

  if (file.type === OUTPUT_MIME_TYPE && file.size <= bestBlob.size) {
    return file;
  }

  return fileFromBlob(bestBlob, file.name);
};
