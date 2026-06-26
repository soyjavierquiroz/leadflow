# LeadFlow Library v1 Foundation

## Architecture

```text
LeadFlow Library
  LibraryCollection
    LibraryAsset
      LibraryTag / LibraryAssetTag
      LibraryAssetVersion
        LibraryMedia
        LibraryCompatibility
        LibraryFunnelVersion
          sourceFunnelInstanceId -> Master FunnelInstance
          sourceFunnelId         -> Builder Funnel

Temporary adapter
  FunnelArsenalTemplate
    libraryAssetVersionId -> LibraryAssetVersion
    sourceFunnelInstanceId/sourceFunnelId remain as legacy fallback/cache

Activation path
  LibraryAssetVersion (published)
    -> LibraryFunnelVersion.sourceFunnelInstanceId
    -> Master FunnelInstance
    -> Deep Clone to customer team

Preview path
  LibraryAssetVersion (published)
    -> LibraryFunnelVersion.sourceFunnelInstanceId
    -> existing marketplace preview runtime payload
```

## Foundation Rules

- Funnels are assets, not templates.
- Assets may have many versions.
- Only `LibraryAssetVersion.status = published` is eligible for preview or activation.
- A partial unique database index allows only one published version per asset.
- Customers still work on Deep Clones, never on Master Funnels.
- `FunnelArsenalTemplate` remains intact as a temporary adapter for Marketplace.

## Migration Plan

1. Create `LibraryCollection` rows for initial families such as `funnels`, `blocks`, `ai-agents`, `prompt-packs`, `themes`, and `brand-kits`.
2. For each existing Marketplace funnel, create one `LibraryAsset` under `funnels`.
3. Create a `LibraryAssetVersion` with status `draft`.
4. Create the matching `LibraryFunnelVersion` pointing to the current Master Funnel through `sourceFunnelInstanceId` and `sourceFunnelId`.
5. Add `LibraryMedia`, `LibraryCompatibility`, and tags as metadata.
6. Publish one version per asset.
7. Set `FunnelArsenalTemplate.libraryAssetVersionId` for that Marketplace asset.
8. Validate preview and activation still behave the same.
9. Later phases can move list/search/filter endpoints from `FunnelArsenalTemplate` to Library-native reads.

## Implemented In This Phase

- New Prisma entities and enums for Library collections, assets, versions, tags, compatibility, media, and funnel versions.
- Nullable `FunnelArsenalTemplate.libraryAssetVersionId` adapter field.
- Admin read endpoint: `GET /v1/system/library`.
- Admin navigation entry and initial page: `/admin/library`.
- Marketplace preview and activation resolve `LibraryAssetVersion -> LibraryFunnelVersion -> sourceFunnelInstanceId` when a template is associated to a published Library version.
- Legacy `FunnelArsenalTemplate.sourceFunnelInstanceId` remains supported as fallback.

## Prepared For Future Phases

- Library-native marketplace listing.
- Version publishing workflows.
- Asset type expansion beyond funnels.
- Filters by compatibility fields.
- Media galleries and previews per version.
- Gradual migration without deleting Marketplace or Arsenal records.

## Risks

- Existing Marketplace funnels remain legacy until explicitly associated to a Library version.
- Library CRUD/publish workflows are not implemented yet.
- The adapter caches source IDs back onto `FunnelArsenalTemplate` for compatibility, so Library remains the source of truth only after association and published-version validation.
- Runtime and Builder were intentionally not changed; deeper Library-native behavior should be phased separately.
