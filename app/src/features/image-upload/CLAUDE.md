# features/image-upload/

Image paste/drop, insert-from-path/URL and bulk upload of local images to the configured host. Code copied from `Editor.vue` (Wave 2 PR-5); `Editor.vue` keeps its copy until PR-8.

| Path | Holds |
|---|---|
| `contracts/image-upload.feature.ts` | `createImageUploadFeature()`: `image-paste` extension, commands `insertImageFromPath`, `insertImageUrl`, `uploadLocalImages` |
| `contracts/index.ts` | Public surface: factory + `imagePasteOptionsFor` (plain engine) |
| `internal/image-paste-options.ts` | `imagePasteOptionsFor(ctx)` |
| `internal/image-links.ts` | Pure: front-matter image root, local image sources, src rewrite changes |
| `internal/upload-local-images.ts` | Upload loop; same toasts as before |

- `insertImageUrl` delegates to the `insertMarkdown` command (format feature).
- `settingsKeys` lists every setting `resolveUploader` reads.
