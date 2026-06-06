# daibase

Minimal desktop app built with Tauri v2, React, react-router v7, MUI, TypeScript, and Vite.

## セットアップ

Node.js, pnpm, Rust, and the Tauri prerequisites for your OS are required.

```sh
pnpm install
```

## 開発サーバー起動

```sh
pnpm tauri dev
```

Frontend only:

```sh
pnpm dev
```

## ビルド

```sh
pnpm build
pnpm tauri build
```

## lint / typecheck / test

Frontend:

```sh
pnpm lint
pnpm typecheck
```

Rust:

```sh
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

## ドキュメント

- `docs/content-app-design.md`: アプリ全体の設計メモ
- `docs/plugin-development.md`: プラグインの現行仕様、配布、登録方法
- `docs/plugin-host-design.md`: Plugin Host 方式の設計判断
