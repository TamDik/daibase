# Plugin Host Design

このドキュメントは、Daibase のプラグイン実行方式を Plugin Host 中心に再設計するための方針です。既存の `entry` HTML を直接 iframe 表示する方式との互換性は考慮しません。

## 結論

Daibase は Plugin Host を持ち、プラグインは Daibase の DOM を直接操作しない設計にします。

プラグインは次の責務だけを持ちます。

- manifest で contribution を宣言する。
- Plugin Host から渡された document model を読む。
- 表示したい view model または plugin-owned view を返す。
- 許可された command を Plugin Host 経由で要求する。

Daibase 本体は次の責務を持ちます。

- どの view を表示するか決める。
- namespace / location / path / page / history などのドメイン解決を行う。
- プラグインを読み込み、sandbox 内で実行する。
- プラグインから返された view model を Daibase UI として描画する。
- プラグインが要求する操作を permission と現在の context に基づいて許可または拒否する。

## VS Code の Extension Host との関係

VS Code は拡張機能をエディタ本体とは分離した Extension Host で実行します。拡張機能はエディタ DOM を直接触るのではなく、API を通じて command、document、view、workspace などを操作します。

Daibase でも同じ方向性が合います。ただし Daibase はコンテンツ管理アプリなので、VS Code 風に API を広く公開するより、最初は view contribution と document context に絞ります。

## 基本アーキテクチャ

```text
React UI
  |
  | current page / user action
  v
Plugin Host
  |
  | manifest registry
  | contribution matching
  | sandbox lifecycle
  | permission checks
  v
Plugin Runtime
  |
  | pure protocol messages
  v
Plugin Module
```

Plugin Host は Daibase 本体の一部です。UI から見ると、通常の Markdown editor/view と plugin view はどちらも Daibase の view mode の一種です。

## View 切り替え

ページ表示は view mode として扱います。

```ts
type PageViewMode =
  | { kind: "editor"; editor: "wysiwyg" | "source" }
  | { kind: "plugin"; pluginId: string; contributionId: string };
```

通常は `editor` view です。ページの frontmatter やページ種別に一致する plugin view がある場合、Daibase は次のどちらかで表示します。

- 自動: manifest の `activation.autoOpen` が true の場合、plugin view を初期表示する。
- 手動: view switcher に plugin view を出し、ユーザーが切り替える。

カレンダーなら、frontmatter が次のようなページで `Calendar` view が候補に出ます。

```yaml
---
daibase.view: calendar
---
```

自動切り替えを許す場合でも、エディタへ戻る操作は常に Daibase UI 側に残します。

## DOM を触らせない方針

プラグインは Daibase の DOM を直接触れません。

禁止:

- Daibase 本体 DOM への selector access
- React component の差し替え
- global CSS の注入
- Daibase 本体 store への直接 access
- Tauri command の直接 invoke

許可:

- Plugin Host が渡した context の参照
- Plugin Host API への request
- 自分の sandbox 内での状態管理
- view model の返却

## Renderer の方式

Plugin Host 方式では、renderer は 2 種類に分けます。

### Structured View

Daibase が用意した UI schema を plugin が返し、Daibase が描画します。

```ts
type PluginView =
  | {
      kind: "calendar";
      month: string;
      events: CalendarEvent[];
    }
  | {
      kind: "table";
      columns: TableColumn[];
      rows: TableRow[];
    }
  | {
      kind: "markdown";
      content: string;
    };
```

メリット:

- DOM を完全に Daibase 側で管理できる。
- アプリ全体のデザインが揃う。
- permission と action を検査しやすい。
- 将来の mobile / native view にも移植しやすい。

デメリット:

- 表現力は Host が定義した schema に制限される。
- 新しい UI 種別は Daibase 側に schema 追加が必要。

### Sandboxed Custom View

表現力が必要な場合だけ、plugin-owned sandbox view を許可します。ただし Daibase DOM には触らせません。

```text
Daibase PageSurface
  PluginFrame
    sandboxed plugin view
```

この場合も、plugin は Plugin Host protocol で document と command を受け渡しします。iframe は plugin 専用 DOM であり、Daibase 本体 DOM ではありません。

初期方針としては Structured View を第一候補にし、Custom View は escape hatch にします。カレンダーは Structured View で十分です。

## Plugin Manifest

互換性を気にしない前提で、manifest は Plugin Host 向けに寄せます。

```json
{
  "schemaVersion": 1,
  "id": "com.example.calendar",
  "name": "Calendar",
  "version": "0.1.0",
  "main": "dist/plugin.js",
  "contributions": [
    {
      "kind": "pageView",
      "id": "calendar",
      "name": "Calendar",
      "match": {
        "frontmatter": {
          "daibase.view": "calendar"
        }
      },
      "view": {
        "kind": "structured",
        "schema": "calendar"
      },
      "activation": {
        "autoOpen": true
      }
    }
  ],
  "permissions": ["page-read", "location-open"]
}
```

