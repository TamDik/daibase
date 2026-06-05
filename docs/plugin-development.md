# Plugin Development

このドキュメントは、Daibase に導入できるローカルプラグインの実装仕様です。設計背景は `docs/plugin-host-design.md` にまとめています。

Daibase は Plugin Host 方式を採用します。プラグインは Daibase 本体の DOM、React component、Tauri command を直接触りません。ユーザーが登録、有効化、無効化、削除できる未知の拡張として扱い、Daibase は manifest と Plugin Host protocol だけを知ります。

## 対応している機能

現在対応している contribution は `pageView` です。

Markdown ページの frontmatter が `pageView.match.frontmatter` に一致すると、通常の editor view の代わりに plugin view を MainView に表示できます。

```yaml
---
daibase.view: calendar
---
```

Daibase は namespace 名、`Special:*`、`.md` 判定、ロケーション正規化を Rust 側で扱います。プラグインは正規ロケーションを自前で組み立てないでください。

## フォルダ構成

プラグインフォルダのルートには `manifest.json` を置きます。

```text
my-plugin/
  manifest.json
  README.md
  dist/
    index.html
```

React / TypeScript などで実装する場合も、Daibase が読み込むのは `manifest.json` の `main` で指定された静的 HTML です。

`README.md` はアプリ内ドキュメントとして扱います。`Special:Plugins` のプラグイン一覧から README を開き、使い方、frontmatter の例、権限、注意点を確認できます。

推奨する開発用構成は次の通りです。

```text
my-plugin/
  manifest.json
  README.md
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
  "main": "dist/index.html",
  "contributions": [
    {
      "kind": "pageView",
      "id": "calendar",
      "name": "Calendar",
      "slot": "main",
      "match": {
        "frontmatter": {
          "daibase.view": "calendar"
        }
      },
      "view": {
        "kind": "custom"
      },
      "activation": {
        "autoOpen": true
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

`main`
: 必須。プラグインフォルダからの相対パスです。絶対パス、バックスラッシュ、`..` は使えません。現在は Plugin Host が iframe `srcDoc` として読み込める単一 HTML を指定します。

`contributions`
: 必須。1 つ以上の contribution を指定します。現在は `pageView` のみ対応しています。

`permissions`
: 任意。Host API の capability 確認用です。現在指定できる値は `page-read`, `page-write`, `file-read`, `file-write`, `namespace-read`, `history-read`, `location-open`, `ui-notify` です。

## pageView

`pageView` は、ページの MainView に plugin view を表示する contribution です。

```json
{
  "kind": "pageView",
  "id": "calendar",
  "name": "Calendar",
  "slot": "main",
  "match": {
    "frontmatter": {
      "daibase.view": "calendar"
    }
  },
  "view": {
    "kind": "custom"
  },
  "activation": {
    "autoOpen": true
  }
}
```

`id`
: 必須。contribution の ID です。プラグイン ID と同じ文字種制限です。

`name`
: 必須。view の表示名です。

`slot`
: 任意。現在 MainView に表示する `main` をサポートしています。将来は `sidebarSection`, `rightPanel`, `bottomPanel`, `toolbar`, `statusBar` を Host 管理の slot として扱います。

`match.frontmatter`
: 必須。Markdown frontmatter と照合する key-value 条件です。現在は flat な key-value のみ対応しています。すべての条件に一致した場合に view が候補になります。

`view.kind`
: 必須。現在は `custom` のみ対応しています。Plugin Host が sandbox iframe として `main` HTML を表示します。

`activation.autoOpen`
: 任意。`true` の場合、条件に一致したページで plugin view を初期表示します。エディタへ戻る操作は Daibase 側に残します。

対応例:

```yaml
---
daibase.view: calendar
calendar:
  month: 2026-06
---
```

未対応例:

```yaml
---
daibase:
  view: calendar
---
```

## Runtime Message

Daibase は plugin iframe の読み込み後、`window.postMessage` で page context を渡します。

```ts
type DaibaseRenderMessage = {
  type: "daibase:render";
  requestId: string;
  context: {
    namespace: {
      id: string;
      name: string;
    };
    page: {
      namespaceId: string;
      path: string;
      location: string;
      title: string;
      content: string;
      frontmatter: Record<string, unknown>;
      body: string;
      isDirty: boolean;
      isReadOnly: boolean;
    };
    view: {
      pluginId: string;
      contributionId: string;
    };
  };
};
```

プラグイン側の最小実装:

```ts
window.addEventListener("message", (event: MessageEvent<DaibaseRenderMessage>) => {
  if (event.data?.type !== "daibase:render") {
    return;
  }

  render(event.data.context);
});
```

## main HTML の制約

`main` で指定する HTML は次の条件を満たしてください。

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

## 登録と更新

1. `pnpm build` などで `dist/index.html` を作成します。
2. Daibase の `Special:Plugins` を開きます。
3. ローカルフォルダからプラグインフォルダを選択して登録します。
4. 登録後、プラグインを有効化します。

Daibase は登録したローカルフォルダを直接参照します。app data directory にはプラグイン ID、有効状態、登録元パスなどの registry だけを保存し、プラグイン本体はコピーしません。

`manifest.json`, `README.md`, `dist/index.html` は表示や実行のたびに登録元フォルダから読みます。React / TypeScript で開発している場合、ソース変更後に `pnpm build` を実行すれば、同じ登録のまま変更が反映されます。

同じ `id` のプラグインフォルダを再登録した場合は、登録元パスと manifest 情報を更新し、有効状態は維持します。

## セキュリティと制限

- プラグインは Plugin Host 管理の sandbox iframe 内で実行されます。
- Daibase 本体 DOM、React component、Tauri command を直接触らせません。
- 任意の Daibase 操作 API はまだ公開していません。
- `permissions` は manifest に保存されますが、現在の Host API proxy は未実装です。
- プラグイン管理操作は MCP には公開していません。

## 最小サンプル

`manifest.json`:

```json
{
  "schemaVersion": 1,
  "id": "com.example.hello",
  "name": "Hello View",
  "version": "0.1.0",
  "description": "Hello page view sample.",
  "main": "dist/index.html",
  "contributions": [
    {
      "kind": "pageView",
      "id": "hello",
      "name": "Hello",
      "slot": "main",
      "match": {
        "frontmatter": {
          "daibase.view": "hello"
        }
      },
      "view": {
        "kind": "custom"
      },
      "activation": {
        "autoOpen": true
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
    <title>Hello View</title>
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
    <h1>Hello View</h1>
    <pre id="content"></pre>
    <script>
      const content = document.getElementById("content");

      window.addEventListener("message", (event) => {
        if (event.data?.type !== "daibase:render") {
          return;
        }
        content.textContent = event.data.context.page.body;
      });

      content.textContent = "Waiting for Daibase content...";
    </script>
  </body>
</html>
```
