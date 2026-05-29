# コンテンツ管理アプリ設計

## 目的

Daibase は、ユーザーが選択したローカルフォルダ内の Markdown や画像などのファイルを管理するアプリです。コンテンツはネームスペース単位で整理します。各ネームスペースは 1 つの保存先フォルダを持ち、必ず `Main` ページから始まり、他の Markdown ページや画像などのローカルアセットへリンクできます。

管理対象のファイルは、Git ではなく Daibase 独自のバージョン管理で履歴を保存します。初期実装では通常の編集を安全に行えることを優先し、将来的な復元や差分表示に対応できる履歴データを保存します。

## プロダクトモデル

### ネームスペース

ネームスペースは独立したコンテンツ領域です。

- `id`: アプリ内部で使う安定した識別子。
- `name`: ユーザーに表示する名前。
- `root_path`: ユーザーが選択したローカル保存先フォルダ。
- `created_at`, `updated_at`: メタデータの日時。
- `default_page`: 常に `Main`。

ルール:

- 1 つのネームスペースは必ず 1 つのローカルフォルダを指します。
- ネームスペースは複数作成できます。
- アプリ起動時は、可能であれば最後に開いていたネームスペースを開きます。
- 保存先フォルダが存在しない、アクセスできない、権限がない場合は、ユーザーがフォルダを再指定できる復旧可能な状態を表示します。

### ページ

ページはネームスペース内の Markdown ファイルです。

- 最初に必ず存在するページは `Main` です。
- `Main` の標準ファイル名は `Pages/Main.md` です。
- Markdown ページはすべて `Pages/` 配下に保存します。
- UI のロケーションバーやページ一覧では、`Page:Main` のように `Page:` 種別と名前をコロン区切りで表示します。
- ページタイトルは Markdown ファイルのパスに対応します。
- リンク先のファイルがまだ存在しない場合でも、ナビゲーション先として扱えます。

推奨する内部 ID:

- ページやアセットには、作成時に `file_id` を割り当てます。
- `file_id` はリネームや移動では変わらない永続 ID です。
- `Pages/Main.md` や `Pages/Projects/Roadmap.md` のような相対パスは、現在の表示・保存場所を表す属性として扱います。
- `Page:Main` や `Page:Projects/Roadmap` は UI 上のロケーション表現であり、実ファイルパスには使いません。
- 表示タイトルや相対パスはリネームや階層化で変わるため、履歴追跡用の永続 ID としては使いません。

### アセット

アセットはネームスペース内の Markdown 以外のファイルです。初期対象は画像です。

- アセットはデフォルトで `_assets/` 配下に保存します。
- Markdown からは相対リンクで参照します。
- アセットもページと同じ独自履歴ストアでバージョン管理します。

## ストレージ構成

各ネームスペースのルートは、ユーザーがアプリ外からも確認・編集できる通常のフォルダです。ユーザーのコンテンツ本体はルート直下に置き、Daibase の管理データは `.daibase/` 配下に集約します。

```text
<namespace-root>/
  .daibase/
    namespace.json
    versions/
      objects/
        ab/
          abcd1234...
      revisions/
        2026/
          05/
            29/
              rev_01HX...json
      files/
        file_01HX...json
      path_index.json
    locks/
  Pages/
    Main.md
    Example.md
  _assets/
    image.png
```

### `.daibase/namespace.json`

アプリ固有のメタデータを保存します。

```json
{
  "schema_version": 1,
  "namespace_id": "uuid",
  "name": "Personal",
  "default_page": "Pages/Main.md",
  "created_at": "2026-05-29T00:00:00Z"
}
```

### `.daibase/versions/objects/`

ファイル内容の実体を保存するコンテンツアドレス型ストアです。

- オブジェクト ID はファイル内容の SHA-256 ハッシュにします。
- 同じ内容は 1 回だけ保存します。
- テキストも画像も同じ仕組みで保存します。
- 大きな画像やバイナリは、初期実装ではファイル全体を 1 オブジェクトとして保存します。

例:

```text
.daibase/versions/objects/ab/abcd1234...
```

### `.daibase/versions/revisions/`

保存操作ごとのリビジョンメタデータを JSON で保存します。リビジョンは「いつ、どのファイルが、どの内容になったか」を表します。

