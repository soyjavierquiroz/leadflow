"use client";

import { webPublicConfig } from "@/lib/public-env";

export type StorageUploadContext = "avatars" | "funnels" | "branding";
export type StorageUploadPurpose = "og-image";

type PresignedUploadPayload = {
  uploadUrl: string;
  publicUrl: string;
};

type ProcessedUploadPayload = {
  publicUrl: string;
  mimeType: string;
  width: number;
  height: number;
};

type PresignedUploadScope = {
  teamId?: string;
};

type ErrorPayload = {
  message?: string;
  error?: string;
};

const requestPresignedUploadUrl = async (
  file: File,
  context: StorageUploadContext,
  scope?: PresignedUploadScope,
) => {
  const response = await fetch(
    `${webPublicConfig.urls.api}/v1/storage/presigned-url`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        context,
        teamId: scope?.teamId,
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const errorPayload = payload as ErrorPayload;
    const message =
      (typeof errorPayload.message === "string"
        ? errorPayload.message
        : null) ??
      (typeof errorPayload.error === "string" ? errorPayload.error : null) ??
      "No pudimos obtener una URL de upload para este archivo.";

    throw new Error(message);
  }

  return payload as PresignedUploadPayload;
};

export const uploadFileWithPresignedUrl = async (
  file: File,
  context: StorageUploadContext,
  scope?: PresignedUploadScope,
) => {
  const { uploadUrl, publicUrl } = await requestPresignedUploadUrl(
    file,
    context,
    scope,
  );

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("No pudimos subir el archivo al storage.");
  }

  return publicUrl;
};

export const uploadOgImageFile = async (
  file: File,
  scope?: PresignedUploadScope,
) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("context", "funnels");
  formData.append("purpose", "og-image" satisfies StorageUploadPurpose);

  if (scope?.teamId) {
    formData.append("teamId", scope.teamId);
  }

  const response = await fetch(`${webPublicConfig.urls.api}/v1/storage/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const errorPayload = payload as ErrorPayload;
    const message =
      (typeof errorPayload.message === "string"
        ? errorPayload.message
        : null) ??
      (typeof errorPayload.error === "string" ? errorPayload.error : null) ??
      "No pudimos subir la imagen SEO al CDN.";

    throw new Error(message);
  }

  return (payload as ProcessedUploadPayload).publicUrl;
};
