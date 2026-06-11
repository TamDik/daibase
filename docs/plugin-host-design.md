# Plugin Host Design

このドキュメントは、Daibase が Plugin Host 方式を採用する理由と設計判断の履歴です。現行の manifest、配布物、登録方法、Runtime Message は `docs/plugin-development.md` を正とします。

## 結論

Daibase は Plugin Host を持ち、プラグインは Daibase 本体の DOM、React component、Tauri command を直接操作しない設計にします。

プラグインの責務:

- manifest で contribution を宣言する。
- Plugin Host から渡された document context を読む。
- 自分の sandbox 内で view を描画する。
- 将来 Daibase 操作 API を使う場合は、Plugin Host 経由で要求する。

Daibase 本体の責務:

- どの view を表示するか決める。
- namespace / location / path / page / history などのドメイン解決を行う。
- manifest と permission を検証する。
- プラグインを sandbox iframe 内で実行する。
- プラグインへ document context を渡す。
- 将来 API proxy を公開する場合は、permission と現在の context に基づいて許可または拒否する。

## 採用理由

VS Code は拡張機能をエディタ本体とは分離した Extension Host で実行します。拡張機能はエディタ DOM を直接触るのではなく、API を通じて command、document、view、workspace などを操作します。

Daibase でも同じ方向性が合います。ただし Daibase はコンテンツ管理アプリなので、VS Code 風に API を広く公開するより、最初は `pageView` contribution と document context に絞ります。

この方針により、コンテンツ管理の整合性を Rust / Daibase 本体に残しつつ、プラグインには表示拡張の自由度を渡せます。

## 現行方式

現行実装では、`pageView` contribution と sandbox iframe の Custom View に対応しています。

```text
React UI
  |
  | current page / user action
  v
Plugin Host
  |
  | manifest registry
  | contribution matching
  | sandbox iframe lifecycle
  v
Plugin HTML
```

ページの frontmatter が `pageView.match.frontmatter` に一致すると、Daibase は `main` が指す単一 HTML を sandbox iframe に読み込み、`daibase:render` message で page context を渡します。

詳細は `docs/plugin-development.md` の次の節を参照してください。

- `manifest.json`
- `pageView`
- `Runtime Message`
- `main HTML の制約`
- `登録と更新`

## DOM を触らせない方針

禁止:

- Daibase 本体 DOM への selector access
- React component の差し替え
- global CSS の注入
- Daibase 本体 store への直接 access
- Tauri command の直接 invoke

許可:

- Plugin Host が渡した context の参照
- 自分の sandbox 内での DOM / CSS / state 管理
- `window.daibase` として公開される Plugin API への request

## GitHub 配布との関係

GitHub 管理プラグインに対応する場合も、Daibase は通常インストール時に build を実行しません。

開発者は好きな framework / bundler / 言語で開発してよい一方で、Daibase が読み込むビルド済み成果物をリポジトリまたは release asset に含めます。これにより、Daibase は manifest、README、`main` の検証と読み込みに責務を絞れます。

詳しい配布方針は `docs/plugin-development.md` の `GitHub 管理プラグインの配布方針` を参照してください。

## 将来拡張

将来的には、Custom View だけでなく Structured View も検討できます。

Structured View では、プラグインが DOM を描画するのではなく、Daibase が定義した view model を返し、Daibase 本体が React component として描画します。

例:

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

Structured View の利点:

- DOM を Daibase 側で管理できる。
- アプリ全体の見た目を揃えやすい。
- action と permission を検査しやすい。
- mobile / native view へ移植しやすい。

ただし現行実装の正は Custom View です。Structured View を実装する場合は、manifest schema、Runtime Message、renderer、テストを追加し、`docs/plugin-development.md` を更新します。

## Host API

プラグインに Daibase 操作 API を渡す場合は capability 制にします。現行実装ではページ CRUD と location open を `window.daibase.page.*` と `window.daibase.location.*` に整理して公開しています。

```ts
type PluginHostApi = {
  page: {
    readCurrent(): Promise<PageSnapshot>;
    writeCurrent(content: string): Promise<void>;
    read(ref: PageRef): Promise<PageSnapshot>;
    create(ref: PageRef, content: string): Promise<PageSnapshot>;
    write(ref: PageRef, content: string): Promise<PageSnapshot>;
    delete(ref: PageRef): Promise<void>;
  };
  location: {
    open(location: string): Promise<void>;
  };
};

type PageRef = { location: string } | { namespaceId: string; path: string };
```

API 呼び出しは manifest の permission と現在の context で検査します。

現行 API:

- `page.readCurrent`, `page.read` には `page-read` が必要。
- `page.create` には `page-create` が必要。
- `page.writeCurrent`, `page.write` には `page-write` が必要。
- `page.delete` には `page-delete` が必要。
- `location.open` には `location-open` が必要。

current 専用 permission は作りません。現在ページだけを扱う API も、任意ページ API と同じ `page-read` / `page-write` を使います。

`page.read` / `page.write` は UI 遷移しません。ページ内容が必要な plugin は API で明示的に読み、表示 location を変える必要がある場合だけ `location.open` を呼びます。

`page.create` は未作成ページだけを作成し、既存ページを指定した場合は reject します。`page.write` は既存ページの更新用で、未作成ページを暗黙に作りません。

イベント通知は今後の追加候補です。方針は、Host からの event は invalidation と最小 metadata に留め、plugin が最新本文を必要とする場合は `page.read` / `page.readCurrent` で取り直す形にします。これにより初期 render message の取りこぼしや stale content を避けます。

将来候補:

- `notify(message)` には `ui-notify` が必要。
- `events.subscribe("page.changed", handler)` は `page-read` が必要。
- `events.subscribe("location.changed", handler)` は追加 permission なし、または `location-open` とは別の read 系 permission にする。