```json
{
  "schema_version": 1,
  "revision_id": "rev_01HX...",
  "created_at": "2026-05-29T00:00:00Z",
  "device_id": "device_01HX...",
  "parent_revision_ids": ["rev_01HW..."],
  "message": "Update Main",
  "changes": [
    {
      "file_id": "file_01HX...",
      "path": "Pages/Main.md",
      "kind": "modified",
      "content_type": "text/markdown",
      "object_id": "sha256:abcd...",
      "size": 1234
    }
  ]
}
```

リネームや移動もリビジョンの変更種別として保存します。この場合、内容が変わらなくても `file_id` は維持し、パスだけを変更します。

```json
{
  "schema_version": 1,
  "revision_id": "rev_01HY...",
  "created_at": "2026-05-29T01:00:00Z",
  "device_id": "device_01HX...",
  "parent_revision_ids": ["rev_01HX..."],
  "message": "Rename Main to Start",
  "changes": [
    {
      "file_id": "file_01HX...",
      "kind": "renamed",
      "from_path": "Pages/Main.md",
      "to_path": "Pages/Start.md",
      "object_id": "sha256:abcd..."
    }
  ]
}
```

### `.daibase/versions/files/`

ファイルごとの履歴インデックスを `file_id` 単位で保存します。履歴一覧を高速に表示するための派生データです。

```json
{
  "schema_version": 1,
  "file_id": "file_01HX...",
  "current_path": "Pages/Start.md",
  "revisions": [
    {
      "revision_id": "rev_01HX...",
      "object_id": "sha256:abcd...",
      "created_at": "2026-05-29T00:00:00Z",
      "kind": "modified",
      "path": "Pages/Main.md"
    },
    {
      "revision_id": "rev_01HY...",
      "object_id": "sha256:abcd...",
      "created_at": "2026-05-29T01:00:00Z",
      "kind": "renamed",
      "from_path": "Pages/Main.md",
      "to_path": "Pages/Start.md"
    }
  ]
}
```

このファイルはリビジョン一覧から再構築できる前提にします。破損時は `revisions/` から再生成します。

### `.daibase/versions/path_index.json`

現在のパスから `file_id` を引くためのインデックスです。アプリ起動時の一覧表示やリンク解決に使います。

```json
{
  "schema_version": 1,
  "entries": {
    "Pages/Start.md": "file_01HX...",
    "Pages/Example.md": "file_01HZ..."
  }
}
```

このファイルも派生データです。リビジョン一覧から再構築できます。

## 独自バージョン管理の方針

Daibase のバージョン管理は、ローカルファイルをそのまま使える状態に保ちながら、保存時点の内容を `.daibase/versions/` に追記する仕組みにします。

設計方針:

- Git は使いません。
- 通常の編集対象はネームスペース内の実ファイルです。
- 保存時に現在の内容をオブジェクトストアへ保存します。
- 保存操作ごとにリビジョン JSON を追記します。
- リビジョン ID は ULID を使い、`rev_<ULID>` 形式にします。
- 既存リビジョンと既存オブジェクトは原則として変更しません。
- 差分表示は Markdown ではテキスト差分、画像ではメタデータ差分とプレビュー比較から始めます。
- オブジェクトは SHA-256 による重複排除を行います。
- 大きなバイナリに対する圧縮、差分保存、履歴整理は初期スコープに含めません。
- 将来的にチェックサム検証やリモート同期を追加できるようにします。

### 初期フェーズ

初期実装では、意味のあるコンテンツ変更をリビジョンとして保存します。

推奨挙動:

- ネームスペース作成時に `.daibase/` と `.daibase/versions/` を初期化します。
- `Pages/Main.md` がなければ作成します。
- ネームスペースメタデータと `Pages/Main.md` の初期リビジョンを保存します。
- 保存時は実ファイルを書き込み、同じ内容をオブジェクトストアへ保存し、リビジョンを追加します。
- アセットのインポート時は、ファイルをネームスペース内にコピーしてリビジョンを追加します。
- 保存操作では内容が前回保存と同一でも新しいリビジョンを作成します。同じ内容のオブジェクトは重複保存せず、既存の `object_id` を参照します。

リビジョンメッセージ例:

- `Create namespace`
- `Update Main`
- `Add asset image.png`

