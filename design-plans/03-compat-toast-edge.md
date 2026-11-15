# 兼容提示卡去掉左边缘色条

Written against: `955902ccf19c307062088e0d8824233b0d2603a8`

## Evidence chain

- Surface: 皮肤检测到与当前 DSH 版本不匹配时，右下角浮出的兼容提示卡（`.isl-compatToast`，由 `src/client.template.js:2451` 用原生 DOM 创建并挂到 `body`）。
- Problem: 卡片左侧叠了一条 3px 实心琥珀色条，右侧边框却是 1px 半透明琥珀。
  - `src/50-components.css:261`：`border: 1px solid rgba(224, 160, 24, 0.5);`
  - `src/50-components.css:262`：`border-left: 3px solid #e0a018;`
- Design evidence: 项目设计约束（全局 `AGENTS.md`「通用设计约束 / 形状与分隔」）规定「卡片左边缘的色条一律不用」。皮肤自身的 `README.md`「设计语言」表只定义了画布、岛屿（1px 发丝描边）、间距、顶栏、强调色，没有把左色条写成设计元素；同一套提示语汇里的设置页横幅 `.isl-compatBanner`（`src/50-components.css:331-341`）用的是 1px 琥珀描边 + 图标，没有色条。
- Owner: `src/50-components.css:250-275` 的 `.isl-compatToast` 规则块。
- Scope and affected surfaces: 只有提示卡本体；关闭按钮 `.isl-compatToastClose`、正文 `.isl-compatToastText`、动作行 `.isl-compatToastAction` 的内边距都按卡的 `padding` 排布，改 padding 会一并移动。
- Uncertainty: 无。卡片已经用琥珀描边、图标与标题三者共同表达「提醒」，去掉色条不改变它的语义强度。

## Design decision

删掉 `border-left: 3px solid #e0a018`，让四边统一回到 `1px solid rgba(224, 160, 24, 0.5)`；同时把左右内边距从 `12px 10px 12px 14px` 收敛成 `12px 14px`，与设置页横幅 `.isl-compatBanner` 的 `padding: 12px 14px` 对齐。色条的强调作用由既有的琥珀描边 + 图标承担。

## Reuse

- 既有描边值 `rgba(224, 160, 24, 0.5)`（同一条规则的 `border`）
- 内边距 `12px 14px`：`src/50-components.css:336` 的 `.isl-compatBanner`
- 图标与标题：`.isl-compatToastTitle` + 模板里的兼容图标

不需要新原语：这是把一处例外收回既有语汇。

## Changes

1. `src/50-components.css:261-262`（`.isl-compatToast`）
   - Change: 删除 `border-left: 3px solid #e0a018;`；`border: 1px solid rgba(224, 160, 24, 0.5);` 保留。
   - Preserve: `position: fixed; right: 16px; bottom: 16px; z-index: 2000`、`width: min(380px, calc(100vw - 32px))`、`box-shadow`、`cursor: pointer`、`transition` 与 `.is-visible` 的入场。
   - Verify: 四边等宽的琥珀发丝描边，不再有色条；深色主题下描边与图标（`.isl-compatToastAction` 深色为 `#f0c274`）对比度保持。

2. `src/50-components.css:260`（同一条规则的 `padding`）
   - Change: `padding: 12px 10px 12px 14px;` → `padding: 12px 14px;`
   - Preserve: 关闭按钮 `.isl-compatToastClose` 的 22×22 尺寸与 `gap: 6px`。
   - Verify: 标题、正文、动作行的左边界与设置页横幅一致；关闭按钮与右边缘间距仍为 14px。

## Scope

- Inherit: 提示卡的全部状态（初始淡入、`.is-visible`、点击整卡跳设置）。
- Verify: 兼容提示只在皮肤与宿主版本不匹配时出现——用 `dsh-islands-ui` 的兼容检查路径触发一次（`src/client.template.js` 的 `showCompatibilityToast`）。
- Exclude: 设置页横幅 `.isl-compatBanner`（本来就无色条）、提示卡的文案与图标语义。

## Validation

- Product: 触发一次兼容提示，确认卡片四边等宽、文字与关闭按钮位置正常。
- Interface: 浅色与深色主题；1440×900 与 1024×700 两种宽度（`min(380px, calc(100vw - 32px))` 生效时）；长文案换行。
- System: 确认删除后没有别的规则再给提示卡加左色条，`grep -n "border-left: 3px" src/*.css` 无结果。
- Repository: `node build.mjs && npm run check` → 全绿（check:build / check:css / check:parts / 4 tests / package）。

## Stop conditions

- 若删掉色条后提示卡在深色画布上不再被识别为提醒（视觉上弱于背景），停止并改用既有琥珀描边加深一档，而不是恢复色条。

## Design documentation

- 验收后：无需新增，`README.md` 设计语言表未涉及提示卡；如果后续要把「提示卡 = 琥珀描边 + 图标」写成规则，再加“提示 | 琥珀发丝描边 + 图标，不用边缘色条”一行。