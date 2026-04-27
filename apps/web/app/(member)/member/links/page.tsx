import { MemberLinkGalleryClient } from "@/components/member-operations/member-link-gallery-client";
import { getMemberLinkGallery } from "@/lib/member-link-gallery";

export default async function MemberLinksPage() {
  const gallery = await getMemberLinkGallery();

  return <MemberLinkGalleryClient initialGallery={gallery} />;
}
