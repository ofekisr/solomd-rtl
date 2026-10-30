# features/image-upload/

Image paste/drop, insert-from-path/URL and bulk upload of local images to the configured host.
Consumed by: `shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`), provided to `editor/ui/Editor.vue` by `App.vue` through `EDITOR_REGISTRY_FACTORY`.

| Path | Holds |
|---|---|
| `contracts/image-upload.feature.ts` | `createImageUploadFeature()`: `image-paste` extension, commands `insertImageFromPath`, `insertImageUrl`, `uploadLocalImages` |
| `contracts/index.ts` | Public surface: factory, `imagePasteOptionsFor` (plain engine), `handleTextareaImagePaste`, `imageTextFromPath`, `ImagePasteOptions` |
| `internal/cm-image-paste.ts` | Paste/drop handlers (moved from `lib/`) |
| `internal/image-upload.ts` | `resolveUploader` and upload helpers (moved from `lib/`) |
| `internal/image-paste-options.ts` | `imagePasteOptionsFor(ctx)` |
| `internal/image-links.ts` | Pure: front-matter image root, local image sources, src rewrite changes |
| `internal/upload-local-images.ts` | Upload loop; same toasts as before |

- `insertImageUrl` delegates to the `insertMarkdown` command (format feature).
- `settingsKeys` lists every setting `resolveUploader` reads.
