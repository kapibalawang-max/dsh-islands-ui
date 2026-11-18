# 回滚手册

1.2.0 一次性加了十二项，所以每一层都留了退路：改主意可以只关一项，也可以整包退回 1.1.14。

## 备份在哪

| 内容 | 位置 |
| --- | --- |
| 1.1.14 源码 | git 标签 `v1.1.14-backup`（1.1.14 的发布提交，只在本地，未推到远端） |
| 1.1.14 的 `client.js` | `git show v1.1.14-backup:client.js`（md5 `d15491e0a21435e3f026c73c605f54f6`） |
| 远端 1.1.14 提交 | `172ca8d3`（`https://codeload.github.com/kapibalawang-max/dsh-islands-ui/tar.gz/172ca8d3`，在 `origin/main` 历史里） |

## 三种回滚

**只退某一项**（最快，不用重装）：打开 `⌘K` 或 设置 → 浮岛界面，关掉对应开关。

| 想要的结果 | 操作 |
| --- | --- |
| 去掉紧凑行高 | 关「紧凑行高」（删 `dsh-islands-ui:density` 键） |
| 回复不套边框 | 关「回复边框」（`dsh-islands-ui:reply-border` 写成 `off` 或删键） |
| 回到默认强调色 | 强调色选「默认」（删 `dsh-islands-ui:accent` 键） |
| 左侧栏图标复原 | 删 `dsh-islands-ui:rail` 与 `dsh-islands-ui:rail-pins` 两个键，刷新 |
| 整套皮肤停用 | 关「启用浮岛界面」，立即回到 DSH 默认外观（偏好保留） |

**退代码**：

```bash
cd ~/sonet/apps/dsh-islands-ui
git reset --hard v1.1.14-backup     # 回到 1.1.14 发布提交
npm run build && npm run check
```

**退本机装的那份**（不动代码也行）：

```bash
dsh plugin --profile desktop add "https://codeload.github.com/kapibalawang-max/dsh-islands-ui/tar.gz/172ca8d3"
```

或者直接覆盖已装文件再刷新：

```bash
git -C ~/sonet/apps/dsh-islands-ui show v1.1.14-backup:client.js \
  > ~/.dsh/profiles/desktop/node_modules/dsh-islands-ui/client.js
```

然后 ⌘R。下次 `dsh plugin add` 会把它重新拉回远端版本，所以这只是临时手段。

## 一点背景

`client.js` 是构建产物，仓库里禁止只手改它（`npm run check:build` 会逐字节比对）。任何改动都走 `src/`，`npm run build` 重新生成。
