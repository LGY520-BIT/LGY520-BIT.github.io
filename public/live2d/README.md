# Local Live2D companion

The default is the user's supplied **八千代 / Yachiyo** Cubism model. Its source folder is labelled 【雪熊企划】八千代辉夜姬. This is not an official model endorsement or proof of redistribution permission. The AI persona is unofficial original role-play inspired by 月見ヤチヨ from https://www.cho-kaguyahime.com/ ; it is not Kaguya, an official character account or a cloned voice.

## Installed model

`models/Yachiyo/Yachiyo.model3.json` references exact-byte copies of the supplied MOC3, two 8192×8192 PNG textures, physics, display info and four expressions. Only resource names in the generated manifest change to ASCII; the four existing expressions are added to that manifest. No VTube Studio, xyplugin or item-pin configuration is executed or copied. No motion3 or audio files were supplied. The nod button drives the model's actual `ParamAngle_HeadY` parameter; pointer tracking uses `ParamAngle_HeadX/Y/Z`, because its standard `ParamAngleX` is an input placeholder rather than a directly deforming head control.

Original textures remain unchanged on disk. The default installed model now reads `models/Yachiyo/web/texture-manifest.json` and uses two prebuilt 2048×2048 RGBA PNG atlases. `scripts/prepare-yachiyo-web.py` produces them locally with Pillow's premultiplied-alpha LANCZOS filtering, without moving UVs, repainting artwork, uploading files or adding an application dependency. The two original PNGs total 61,642,169 bytes; the web copies total 3,161,987 bytes (94.87% smaller). The default path does not download the original 8K PNGs or resize them in the browser. The theoretical two-texture RGBA pixel budget is 32 MiB rather than 512 MiB at 8K, excluding other renderer memory; this is a size calculation, not a GPU measurement. Missing web assets, a GPU texture limit below 2048 or render failure leaves the supplied square avatar visible, honestly labelled static; it does not silently download the originals.

A one-time preference migration selects Yachiyo; later explicit display choices are respected. Haru remains an optional technical sample, and the old Kaguya layered mesh remains explicitly labelled non-Cubism. When the companion is minimized/hidden, F8 clean mode is active or the tab is in the background, initial runtime/model loading is deferred until it is shown. Static-avatar mode does not fetch a model. Once loaded, the same instance is kept across internal page navigation and temporary hiding; hidden tab, hidden companion, F8 clean mode, manual pause and reduced-motion preferences stop updates without touching the blog music player. A full document unload or an explicit model change releases the old model.

## Dependencies and notices

- `live2dcubismcore5.min.js`: exact Core from official **Cubism SDK for Web 5 R4**, https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-5-r.4.zip . Actual Core API reports **5.1.0 (83951616)** and latest MOC format **5**. SHA256: `25ae938cb4fe282ce189b357bcc97e603d1e1f7ec78bf04150d401c23cdc792f`. Proprietary, not MIT; see `LICENSE-core5.md`, `RedistributableFiles-core5.txt`, `CHANGELOG-core5.md` and https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html .
- The old `live2dcubismcore.min.js` remains unchanged for baseline evidence: official SDK 4 R7 Core **4.2.4**, latest MOC format **4**; it cannot read this new format-5 MOC.
- `pixi.min.js`: PixiJS **6.5.10**, MIT (`LICENSE-pixi.txt`).
- `cubism4.min.js`: pixi-live2d-display **0.4.0**, MIT portion (`LICENSE-display.txt`) plus bundled Cubism framework terms (`LICENSE-framework.md`). A Core accepting the MOC does not guarantee every later Cubism feature renders identically through this adapter.
- `models/Haru`: optional official Live2D sample, subject to `LICENSE-samples.md` and `NOTICE-samples.md`; sample voice references are omitted. Haru is not Yachiyo or Kaguya.

This content uses optional sample data owned and copyrighted by Live2D Inc. The sample data are utilized in accordance with terms and conditions set by Live2D Inc. This content itself is created at the author's sole discretion.

SDK download and agreements: https://www.live2d.com/en/sdk/download/web/ . Sample terms: https://www.live2d.com/en/learn/sample/model-terms/ . Review the user-supplied model's own permissions and the SDK release conditions before public distribution, sale or commercial deployment. A local import does not grant these rights.

## Local directory import

Only a `.model3.json` manifest and its known data references are used; relative-path validation blocks external URLs and traversal. Files stay in document memory through Blob URLs, never upload and must be chosen again after a full reload. Maximum 250 files, 100 MiB total, 32 MiB per file and 1 MiB manifest. Imports retain the existing local Blob-URL/Pixi display path and do not automatically use the installed Yachiyo web atlas manifest. Oversized or incompatible imported textures may fail and keep the static avatar. The legacy ImageBitmap/canvas sizing helper remains available in the source with bitmap, canvas and temporary-URL cleanup, but the default installed Yachiyo path no longer uses it. Sound references and scripts are ignored. The large supplied Yachiyo model is installed locally rather than routed through the directory-import cap.

## Observed verification, not GPU acceptance

The real official Core validates this MOC (consistency=1), creates **796 parameters, 106 parts and 409 drawables**, and produces changed mesh coordinates when its custom head X/Y/Z controls change. All expression parameter IDs exist. Source hashes, exact 2K atlas dimensions/hashes, deferred loading, single-flight cancellation and resource disposal are tested. No browser/GPU screenshot, visible sharpness acceptance or final rendering success is claimed; the adapter reveals the canvas only after its renderer succeeds at runtime.
