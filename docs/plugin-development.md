# Plugin Development

このドキュメントは、Daibase に導入できるプラグインの実装仕様です。プラグイン仕様の正はこのドキュメントに置きます。`docs/plugin-host-design.md` は設計判断の履歴だけを扱います。

Daibase は Plugin Host 方式を採用します。プラグインは Daibase 本体の DOM、React component、Tauri command を直接触りません。ユーザーが登録、有効化、無効化、削除できる未知の拡張として扱い、Daibase は manifest と Plugin Host protocol だけを知ります。

## ドキュメントの位置付け

- 現行の manifest、配布物、登録方法、Runtime Message はこのドキュメントに集約します。
- `docs/plugin-host-design.md` は、Plugin Host を採用する理由と将来拡張の方向性を残す設計メモです。現行実装の詳細は重複して書きません。
- `docs/content-app-design.md` はアプリ全体設計の文脈だけを扱い、プラグインの詳細仕様はこのドキュメントを参照します。

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

Daibase が実行時に必要とする最小配布物は次の 3 つです。

- `manifest.json`
- `README.md`
- `main` が指すビルド済み HTML

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

## Plugin API

Daibase は plugin iframe に `window.daibase` を注入します。`daibase:render` message で受け取った page context は、Plugin API からも取得できます。

現在表示しているページの Markdown を読む場合:

```ts
const page = await window.daibase.readCurrentPage();

console.log(page.content);
console.log(page.body);
console.log(page.frontmatter);
```

現在表示しているページの Markdown を更新する場合:

```ts
await window.daibase.writeCurrentPage(nextMarkdown);
```

`writeCurrentPage` には、更新後の Markdown 全体を渡してください。Daibase は現在の page context を対象として保存します。プラグイン側で namespace、保存先パス、正規ロケーションを組み立てる必要はありません。

これらの API を使うプラグインは、`manifest.json` の `permissions` に必要な permission を追加してください。

```json
{
  "permissions": ["page-read", "page-write"]
}
```

`readCurrentPage` には `page-read`、`writeCurrentPage` には `page-write` が必要です。

TypeScript で型を付ける場合の最小例:

```ts
declare global {
  interface Window {
    daibase: {
      readCurrentPage(): Promise<{
        namespaceId: string;
        path: string;
        location: string;
        title: string;
        content: string;
        frontmatter: Record<string, unknown>;
        body: string;
        isDirty: boolean;
        isReadOnly: boolean;
      }>;
      writeCurrentPage(content: string): Promise<void>;
    };
  }
}
```

書き込みに失敗した場合、`writeCurrentPage` は reject します。プラグイン側では必要に応じて `try` / `catch` で扱ってください。

```ts
try {
  await window.daibase.writeCurrentPage(nextMarkdown);
} catch (error) {
  console.error(error);
}
```

`writeCurrentPage` が成功すると、Daibase は保存後の内容で `daibase:render` message を再送します。プラグインは保存後の正規化された Markdown を、次の `daibase:render` または `readCurrentPage` で確認できます。

## main HTML の制約

`main` で指定する HTML は次の条件を満たしてください。

- JavaScript と CSS を HTML 内に inline する。
- CDN や外部ネットワークに依存しない。
- `script src="..."` や `link rel="stylesheet"` で別ファイルを参照しない。
- `daibase:render` message を受け取って再描画できる。
- Markdown を読む場合は `daibase:render` message または `window.daibase.readCurrentPage` を使う。
- Markdown を書き込む場合は `window.daibase.writeCurrentPage` を使う。
- message が来ない状態でも確認できる fallback 表示を持つことを推奨します。

Vite で React / TypeScript を使う場合は、ビルド後に JS/CSS を `dist/index.html` へ inline してください。

## GitHub 管理プラグインの配布方針

GitHub で管理されるプラグインも、Daibase から見ると「ビルド済み配布物を含むプラグインフォルダ」として扱います。

プラグイン開発者は、好きな framework、bundler、言語で開発して構いません。ただし通常配布では、Daibase が読み込む成果物をリポジトリに commit してください。Daibase 本体は通常インストール時に `pnpm build`、`npm install`、`cargo build` などを実行しません。

理由は次の通りです。

- Daibase が plugin ごとの build tool、package manager、Node / Rust / Python などの実行環境を解釈せずに済む。
- 開発者は framework を自由に選べる。
- ユーザーのインストール時に任意の build script を実行しないため、更新とセキュリティ確認を単純に保てる。
- Daibase は manifest、README、ビルド済み `main` の検証と読み込みに責務を絞れる。

推奨する GitHub リポジトリ構成:

```text
my-plugin/
  manifest.json
  README.md
  package.json
  src/
  dist/
    index.html
```

通常配布で commit するもの:

- `manifest.json`
- `README.md`
- `dist/index.html` など `main` が指す成果物
- 開発に必要なソースコードと lockfile

通常配布で Daibase がしないこと:

- 依存関係の install
- build script の実行
- framework や bundler の自動判定
- `main` に含まれない asset graph の解決

将来的に GitHub からの install / update に対応する場合も、基本は repo、tag、branch、または release asset からプラグインフォルダを取得し、`manifest.json` と `main` を検証して登録します。配布単位は release tag を推奨します。

manifest に配布元を記録する場合の例:

```json
{
  "schemaVersion": 1,
  "id": "com.example.calendar",
  "name": "Calendar",
  "version": "0.1.0",
  "description": "Markdown ページをカレンダーとして表示します。",
  "main": "dist/index.html",
  "source": {
    "kind": "github",
    "repo": "owner/calendar-plugin",
    "ref": "v0.1.0"
  },
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

`source` は将来拡張の候補です。現行 schema では未実装のため、Daibase 側で保存、検証、更新処理を追加するまでは必須にしません。

## 開発用 build の扱い

Daibase 内で build する方式は、通常配布ではなく developer mode の機能として扱います。

developer mode で検討できること:

- ローカル登録済みプラグインに対して、manifest や設定で宣言された build command を手動実行する。
- build command 実行前にユーザーへ明示的に確認する。
- build 後に `main` の存在と読み込みを再検証する。

通常ユーザー向けの install / update では、Daibase は build command を自動実行しません。

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

現行実装では、ローカルフォルダ登録のみ対応しています。

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
- 現在公開している Plugin API は `window.daibase.readCurrentPage` と `window.daibase.writeCurrentPage` です。
- `readCurrentPage` には `page-read` permission が必要です。
- `writeCurrentPage` には `page-write` permission が必要です。
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
