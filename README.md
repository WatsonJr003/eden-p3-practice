# 絶もうひとつの未来 P3「時間圧縮・絶」練習ツール

FF14「絶もうひとつの未来」P3「時間圧縮・絶」を、ブラウザ上で反復練習するための静的Webツールです。FF14本体、ACT、Dalamud、ゲームログ、ネットワークには接続しません。

早・中・遅ファイガ、ブリザガの練習、カウントなしモード、タンク・ヒーラー向けの擬似実戦、ビーム誘導、操作軌跡とゴースト比較を含みます。

## ローカルでの起動方法

`index.html` をダブルクリックして、任意のブラウザで開きます。Node.js、npm、サーバー、ビルド処理は不要です。

## ファイル構成

```text
eden-p3-practice/
├ index.html
├ style.css
├ script.js
├ README.md
└ .gitignore
```

## GitHub Pagesでの公開方法

1. GitHubで空のリポジトリ `eden-p3-practice` を作成します。
2. このフォルダーの内容を `main` ブランチへpushします。
3. GitHubリポジトリの **Settings → Pages** を開きます。
4. **Build and deployment** の **Source** で **Deploy from a branch** を選びます。
5. Branchを **main**、Folderを **/(root)** にして **Save** を押します。
6. 数分後に表示される公開URLを開きます。

GitHub Pagesの公開URL形式は、通常次のとおりです。

```text
https://<GitHubユーザー名>.github.io/eden-p3-practice/
```

## 更新方法

ファイルを編集した後、次のようにcommitして `main` へpushします。GitHub Pagesは自動的に更新されます。

```text
git add .
git commit -m "Update P3 practice tool"
git push origin main
```

## Google Sitesへの埋め込み

GitHub Pagesの公開URLを確認してから、Google Sitesで次の操作を行います。

1. **挿入 → 埋め込む → URL** を選びます。
2. GitHub Pagesの公開URLを貼り付けます。
3. プレビューを確認して **挿入** を押します。
4. Sitesを公開します。

このツールは外部サーバー通信・認証・iframe制限用の設定を使っていないため、GitHub Pagesの公開URLをそのまま埋め込む構成です。

## 調整箇所

`script.js` 冒頭の `SETTINGS` で、判定時刻・判定範囲・砂時計座標を調整できます。実測値が確定した場合は、各デバフの `steps` にある `checkAt` を変更してください。