### 将来フェーズ

このストレージモデルで以下に対応できるようにします。

- ファイルごとの履歴一覧。
- 1 ファイルを過去バージョンへ復元。
- ネームスペース全体を過去リビジョン時点へ復元。
- Markdown テキストの差分表示。
- バイナリアセットのメタデータ変更表示と画像バージョンプレビュー。
- 履歴データの整合性チェック。
- リモート同期。

## リモート同期方針

リモート同期はスコープに含めます。推奨する方式は、ユーザーの現在ファイルだけを同期するのではなく、`.daibase/versions/` のリビジョンとオブジェクトを追記型で同期する方式です。

この方式では、各端末が未同期のリビジョン JSON と不足しているオブジェクトだけを送受信します。オブジェクトは SHA-256 で内容が識別できるため、同じ内容を複数回アップロードする必要がありません。リビジョン ID は ULID なので、時系列に近い順序で扱いやすく、端末間で ID が衝突しにくいです。

### 同期対象

- `.daibase/namespace.json`
- `.daibase/versions/revisions/`
- `.daibase/versions/objects/`
- 必要に応じて `.daibase/versions/files/` と `path_index.json`

`files/` と `path_index.json` は派生データなので、同期してもよいですが、信頼できる正本は `revisions/` と `objects/` です。

### 同期バックエンド案

初期の現実的な候補は次の順です。

1. S3 互換オブジェクトストレージ
   - リビジョン JSON とオブジェクトをキー単位で保存できます。
   - 追記型ストアと相性がよく、クライアント実装も単純です。
   - Cloudflare R2、AWS S3、MinIO などを選べます。
2. WebDAV
   - Nextcloud などの既存ストレージを使えます。
   - 個人利用では導入しやすい一方、ロックや一覧取得の性能に注意が必要です。
3. Daibase 専用同期サーバー
   - 競合解決、認証、差分取得、暗号化を最も制御しやすい方式です。
   - 初期コストは高いので、最初から必須にはしません。

推奨は、まず S3 互換オブジェクトストレージを抽象化した `SyncBackend` を作り、後から WebDAV や専用サーバーを追加できる形です。

### 競合方針

リビジョンには `device_id` と `parent_revision_ids` を保存します。同期後に同じ `file_id` に対して共通親から分岐したリビジョンが見つかった場合は競合として扱います。

- Markdown は将来的に 3-way merge を検討します。
- 初期実装では自動マージせず、競合版を両方残してユーザーに選ばせます。
- 画像やその他バイナリは自動マージせず、どちらを採用するか選ばせます。
- 競合解決も新しいリビジョンとして保存します。

### 暗号化

リモート同期では、将来的にクライアント側暗号化を検討します。暗号化する場合も、オブジェクト単位で暗号化し、リビジョンメタデータには必要最小限の情報だけを残す方針にします。

## リンクモデル

Markdown リンクは通常の Markdown として保持します。

対応する形式:

```markdown
[Roadmap](Roadmap.md)
![Diagram](../_assets/diagram.png)
```

Wiki 形式リンクは後から追加できます。

```markdown
[[Roadmap]]
[[Projects/Roadmap]]
```

初期実装では通常の Markdown リンクだけで十分です。ファイルの可搬性も保てます。

ナビゲーションルール:

- 相対パスの Markdown リンクはアプリ内で開きます。
- 既存アセットへのリンクはアセットプレビューを開きます。
- 存在しない Markdown リンクは、リンク先ページの作成を提案します。
- 外部の `http:` / `https:` リンクはアプリ外で開きます。

## アーキテクチャ

### Rust / Tauri レイヤー

Rust 側はファイルシステム、独自バージョン管理、パス検証、OS 連携を担当します。

主な責務:

- アプリ設定ディレクトリ内でネームスペース一覧を管理する。
- Tauri のダイアログで保存先フォルダを選択する。
- ページやアセットのパスが必ずネームスペースルート内に収まることを検証する。
- ネームスペース内ファイルの読み込み、書き込み、リネーム、削除を行う。
- `.daibase/versions/` の初期化、追記、検証、復元を行う。
- フロントエンドへ型付きのエラーを返す。

推奨モジュール構成:

