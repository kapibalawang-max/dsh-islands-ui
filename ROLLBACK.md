# 回滚手册

1.2.0 一次性加了十二项，所以每一层都留了退路：改主意可以只关一项，也可以整包退回 1.1.14。

## 备份在哪

| 内容 | 位置 |
| --- | --- |
| 1.1.14 源码快照 | `~/sonet/backups/dsh-islands-ui/dsh-islands-ui-1.1.14.tar.gz` |
| 1.1.14 装到本机的那份 `client.js` | `~/sonet/backups/dsh-islands-ui/client.js.1.1.14`（md5 `d15491e0a21435e3f026c73c605f54f6`） |
| git 标签 | `v1.1.14-backup`（指向 1.1.14 的发布提交） |
| 远端 1.1.14 提交 | `172ca8d3`（`https://codeload.github.com/kapibalawang-max/dsh-islands-ui/tar.gz/172ca8d3`） |

## 三种回滚

**只退某一项**（最快，不用重装）：打开 `⌘K` 或设置页 → Islands 界面，关掉对应开关。

| 想要的结果 | 操作 |
| --- | --- |
| 去掉点阵纹理 | 关「海面点阵」（写 `localStorage['dsh-islands-ui:sea'] = '0'`） |
| 去掉紧凑行高 | 关「紧凑行高」（`dsh-islands-ui:density` 清空或删键） |
| 回到默认配色 | 主题预设选「雾」（`dsh-islands-ui:theme` 删键） |
| 现在的强调色 | 强调色选第一个色块或「跟随主题」 |
| 整套皮肤停用 | 关「启用 Islands 界面」，立即回到 DSH 默认外观 |

**退代码**：

```bash
cd ~/sonet/dsh-islands-ui
git reset --hard v1.1.14-backup     # 回到 1.1.14 发布提交
npm run build && npm run check
```

**退本机装的那份**（不动代码也行）：

```bash
dsh plugin --profile desktop add "https://codeload.github.com/kapibalawang-max/dsh-islands-ui/tar.gz/172ca8d3"
```

或者直接覆盖已装文件再刷新：

```bash
cp ~/sonet/backups/dsh-islands-ui/client.js.1.1.14 \
   ~/.dsh/profiles/desktop/node_modules/dsh-islands-ui/client.js
```

然后 ⌘R。下次 `dsh plugin add` 会把它重新拉回远端版本，所以这只是临时手段。

## 一点背景

`client.js` 是构建产物，仓库里禁止只手改它（`npm run check:build` 会逐字节比对）。任何改动都走 `src/`，`npm run build` 重新生成。