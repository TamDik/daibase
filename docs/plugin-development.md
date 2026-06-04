# Plugin Development

このドキュメントは、Daibase に導入できるローカルプラグインの実装仕様です。

Plugin Host 方式へ切り替える設計方針は `docs/plugin-host-design.md` にまとめています。互換性を気にしない次期仕様では、プラグインに Daibase DOM を直接触らせず、Host が view model を受け取って描画する方式へ寄せます。

現時点のプラグインは、ローカルの unpacked plugin folder を `Special:Plugins` からインストールする方式です。Daibase はプラグインフォルダを app data directory にコピーし、インストール直後は無効状態にします。ユーザーが `Special:Plugins` で有効化すると、対応する Markdown renderer が使われます。

## 対応している機能

現在対応している contribution は `markdownRenderer` です。

Markdown ページの frontmatter がプラグイン manifest の `frontmatter` 条件に一致すると、通常の Markdown 表示の代わりにプラグインの `entry` HTML が iframe で表示されます。

```yaml
---
daibase.renderer: calendar
---
```

Daibase は namespace 名、`Special:*`、`.md` 判定、ロケーション正規化を Rust 側で扱います。プラグインは正規ロケーションを自前で組み立てないでください。

## フォルダ構成

プラグインフォルダのルートには `manifest.json` を置きます。

```text
my-plugin/
  manifest.json
  dist/
    index.html
```

React / TypeScript などで実装する場合も、Daibase が読み込むのは `manifest.json` の `entry` で指定された静的 HTML です。

推奨する開発用構成は次の通りです。

```text
my-plugin/
  manifest.json
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  scripts/
    inline-dist.mjs
  src/
    main.tsx
    App.tsx
  dist/
    index.html
```

## manifest.json

例:

```json
{
  "schemaVersion": 1,
  "id": "com.example.calendar",
  "name": "Calendar",
  "version": "0.1.0",
  "description": "Markdown ページをカレンダーとして表示します。",
  "entry": "dist/index.html",
  "contributions": [
    {
      "kind": "markdownRenderer",
      "id": "calendar",
      "name": "Calendar",
      "frontmatter": {
        "daibase.renderer": "calendar"
      }
    }
  ],
  "permissions": ["page-read", "location-open"]
}
```

### フィールド

`schemaVersion`
: 必須。現在は `1` のみ対応しています。

`id`
: 必須。プラグインの一意 ID です。英数字、ドット、ハイフン、アンダースコアだけ使えます。最大 128 文字です。

`name`
: 必須。UI に表示する名前です。

`version`
: 必須。プラグインのバージョンです。形式は現時点では厳密には検証していませんが、SemVer 形式を推奨します。

`description`
: 任意。UI に表示する説明です。

`entry`
: 必須。プラグインフォルダからの相対パスです。絶対パス、バックスラッシュ、`..` は使えません。

`contributions`
: 必須。1 つ以上の contribution を指定します。現在は `markdownRenderer` のみ対応しています。

`permissions`
: 任意。将来の capability 確認用です。現在指定できる値は `page-read`, `page-write`, `file-read`, `file-write`, `namespace-read`, `history-read`, `location-open`, `ui-notify` です。

## markdownRenderer

`markdownRenderer` は、Markdown ページの表示をプラグインで置き換える contribution です。

```json
{
  "kind": "markdownRenderer",
  "id": "calendar",
  "name": "Calendar",
  "frontmatter": {
    "daibase.renderer": "calendar"
  }
}
```

`id`
: 必須。contribution の ID です。プラグイン ID と同じ文字種制限です。

`name`
: 必須。renderer の表示名です。

`frontmatter`
: 必須。Markdown frontmatter と照合する key-value 条件です。現在は flat な key-value のみ対応しています。すべての条件に一致した場合に renderer が使われます。

対応例:

```yaml
---
daibase.renderer: calendar
---
```

未対応例:

```yaml
---
daibase:
  renderer: calendar
---
```

## Runtime Message