```text
src-tauri/src/
  lib.rs
  commands.rs
  namespace.rs
  content.rs
  versioning.rs
  object_store.rs
  paths.rs
```

推奨依存関係:

- `sha2`: ファイル内容のハッシュ計算。
- `uuid`: ネームスペース ID。
- `ulid`: `file_id`、`device_id`、リビジョン ID。
- `chrono` または `time`: 日時。
- `mime_guess`: アセットの MIME type 推定。
- `similar`: Markdown 差分の生成。
- Tauri の dialog / filesystem プラグイン: ネイティブのフォルダ・ファイル選択が必要な場合。

### React レイヤー

React 側はアプリ状態とユーザー操作を担当します。

主な責務:

- ネームスペース選択。
- ページツリーとアセットブラウザ。
- Markdown エディタ。
- Markdown プレビュー。
- リンクナビゲーション。
- 保存状態とエラー表示。
- 将来的な履歴・差分ビュー。

Markdown プレビューは自前パーサではなく、unified / remark / rehype エコシステムに対応した `react-markdown` を使います。GFM などの拡張は `remark-gfm` のような plugin で追加し、将来の wiki 形式リンクや独自リンク解決も plugin または component 差し替えで拡張できるようにします。

推奨ルート:

```text
/
/namespace/:namespaceId/page/*path
/namespace/:namespaceId/asset/*path
/namespace/:namespaceId/history/*path
```

推奨フロントエンド構成:

```text
src/
  api/
    tauriCommands.ts
  routes/
    HomePage.tsx
    NamespacePage.tsx
  features/
    namespace/
    editor/
    content-tree/
    preview/
    history/
```

## Tauri Commands

初期 command API 案:

```rust
list_namespaces() -> Vec<NamespaceSummary>
create_namespace(name: String, root_path: PathBuf) -> NamespaceSummary
open_namespace(namespace_id: String) -> NamespaceDetail
repair_namespace_path(namespace_id: String, root_path: PathBuf) -> NamespaceSummary

read_page(namespace_id: String, path: String) -> PageContent
write_page(namespace_id: String, path: String, content: String) -> SaveResult
create_page(namespace_id: String, path: String) -> PageContent
rename_file(namespace_id: String, file_id: String, new_path: String) -> FileSummary
list_content(namespace_id: String) -> ContentTree

import_asset(namespace_id: String, source_path: PathBuf, target_dir: String) -> AssetSummary
read_asset_metadata(namespace_id: String, path: String) -> AssetMetadata

resolve_path(namespace_id: String, path: String) -> FileSummary
list_file_history(namespace_id: String, file_id: String) -> Vec<FileVersion>
diff_file(namespace_id: String, file_id: String, from_revision: String, to_revision: String) -> FileDiff
restore_file(namespace_id: String, file_id: String, revision_id: String) -> SaveResult
verify_history(namespace_id: String) -> HistoryCheckResult
```

最初の実用マイルストーンでは、ネームスペース管理とページの読み書き command だけで十分です。履歴系 command は、ストレージと保存フローが安定してから実装します。

## セキュリティ

最もリスクが高いのはパス処理です。

ルール:

- フロントエンドから渡されるパスは、すべてネームスペースからの相対パスとして扱います。
- ページやアセット操作では絶対パスを拒否します。
- パスを正規化し、`..` によるディレクトリ脱出を拒否します。
- 解決後のパスが必ずネームスペースルート配下であることを検証します。
- `.daibase/` 配下はアプリ管理領域として扱い、通常のページ・アセット操作対象から除外します。
- 初期実装では、書き込み先を対応済みのコンテンツ領域に制限します。
- Tauri capability は最小権限に保ち、広いファイルシステム権限をフロントエンドへ直接渡さず command 経由で扱います。

## 整合性と障害対応

独自バージョン管理では、履歴データの整合性をアプリ自身が守る必要があります。

基本方針:

- リビジョンとオブジェクトは追記型で保存します。
- オブジェクト保存後にリビジョンを書きます。
- リビジョン JSON は一時ファイルへ書いてからリネームします。
- 保存処理中は `.daibase/locks/` にロックファイルを作成し、同時保存を防ぎます。
- 起動時または手動操作で、リビジョンが参照するオブジェクトの存在とハッシュを検証できます。
- 外部編集で実ファイルが変わっている場合は、次回保存時に新しいリビジョンとして取り込みます。

