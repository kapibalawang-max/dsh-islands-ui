# 更新入口跟随用户强调色

> **状态**：已落地 — 1.1.12。`--isl-update-bg` 改为 `var(--isl-accent)`，悬停走 `color-mix`；实测绿/紫强调色下按钮底色随之变化。

Written against: `955902ccf19c307062088e0d8824233b0d2603a8`

## Evidence chain

- Surface: rail 底部、设置在齿轮上方的圆形更新入口（`.isl-updateButton`，`position: fixed`）。
- Problem: 入口自己的两个颜色变量把品牌蓝写死成 `#4176e6` / `#3264d4`，用户改了强调色后它仍然是蓝色。
  - `src/17-update.css:19-22`：`body[data-islands-ui] { --isl-update-bg: #4176e6; --isl-update-bg-hover: #3264d4; --isl-update-delivery... }`
  - `src/17-update.css:43`：`background: var(--isl-update-bg);`，`:61` 悬停用 `--isl-update-bg-hover`，`:47-48`、`:64-65`、`:73` 的光晕与焦点环都由 `--isl-update-bg` 派生。
- Design evidence:
  - `README.md`「设计语言」表最后一行：「强调色 | 默认品牌蓝，可改为紫 / 绿 / 橙 / 粉 / 红或任意取色」。
  - `README.md` 功能表「桌面更新入口」一行写明「加载态使用强调色 3×3 点阵动效」——更新入口的强调色行为是文档承诺，不只是审美偏好。
  - 强调色的运行路径已经存在且是唯一来源：`src/client.template.js:404` 在恢复默认时 `body.style.removeProperty('--isl-accent')`，`:407` 在选色时 `body.style.setProperty('--isl-accent', color)`；`src/00-tokens.css:23` 给 `--isl-accent` 默认值 `#4176e6`，`:163-168` 用 `data-islands-accent` 把 `--dsw-alias-state-business-primary` 指回 `var(--isl-accent)`。
- Owner: `src/17-update.css:19-22` 的两个私有变量；皮肤的强调色真源是 `--isl-accent`。
- Scope and affected surfaces: 只有 `.isl-updateButton` 及其 `is-hover` / `is-pending` / 光晕、焦点环读这两个变量；`src/16-rail.css` 与 `src/00-tokens.css` 的两处 `--isl-accent` 用法已经在正确轨道上，可作为对照。
- Uncertainty: 无。默认强调色与 `#4176e6` 相同，改完在默认状态下视觉零变化，只有换色后才生效，因此不存在「改动带来的回归风险」。

## Design decision

把更新入口的蓝色收回到 `--isl-accent`：`--isl-update-bg` 指向 `var(--isl-accent)`，悬停色由强调色派生（`color-mix`，与皮肤其它悬停的写法一致）。更新入口从此和其他强调色构件（rail 选中态、模型确认按钮、加载点阵）同源，`#4176e6` 只保留在 token 的默认值里。

## Reuse

- `--isl-accent`（`src/00-tokens.css:23`，由 `src/client.template.js:407` 写入）
- 派生写法 `color-mix(in srgb, <色> <比例>, transparent/black)`：`src/16-rail.css` 的 `.isl-railMenuCheck.is-on`、`src/17-update.css:47-48` 的阴影已经在用
- Exemplar: `src/16-rail.css` 里强调色构件的取色方式

不需要新原语：强调色 token 与派生写法都已存在。

## Changes

1. `src/17-update.css:19-22`
   - Change: `--isl-update-bg: #4176e6;` → `--isl-update-bg: var(--isl-accent);`；`--isl-update-bg-hover: #3264d4;` → `--isl-update-bg-hover: color-mix(in srgb, var(--isl-accent) 86%, #000);`；`--isl-update-danger` 不动。
   - Preserve: 变量名（`background`、阴影、焦点环全部通过它们派生，改名会漏掉 `:43/:47/:48/:61/:64/:65/:73` 六处引用）。
   - Verify: 默认状态下按钮仍是 `rgb(65, 118, 230)`；在 设置 → Islands UI → 强调色 选绿色后，按钮背景、悬停态、光晕、焦点环一起变绿，不再残留蓝色。

## Scope

- Inherit: `.isl-updateButton` 的正常/悬停/进行中/失败/预览全部状态，以及 showcase 卡里的预览按钮（同一个类名）。
- Verify: rail 底部入口在浅色与深色主题下的对比度（白字压强调色，`color: #fff` 位于 `src/17-update.css:44`；若用户选浅黄这类低对比色，现有行为与其他强调色构件一致，不在本次范围）。
- Exclude: `--isl-update-danger` 的红色（危险态与强调色无关）；点阵动效的 3×3 结构。

## Validation

- Product: 打开 设置 → Islands UI，依次选默认、绿、紫、自定义取色，回到 rail 看更新入口颜色是否同步。
- Interface: 默认与自定义强调色各一次；浅色与深色主题；hover 与 focus-visible 各一次；进行中（`is-pending`）状态可见。
- System: 确认没有残留私有蓝色变量，`grep -n "#4176e6" src/*.css` 只剩 `src/00-tokens.css:23` 的默认值。
- Repository: `node build.mjs && npm run check` → 全绿（check:build / check:css / check:parts / 4 tests / package）。

## Stop conditions

- 若更新入口的蓝色被上游文档明确写成「不随强调色变化」（目前 `README.md` 写的是「加载态使用强调色」），停止并改为在文档侧澄清，不要改样式。

## Design documentation

- 验收后：无需新增文档，`README.md`「强调色」与「桌面更新入口」两行已经描述了这个行为；本次改动是让实现回到文档。