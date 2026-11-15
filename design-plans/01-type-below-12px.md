# 把 10–11px 的文字提到 12px 下限

> **状态**：已落地 — 1.1.12。十条规则提高；1.1.13 下线模型弹层后 `.isl-modelGroupName` / `.isl-modelError` 两条随样式表一并删除，实际改动 8 条。

Written against: `955902ccf19c307062088e0d8824233b0d2603a8`

## Evidence chain

- Surface: 侧栏 rail 的悬停菜单（标题、工作区 Owner 副行、底部提示）、置顶区计数、模型弹层的分组名与错误行、设置页诊断行、兼容提示里的锚点 chip、更新入口的 showcase 阶段标签。
- Problem: 十条规则把可见文字设成 10px 或 11px，低于 12px 下限。

  | 位置 | 选择器 | 当前值 |
  | --- | --- | --- |
  | `src/16-rail.css:177` | `.isl-railMenuTitle` | `font-size: 11px` |
  | `src/16-rail.css:231` | `.isl-railMenuSub` | `font-size: 10px` |
  | `src/16-rail.css:261` | `.isl-railMenuHint` | `font-size: 10px` |
  | `src/17-update.css:378` | `.isl-updateShowcasePhase` | `font-size: 10px` |
  | `src/20-sidebar.css:472` | `.isl-pinnedCount` | `font-size: 11px` |
  | `src/45-model-picker.css:150` | `.isl-modelGroupName` | `font-size: 11px` |
  | `src/45-model-picker.css:355` | `.isl-modelError` | `font-size: 11px` |
  | `src/50-components.css:164` | `.isl-settingsMeta` | `font-size: 11px` |
  | `src/50-components.css:174` | `.isl-settingsMetaValue` | `font-size: 11px` |
  | `src/50-components.css:389` | `.isl-compatAnchor` | `font-size: 11px` |

- Design evidence: 项目设计约束（全局 `AGENTS.md`「通用设计约束 / 排版」）规定「字号档位……最小 12px」，对界面评审同样生效。皮肤自身没有排版档位文档：`README.md`「设计语言」表只记录了画布、岛屿、间距、顶栏、强调色五行，未定义字号阶梯，因此没有任何一处把 10–11px 写成有意为之。
- Owner: 上述六条规则各自所在的文件；皮肤没有字号 token，唯一承载这一档位的地方就是这十条 `font-size` 声明。
- Scope and affected surfaces: 十个选择器全部由 `src/client.template.js` 渲染（`.isl-railMenuSub` 在 1225 行、`.isl-railMenuHint` 在 1234 行、`.isl-pinnedCount` 在 2271 行、`.isl-modelGroupName` 在 1723 行、`.isl-compatAnchor` 在 2320 行、`.isl-updateShowcasePhase` 在 1510 行、`.isl-compatToast` 相关在 2451 行起），因此都落在真实渲染路径上。
- Uncertainty: 无。行高均不低于 14px，12px 字号装入现有行高不需要改行高。

## Design decision

把这十条规则的 `font-size` 提到 `12px`，行高维持现状（14–16px 已能容纳 12px 文字）。这是把可见文字拉回下限，不是重新设计字号阶梯：12px 与既有的 12/13/14px 主力档位合并，不需要新增 token。

## Reuse

- 既有档位：`font-size: 12px`（`src/16-rail.css`、`src/20-sidebar.css`、`src/45-model-picker.css`、`src/50-components.css` 里已有 14 处使用）
- Exemplar: `src/20-sidebar.css` 的会话行时间戳与 `src/50-components.css` 的 `.isl-compatBannerBody`，两者都以 12px 承载同等级的次要信息。

不需要新原语：档位已经存在，缺的只是把这十条指过去。

## Changes

1. `src/16-rail.css:177`（`.isl-railMenuTitle`）
   - Change: `font-size: 11px` → `font-size: 12px`；`line-height: 16px` 保持。
   - Preserve: `padding: 4px 8px 6px`、`color: var(--dsw-alias-label-tertiary)`。
   - Verify: rail 菜单标题与工作区名同级可读，不再比下面的行更小。