## UX フロー

### 初回起動

1. ネームスペース作成画面を表示します。
2. ユーザーがネームスペース名を入力し、ローカルフォルダを選択します。
3. アプリが `.daibase/`、`.daibase/versions/`、`Pages/Main.md` を初期化します。
4. アプリが `Main` の初期リビジョンを保存します。
5. アプリが `Main` を開きます。

### 通常起動

1. アプリがネームスペース一覧を読み込みます。
2. 最後に開いていたネームスペースがあれば、その `Main` ページまたは最後のページを開きます。
3. 開けるネームスペースがなければ、ネームスペース選択画面を表示します。

### 編集

1. ユーザーが Markdown を編集します。
2. アプリが未保存状態を管理します。
3. 保存すると実ファイルを書き込み、リビジョンを追加します。
4. UI に最新保存バージョンの日時を表示します。

オートセーブは後から追加できます。初期実装では、不要なリビジョンが増えすぎないように明示的な保存を採用します。

## マイルストーン

### Milestone 1: ローカルネームスペースと Main ページ

- ネームスペースの作成・オープン。
- ストレージ構成の初期化。
- `Pages/Main.md` の存在保証。
- `Pages/Main.md` の読み書き。
- 初期ネームスペースとページ更新のリビジョン保存。
- ネームスペース選択、ページ一覧、エディタ、プレビューを持つ基本 React レイアウト。

### Milestone 2: 独自履歴ストアの基礎

- SHA-256 ベースのオブジェクト保存。
- リビジョン JSON の追記。
- ファイル別履歴インデックスの更新。
- `file_id` による履歴追跡。
- パス変更を `renamed` リビジョンとして保存。
- 現在パスから `file_id` を引くインデックスの更新。
- 同一内容保存時はオブジェクトを重複保存せず、新しいリビジョンだけを追加。
- 履歴データの簡易検証。

### Milestone 3: リンクと複数ページ

- Markdown リンクを解析してナビゲーションする。
- 存在しないリンク先ページを作成する。
- `Pages/` 配下の Markdown ファイルを一覧する。
- ネストしたページパスに対応する。

### Milestone 4: アセット

- 画像を `_assets/` へインポートする。
- プレビュー内で画像リンクを表示する。
- アセット単体のプレビューを表示する。
- アセットの追加・置き換えをバージョン管理する。

### Milestone 5: 履歴

- リネームや移動をまたいでファイルごとの履歴を一覧する。
- Markdown の差分を表示する。
- 1 ファイルを過去リビジョンから復元する。
- ネームスペース全体の復元方針を固める。

### Milestone 6: ネームスペース保守

- ネームスペース名を変更する。
- ネームスペースフォルダの移動・再接続に対応する。
- アプリ外でのファイル変更を検出する。
- 外部編集による競合に近い状態を扱う。

### Milestone 7: リモート同期

- `SyncBackend` インターフェースを定義する。
- S3 互換オブジェクトストレージへリビジョンとオブジェクトを同期する。
- 不足しているリビジョンとオブジェクトだけを取得する。
- `device_id` と `parent_revision_ids` による分岐検出を行う。
- 競合した Markdown とバイナリの解決 UI を追加する。

## 決定済み方針

- Markdown ページはすべて `Pages/` 配下に保存します。
- 保存操作ごとに必ずリビジョンを作成します。
- wiki 形式リンクは初期リリースではサポートせず、将来的に導入します。
- リビジョン ID には ULID を使います。
- 大きなバイナリに対する圧縮、差分保存、履歴整理は行いません。
- リモート同期は将来スコープに含めます。

## 推奨する初期実装

まずは、ユーザーが選択したネームスペースフォルダ内に `.daibase/versions/` を作り、`Pages/Main.md` だけを明示的に保存できる Markdown エディタから始めます。保存時には実ファイルを書き込み、同じ内容を SHA-256 オブジェクトとして保存し、リビジョン JSON を追記します。

この流れが安定したら、通常の Markdown リンクによるナビゲーションと、存在しないリンク先ページの作成を追加します。その後、アセットと履歴ビューは同じネームスペース、パス検証、独自履歴ストアを再利用して実装できます。