変更点:

- `entry` ではなく `main` を使う。
- `markdownRenderer` ではなく `pageView` とする。
- `frontmatter` は `match.frontmatter` に入れる。
- view の種類を `view.kind` で宣言する。
- 自動表示か手動候補かを `activation.autoOpen` で宣言する。

## Plugin Module API

プラグインは Daibase が読み込む module として実装します。

```ts
import type { DaibasePlugin } from "@daibase/plugin-api";

const plugin: DaibasePlugin = {
  activate(host) {
    host.registerPageView("calendar", {
      render(context) {
        return {
          kind: "calendar",
          month: readMonth(context.page.frontmatter),
          events: parseEvents(context.page.content),
        };
      },

      onAction(action, context) {
        if (action.kind === "open-location") {
          return host.openLocation(action.location);
        }
      },
    });
  },
};

export default plugin;
```

ここで plugin が返すのは DOM ではなく view model です。

## Context

Plugin Host は renderer に context を渡します。

```ts
type PageViewContext = {
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
  namespace: {
    id: string;
    name: string;
  };
  view: {
    contributionId: string;
  };
};
```

frontmatter の parse は Daibase 側で行います。プラグインが Markdown 文字列から Daibase 管理 key を独自解釈する必要を減らします。

## Host API

Plugin Host API は最初は狭くします。

```ts
type PluginHostApi = {
  openLocation(location: string): Promise<void>;
  notify(message: string, options?: NotifyOptions): Promise<void>;
  readPage(location: string): Promise<PageSnapshot>;
  writeCurrentPage(content: string): Promise<void>;
};
```

API 呼び出しは permission と context で検査します。

例:

- `readPage` には `page-read` が必要。
- `writeCurrentPage` には `page-write` が必要。
- `openLocation` には `location-open` が必要。
- `notify` には `ui-notify` が必要。

## Message Protocol

Plugin Host と Plugin Runtime の通信は request / response 形式にします。

```ts
type HostToPlugin =
  | {
      type: "daibase:init";
      requestId: string;
      pluginId: string;
      manifest: PluginManifest;
    }
  | {
      type: "daibase:render";
      requestId: string;
      context: PageViewContext;
    };

type PluginToHost =
  | {
      type: "plugin:ready";
      requestId: string;
    }
  | {
      type: "plugin:render-result";
      requestId: string;
      view: PluginView;
    }
  | {
      type: "plugin:host-call";
      requestId: string;
      method: keyof PluginHostApi;
      params: unknown;
    };
```

Structured View の場合、Plugin Host は `plugin:render-result` の `view` を React component で描画します。

Custom View の場合も Host API は同じ protocol に通します。iframe 内の plugin DOM から直接 Tauri command を呼ばせません。

## Calendar Plugin の例

Markdown:

```yaml
---
daibase.view: calendar
calendar:
  month: 2026-06
---
- 2026-06-04 14:00 Product review
- 2026-06-10 Team planning
```

Plugin が返す view:

```ts
{
  kind: "calendar",
  month: "2026-06",
  events: [
    {
      date: "2026-06-04",
      time: "14:00",
      title: "Product review",
      sourceRange: {
        startLine: 7,
        endLine: 7
      }
    }
  ]
}
```

Daibase 側はこの view model を `CalendarView` component で描画します。イベントクリックや日付クリックは Daibase UI action として処理します。

## 実装ステップ

1. Manifest schema v1 を Plugin Host 仕様として定義する。
2. `markdownRenderer` を廃止し、`pageView` contribution に置き換える。
3. Rust 側で plugin main file を読み込む command を用意する。
4. Frontend に `PluginHost` service を追加する。
5. `PageSurface` の view mode を `editor/source/plugin` へ整理する。
6. `daibase.view` frontmatter から page view contribution を解決する。
7. Structured View schema と React renderer を追加する。
8. Calendar structured view を最初の schema として実装する。
9. Plugin Host API の request / response と permission check を追加する。
10. Custom View iframe は必要になった時点で追加する。

## 最初に作るべき最小版

最初の実装は、Custom View を作らず Structured View だけで十分です。

必要なもの:

- `pageView` contribution
- `daibase.view` frontmatter matching
- Plugin module の `render(context): PluginView`
- `calendar` view schema
- Daibase 側の `CalendarView` component

この形にすると、カレンダープラグインは DOM を触らず、Daibase の見た目と操作体系の中で表示できます。

## 判断

Daibase では Plugin Host 方式を採用する方が良いです。

理由:

- コンテンツ管理の整合性を Rust / Daibase 本体に残せる。
- プラグインに DOM や Tauri command を直接触らせずに済む。
- view 切り替えを Daibase UI の責務として扱える。
- 通常エディタ view と plugin view の往復が明確になる。
- permission と将来の同期、履歴、復元の境界を保ちやすい。

特に「普通はエディタ view」「条件に合うと plugin view に切り替えられる」という体験には、Plugin Host + Structured View が一番合います。