2. `src/16-rail.css:231`（`.isl-railMenuSub`）、`src/16-rail.css:261`（`.isl-railMenuHint`）
   - Change: `font-size: 10px` → `font-size: 12px`；`line-height: 14px` 保持。
   - Preserve: 单行截断（`white-space: nowrap` / `text-overflow: ellipsis`）与 `border-top` 分隔线。
   - Verify: 菜单宽度不变时 Owner 名截断位置后移但不换行；底部提示不撑高菜单。

3. `src/17-update.css:378`（`.isl-updateShowcasePhase`）
   - Change: `font-size: 10px` → `font-size: 12px`；`line-height: 14px` 保持。
   - Preserve: 等宽字体族与 `color: var(--dsw-alias-label-tertiary)`。
   - Verify: showcase 卡里的阶段标签与 12px 的 `.isl-updateShowcaseLabel` 视觉同档。

4. `src/20-sidebar.css:472`（`.isl-pinnedCount`）
   - Change: `font-size: 11px` → `font-size: 12px`。
   - Preserve: `margin-left: auto`、`font-weight: 400`、tertiary 颜色。
   - Verify: 置顶标题行右侧计数的基线仍与标题中线对齐，两位数计数不挤出边界。

5. `src/45-model-picker.css:150`（`.isl-modelGroupName`）、`src/45-model-picker.css:355`（`.isl-modelError`）
   - Change: `font-size: 11px` → `font-size: 12px`；行高保持 16px。
   - Preserve: 分组名的 `padding: 6px 8px 2px`、错误行的 `border-radius` 与 error 语义色。
   - Verify: 模型菜单分组标题与 12px 的菜单正文同档；错误行仍单行可读、不换行撑高。

6. `src/50-components.css:164`（`.isl-settingsMeta`）、`src/50-components.css:174`（`.isl-settingsMetaValue`）、`src/50-components.css:389`（`.isl-compatAnchor`）
   - Change: `font-size: 11px` → `font-size: 12px`；行高与内边距保持。
   - Preserve: `.isl-settingsMeta` 的 `flex-wrap`、`.isl-settingsMetaValue` 的等宽字体与底色 chip、`.isl-compatAnchor` 的 `padding: 0 4px`。
   - Verify: 设置页诊断行在窄侧栏里仍可换行，长选择器 chip 不溢出。

## Scope

- Inherit: 上述十个选择器所属的六个样式文件；构建产物 `client.js` 随 `node build.mjs` 更新。
- Verify: 置顶区标题行、rail 菜单、模型弹层、设置页、更新入口 showcase、兼容提示（兼容提示只在皮肤与宿主版本不匹配时出现）。
- Exclude: 宿主自身的字号；13/14/15/16/18px 这些高于下限的档位不在本次范围（是否收敛档位数量是另一个决定）。

## Validation

- Product: 打开 rail 菜单、模型弹层、设置页与置顶区，逐处确认文字不小于 12px 且没有挤压换行。
- Interface: 1440×900 与 1024×700 两种宽度；浅色与深色主题；置顶计数为两位数；模型名与 Owner 名取最长的一条；错误行触发一次。
- System: 确认没有新增 token 或平行档位，改动只把既有声明指向已存在的 12px 档位。
- Repository: `node build.mjs && npm run check` → `check:build` 通过（client.js 与源码一致）、`check:css ok`、`check:parts ok`、4 个测试全绿、`package check passed`。

## Stop conditions

- 若某处 12px 文字在既有行高内被裁切、或菜单/卡片因此撑高，停止并按该处的行高与内边距重新定值，不要改动其它选择器。
- 若发现上游已把某一处刻意写成 10px 并在文档中说明（目前 `README.md` 设计语言表没有），停止并把该处从清单中剔除。

## Design documentation

- 验收后：在 `README.md`「设计语言」表补一行「字号 | 最小 12px，12/13/14px 为主力档位」，位置在「间距」行之后。