"use client";

import { memberOperationRequest } from "@/lib/member-operations";

export type StorageUploadContext = "avatars" | "funnels";

type PresignedUploadPayload = {
  uploadUrl: string;
  publicUrl: string;
};

export const uploadFileWithPresignedUrl = async (
  file: File,
  context: StorageUploadContext,
) => {
  const { uploadUrl, publicUrl } =
    await memberOperationRequest<PresignedUploadPayload>(
      "/storage/presigned-url",
      {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          context,
        }),
      },
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