Daibase は renderer iframe の読み込み後、`window.postMessage` で Markdown 本文を渡します。

```ts
type DaibaseRenderMessage = {
  type: "daibase:render";
  payload: {
    content: string;
  };
};
```

プラグイン側の最小実装:

```ts
window.addEventListener("message", (event: MessageEvent<DaibaseRenderMessage>) => {
  if (event.data?.type !== "daibase:render") {
    return;
  }

  const markdown = event.data.payload.content;
  render(markdown);
});
```

Daibase は現在、`entry` HTML を読み込んで iframe の `srcDoc` に渡します。そのため、`dist/index.html` は単体で実行できる HTML にしてください。

## entry HTML の制約

`dist/index.html` は次の条件を満たしてください。

- JavaScript と CSS を HTML 内に inline する。
- CDN や外部ネットワークに依存しない。
- `script src="..."` や `link rel="stylesheet"` で別ファイルを参照しない。
- `daibase:render` message を受け取って再描画できる。
- message が来ない状態でも確認できる fallback 表示を持つことを推奨します。

Vite で React / TypeScript を使う場合は、ビルド後に JS/CSS を `dist/index.html` へ inline してください。

## React / TypeScript テンプレート方針

React / TypeScript で実装して構いません。ただし、Daibase に渡す成果物は静的な単一 HTML です。

推奨 `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit && vite build && node scripts/inline-dist.mjs",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^6.0.2",
    "typescript": "^6.0.3",
    "vite": "^8.0.14",
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  }
}
```

`scripts/inline-dist.mjs` の例:

```js
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const htmlPath = path.join(distDir, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");

html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_match, href) => {
  const css = fs.readFileSync(path.join(distDir, href), "utf8");
  return `<style>${css}</style>`;
});

html = html.replace(
  /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
  (_match, src) => {
    const js = fs.readFileSync(path.join(distDir, src), "utf8");
    return `<script>${js}</script>`;
  },
);

fs.writeFileSync(htmlPath, html);
fs.rmSync(path.join(distDir, "assets"), { force: true, recursive: true });
```

## インストールと更新

1. `pnpm build` などで `dist/index.html` を作成します。
2. Daibase の `Special:Plugins` を開きます。
3. ローカルフォルダからプラグインフォルダを選択してインストールします。
4. インストール後、プラグインを有効化します。

Daibase はインストール時にプラグインフォルダを app data directory へコピーします。元フォルダを編集しても、インストール済みプラグインは自動更新されません。

同じ `id` のプラグインを再インストールすることは現在できません。開発中に差し替える場合は、バージョン違いでも `id` を変えるか、アプリ側のデータを手動で整理してください。

## セキュリティと制限

- プラグインはローカル HTML として iframe 内で実行されます。
- 任意の Daibase 操作 API はまだ公開していません。
- `permissions` は manifest に保存されますが、現在の renderer 実行では `page-read` などの API proxy は未実装です。
- プラグイン管理操作は MCP には公開していません。
- secret、証明書、生成物以外の不要ファイルをプラグインフォルダへ含めないでください。

## 最小サンプル

`manifest.json`:

```json
{
  "schemaVersion": 1,
  "id": "com.example.hello",
  "name": "Hello Renderer",
  "version": "0.1.0",
  "description": "Hello renderer sample.",
  "entry": "dist/index.html",
  "contributions": [
    {
      "kind": "markdownRenderer",
      "id": "hello",
      "name": "Hello",
      "frontmatter": {
        "daibase.renderer": "hello"
      }
    }
  ],
  "permissions": ["page-read"]
}
```

`dist/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hello Renderer</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        margin: 0;
        padding: 16px;
      }
      pre {
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <h1>Hello Renderer</h1>
    <pre id="content"></pre>
    <script>
      const content = document.getElementById("content");

      window.addEventListener("message", (event) => {
        if (event.data?.type !== "daibase:render") {
          return;
        }
        content.textContent = event.data.payload.content;
      });

      content.textContent = "Waiting for Daibase content...";
    </script>
  </body>
</html>
```
