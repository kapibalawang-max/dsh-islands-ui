/**
 * Browser half of the Islands UI skin.
 *
 * Publishes the stylesheet, marks the host parts, and registers the skin's own
 * chrome. The stylesheet lives in src/*.css, the host bridge in
 * src/host/runtime.js, and build.mjs inlines both — the module loader has no
 * filesystem access, so the built client.js is self-contained.
 */
window.__ModuleLoader__.load({
  id: 'dsh-islands-ui',
  factory(require) {
    const React = require('react');
    const ReactDOM = require('react-dom');
    const h = React.createElement;
    /*__HOST_RUNTIME__*/
    const CSS = '__ISLANDS_CSS__';

    const ATTRIBUTE = SKIN_ATTR;
    const STORAGE_KEY = 'dsh-islands-ui:enabled';
    const WORKSPACE_ATTR = 'data-islands-workspace-collapsed';
    /** Escape hatch, session scoped so the next launch re-runs the check. */
    const FORCE_KEY = 'dsh-islands-ui:force';
    /**
     * Contracts every Islands layout depends on. They do not exist when
     * `apply()` runs (the shell mounts afterwards), so the gate waits for the
     * root slot and only then decides whether this build still matches.
     */
    const CORE_CONTRACTS = [HOST.ROOT_SLOT, HOST.SIDEBAR_SLOT];
    const CORE_PARTS = ['layout-frame', 'center-column', 'sidebar-root'];
    const FRAME = partSelector('layout-frame');
    /** No shell content at all after this long: the build is unusable. */
    const COMPAT_TIMEOUT_MS = 6000;
    /** Content mounted but the frame anchor never showed up: rename, not slowness. */
    const COMPAT_CONTENT_GRACE_MS = 1200;
    let animateTimer;
    let skinRegistrar = null;
    let publishRightbarWidth = null;
    let activated = false;
    /** Release reported by the client boot, and the structure observed on the page. */
    let shellVersion = null;
    let shellStructure = 'unknown';
    let styleTag = null;
    let compatState = { status: 'checking', missing: [], forced: false, version: null, structure: 'unknown' };
    const compatListeners = new Set();

    /** Copy for the preference row; the row is the only user-facing string. */
    const COPY = {
      zh: {
        title: 'Islands 界面',
        description: '悬浮岛屿式布局：圆角面板、常驻左侧导航栏与独立的工作区列表。关闭后立即恢复默认外观。',
        topbarToggle: '折叠或展开工作区',
        openRight: '打开侧边栏',
        closeRight: '关闭侧边栏',
        workspace: '工作区',
        pinned: '置顶',
        statusRunning: '运行中',
        statusApproval: '等待审批',
        statusPlanReview: '等待确认计划',
        statusQuestion: '等待回答',
        statusPending: '等待处理',
        statusDone: '已完成，未查看',
        statusIdle: '空闲',
        untitled: '未命名会话',
        locate: '定位到会话',
        unpin: '取消置顶',
        schedules: '自动化任务',
        plugins: '插件',
        settings: '设置',
        railTitle: '左侧栏图标',
        railHint: '点击切换显示；按住图标拖动可排序',
        railShow: '显示在左侧栏',
        railHide: '从左侧栏移除',
        builtIn: 'DSH 内置',
        noExtras: '左侧栏还没有图标',
        enable: '启用 Islands 界面',
        enableDesc: '关闭后立即恢复 DSH 默认外观，设置会保留。',
        accent: '强调色',
        accentDesc: '用于选中状态、滑块、发送按钮等。',
        accentDefault: '跟随主题',
        accentCustom: '自定义颜色',
        models: '选择模型',
        effort: '推理等级',
        back: '返回',
        noEffort: '该模型没有可调推理等级',
        reset: '恢复默认',
        loading: '加载中…',
        pick: '选择模型',
        empty: '没有可用模型',
        failed: '切换失败',
        updateAvailable: '发现新版本 {version}',
        updateAvailablePlain: '发现新版本',
        updateDownloading: '正在下载更新 {percent}%',
        updateDownloadingDetail: '正在下载更新：{percent}%\n目标版本：{version}',
        updateVerifying: '正在校验更新文件…',
        updateInstalling: '正在准备重启…',
        updateReady: '安装并重启',
        updateReadyDetail: '新版本 {version} 已准备就绪，点击安装并重启',
        updateRetry: '重试更新',
        updateFailedCheck: '检查更新失败，请稍后重试。',
        updateFailedCheckNetwork: '检查更新失败，请检查网络连接后重试。',
        updateFailedDownload: '下载更新失败，请重试。',
        updateFailedDownloadNetwork: '下载更新失败，请检查网络连接后重试。',
        updateFailedInstall: '安装更新失败，请稍后重试。',
        updateFailedInstallNetwork: '安装更新失败，请检查网络连接后重试。',
        updateFailedStop: '未能安全停止任务，更新尚未安装，请稍后重试。',
        updateFailedTasksChanged: '有新任务开始运行，请重新确认是否停止任务并更新。',
        updateFailedTasksUnavailable: '无法确认任务状态，请在工作区就绪后重试更新。',
        updateFailedFullscreen: '无法退出全屏，请退出全屏后重试更新。',
        updateFailedGeneric: '更新失败，请稍后重试。',
        updateConfigUnavailable: '配置不可用',
        updateConfigRead: '更新已暂停：无法读取配置文件',
        updateConfigFormat: '更新已暂停：配置文件格式有误',
        updateConfigChannel: '更新已暂停：channel 只能是 nightly 或 stable',
        updateConfigCleanup: '更新已暂停：无法清理旧更新，请重启应用',
        updateConfigGeneric: '更新已暂停：配置不可用',
        updateShowcaseTitle: '更新按钮状态',
        updateShowcaseDesc: '桌面端设置齿轮上方的更新入口在各阶段的外观；没有可用更新时按钮隐藏。',
        updateStateAvailable: '发现新版本',
        updateStateDownloading: '下载中',
        updateStateVerifying: '校验中',
        updateStateInstalling: '准备重启',
        updateStateReady: '安装并重启',
        updateStateError: '更新失败',
        compatTitle: 'Islands UI 已自动关闭',
        compatBody: '当前 DSH 构建的界面结构与插件不匹配，皮肤已回退到默认外观，以免出现双栏重叠或控件遮挡。',
        compatView: '查看插件设置',
        compatMissing: '缺失的界面契约',
        compatBannerTitle: '皮肤已自动停用：界面结构不匹配',
        compatBannerBody:
          'Islands UI 的样式依赖 DSH 公开的插槽、相位等契约，以及皮肤写回的部件标记。当前构建缺少核心契约，浮岛布局、原生导航隐藏和工作区折叠都会失效，因此插件没有启用皮肤，DSH 保持默认外观。',
        compatFix: '处理方式：把 Islands UI 更新到适配当前 DSH 的版本，或回退 DSH。若确认界面正常，可临时强制启用（下次启动会重新检测）。',
        compatForce: '仍然启用',
        compatForced: '已强制启用，本次会话跳过自动检测。',
        compatDismiss: '关闭提示',
        compatDetected: '检测到 DSH',
        compatStructure: '侧栏结构',
        compatStructureFlat: '平铺',
        compatStructureScroll: '滚动容器',
      },
      en: {
        title: 'Islands interface',
        description:
          'Floating-island layout with rounded panels, a persistent rail and an islanded workspace list. Turn off to return to the default look immediately.',
        topbarToggle: 'Collapse or expand the workspace',
        openRight: 'Open side panel',
        closeRight: 'Close side panel',
        workspace: 'Workspace',
        pinned: 'Pinned',
        statusRunning: 'Running',
        statusApproval: 'Waiting for approval',
        statusPlanReview: 'Waiting for plan review',
        statusQuestion: 'Waiting for an answer',
        statusPending: 'Waiting for you',
        statusDone: 'Finished, not viewed',
        statusIdle: 'Idle',
        untitled: 'Untitled session',
        locate: 'Reveal in workspace',
        unpin: 'Unpin session',
        schedules: 'Automation',
        plugins: 'Plugins',
        settings: 'Settings',
        railTitle: 'Left rail icons',
        railHint: 'Click to show or hide; drag an icon to reorder',
        railShow: 'Show in the left rail',
        railHide: 'Remove from the left rail',
        builtIn: 'Built into DSH',
        noExtras: 'No icons on the left rail',
        enable: 'Enable Islands UI',
        enableDesc: 'Turn off to restore the default appearance immediately; your settings are kept.',
        accent: 'Accent color',
        accentDesc: 'Used for selected states, sliders, the send button and more.',
        accentDefault: 'Follow theme',
        accentCustom: 'Custom color',
        models: 'Select model',
        effort: 'Reasoning',
        back: 'Back',
        noEffort: 'This model has no adjustable reasoning level',
        reset: 'Reset to default',
        loading: 'Loading…',
        pick: 'Select model',
        empty: 'No models available',
        failed: 'Selection failed',
        updateAvailable: 'Update {version} available',
        updateAvailablePlain: 'Update available',
        updateDownloading: 'Downloading update {percent}%',
        updateDownloadingDetail: 'Downloading update: {percent}%\nTarget version: {version}',
        updateVerifying: 'Verifying update files…',
        updateInstalling: 'Preparing to restart…',
        updateReady: 'Install and restart',
        updateReadyDetail: 'Version {version} is ready. Click to install and restart.',
        updateRetry: 'Retry update',
        updateFailedCheck: 'Could not check for updates. Please try again later.',
        updateFailedCheckNetwork: 'Could not check for updates. Check your connection and try again.',
        updateFailedDownload: 'Could not download the update. Please try again.',
        updateFailedDownloadNetwork: 'Could not download the update. Check your connection and try again.',
        updateFailedInstall: 'Could not install the update. Please try again later.',
        updateFailedInstallNetwork: 'Could not install the update. Check your connection and try again.',
        updateFailedStop: 'Could not safely stop the tasks. The update has not been installed. Please try again later.',
        updateFailedTasksChanged: 'New tasks have started. Confirm again to stop the tasks and update.',
        updateFailedTasksUnavailable: 'Task status is unavailable. Try updating again when the workspace is ready.',
        updateFailedFullscreen: 'Could not exit fullscreen. Exit fullscreen, then retry the update.',
        updateFailedGeneric: 'The update failed. Please try again later.',
        updateConfigUnavailable: 'Configuration unavailable',
        updateConfigRead: 'Updates paused: cannot read settings file',
        updateConfigFormat: 'Updates paused: invalid settings file',
        updateConfigChannel: 'Updates paused: channel must be nightly or stable',
        updateConfigCleanup: 'Updates paused: cannot discard previous update; restart the app',
        updateConfigGeneric: 'Updates paused: configuration unavailable',
        updateShowcaseTitle: 'Update button states',
        updateShowcaseDesc:
          'How the desktop update entry above the settings gear looks in each phase. It is hidden when no update is available.',
        updateStateAvailable: 'Update available',
        updateStateDownloading: 'Downloading',
        updateStateVerifying: 'Verifying',
        updateStateInstalling: 'Preparing restart',
        updateStateReady: 'Install and restart',
        updateStateError: 'Update failed',
        compatTitle: 'Islands UI turned itself off',
        compatBody:
          'This DSH build no longer matches the plugin, so the skin fell back to the default look instead of overlapping panels.',
        compatView: 'Open plugin settings',
        compatMissing: 'Missing interface contracts',
        compatBannerTitle: 'Skin disabled: interface structure changed',
        compatBannerBody:
          'Islands UI styles itself against the host contracts for slots and phases, plus the part marks the skin writes back. This build is missing the core contracts, so the island layout, the hidden native navigation and the workspace collapse would all break. The skin therefore stayed off and DSH keeps its default look.',
        compatFix:
          'Update Islands UI to a release that matches this DSH build, or roll DSH back. If the interface looks fine, you can enable it anyway for this session.',
        compatForce: 'Enable anyway',
        compatForced: 'Enabled manually; automatic detection is skipped for this session.',
        compatDismiss: 'Dismiss',
        compatDetected: 'Detected DSH',
        compatStructure: 'Sidebar structure',
        compatStructureFlat: 'flat',
        compatStructureScroll: 'scroll containers',
      },
    };

    let localeService;
    let layoutService;
    let slotsService;
    let shortcutsService;
    let uiWorkspaceService;
    let workspacesService;
    let modelDirectories;
    const RAIL_PIN_KEY = 'dsh-islands-ui:rail-pins';
    /** Order + visibility of every left-rail panel entry. */
    const RAIL_CONFIG_KEY = 'dsh-islands-ui:rail';
    const ACCENT_KEY = 'dsh-islands-ui:accent';
    const DEFAULT_ACCENT = '#4176e6';
    const ACCENT_PRESETS = ['#4176e6', '#7c5cff', '#1f9d63', '#e07a2e', '#d94f8a', '#d64545'];
    const listeners = new Set();

    function readStored() {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored === null ? true : stored === '1';
      } catch {
        return true;
      }
    }

    let enabled = readStored();

    function syncAttribute() {
      const body = document.body;
      if (body === null) return;
      if (enabled) body.setAttribute(ATTRIBUTE, '');
      else body.removeAttribute(ATTRIBUTE);
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function getSnapshot() {
      return enabled;
    }

    function setEnabled(next) {
      enabled = next === true;
      try {
        window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
      } catch {
        /* private mode: the choice still applies for this page. */
      }
      syncAttribute();
      for (const listener of listeners) listener();
    }

    function shortcutKeys(id, fallback = '') {
      try {
        const row = shortcutsService?.catalog?.getSnapshot?.().find((value) => value.id === id);
        const keys = row?.keys;
        if (Array.isArray(keys) && keys.length > 0) {
          const mac =
            document.documentElement.getAttribute('data-platform') === 'darwin' ||
            /Mac/i.test(navigator.platform ?? '');
          return keys.join(mac ? '' : '+');
        }
      } catch {
        /* ignore */
      }
      return fallback;
    }

    function withShortcut(label, id, fallback = '') {
      const keys = shortcutKeys(id, fallback);
      return keys === '' ? label : `${label} (${keys})`;
    }

    function useEnabled() {
      return React.useSyncExternalStore(subscribe, getSnapshot);
    }

    function setCompat(next) {
      compatState = next;
      for (const listener of compatListeners) listener();
    }

    function subscribeCompat(listener) {
      compatListeners.add(listener);
      return () => compatListeners.delete(listener);
    }

    function getCompatSnapshot() {
      return compatState;
    }

    function useCompat() {
      return React.useSyncExternalStore(subscribeCompat, getCompatSnapshot);
    }

    function currentCopy() {
      try {
        return String(localeService?.getSnapshot?.().active ?? 'en').toLowerCase().startsWith('zh')
          ? COPY.zh
          : COPY.en;
      } catch {
        return COPY.en;
      }
    }

    function isForced() {
      try {
        return window.sessionStorage.getItem(FORCE_KEY) === '1';
      } catch {
        return false;
      }
    }

    /**
     * The DSH release this page booted with. The client module system publishes
     * it in `window.__DSH_BOOT__.release` (shared with the CLI version), so a
     * plugin can pick the stylesheet written for the running shell without a
     * Host round trip.
     */
    function readDshVersion() {
      try {
        const release = window.__DSH_BOOT__?.release;
        return typeof release?.version === 'string' && release.version !== '' ? release.version : null;
      } catch {
        return null;
      }
    }

    /**
     * Structure the mounted shell actually uses, read from the parts the walker
     * wrote. This is display information only: the stylesheet never branches on
     * a release number.
     */
    function detectStructure() {
      if (document.querySelector(partSelector('sidebar-scroll-region')) !== null) return 'scroll';
      if (document.querySelector(partSelector('region-area')) !== null) return 'flat';
      return 'unknown';
    }

    /** Which host contracts or core parts of the running build are gone. */
    function missingAnchors() {
      const missing = [];
      for (const selector of CORE_CONTRACTS) {
        if (document.querySelector(selector) === null) missing.push(selector);
      }
      for (const part of CORE_PARTS) {
        if (document.querySelector(partSelector(part)) === null) missing.push(partSelector(part));
      }
      return missing;
    }

    function readAccent() {
      try {
        const stored = window.localStorage.getItem(ACCENT_KEY);
        return stored !== null && /^#[0-9a-f]{6}$/iu.test(stored) ? stored : null;
      } catch {
        return null;
      }
    }

    function applyAccent(color) {
      const body = document.body;
      if (body === null) return;
      if (color === null) {
        body.removeAttribute('data-islands-accent');
        body.style.removeProperty('--isl-accent');
      } else {
        body.setAttribute('data-islands-accent', '');
        body.style.setProperty('--isl-accent', color);
      }
    }

    function storeAccent(color) {
      try {
        if (color === null) window.localStorage.removeItem(ACCENT_KEY);
        else window.localStorage.setItem(ACCENT_KEY, color);
      } catch {
        /* private mode: keep the session choice. */
      }
    }

    function useLocale() {
      return React.useSyncExternalStore(
        (listener) => (localeService === undefined ? () => {} : localeService.subscribe(listener)),
        () => (localeService === undefined ? 'en' : localeService.getSnapshot().active),
      );
    }

    /** Sidebar glyph for the window bar (divider on the left, workspace rail). */
    function PanelGlyph() {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('rect', {
          x: 2.5,
          y: 3.5,
          width: 15,
          height: 13,
          rx: 3,
          stroke: 'currentColor',
          strokeWidth: 1.5,
        }),
        h('path', { d: 'M7.5 4v12', stroke: 'currentColor', strokeWidth: 1.5 }),
      );
    }

    /** Mirror glyph for the right sidebar toggle (divider on the right). */
    function RightPanelGlyph() {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('rect', {
          x: 2.5,
          y: 3.5,
          width: 15,
          height: 13,
          rx: 3,
          stroke: 'currentColor',
          strokeWidth: 1.5,
        }),
        h('path', { d: 'M12.5 4v12', stroke: 'currentColor', strokeWidth: 1.5 }),
      );
    }

    /** Small glyphs used by the composer model picker. */
    function ModelGlyph() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('rect', { x: 1.5, y: 1.5, width: 13, height: 13, rx: 4, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M5 9.5 6.8 6l1.7 3.5L10.2 6 12 9.5', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      );
    }

    function CheckGlyph() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'm3.5 8.5 3 3 6-6.5', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      );
    }

    function ChevronGlyph() {
      return h(
        'svg',
        { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'm4 6 4 4 4-4', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      );
    }

    function ResetGlyph() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M3.5 6.5A5 5 0 1 1 3 9.5', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
        h('path', { d: 'M3 3.5v3h3', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      );
    }

    function DownloadGlyph() {
      return h(
        'svg',
        { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M10 3.4v8.2', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
        h('path', { d: 'm6.7 8.7 3.3 3.3 3.3-3.3', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        h('path', { d: 'M4.5 15.6h11', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
      );
    }

    function RestartGlyph() {
      return h(
        'svg',
        { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M16.4 8.1A6.5 6.5 0 1 0 16.4 12', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
        h('path', { d: 'M16.4 3.9v4.2h-4.2', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      );
    }

    function DotMatrixGlyph({ variant }) {
      const rings = [2, 1, 2, 1, 0, 1, 2, 1, 2];
      const smiley = new Set([0, 2, 7]);
      // Windows for the 720 ms smiley rotation: each cell is lit for one or
      // two 180 ms phases; the first cell wraps across the cycle boundary.
      const phases = [
        { span: 'wrap', delay: 0 },
        { span: 1, delay: 360 },
        { span: 2, delay: 0 },
        { span: 1, delay: 180 },
        { span: null, delay: 0 },
        { span: 1, delay: 540 },
        { span: 2, delay: 360 },
        { span: 1, delay: 0 },
        { span: 2, delay: 180 },
      ];
      return h(
        'span',
        { className: `isl-dmx isl-dmx-${variant}`, 'aria-hidden': true },
        Array.from({ length: 9 }, (_, index) =>
          h('span', {
            key: index,
            className: 'isl-dmx-dot',
            'data-col': index % 3,
            'data-ring': rings[index],
            'data-on': smiley.has(index) ? '1' : '0',
            'data-span': variant === 'smiley' ? phases[index].span ?? undefined : undefined,
            style:
              variant === 'smiley'
                ? { animationDelay: `${phases[index].delay}ms` }
                : { '--dmx-col': index % 3, '--dmx-ring': rings[index] },
          }),
        ),
      );
    }

    /** Shared face for the live rail button and the settings showcase. */
    function UpdateGlyph({ phase }) {
      if (phase === 'available') return h(DownloadGlyph);
      if (phase === 'ready' || phase === 'error') return h(RestartGlyph);
      if (phase === 'downloading') return h(DotMatrixGlyph, { variant: 'column' });
      if (phase === 'verifying') return h(DotMatrixGlyph, { variant: 'smiley' });
      return h(DotMatrixGlyph, { variant: 'ripple' });
    }

    function readRailPins() {
      try {
        const raw = window.localStorage.getItem(RAIL_PIN_KEY);
        const parsed = raw === null ? [] : JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
      } catch {
        return [];
      }
    }

    function uniqueRailIds(values) {
      const seen = new Set();
      const result = [];
      for (const value of values) {
        if (typeof value !== 'string' || value === '' || seen.has(value)) continue;
        seen.add(value);
        result.push(value);
      }
      return result;
    }

    /**
     * The rail shows every panel entry by default and remembers the user's
     * order and the entries they hid. Configurations written by 1.0.x only
     * stored pins, so they are read once and migrated into an order prefix.
     */
    function readRailConfig() {
      try {
        const raw = window.localStorage.getItem(RAIL_CONFIG_KEY);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          return {
            order: uniqueRailIds(Array.isArray(parsed?.order) ? parsed.order : []),
            hidden: uniqueRailIds(Array.isArray(parsed?.hidden) ? parsed.hidden : []),
          };
        }
      } catch {
        /* fall through to the legacy pin list */
      }
      return { order: uniqueRailIds(['schedules', 'plugins', ...readRailPins()]), hidden: [] };
    }

    function writeRailConfig(config) {
      try {
        window.localStorage.setItem(RAIL_CONFIG_KEY, JSON.stringify(config));
        // The legacy key only seeds the first migration; drop it once the new
        // configuration exists so clearing that key really resets the rail.
        window.localStorage.removeItem(RAIL_PIN_KEY);
      } catch {
        /* private mode: keep the arrangement for this session only. */
      }
    }

    function HouseGlyph() {
      return h('svg', { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M3 8.6 10 3l7 5.6V16a1 1 0 0 1-1 1h-4v-4.5H8V17H4a1 1 0 0 1-1-1V8.6Z', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }));
    }

    function ClockGlyph() {
      return h('svg', { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('circle', { cx: 10, cy: 10, r: 7, stroke: 'currentColor', strokeWidth: 1.5 }),
        h('path', { d: 'M10 6.2V10l2.6 1.6', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }));
    }

    function PluginsGlyph() {
      return h('svg', { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('rect', { x: 3, y: 3, width: 6, height: 6, rx: 1.6, stroke: 'currentColor', strokeWidth: 1.4 }),
        h('rect', { x: 11, y: 3, width: 6, height: 6, rx: 1.6, stroke: 'currentColor', strokeWidth: 1.4 }),
        h('rect', { x: 3, y: 11, width: 6, height: 6, rx: 1.6, stroke: 'currentColor', strokeWidth: 1.4 }),
        h('path', { d: 'M14 11v6M11 14h6', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }));
    }

    function PlugGlyph() {
      return h('svg', { width: 17, height: 17, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M7 3v4M13 3v4M5 7h10v3a5 5 0 0 1-10 0V7ZM10 15v3', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    }

    function CheckGlyph() {
      return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'm3 8.4 3.2 3.2L13 4.8', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    }

    function PlusGlyph() {
      return h('svg', { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M10 4v12M4 10h12', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }));
    }

    function GearGlyph() {
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
        h('circle', { cx: 12, cy: 12, r: 3, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', {
          d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    /**
     * Best effort selection of one settings section once the dialog is up. The
     * settings navigation has no service of its own, so the row is matched by
     * its label inside the dialog and simply skipped when it is not there.
     */
    function revealSettingsSection(label) {
      if (typeof label !== 'string' || label === '') return;
      let attempts = 0;
      const tick = () => {
        attempts += 1;
        const scope = document.querySelector(HOST.SETTINGS_DIALOG) ?? document;
        const cells = [
          ...scope.querySelectorAll(`button, a, [role="tab"], [role="option"], ${partSelector('settings-nav-cell')}`),
        ];
        const target = cells.find((cell) => (cell.textContent ?? '').trim() === label);
        if (target instanceof HTMLElement) {
          target.click();
          return;
        }
        if (attempts < 12) window.setTimeout(tick, 120);
      };
      window.setTimeout(tick, 140);
    }

    function openSettings(options) {
      const section = options?.section;
      // The dialog may already be open (the compatibility banner lives inside
      // it); clicking the toggle again would close it.
      if (document.querySelector(HOST.SETTINGS_DIALOG) !== null) {
        revealSettingsSection(section);
        return;
      }
      // The host exposes a direct settings trigger in the sidebar foot; the
      // account menu path remains for builds that fold Settings into a menu.
      const direct = document.querySelector(HOST.SETTINGS_TRIGGER);
      if (direct instanceof HTMLElement) {
        direct.click();
        revealSettingsSection(section);
        return;
      }
      const trigger = document.querySelector(`${partSelector('foot-area')} button[aria-haspopup="menu"]`);
      if (trigger instanceof HTMLElement) {
        trigger.click();
        window.setTimeout(() => {
          const item = [
            ...document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] [role="menuitemradio"], [role="menu"] button, [role="menu"] a'),
          ].find((element) => /设置|Settings|偏好|Preferences/i.test(element.textContent ?? ''));
          if (item instanceof HTMLElement) item.click();
          revealSettingsSection(section);
        }, 60);
        return;
      }
      try {
        const row = (shortcutsService?.catalog?.getSnapshot?.() ?? []).find(
          (value) => value.id === 'settings.open' && value.binding !== null && value.binding !== undefined,
        );
        if (row?.binding !== undefined) {
          const modifiers = new Set(row.binding.modifiers ?? []);
          window.dispatchEvent(
            new KeyboardEvent('keydown', {
              code: row.binding.code,
              key: ',',
              metaKey: modifiers.has('meta'),
              ctrlKey: modifiers.has('control'),
              altKey: modifiers.has('alt'),
              shiftKey: modifiers.has('shift'),
              bubbles: true,
              cancelable: true,
            }),
          );
        }
      } catch {
        /* ignore */
      }
      revealSettingsSection(section);
    }

    function LocateGlyph() {
      return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('circle', { cx: 8, cy: 8, r: 4, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }));
    }

    function defaultPinIcon() {
      try {
        const entries = slotsService?.entriesOfSlot?.('contextMenu.icon') ?? [];
        const entry =
          entries.find((value) => value.options?.key === 'workspace.unpin') ??
          entries.find((value) => value.options?.key === 'workspace.pin');
        if (entry?.component !== undefined) return h(entry.component, { size: 14 });
      } catch {
        /* fall back to the local glyph */
      }
      return h(PinGlyph);
    }

    function revealPinnedSession(sessionId, title) {
      const projectRows = () => [...document.querySelectorAll(HOST.WORKSPACE_ROW)];
      const stateOf = (row) =>
        row.getAttribute('aria-expanded') ??
        row.querySelector('[aria-expanded]')?.getAttribute('aria-expanded');
      const expanded = (row) => stateOf(row) === 'true';
      const toggle = (row) => {
        const chevron = row.querySelector('[aria-expanded]');
        if (chevron instanceof HTMLElement) chevron.click();
        else row.click();
      };

      // Expand every workspace briefly so the target session exists in the DOM.
      for (const row of projectRows()) {
        if (!expanded(row)) toggle(row);
      }

      window.setTimeout(() => {
        const candidates = [...document.querySelectorAll(HOST.SESSION_ROW)].filter((row) =>
          (row.textContent ?? '').includes(title),
        );
        if (candidates.length === 0) return;
        const row = candidates[0];

        // The owner is the nearest preceding Workspace row; nested ancestors stay open.
        let owner = null;
        for (const project of projectRows()) {
          if ((project.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) owner = project;
        }

        for (const project of projectRows()) {
          const keep = project === owner || project.contains(owner);
          if (keep) {
            if (!expanded(project)) toggle(project);
          } else if (expanded(project)) {
            toggle(project);
          }
        }

        window.setTimeout(() => {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          if (!row.hasAttribute('tabindex')) row.setAttribute('tabindex', '-1');
          row.focus({ preventScroll: true });
          row.classList.add('isl-located');
          window.setTimeout(() => row.classList.remove('isl-located'), 1400);
        }, 140);
      }, 180);
    }

    function PinGlyph() {
      return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M6 2v4L4 8v1.5h3.2V14l.8 1 .8-1V9.5H12V8l-2-2V2', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' }));
    }

    /**
     * Left rail: the workspace home plus every panel launcher registered in
     * `sidebar.panellist`. Entries are shown directly, reordered by dragging,
     * and shown or hidden from the right-click management menu.
     */
    function IslandsRail({ usePanelInfo }) {
      const active = usePanelInfo((info) => info.activePanelId ?? null);
      const [config, setConfig] = React.useState(readRailConfig);
      const [menu, setMenu] = React.useState(null);
      const [dragId, setDragId] = React.useState(null);
      const [ripples, setRipples] = React.useState([]);
      const rippleSeq = React.useRef(0);
      const [, refreshEntries] = React.useState(0);
      const railRef = React.useRef(null);
      const menuRef = React.useRef(null);
      const itemRefs = React.useRef(new Map());
      const configRef = React.useRef(config);
      const dragRef = React.useRef(null);
      const suppressClickRef = React.useRef(false);
      const lang = useLocale() ?? 'en';
      const copy = String(lang).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
      configRef.current = config;

      const allEntries = (() => {
        try {
          const seen = new Set();
          return (slotsService?.entriesOfSlot('sidebar.panellist') ?? []).flatMap((entry) => {
            const id = entry.options.id;
            if (typeof id !== 'string' || id === '' || seen.has(id)) return [];
            seen.add(id);
            return [{
              id,
              order: entry.options.order ?? 0,
              label: typeof entry.options.label === 'function' ? entry.options.label() : entry.options.label,
              registrant: entry.registrant,
              component: entry.component,
            }];
          });
        } catch {
          return [];
        }
      })();

      const byId = new Map(allEntries.map((entry) => [entry.id, entry]));
      const storedIndex = new Map(config.order.map((id, index) => [id, index]));
      // The two shipped panels lead on a fresh install; every other launcher
      // follows registration order until the user drags it somewhere else.
      const defaultIds = [
        ...['schedules', 'plugins'].filter((id) => byId.has(id)),
        ...allEntries.map((entry) => entry.id).filter((id) => id !== 'schedules' && id !== 'plugins'),
      ];
      const defaultIndex = new Map(defaultIds.map((id, index) => [id, index]));
      const orderedEntries = [...allEntries].sort((left, right) => {
        const leftIndex = storedIndex.get(left.id);
        const rightIndex = storedIndex.get(right.id);
        if (leftIndex !== undefined || rightIndex !== undefined) {
          if (leftIndex === undefined) return 1;
          if (rightIndex === undefined) return -1;
          if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        }
        return (defaultIndex.get(left.id) ?? 0) - (defaultIndex.get(right.id) ?? 0);
      });
      const visible = orderedEntries.filter((entry) => !config.hidden.includes(entry.id));

      // A plugin can register a panel after the shell is already mounted.
      React.useEffect(() => {
        try {
          const unsubscribe = slotsService?.subscribe?.('sidebar.panellist', () => refreshEntries((value) => value + 1));
          return typeof unsubscribe === 'function' ? unsubscribe : undefined;
        } catch {
          return undefined;
        }
      }, []);

      React.useEffect(() => {
        if (menu === null) return;
        const onDown = (event) => {
          if (railRef.current?.contains(event.target) === true) return;
          if (menuRef.current?.contains(event.target) === true) return;
          setMenu(null);
        };
        const onKey = (event) => {
          if (event.key === 'Escape') setMenu(null);
        };
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey, true);
        return () => {
          document.removeEventListener('mousedown', onDown, true);
          document.removeEventListener('keydown', onKey, true);
        };
      }, [menu]);

      React.useEffect(
        () => () => {
          dragRef.current?.detach?.();
          dragRef.current = null;
        },
        [],
      );

      const iconFor = (id, size) => {
        const entry = byId.get(id);
        if (entry?.component !== undefined) {
          try {
            return h(entry.component, { size, active: active === id });
          } catch {
            /* fall back to the generic glyph */
          }
        }
        if (id === 'schedules') return h(ClockGlyph);
        if (id === 'plugins') return h(PluginsGlyph);
        return h(PlugGlyph);
      };

      // Official panels are registered by the bundled web-client fiber, whose
      // internal name is `wc`; that code means nothing in the UI. Third-party
      // entries keep their package name so the owner is still recognizable.
      const ownerFor = (registrant) => {
        if (typeof registrant !== 'string') return undefined;
        const code = registrant.trim();
        if (code === '') return undefined;
        // The bundled client reports the fiber as `WC` (older bundles may use
        // lower case); both are the same internal name, not a plugin name.
        return code.toLowerCase() === 'wc' ? copy.builtIn : code;
      };

      const labelFor = (id) => {
        const entry = byId.get(id);
        const label = entry?.label ?? id;
        const owner = ownerFor(entry?.registrant);
        return owner === undefined ? label : `${label} · ${owner}`;
      };

      const openMenuAt = (x, y, contextId) => {
        const width = 248;
        const height = Math.min(window.innerHeight - 16, 76 + orderedEntries.length * 36);
        const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
        const top = y + height + 8 <= window.innerHeight ? y : Math.max(8, y - height);
        setMenu({ left, top, contextId });
      };

      const toggleHidden = (id) => {
        const current = configRef.current;
        const hidden = current.hidden.includes(id)
          ? current.hidden.filter((value) => value !== id)
          : [...current.hidden, id];
        const next = { order: current.order, hidden };
        configRef.current = next;
        setConfig(next);
        writeRailConfig(next);
      };

      const addRipple = (event) => {
        const button = event.currentTarget;
        if (button === null) return;
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2.4;
        // Keyboard activation (Enter/Space) reports detail 0 and no pointer
        // position; centre the ripple on the tile instead.
        const centered = event.detail === 0 || (event.clientX === 0 && event.clientY === 0);
        const x = centered ? rect.width / 2 : event.clientX - rect.left;
        const y = centered ? rect.height / 2 : event.clientY - rect.top;
        const key = `ripple-${rippleSeq.current++}`;
        setRipples((values) => [...values, { key, x, y, size }]);
      };

      const removeRipple = (key) => {
        setRipples((values) => values.filter((value) => value.key !== key));
      };

      const select = (id) => {
        setMenu(null);
        if (id === null) {
          // The house is the workspace list's own control. Three states need
          // three answers: a narrowed or folded-away list comes back, an open
          // plugin panel gives way to the conversation, and on the plain
          // conversation the house folds the list so the click always lands.
          const frame = document.querySelector(FRAME);
          const narrowed =
            frame !== null &&
            (frame.hasAttribute('data-sidebar-drawer') || frame.hasAttribute('data-sidebar-collapsed'));
          if (narrowed || document.body.hasAttribute(WORKSPACE_ATTR)) {
            toggleWorkspace();
            return;
          }
          if (active !== null) {
            layoutService?.selectPanel(null);
            return;
          }
          toggleWorkspace();
          return;
        }
        layoutService?.selectPanel(id);
      };

      const autoScroll = (clientY) => {
        const rail = railRef.current;
        if (rail === null) return;
        const rect = rail.getBoundingClientRect();
        if (clientY < rect.top + 32) rail.scrollTop -= 12;
        else if (clientY > rect.bottom - 32) rail.scrollTop += 12;
      };

      const beforeIdAt = (clientY, id) => {
        for (const entry of visible) {
          if (entry.id === id) continue;
          const node = itemRefs.current.get(entry.id);
          if (node === undefined) continue;
          const rect = node.getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) return entry.id;
        }
        return null;
      };

      const moveEntryBefore = (id, beforeId) => {
        const current = configRef.current;
        const baseOrder = orderedEntries.map((entry) => entry.id);
        const currentOrder = uniqueRailIds([...current.order, ...baseOrder]);
        const without = currentOrder.filter((value) => value !== id);
        let index = beforeId === null ? without.length : without.indexOf(beforeId);
        if (index === -1) index = without.length;
        without.splice(index, 0, id);
        if (without.length === currentOrder.length && without.every((value, at) => value === currentOrder[at])) return;
        const next = { order: without, hidden: current.hidden };
        configRef.current = next;
        setConfig(next);
      };

      const beginDrag = (event, id) => {
        if (event.button !== 0 || dragRef.current !== null) return;
        const pointerId = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        const source = event.currentTarget;
        const origin = source.getBoundingClientRect();
        const state = {
          id,
          active: false,
          detach: null,
          ghost: null,
          offsetX: startX - origin.left,
          offsetY: startY - origin.top,
        };
        const positionGhost = (x, y) => {
          if (state.ghost === null) return;
          state.ghost.style.transform = `translate3d(${x - state.offsetX}px, ${y - state.offsetY}px, 0)`;
        };
        const detach = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp, true);
          window.removeEventListener('pointercancel', onUp, true);
          if (state.ghost !== null) {
            state.ghost.remove();
            state.ghost = null;
          }
        };
        const onMove = (moveEvent) => {
          if (moveEvent.pointerId !== pointerId) return;
          if (!state.active) {
            if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
            state.active = true;
            suppressClickRef.current = true;
            setDragId(id);
            setMenu(null);
            // Clone the rendered icon so the ghost keeps the exact glyph and
            // size of the row, then park it under the pointer at the grab
            // offset. It must never intercept pointer events.
            const ghost = source.cloneNode(true);
            ghost.className = 'isl-railGhost';
            ghost.removeAttribute('data-rail-id');
            ghost.removeAttribute('data-draggable');
            ghost.removeAttribute('title');
            ghost.removeAttribute('aria-label');
            ghost.removeAttribute('aria-pressed');
            ghost.setAttribute('aria-hidden', 'true');
            ghost.tabIndex = -1;
            state.ghost = ghost;
            positionGhost(moveEvent.clientX, moveEvent.clientY);
            document.body.appendChild(ghost);
          }
          moveEvent.preventDefault();
          positionGhost(moveEvent.clientX, moveEvent.clientY);
          autoScroll(moveEvent.clientY);
          moveEntryBefore(id, beforeIdAt(moveEvent.clientY, id));
        };
        const onUp = (upEvent) => {
          if (upEvent.pointerId !== pointerId) return;
          detach();
          dragRef.current = null;
          if (!state.active) return;
          upEvent.preventDefault();
          setDragId(null);
          writeRailConfig(configRef.current);
          // The click that follows a drag must not select the icon; clear the
          // guard after the browser has dispatched it.
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        };
        state.detach = detach;
        dragRef.current = state;
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onUp, true);
      };

      const button = (id, label, glyph, extraClass, draggable = false) => {
        // The house is a navigation trigger (conversation / workspace drawer),
        // not a destination in the panel model. It therefore never carries the
        // persistent selected fill; hover and focus still show that it is live.
        const selected = id !== null && active === id;
        // `dragId` is null while idle, so the house (id null) must not match it.
        const dragging = id !== null && dragId === id;
        return h(
          'button',
          {
            type: 'button',
            key: id ?? 'workspace',
            ref: draggable
              ? (node) => {
                  if (node === null) itemRefs.current.delete(id);
                  else itemRefs.current.set(id, node);
                }
              : undefined,
            className:
              'isl-railBtn' +
              (selected ? ' is-active' : '') +
              (dragging ? ' is-dragging' : '') +
              (extraClass ? ` ${extraClass}` : ''),
            title: label,
            'aria-label': label,
            'aria-pressed': id === null ? undefined : selected,
            'data-rail-id': id ?? 'workspace',
            'data-draggable': draggable ? '' : undefined,
            onClick: (event) => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              if (id === null) addRipple(event);
              select(id);
            },
            onPointerDown: draggable ? (event) => beginDrag(event, id) : undefined,
          },
          glyph,
          id === null
            ? ripples.map((ripple) =>
                h('span', {
                  key: ripple.key,
                  className: 'isl-railRipple',
                  'aria-hidden': true,
                  style: {
                    left: `${ripple.x}px`,
                    top: `${ripple.y}px`,
                    width: `${ripple.size}px`,
                    height: `${ripple.size}px`,
                  },
                  onAnimationEnd: () => removeRipple(ripple.key),
                }),
              )
            : null,
        );
      };

      const menuNode = menu !== null
        ? ReactDOM.createPortal(
            h(
              'div',
              {
                ref: menuRef,
                className: 'isl-railMenu',
                role: 'menu',
                style: { left: menu.left, top: menu.top },
                onContextMenu: (event) => event.preventDefault(),
              },
              h('div', { className: 'isl-railMenuTitle' }, copy.railTitle),
              orderedEntries.length === 0
                ? h('div', { className: 'isl-railMenuEmpty' }, copy.noExtras)
                : orderedEntries.map((entry) => {
                    const shown = !config.hidden.includes(entry.id);
                    const owner = ownerFor(entry.registrant);
                    return h(
                      'button',
                      {
                        type: 'button',
                        key: entry.id,
                        className:
                          'isl-railMenuRow' +
                          (menu.contextId === entry.id ? ' is-current' : '') +
                          (shown ? '' : ' is-hidden'),
                        role: 'menuitemcheckbox',
                        'aria-checked': shown,
                        title: shown ? copy.railHide : copy.railShow,
                        onClick: () => toggleHidden(entry.id),
                      },
                      h('span', { className: 'isl-railMenuIcon' }, iconFor(entry.id, 16)),
                      h(
                        'span',
                        { className: 'isl-railMenuText' },
                        h('span', { className: 'isl-railMenuLabel' }, entry.label ?? entry.id),
                        owner === undefined
                          ? null
                          : h('span', { className: 'isl-railMenuSub' }, owner),
                      ),
                      h(
                        'span',
                        { className: 'isl-railMenuCheck' + (shown ? ' is-on' : ''), 'aria-hidden': true },
                        shown ? h(CheckGlyph) : null,
                      ),
                    );
                  }),
              h('div', { className: 'isl-railMenuHint' }, copy.railHint),
            ),
            document.body,
          )
        : null;

      return h(
        'nav',
        {
          ref: railRef,
          className: 'isl-rail' + (dragId === null ? '' : ' is-dragging'),
          'aria-label': copy.workspace,
          onContextMenu: (event) => {
            event.preventDefault();
            const target = event.target instanceof Element ? event.target.closest('[data-rail-id]') : null;
            const id = target?.getAttribute('data-rail-id') ?? null;
            const anchor = target?.getBoundingClientRect() ?? railRef.current?.getBoundingClientRect();
            // Shift+F10 and the context-menu key dispatch a contextmenu event
            // without a pointer position; anchor that menu on the focused row.
            const point = event.clientX === 0 && event.clientY === 0
              ? { x: (anchor?.right ?? 48) + 8, y: anchor?.top ?? 8 }
              : { x: event.clientX, y: event.clientY };
            openMenuAt(point.x, point.y, id === 'workspace' ? null : id);
          },
        },
        button(null, copy.workspace, h(HouseGlyph)),
        h('div', { className: 'isl-railDivider', 'aria-hidden': true }),
        visible.map((entry) => button(entry.id, labelFor(entry.id), iconFor(entry.id, 18), null, true)),
        visible.length === 0
          ? h(
              'button',
              {
                type: 'button',
                className: 'isl-railBtn isl-railAdd',
                title: copy.railTitle,
                'aria-label': copy.railTitle,
                'aria-haspopup': 'menu',
                'aria-expanded': menu !== null,
                onClick: (event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  openMenuAt(rect.right + 8, rect.top, null);
                },
              },
              h(PlusGlyph),
            )
          : null,
        menuNode,
      );
    }

    /**
     * The desktop preload exposes update state only to the product page. Keep
     * the lookup optional so the same bundle stays inert in a plain browser.
     */
    function desktopUpdateBridge() {
      try {
        const bridge = globalThis.dshDesktop;
        return bridge?.protocolVersion === 1 ? bridge.updates : undefined;
      } catch {
        return undefined;
      }
    }

    function formatCopy(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (match, key) =>
        values[key] === undefined ? match : String(values[key]),
      );
    }

    const UPDATE_FAILURE_KEYS = {
      check: 'updateFailedCheck',
      'check-network': 'updateFailedCheckNetwork',
      download: 'updateFailedDownload',
      'download-network': 'updateFailedDownloadNetwork',
      install: 'updateFailedInstall',
      'install-network': 'updateFailedInstallNetwork',
      'stop-failed': 'updateFailedStop',
      'tasks-changed': 'updateFailedTasksChanged',
      'tasks-unavailable': 'updateFailedTasksUnavailable',
      'fullscreen-timeout': 'updateFailedFullscreen',
    };

    function updateFailureCopy(state, copy) {
      const key = UPDATE_FAILURE_KEYS[state?.failure] ?? 'updateFailedGeneric';
      return copy[key] ?? copy.updateFailedGeneric;
    }

    const UPDATE_CONFIGURATION_KEYS = {
      read: 'updateConfigRead',
      format: 'updateConfigFormat',
      channel: 'updateConfigChannel',
      cleanup: 'updateConfigCleanup',
    };

    /** DSH 0.2.2-rc.2 added channel configuration failures to the presentation. */
    function updateConfigurationCopy(state, copy) {
      const key = UPDATE_CONFIGURATION_KEYS[state?.configurationError] ?? 'updateConfigGeneric';
      return {
        label: copy.updateConfigUnavailable,
        detail: copy[key] ?? copy.updateConfigGeneric,
      };
    }

    function updatePresentationCopy(state, failed, copy) {
      if (failed) return { label: copy.updateRetry, detail: copy.updateRetry };
      if (typeof state?.configurationError === 'string') return updateConfigurationCopy(state, copy);
      const version = typeof state?.version === 'string' ? state.version : undefined;
      switch (state?.phase) {
        case 'available': {
          const label = version === undefined
            ? copy.updateAvailablePlain
            : formatCopy(copy.updateAvailable, { version });
          return { label, detail: label };
        }
        case 'downloading': {
          const percent = Math.max(0, Math.min(100, Math.round(Number(state.percent) || 0)));
          const label = formatCopy(copy.updateDownloading, { percent });
          return {
            label,
            detail: version === undefined
              ? label
              : formatCopy(copy.updateDownloadingDetail, { percent, version }),
          };
        }
        case 'verifying':
          return { label: copy.updateVerifying, detail: copy.updateVerifying };
        case 'installing':
          return { label: copy.updateInstalling, detail: copy.updateInstalling };
        case 'ready':
          return {
            label: copy.updateReady,
            detail: version === undefined
              ? copy.updateReady
              : formatCopy(copy.updateReadyDetail, { version }),
          };
        case 'error':
          return { label: copy.updateRetry, detail: updateFailureCopy(state, copy) };
        default:
          return { label: '', detail: '' };
      }
    }

    /** One subscription shared by the rail button; null until the bridge answers. */
    function useDesktopUpdate() {
      const updates = React.useMemo(() => desktopUpdateBridge(), []);
      const [view, setView] = React.useState({ state: undefined, failed: false });

      React.useEffect(() => {
        if (updates === undefined) return undefined;
        let live = true;
        let received = false;
        const apply = (state) => {
          if (!live) return;
          received = true;
          setView({ state, failed: false });
        };
        let unsubscribe;
        try {
          unsubscribe = updates.subscribe?.(apply);
        } catch {
          /* a bridge without a subscriber still gets the status probe */
        }
        Promise.resolve()
          .then(() => updates.status())
          .then(
            (state) => {
              if (live && !received) apply(state);
            },
            () => {
              if (live && !received) setView({ state: undefined, failed: true });
            },
          );
        return () => {
          live = false;
          try {
            unsubscribe?.();
          } catch {
            /* already detached by the shell */
          }
        };
      }, [updates]);

      return { updates, ...view };
    }

    /**
     * Desktop update entry above the settings gear. Available and ready are
     * actionable; busy phases are a 3x3 dot-matrix animation; failures keep
     * the same footprint with a danger tint and a retry glyph.
     */
    function IslandsUpdateButton() {
      const { updates, state, failed } = useDesktopUpdate();
      const [pending, setPending] = React.useState(false);
      const enabled = useEnabled();
      const lang = useLocale() ?? 'en';
      const copy = String(lang).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
      const configurationError = typeof state?.configurationError === 'string';
      const phase = failed || configurationError ? 'error' : state?.phase;
      if (!enabled || updates === undefined || phase === undefined || phase === 'idle') return null;
      if (!['available', 'downloading', 'verifying', 'installing', 'ready', 'error'].includes(phase)) return null;

      const clickable = phase === 'available' || phase === 'ready' || phase === 'error';
      const busy = pending || phase === 'downloading' || phase === 'verifying' || phase === 'installing';
      const { label, detail } = updatePresentationCopy(state, failed, copy);
      const open = () => {
        if (!clickable || pending) return;
        setPending(true);
        Promise.resolve()
          .then(() => updates.open())
          .catch(() => {})
          .finally(() => setPending(false));
      };

      return h(
        'button',
        {
          type: 'button',
          className: `isl-updateButton is-${phase}${clickable ? ' is-clickable' : ''}${pending ? ' is-pending' : ''}`,
          'data-phase': phase,
          'data-clickable': clickable ? 'true' : 'false',
          title: detail,
          'aria-label': label,
          'aria-disabled': clickable ? undefined : 'true',
          'aria-busy': busy ? 'true' : undefined,
          onClick: open,
        },
        h(UpdateGlyph, { phase }),
        phase === 'error' ? h('span', { className: 'isl-updateErrorDot', 'aria-hidden': true }) : null,
      );
    }

    const UPDATE_SHOWCASE_PHASES = ['available', 'downloading', 'verifying', 'installing', 'ready', 'error'];
    const UPDATE_STATE_LABELS = {
      available: 'updateStateAvailable',
      downloading: 'updateStateDownloading',
      verifying: 'updateStateVerifying',
      installing: 'updateStateInstalling',
      ready: 'updateStateReady',
      error: 'updateStateError',
    };

    /** Static, non-interactive copies of the rail button for the settings page. */
    function IslandsUpdateShowcase({ copy }) {
      return h(
        'div',
        { className: 'isl-updateShowcase' },
        h(
          'div',
          { className: 'isl-updateShowcaseHead' },
          h('div', { className: 'isl-updateShowcaseTitle' }, copy.updateShowcaseTitle),
          h('div', { className: 'isl-updateShowcaseDesc' }, copy.updateShowcaseDesc),
        ),
        h(
          'div',
          { className: 'isl-updateShowcaseGrid' },
          UPDATE_SHOWCASE_PHASES.map((phase) => {
            const label = copy[UPDATE_STATE_LABELS[phase]] ?? phase;
            return h(
              'div',
              { className: 'isl-updateShowcaseItem', key: phase },
              h(
                'div',
                { className: 'isl-updateShowcaseStage' },
                h(
                  'span',
                  {
                    className: `isl-updateButton is-preview is-${phase}`,
                    'data-phase': phase,
                    title: label,
                    'aria-hidden': 'true',
                  },
                  h(UpdateGlyph, { phase }),
                  phase === 'error' ? h('span', { className: 'isl-updateErrorDot' }) : null,
                ),
              ),
              h('div', { className: 'isl-updateShowcaseLabel' }, label),
              h('div', { className: 'isl-updateShowcasePhase' }, phase),
            );
          }),
        ),
      );
    }

    const EMPTY_MENU_STATE = Object.freeze({ current: null, groups: [], status: 'idle', retainedEffort: undefined, error: null });

    function modelIn(groups, selection) {
      for (const group of groups) {
        if (group.id !== selection.provider) continue;
        const model = group.models.find((entry) => entry.id === selection.model);
        if (model !== undefined) return model;
      }
      return undefined;
    }

    /**
     * Composer model + reasoning picker. Replaces the shipped two-level menu:
     * the trigger is a chip, the menu opens straight onto the model list, and
     * reasoning effort lives on a stepped slider.
     */
    function ModelPicker({ sessionId, locked }) {
      const active = useLocale() ?? 'en';
      const copy = String(active).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
      const directory = React.useMemo(() => {
        try {
          return modelDirectories !== undefined && sessionId !== undefined
            ? modelDirectories.directoryFor(sessionId)
            : null;
        } catch {
          return null;
        }
      }, [sessionId]);
      const subscribe = React.useCallback(
        (listener) => (directory === null ? () => {} : directory.store.subscribe(listener)),
        [directory],
      );
      const getSnapshot = React.useCallback(
        () => (directory === null ? EMPTY_MENU_STATE : directory.store.getSnapshot()),
        [directory],
      );
      const state = React.useSyncExternalStore(subscribe, getSnapshot);
      const [open, setOpen] = React.useState(false);
      const [position, setPosition] = React.useState(null);
      const [pane, setPane] = React.useState('effort');
      const [draft, setDraft] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [query, setQuery] = React.useState('');
      const rootRef = React.useRef(null);
      const triggerRef = React.useRef(null);
      const panelRef = React.useRef(null);

      React.useEffect(() => {
        if (directory !== null) directory.load().catch(() => {});
      }, [directory]);

      const current = state.current ?? null;
      const groups = Array.isArray(state.groups) ? state.groups : [];
      const reasoning = current !== null && directory !== null ? directory.catalog.reasoningFor(current) : undefined;
      const efforts = Array.isArray(reasoning?.efforts) ? reasoning.efforts : [];
      const effective = current?.reasoningEffort ?? reasoning?.defaultEffort;
      const effortName = efforts.find((level) => level.id === effective)?.name ?? state.retainedEffort;
      const modelName = current === null
        ? state.status === 'loading' ? copy.loading : copy.pick
        : modelIn(groups, current)?.name ?? current.model;

      const searchQuery = query.trim().toLowerCase();
      const searchPlaceholder = String(active).toLowerCase().startsWith('zh') ? '搜索模型' : 'Search models';
      const visibleGroups = searchQuery === ''
        ? groups
        : groups
            .map((group) => ({
              ...group,
              models: group.models.filter((entry) =>
                String(entry.name ?? entry.id).toLowerCase().includes(searchQuery),
              ),
            }))
            .filter((group) => group.models.length > 0);

      const close = () => {
        setOpen(false);
        setError('');
        setDraft(null);
        setQuery('');
      };

      const openMenu = () => {
        if (locked || directory === null) return;
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect === undefined) return;
        setPosition({
          bottom: Math.max(8, window.innerHeight - rect.top + 8),
          right: Math.max(8, window.innerWidth - rect.right),
          width: Math.min(300, window.innerWidth - 24),
        });
        setPane('model');
        setDraft(null);
        setError('');
        setQuery('');
        setOpen(true);
        directory.load().catch(() => {});
      };

      React.useEffect(() => {
        const onOpen = () => openMenu();
        window.addEventListener('islands:model-open', onOpen);
        return () => window.removeEventListener('islands:model-open', onOpen);
      }, [openMenu]);

      React.useEffect(() => {
        if (!open) return;
        const onDown = (event) => {
          if (rootRef.current?.contains(event.target) === true) return;
          if (panelRef.current?.contains(event.target) === true) return;
          close();
        };
        const onKey = (event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          close();
        };
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey, true);
        return () => {
          document.removeEventListener('mousedown', onDown, true);
          document.removeEventListener('keydown', onKey, true);
        };
      }, [open]);

      const choose = (selection, stayOpen = false) => {
        if (directory === null || busy) return;
        setBusy(true);
        setError('');
        directory
          .select(selection)
          .then((result) => {
            setBusy(false);
            if (result.ok) {
              if (stayOpen) {
                setPane('effort');
                setDraft(null);
              } else {
                close();
              }
            } else {
              setError(result.error?.message ?? copy.failed);
            }
          })
          .catch((problem) => {
            setBusy(false);
            setError(String(problem?.message ?? problem));
          });
      };

      const chooseEffort = (effortId) => {
        if (directory === null || current === null || busy) return;
        setDraft(effortId);
        setBusy(true);
        setError('');
        directory
          .select({ provider: current.provider, model: current.model, reasoningEffort: effortId })
          .then((result) => {
            setBusy(false);
            if (!result.ok) setError(result.error?.message ?? copy.failed);
          })
          .catch((problem) => {
            setBusy(false);
            setError(String(problem?.message ?? problem));
          });
      };

      const sliderId = draft ?? effective;
      const sliderIndex = Math.max(0, efforts.findIndex((level) => level.id === sliderId));
      const percent = efforts.length > 1 ? Math.round((sliderIndex / (efforts.length - 1)) * 100) : 0;

      const trigger = h(
        'button',
        {
          ref: triggerRef,
          type: 'button',
          className: 'isl-modelTrigger',
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'aria-label': modelName,
          title: withShortcut(
            effortName === undefined ? modelName : `${modelName} · ${effortName}`,
            'islands.model.open',
            /Mac/i.test(navigator.platform ?? '') ? '⌘⇧M' : 'Ctrl+Shift+M',
          ),
          disabled: locked || directory === null,
          onClick: () => (open ? close() : openMenu()),
        },
        h('span', { className: 'isl-modelIcon' }, h(ModelGlyph)),
        h('span', { className: 'isl-modelName' }, modelName),
        effortName === undefined ? null : h('span', { className: 'isl-modelEffort' }, effortName),
        h('span', { className: 'isl-modelChevron' + (open ? ' is-open' : '') }, h(ChevronGlyph)),
      );

      const modelPane = h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'isl-modelPaneHead' },
          h(
            'button',
            {
              type: 'button',
              className: 'isl-modelBack',
              title: copy.back,
              'aria-label': copy.back,
              onClick: () => setPane('effort'),
            },
            h('span', { className: 'isl-modelBackIcon' }, h(ChevronGlyph)),
          ),
          h('span', { className: 'isl-modelMenuTitle' }, copy.models),
        ),
        h(
          'div',
          { className: 'isl-modelSearch' },
          h('input', {
            className: 'isl-modelSearchInput',
            type: 'search',
            value: query,
            placeholder: searchPlaceholder,
            spellCheck: false,
            autoFocus: true,
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: (event) => event.stopPropagation(),
          }),
        ),
        h(
          'div',
          { className: 'isl-modelGroups' },
          visibleGroups.length === 0
            ? h('div', { className: 'isl-modelEmpty' }, state.status === 'loading' ? copy.loading : copy.empty)
            : visibleGroups.map((group) =>
                h(
                  'div',
                  { className: 'isl-modelGroup', key: group.id },
                  h('div', { className: 'isl-modelGroupName' }, group.name),
                  group.models.map((model) => {
                    const selected = current !== null && current.provider === group.id && current.model === model.id;
                    return h(
                      'button',
                      {
                        type: 'button',
                        role: 'menuitemradio',
                        'aria-checked': selected,
                        className: 'isl-modelOption' + (selected ? ' is-selected' : ''),
                        key: model.id,
                        onClick: () => choose({ provider: group.id, model: model.id }, true),
                      },
                      h('span', { className: 'isl-modelOptionName' }, model.name),
                      selected ? h('span', { className: 'isl-modelCheck' }, h(CheckGlyph)) : null,
                    );
                  }),
                ),
              ),
        ),
      );

      const ratio = efforts.length > 1 ? sliderIndex / (efforts.length - 1) : 0;

      const effortPane = h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'isl-effortPopup' },
          h(
            'button',
            {
              type: 'button',
              className: 'isl-effortReset',
              title: copy.reset,
              'aria-label': copy.reset,
              disabled: reasoning?.defaultEffort === undefined,
              onClick: () => chooseEffort(reasoning?.defaultEffort),
            },
            h(ResetGlyph),
          ),
          h('div', { className: 'isl-effortName' }, effortName ?? ''),
          h(
            'button',
            { type: 'button', className: 'isl-effortModel', onClick: () => setPane('model'), title: copy.models },
            h('span', { className: 'isl-effortModelName' }, modelName),
            h('span', { className: 'isl-effortModelChevron' }, h(ChevronGlyph)),
          ),
          efforts.length > 1
            ? h(
                'div',
                { className: 'isl-effortSliderWrap' },
                h('input', {
                  type: 'range',
                  className: 'isl-effortSlider',
                  min: 0,
                  max: Math.max(0, efforts.length - 1),
                  step: 1,
                  value: sliderIndex,
                  'aria-label': copy.effort,
                  style: { '--isl-ratio': String(ratio) },
                  onChange: (event) => setDraft(efforts[Number(event.target.value)]?.id),
                  onPointerUp: () => {
                    if (draft !== null && draft !== effective) chooseEffort(draft);
                  },
                  onKeyUp: () => {
                    if (draft !== null && draft !== effective) chooseEffort(draft);
                  },
                }),
                h(
                  'div',
                  { className: 'isl-effortDots', 'aria-hidden': true },
                  efforts.map((level, index) =>
                    h('span', {
                      key: level.id,
                      className: 'isl-effortDot' + (index <= sliderIndex ? ' is-filled' : ''),
                    }),
                  ),
                ),
              )
            : h('div', { className: 'isl-modelEmpty' }, copy.noEffort),
        ),
      );

      const panel = open && position !== null
        ? ReactDOM.createPortal(
            h(
              'div',
              {
                ref: panelRef,
                className: 'isl-modelMenu',
                role: 'menu',
                style: { right: position.right, bottom: position.bottom, width: position.width },
              },
              pane === 'model' ? modelPane : effortPane,
              error === '' ? null : h('div', { className: 'isl-modelError' }, error),
            ),
            document.body,
          )
        : null;

      return h('div', { className: 'isl-model', ref: rootRef }, trigger, panel);
    }

    /** Live open/closed state of the native right sidebar, read from its attribute. */
    function useRightPanelOpen() {
      const [open, setOpen] = React.useState(false);
      React.useEffect(() => {
        const read = () => setOpen(document.querySelector(HOST.RIGHT_PANEL_OPEN) !== null);
        read();
        const observer = new MutationObserver(read);
        // The pane can mount already open (restored layout), in which case no
        // attribute mutation for its open state is ever observed. Watch for
        // insertion too, not only later attribute flips.
        observer.observe(document.getElementById('root') ?? document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['data-sidebar-right-open'],
        });
        return () => observer.disconnect();
      }, []);
      return open;
    }

    function rightPanelOpenNow() {
      return document.querySelector(HOST.RIGHT_PANEL_OPEN) !== null;
    }

    /**
     * The shipped control is a button that the skin hides and DSH can disable
     * (it is `disabled` whenever the layout already counts the pane as open),
     * so clicking it is not a dependable contract. Ask the layout service
     * first and only fall back to the control when the service ignored us.
     */
    function toggleRightPanel() {
      const wantOpen = !rightPanelOpenNow();
      try {
        if (wantOpen) layoutService?.openRightbar?.(true, false);
        else layoutService?.closeRightbar?.();
      } catch {
        /* fall through to the shipped control */
      }
      window.setTimeout(() => {
        if (rightPanelOpenNow() === wantOpen) {
          // The pane can be mounted with its width preference already set;
          // republish so a collapsed workspace gets the right grid track.
          if (wantOpen) publishRightbarWidth?.();
          return;
        }
        const selector = wantOpen ? '[data-sidebar-right-expand]' : '[data-sidebar-right-toggle]';
        const target = document.querySelector(selector);
        if (target instanceof HTMLElement) target.click();
      }, 120);
    }

    /**
     * Always-visible right sidebar toggle; drives the native open/collapse actions.
     *
     * Rendered into `document.body`, not into the top bar: the frame's overlay
     * layer is z-index 20, while the workbench panel host (dsh-better-sidebar)
     * is a full-viewport fixed layer at z-index 25 and re-enables pointer
     * events on its dock strip — the same top-right band the native expand
     * button used to occupy. Anything painted inside the frame therefore sits
     * UNDER that strip: the toggle still renders (the strip is transparent
     * there) but never sees hover or clicks. A body-level portal escapes both
     * stacking contexts; the stylesheet keeps it above the workbench
     * (25/40/60/90) and below the app's menus and dialogs (1000+).
     */
    function RightPanelToggle() {
      const open = useRightPanelOpen();
      const active = useLocale() ?? 'en';
      const copy = String(active).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
      const label = open ? copy.closeRight : copy.openRight;
      return ReactDOM.createPortal(
        h(
          'button',
          {
            type: 'button',
            className: 'isl-rightToggle',
            'aria-label': withShortcut(label, 'sidebar.right.toggle'),
            title: withShortcut(label, 'sidebar.right.toggle'),
            'aria-pressed': open,
            onClick: toggleRightPanel,
          },
          h(RightPanelGlyph),
        ),
        document.body,
      );
    }

    /**
     * Collapse the workspace island without asking DSH to swap the sidebar for
     * its rail-only render tree. The expanded rail stays mounted, the workspace
     * column is hidden, and the frame track shrinks to the rail width.
     */
    function toggleWorkspace() {
      const frame = document.querySelector(FRAME);
      if (frame !== null && frame.hasAttribute('data-sidebar-drawer')) {
        // Narrow layout: the workspace is a drawer, owned by DSH's native
        // narrow expansion state. The rail's home button and the shortcut both
        // open/close it here.
        layoutService?.toggleSidebar();
        return;
      }
      if (frame !== null && frame.hasAttribute('data-sidebar-collapsed')) {
        layoutService?.toggleSidebar();
        document.body.removeAttribute(WORKSPACE_ATTR);
        return;
      }
      const collapsed = document.body.hasAttribute(WORKSPACE_ATTR);
      if (collapsed) document.body.removeAttribute(WORKSPACE_ATTR);
      else document.body.setAttribute(WORKSPACE_ATTR, '');
      if (frame !== null) {
        frame.setAttribute('data-islands-animating', '');
        window.clearTimeout(animateTimer);
        animateTimer = window.setTimeout(() => {
          frame.removeAttribute('data-islands-animating');
        }, 360);
      }
    }

    /** Window chrome strip above the islands; owns the workspace toggle. */
    function IslandsTopBar() {
      const active = useLocale() ?? 'en';
      const copy = String(active).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
      return h(
        'header',
        { className: 'isl-topbar' },
        h('div', { className: 'isl-topbarLead', 'aria-hidden': true }),
        h(
          'button',
          {
            type: 'button',
            className: 'isl-topbarToggle',
            'aria-label': withShortcut(copy.topbarToggle, 'sidebar.left.toggle'),
            title: withShortcut(copy.topbarToggle, 'sidebar.left.toggle'),
            onClick: () => toggleWorkspace(),
          },
          h(PanelGlyph),
        ),
        h('div', { className: 'isl-topbarDrag', 'aria-hidden': true }),
        h(RightPanelToggle),
      );
    }

    function IslandsLogo({ size = 30 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 64 64', fill: 'none', 'aria-hidden': true },
        h('rect', { width: 64, height: 64, rx: 16, fill: '#0f1115' }),
        h('rect', { x: 10, y: 10, width: 44, height: 44, rx: 11, fill: '#22252b' }),
        h('rect', { x: 16, y: 16, width: 14, height: 32, rx: 6, fill: '#4176e6' }),
        h('rect', { x: 34, y: 16, width: 14, height: 14, rx: 6, fill: '#f5f7fa' }),
        h('rect', { x: 34, y: 34, width: 14, height: 14, rx: 6, fill: '#7aaaff' }),
      );
    }

    const EMPTY_SESSION_STATUS = new Map();

    /**
     * Pending-interaction kinds are host vocabulary, so match on the word the
     * kind carries instead of pinning an exact spelling: an unknown kind still
     * turns the row amber rather than reporting the session as idle.
     */
    function pinnedPendingKey(pending) {
      const kind = String(pending?.kind ?? pending?.type ?? '').toLowerCase();
      if (kind.includes('approval')) return 'statusApproval';
      if (kind.includes('plan')) return 'statusPlanReview';
      if (kind.includes('question') || kind.includes('ask')) return 'statusQuestion';
      return 'statusPending';
    }

    /**
     * One pinned row status, with the precedence the workspace rows use:
     * pending interaction, live turn, unviewed completion, then idle.
     */
    function pinnedStatusOf(status, copy) {
      if (status === null || status === undefined) return { state: 'idle', label: copy.statusIdle };
      if (status.pendingInteraction !== null && status.pendingInteraction !== undefined) {
        return { state: 'warning', label: copy[pinnedPendingKey(status.pendingInteraction)] };
      }
      if (status.running === true || status.busy === true || status.activity === 'running') {
        return { state: 'ongoing', label: copy.statusRunning };
      }
      if (status.completionUnread === true) return { state: 'done', label: copy.statusDone };
      return { state: 'idle', label: copy.statusIdle };
    }

    /** The status snapshot is keyed by Session id; accept a Map or a plain record. */
    function pinnedStatusFor(statuses, id) {
      if (statuses === null || statuses === undefined) return undefined;
      return typeof statuses.get === 'function' ? statuses.get(id) : statuses[id];
    }

    /** The shell draws live turns as a spinner and everything else as a dot. */
    function PinnedStatusMark({ status }) {
      return h(
        'span',
        {
          className: 'isl-pinnedStatus',
          'data-islands-state': status.state,
          role: 'img',
          'aria-label': status.label,
          title: status.label,
        },
        status.state === 'ongoing'
          ? h(
              'svg',
              { className: 'isl-pinnedSpinner', width: 14, height: 14, viewBox: '0 0 24 24', 'aria-hidden': true },
              h(
                'g',
                { className: 'isl-pinnedSpinnerMotion' },
                h('circle', { className: 'isl-pinnedSpinnerTrack', cx: 12, cy: 12, r: 9.5 }),
                h('circle', { className: 'isl-pinnedSpinnerArc', cx: 12, cy: 12, r: 9.5 }),
              ),
            )
          : h('span', { className: 'isl-pinnedDot', 'aria-hidden': true }),
      );
    }

    /** One pinned row: hover reveals unpin + locate, and a clipped title marquees. */
    function PinnedRow({ session, status, copy, pinIcon }) {
      const titleRef = React.useRef(null);
      const frameRef = React.useRef(0);
      const revealingRef = React.useRef(false);
      const id = session.id ?? session.sessionId;
      const title = String(session.title ?? '').trim() || copy.untitled;
      const statusMark = status ?? pinnedStatusOf(undefined, copy);
      const rowTitle = statusMark.state === 'idle'
        ? title
        : (copy === COPY.zh ? `${title}（${statusMark.label}）` : `${title} (${statusMark.label})`);

      React.useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

      const place = (left, range) => {
        const element = titleRef.current;
        if (element === null) return;
        if (typeof element.scrollTo === 'function') element.scrollTo({ left, behavior: 'instant' });
        else element.scrollLeft = left;
        if (left > 0) element.dataset.scrolled = '';
        else delete element.dataset.scrolled;
        if (left < range) element.dataset.clipped = '';
        else delete element.dataset.clipped;
      };

      const enter = (event) => {
        if (event?.pointerType === 'touch') return;
        if (titleRef.current === null || revealingRef.current) return;
        revealingRef.current = true;
        cancelAnimationFrame(frameRef.current);
        // Measure after hover has laid out the two action buttons; otherwise
        // the title still has its resting width and the marquee never starts.
        frameRef.current = requestAnimationFrame(() => {
          const element = titleRef.current;
          if (element === null) return;
          const range = element.scrollWidth - element.clientWidth;
          if (range <= 8) return;
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            place(range, range);
            return;
          }
          let previous;
          let position = 0;
          const step = (now) => {
            position += previous === undefined ? 0 : (now - previous) * 0.03;
            previous = now;
            place(Math.min(position, range), range);
            if (position < range) frameRef.current = requestAnimationFrame(step);
          };
          frameRef.current = requestAnimationFrame(step);
        });
      };

      const leave = () => {
        revealingRef.current = false;
        cancelAnimationFrame(frameRef.current);
        place(0, 0);
      };

      return h(
        'div',
        {
          className: 'isl-pinnedRow',
          role: 'button',
          tabIndex: 0,
          title: rowTitle,
          onClick: () => uiWorkspaceService?.openSession(id),
          onKeyDown: (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            uiWorkspaceService?.openSession(id);
          },
          onPointerEnter: enter,
          onPointerLeave: leave,
        },
        h(PinnedStatusMark, { status: statusMark }),
        h('span', { className: 'isl-pinnedName', ref: titleRef }, title),
        h(
          'button',
          {
            type: 'button',
            className: 'isl-pinnedPinBtn',
            title: copy.unpin,
            'aria-label': copy.unpin,
            onClick: (event) => {
              event.stopPropagation();
              workspacesService?.unpinSession?.(id).catch?.(() => {});
            },
          },
          pinIcon,
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'isl-pinnedLocate',
            title: copy.locate,
            'aria-label': copy.locate,
            onClick: (event) => {
              event.stopPropagation();
              revealPinnedSession(id, title);
            },
          },
          h(LocateGlyph),
        ),
      );
    }

    /**
     * Aggregate pinned sessions above the workspace groups. The block lives
     * in a host div inserted before the DSH workspace list, so it participates
     * in the sidebar flow while rendering as React through a portal.
     */
    // The new-session hero mark. The host asks for a square edge and hands
    // down its own mark class (which carries the hover sway), so the mark
    // keeps the shipped geometry: only the artwork changes.
    const ISL_HERO_MARK =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAAAXNSR0IArs4c6QAAAMRlWElmTU0AKgAAAAgABgESAAMAAAABAAEAAAEaAAUAAAABAAAAVgEbAAUAAAABAAAAXgEoAAMAAAABAAIAAAExAAIAAAATAAAAZodpAAQAAAABAAAAegAAAAAAAAEsAAAAAQAAASwAAAABUGl4ZWxtYXRvciBQcm8gNC4zAAAABJAEAAIAAAAUAAAAsKABAAMAAAABAAEAAKACAAQAAAABAAABAKADAAQAAAABAAABAAAAAAAyMDI2OjExOjExIDIyOjQ0OjQyAJq8wNAAAAAJcEhZcwAALiMAAC4jAXilP3YAAAOyaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA2LjAuMCI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIj4KICAgICAgICAgPGV4aWY6UGl4ZWxZRGltZW5zaW9uPjI1NjwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj4yNTY8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPlBpeGVsbWF0b3IgUHJvIDQuMzwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+MjAyNi0xMS0xMVQyMjo0NDo0MiswODowMDwveG1wOkNyZWF0ZURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMjYtMTEtMTFUMjI6NDQ6NTErMDg6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjMwMDAwMDAvMTAwMDA8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjI8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOllSZXNvbHV0aW9uPjMwMDAwMDAvMTAwMDA8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgrHK9ioAABAAElEQVR4Aey9C7BmV3Xfub/v3u6WWi0JCYRAEGQEGGwQRgZhG4jNyyTGtvxE48Qzxk6lXPEkDpNKPJPxOFVUeWIn8WQyIU7NxFNTKSfjx2AnDsZMcIwAE8DJWAYbGQwEhGTE20jore6+9zvz+/3X3udeoRbqbvW9fVvqfe85e+/13muvtc8+53st2tnyiPPA9Ma21p7+NU9um8sn03pia9MT26JdTH1hmxYXUp/b2mIfA/ewHAXGsbi3LabbqW9vU7uV+jNts32mra1uaR/7k1sW19I7Wx5RHlg8okbzKB3M9MFnH2qHN69s09qVJPBXk8xP7Ql+Cj2SBeITLCAfbYvNG9qBtRsWz/7gXadQwVlRp8EDZxeA0+D0U6Fyeu9XP6ntX39RW7ZvRN7TOXZ7Lid0fqyt2n9qRzbeu3jRRz91KsZ1VsbuemC3g2Z3R/cI0zZ9+Jnnt3vWX8YV/pUM7av22PBuYg16Wzu48Y7Fsz5y5x6z7aw5D+KBswvAgzhmL4GnD1x5RdvY/B4S7EUk/7hv30smbrNl4fOE97b1td9YPPeGG7chzjb3oAfOLgB7cFKGSdP1z7qyLdeuJaG+bsDOrHrxR221+cbFCz58w5ll96PH2rMLwB6c6+n3ueKvbb4W067ag+adjEnvb5trv7i4+uyO4GSct5M8ZxeAnfTuCcque/y1H+EluFfu+iO9E7T1hMl9ZLhoPCPY/JdnnxGcsPd2jOHsArBjrj0xwdP7vvYVJIjJf8GJcZ5h1It2B2P8l4uv/9B1Z5jlj0hzzy4Ap3lap+uvuLAtz/2b3OdffZpN2WX10//XVof/2eIFN/LGo7PldHng7AJwujyP3ukPv/aqtrn4W7x55zGn0YzTp3pafKmtTf9k8bwPvf/0GfHo1nx2AThN8z+979nfxxLwQ6h/tM8BTwcW/2rx9R/8N6dpKh7Vah/twbfrk8/bdve3+1ava4vFn9915XtZ4aK9q+1fvIG3Fx/Zy2Y+0mw7uwDs4oxO1z//YFve+1OofM4uqj2TVP1xW537Py9e8Af3nElGn8m2nl0Admn28rBv7dzXt2l62i6pPDPVLBYfb5v3vv7sw8Hdmb6zC8Au+Hl6N+/hP7j2M6i6fBfUPRJU3Nzu2fzJxUvOfqZgpydzudMKHu3ys+0/uPZ6/HA2+Y8/GC5nwXx9fHf8PGcpT8IDZxeAk3Da8bJM02vW+j3/M46X5yzd7IFn8P0k/1N8OIPONk61B84uAKfao9vl/dGHfozu2Qd+231yIu1Fu7KVD0+E6yztCXjg7AJwAs46EVJe57+mraZXnQjPWdpjeAAfxpfHQJ0FPXwPnF0AHr4PHyBh+qNnPpM3+fyVByDOAk7SA9NfKZ+eJPtZtgf1wNlXAY7hmun6yw62A+2x7ZzVBW1jcQ5v2jmnTat9bbncaJubG22x5EsvlnfyVVhfauuP+9L2N6/kwdXaff+Ul/suPYbos6CT9cBi8bm2ec7rtr9HYHojb6q68EmP4aPTj2nL1fm8pZovS1lfb21jne8uZI7afY23XTFnd7Q7Lvzi4jvffPb9BV/m/0f1AjB9mkS/uz2rba6exhtyn4JvLm/T8gmtrc75Mj89RJf3tE/tFpL+FhaHS9uRc5/RNg8cegims+jj9YAfJV6t34VP/0u779DnWHyfzA6Lo53oZyjug+ezLOg3M1d/yvcpfrwdPO/Dixc8eheGR9UCME18SfZHn/Sctlq9kADiG3Tz0typ88FydUdbHv1BFhHE+7HXJe9s2/cpFgR2DmcXhOPN99BVwq/zYakntcXac0hYPibNVG3s+yUWg1P5kWmXFxaE9gF0/H572eP+eLH4tUfN15+fuuA/odndPWKSftn+5LLn8d32L2OS/cjtwZ3Rvths6/ddRdJfzlYUFfV4ZVoRtnp5WtxC8P5B2zh4d9vYf/7O2HCmS127czqy/7zFtHw+O6knTxOOw5ULE18f4stcvY+c46cH13ZktNN0D7d6v982pne0l3/zHy4Wr1frI7bo1kdkmf7kSY9t0+a3t7Xly7l/50cxdrisH/XLML83EesOIJG75KJSsVu17l6I+dBi48AH2uFDB1gYuGd9FJdpsbFa7T+83Nz3XHz2tTrHHZS5Hxem9tR9mkVh8Rtt48DO+20x3Yoh1/Ec6P9dvPK6Lz4SZ0nPPqLK9IFLr2j7Ft/LleLFRNDOXCW+3GMLrhrrR76nrRb72xKXroziClg3IG4IhGQn4AIgng6Lwp2L1b53LA4fuq+t1vi1nkdRmZb3ts3950yrtZfijGzpszQOR1Wi45DyVRwYn+rfdgTe3yA5d2g394B52ET/e/ilpX+7eOXbbnwA9gwGPGIWgOlDT2Tr3f4yAfNN2S7u4qRM60f2o/cveNkyyd26ZtuaqK1bgWwFgBvXC08uBP1WYWFAr9Z+px05dPcjfiEw8Vfr57E2fyt+wm96grIy/fVfesn7IFb4Tz9Z68/gqae1325H95+Gjw5Pv8dziV9evOLtN2v2mV66t8/cYUwf5yu1jt73Wi6rp+eLNJfT3W1x5PsJTF56wo96dCT4AHCpX3D1mgje5Pyg8b7ARcEYN8AnXrKa1t/a7juP+87lHv/+/xOMGV+WW+3DCWt/kWGfk8DzZOLrl3KcPuDoyS4sK2bpmqANX7prm+wCfo3dwHmF3dWzE3ddO8Q3Hb/gbWf0V5pt+XNX/ffwlRFEy/aRy76DCOKqv1MP9o7DzrUj57Tl9K0J3JAT0IRHQlXvjmAetaAsEDagWxLs3hJkFaCChx3CbW1znR3BefsB7M5tTGzfgdOCHxQ9uu/ItFp+62LZLtIzVahd/OIrXbEFzy2TcK/28wKgn3we5+IgbXz2OzxQ9aW901PywLD9cvvmb/mtM/Vh4fD66XHgSWqd/suT+OXb6XVEBO+4O42Fe3+2/99PsleSbnte7FXNsuhXuHQI5uwAguAEbo5lGmN3QGjbE//pttr/u+3IQe91jfwzqazY6t/DPf63kOaX5bZIl5jQjs3Md0jbYWN00GRhyAIgC97QV9tK+YjFZePAr0OwW88CtlmwrbloH2Fx+qeLl73zlm3QM6J5f6+eASZPH77sGqLjtWTL6d8irx/hXYGTD/8qkPVfv5LXS1b2E+GYTBDnAWHFfhzPJXGCMMkePsI697qDrSfJNH1uMe1/Vzt6zhJ87pv37lQtuC9fX7FAfzOv1F2aVU3/kNET463nH46Paz5jHguDL5d6f0/qF6xneJ7jQpvtfzltOEcG/fXv2ua+vbBLOsqAfnHxLe/4zb07Nw+0LC59IHjvQaYPXnKora1z1Z++YW9Yx6O7ffe9aJqmS0ZQG8CJ2zy4GlbqYo8VQUwCpA1V9/zWfS0AEoTxSRo5IXLhkLi2B/ewwLy7HTnwBe6nT+WbYYaxJ19Pyzsw8hIy+yXUB5PQLHgxO1IZm84ZhUUh3SwK+oMxdli5po+5no0gtqCy2xqvrtD8ArcB783qIvJ0l0X7z303cEb8dPqWV0+3476C/ulGnvAfaX+PaX/8VyDbXdTaxh28hP2DldAVkrVLN6y9snuFo5kdwKiLzvtdcVsPvwa+X/3MlVw1peeAOHqUlwLMNxZNS95YtO8uFgPfWCTxbhaMXd7JAniI5xjPx94nxwDHa8PaY4nRJHHAsT8Dh2D4yEWvSFlSKTK7OMhPy8o6MGoFBacwkRyL9V9qG8u9syBO0+f5gtOfXrx4779SoDf3dJk+/MQXMMM/QRTtrdfJ9x25lCx9YUXoCEQjmIDmoZ7bXUslelrVJmAXAr2yJcKp6SbFc5WDl+Sf+ZwhFwNwi3kbXTDvGkDIfBvb6fetNpfuDKblanlI8CktmryYuKotF+T0JZjy9QyRh3oaQcKCT5LiAsdXDzrd8WRw0PTxati43Zn5pAHv+LMIaLm3B4K2ye46xDronOHj+cDvM+7PBrBXTot2b1tb+7nFS37n+r1i0rHsONVhciwdJw2bPvKEb2Oe/xoC9pqdh6d9h78Xo4zaBKpXoiR2TCU4TfBYbaDSzpVLVwA0snudrSy9XMisbXRak8ePL1RhiQiuYBFtEoykCQAOF4/W7uT0cd5T8Flk3c59NM8qINxc7KPmlYVkY5e7rVp4n8Jea9F4VyOrmC9trqYLqfmA1OJp4NhplObYiPraxQwTGedoahp/Wdgcroe22uyDdZFL4g+ZheSsHGjFU0Ief0aIEA79rgZr1qaN/f8W4AGOvVQ09P9YvPTt/34vGbXdlj6b20F7oz199InfR/C9dm9Y82VWLDfuasvNv2RgGp1xYqK00zntHgYnyDzssifM2CZJ8xBMTq549ZRbAuBWkdiJXSz8B5cFwCQSRamrrA17Xm0tdNx9hE/IDO1P0tW9OLpYrHj34fIwHZ+zHeCTDHzkOQtEyVNPbENC16eOGg8AG8qWPwTap15toFiHxCu5i1e/ond7Cg+BevjozeStQud3/C5zvnci48h4FKkOa0UPecW3mpa/slyt7c1PYC6Xv7j45rf9G92y14pTtOfK9CeX/WWi9Qf2nGHDoPXDbH0bD7soetCITFQSuCSEfwEkSWzRBx9nB2WA0xc/3gcQErezIHoxhy2LJEC46QnsSSUyUsM8q0yykSlJyGRM6ZN2S77yhkxYY3fJm20zOS19HEl2k1k+iOrqX7ZEdgFpdtnSdLlJ6LGoYL8yKqEr1VVTdlsXbOgpE/QNcHzRvRcb1Bv7pvZuXg24Tdo9WRbTr/IKwS/vNdu8Hu2pkiv/Xk7+xYLtdHtB8lDPGeRVpZGU6VfESgRDlD/jdL5AEvq97047AZz7frJfAeJMYGcnhAa+K4M7dHDzykDyFTFAeUgOlUDr4mIaeRW38nX0LDhRIKjje3KrNij0VVuBHJ2+2toNVgKf8KeBrvAUrXcX+ayD3SwWNiwOHp0zLXDl29eG2OFLoiP5AfmnPjX5JiCbvrygnMi3Ly+d5cSzIvcSe7RMix+Y3vVKfg5ubxVDbM+U3PPv1W3/8NLyKC/FTXxLUAfkikSAUnu1SxyLrAa1dJz4TxKGMZltnlaJLILd5LXII/9IWvHg6uqnLpMG2OCPcGClpHhBlw0wm0S+BwF8mVVX0ciIMjHgza3olll9wOxbejt45dgIruQOfAyDdujJcMMusTaavLGUPjAXwCx2LG6KmksswkeFr9uaIqj3EMitLBgcG28v5luB7p7Z92JjtXrt9M6Xf9teMm3PLAB52l8P/PaSfx5oy3LzEoN93PfmimRyUKxs1RXayKTdceEx4EeUj+RNFhrk4ayADicnccGTsCZJvVvGYC9F0UfH+2fwihZVr0CIFK5cgWJkC1PaofMWREZpaUo9bM4C1fmSjpKpK1Sjos9ClcVj2+v+tV2PGmzq+Cwa9EJXi0FEqTSLnbaUKdERVfh6LEzqx8jsGGzrkzw7gDCL5+qS0rinz39teve3ulvZE2VPLAB5nT8v9Y3I2hO+OZYRRlq2/+YLKZeAzSmJYt9o9gpHTeAm4bqk7BLCA11Wi6KtBAREMAuRJFdKdxVCzIAsGGaoSI7Au2Bxgrlaegvgw3y3FyVL2n4EMLq1C6gFTDnqqXCI+IxHBuHdLmz26i2sHtCJop8FCJh2aKI80GbtAR97QJXt1N1XJVWZgBRbg5Qg49Zq23GVOAEoKXYY5Eun6PptQLEJ2puFV2M2f2J6z8sv3wvmnfYFIO/wy5t89tjr/MeaneWKN74s+XIRYixbf9zn9pOr1whm2YzlxHO8azxWsMo37qEN+Dl2ybgkQd4b0JkBmFDKUXaektNOpnjF7WJTiw+IUzFAaCZ2u6QVYYKGwd1COtVLkjqmjrbSpmU3wAzEnkp+kQrsBkgXxmFslAHjL9t3eSH3qh86upXR9EIVaF3VoXX1Ca3maBAl9L3tTiHNCC2aUgnh8uJ6r0K49u5paue2I9Pfm97x0tP+qsVpXwD623v3zjv8vlLYLI+S/CYOETiCrvKoB6UhPVC0clkDZlNMEkd23D7ubRPkyOvxPTcS5cWTNI6sMs4LdbqRpy0c2xOjkAXDXqQgVgXjqG7upYHV+xckgtIEtJLWsY1kp1vc1aihmPoaI4+hRC2VhNmJ1Ngz3uCkQ3L29NCE0JoSHmrwQ7bSYje+qmcOEKkucGlrN5AFKONb8aLKLnz7k/ofblksHo+xvLX99BZn7bSVfLBnz7y3/6HcwCvli+klxlkC0FMiVUAgqY1jjzoB76hKQKMXrFv13AdLWMW8ky/XxJH8QxmI5FiEwZskKlERL2Pfhkf+4Ivofs9s0s2zbYNEdOcy7HP3McajPvHIGc8Dcp+vjDGgYWP44VW/I6CSrJ4VCBEw2NRrhxLZ4kPRofK7QIC35m87fXVBZpEC5+4Lka6nodO308Q3Qe3hVwM0dZSpfcP0uy+7ZnRPRx3XnQ7F+Uivn+o7U8ra0bvZAp9fAUqg8Z+TtQdxOSdLACaPkWw2+F+BHpTJAjhP/ZN0YYYWutDSGFdUg9wtf5eh/pQCQa+OWhSSRcDnB5R9Cz9E5Youkdt/2SjFr23ClM0SpOy+GIxkDIPGgcwbCcFLF13K08bIZKQ0XUz8s0RseO33jAXYTY9LZAnABiSdUyD/Pq+Qz27nk4J//doVhBZPnN/W+Iq2M6VMi9dyK+BXnJ+WcloWAGJjmc/z74WP9B6v25ebVxp/FcydKREszOA0CQ3bUG0Fp7hEs9dUC2mBkFCaoArcxpYkHckTOpAmT5hNOvrqATbfkytCGUH1xUA9PSllnVxIkixUvQiLVYoTFpk9JMLUhaoz/NLwzyU+0rAvCVhAETnCFZ9EaGhjS3zRl4VOa15XiQUlQ7l0txZUJbrdL9/FZxJQtj8ElMoFbVqtrgzyzDj5gzOvm6bXz57YTbNPi9L+TT6n98s8TsTLft9/a8+VJc/OTNpKAaM0rRGUCW8uuQZjwXpQFlWu/NnCK8JLM7uBrSsqwMxI1arxymfS5w0+IgtILY6TMkj0fNdAt0rV0vlXCwYtF4PILlzs91YkxJxITpOJtwgnj4NPFkqgXnVB7cA8+oIwPrgkVeFKZr0iAcyE1BIVKQO+WWeXVwtZ30VoZ2g7nWoFSKsczoUveenX1gZAPe9gEeA3Hybn7MwoU3tme9fv8u1Wu19GSOya5nyHX32N167pfLiKpuXRyysAkaTHjEeFGpxeyQzsumQRd2II5kQmwW83wUs9+ORJsSaoMwsd6abAkDc5YU4bmin336VGvQrOwqEsr+TwzaXz+aQ/KRN1nHyYphGR55mkH3yAxWSAjEW7w1bAYOw73ux4JKDkFoLxVU8CF5Kg6gSuhisQYVbb8cDGbUgY1BcfjAd8wy4sF+fYhoxu56Cw1pKMcTF9VeSdKadV+8vT9a+8cLfN3fUFIF/geTq/w+9EPbyc7iRAfbBUeZyX6rYlp9GY5C+8wWe+G6s2Etzg88aY9MVw9CSQvZKw03qFTKSXEKmjYlyFI98wl04lFAiSgsk0+cABTjfM3UZhlY29ZoEIIafYY0325dZBmWGohEsPGAkeOKjaorsgdF0uKCJz9IZVHhBqQ19tJAphH7y7mOjvFWjZalxpcAIiu2MT6aIXKJ0tpSIG74sw9k4AZ0ZZ8LVmd22+dreN3dUFIF/d7bf3nklleeSKijqSJdvoRGFGkCBNYtKlY38kb7a1JhvBaQ5a0rUh2MrANaB9FpDLHv0EM12bVHNw98Q1QUuPeK+G9qBETpYBuxa39DmGoAIXTsmRUkrYGVQDmNlFwtbLe8WThIt0ZWFr2LGbgWV9ATDu1yM14jxRJM+CEgzypRXR8drh2KKXKnaBxvb4MrLC0HloC8sOSbotnC2kd5eBWLanATqDyuIV03W7+wahXV0AmFs+5XcGzYf3/ov2jT2ivLgk/reCV4DBS9AZ1QYmDHlTi80Eb69NRv7qDS9SGbsQ+L/qn/m3L8D1IHKsQ9Br+06ZdOozXaoWMz+E7ItC8krqmDZ4ACg/doOYEwhYdEssLUWc6oe+wNDvFb3T5FuNwUNZbpp5B59i2M5HVsmNnenLxRHmLqCrrgd+dMRFv6QuphIA1AZl1GBKOQN2kxEWzyu+Pu5Mehag6WuT33K9a8Vo2pWSX+zxRzvOnEI0HX1+At2gI4t8Z1setiXBKswSbcaicWlJgFZCOJ8JfAPXJOksI569X64kHcEMgUT8d5XRW1dFpmoWUILsbiWnOoRn9QhfhGNr/mKz9mmkdiFPJbLk4KQx2Y3QFu2ffPJwpClPruiGjoyFkCSjxCjbY3eT9YpTkj42hCps49agXiFQTtkeXyGjxGurPOqaQdjgswZt09BuhxbYREyezcRB+ZSgJp0hZfFN09teecVuGess7k7Jz3XtjqpTomX9yH3E7bNMugpAgq8HV4/wUiOsIpV6pEGAwY+FYVz5tyfsfE/cyROlbseNYhiLp2RG2HwCNrbtMQoWQIrxB0aSuCpGThICeBIimJIdUaHpQhWghPyaGnXsKJkOy5cM82nGRIzKXByozVm367THKwKalJTNQqH8vih1faBTTOCyT4urXXbKXfaIly3yBVmCgiO7ADqxyXGrl44GqFL7lotnwnz6fjtAe0+0rK2+90RZTpZ+VxaA/FBnfqvvZM3cZT5/62+x+o5EFDGUYKbOPXUCtQI2eK82oai4pOl/OiO468qmAHFi06Au9yst+Rfmwhv0XRKVnQCqTlZAN8TQ1MZaobCGBFBKxIWNvldKAPVyYb8io7+u1IgKXhnaMl5OU0XJLXsQ4UPQvui4iVBH7FdhhgO9OmNAyTPLBYXPgaIrcrUnYGzGj+OLT0z2JLK40EOV5xIluMYKMusKvQivZyOlXFlS8SdysfgOjjPnzUGL9uLpba94LCPc8ZIp23Et/kpvXVp2XNUpUbB2+AoSgh+bMLgIvsrkEVsJ254DkiRI66EZ9PMVXHhZY5BLVyUB2WVKUPJFb+U5vWQXAWwgjyRQQJdZxExfol96DhOCKiSe+hU4yTbDRXgAsKiU8SVdMlZF2SdJHUvaRVpbdlc8qcM8n/PqQPykXJVhG7uGYVP5kH5QJriitcwWxau5PbvV7Bh0BYY9QUoMLGOFkP9Yo021EgBSgK9wsNCFdmIupyvkPEPKWlufXr0btu74AsCcLPMT3bsxmlOhY7lxHzFz9dZHWLvQnggJV9oJ3J48Ru14zX3E6MhLL4u530ZokiK1wUoEm6Bzoa08D4sCCOoCrSWkK5FHInQZknqYEK4HGjBEKF6xnkjmeji5hU9yoqfkhqqzyoRAt/3KjjztoZOiLDtiKQOvQCNKG+IbkQAY53iibzjEDnk4Mtzcz1coRpT86ZZt9VKqV3j7DrRU6J+YMNOXPbMubRRUPrkaoWfOrcBiesVuvDuwvB6X7tDpTy57HtHJp+jOgOLHfdc2v1tLa0tc8VNRKjTR1APXcOygxBmuJJqzMHgm6NImM+UatKkJzOwY8lq2kArtBHQud4MBnP/I3Upe5MnCkS2z3F6pfXjHfz03AIhM6ebk9Wo8G4KdhYidgkPogiORfKmLIbAwK9aQAV5JJWfJdbzg6iU/BFis9EnE6JsiDSL+KRJpisRa2cAjwp766GQ3w+Ix85X/c7sibWxPo2x3oeEvcgCXW/kVJ78x+Uwo0+Li9vZ3PW+nTd35BWBt9bKdHsQpkn+Yd/x9CyGzL8Fk4HbBVRui2wEGK+4zsjxIwoQv7cFXDWl64BONczKZQMnYwpmsICGloTw7SapU6W7Jg0qSnsTj9j16o6PYswWPzKLt98NB5irZc2vemcSI4nUhyUhiF/pIQK2PzZyLJxoDV3bu3ZURndKWcoeakYvLP4oLWDrmszr6Fb7zhsHkd+EJP3b1McaF0JXZ2JhnCw7K0n0kXlN02KLxC87LbwF1OCR7/bS+eNlOmzi8tSN6mCf3rmy99nhZ8FHf9cNPI+ifhL1VcqVLGHHSTUZuBaeRVFEF2ODyAG9g5motIKTSCaNWbuiqjhrk9p8Fh4arZ0/84DptgltZBn1sKnmiJS85iq4EMdEgnZHSmczCR9IVH0TSaZuv09tVfjEHxik6ig6CyjSFc2BUZaBUClIAR42jbhEKXEKgzwNELbHteLpNkimbfl3xhQssWDYB6Ihp6nI3k1LJvfVsAJmySDNso1ldGraX05O4DXk6NunVvV1Wq6un6TXjhyF2xNYdXQDaR5/0HKw+vb/cehxum9bvO0jkXGX05Cpi8LitJpSypTYa001UVmAKEJaKU5JzG/02vUkGRbiQdJ450di6mzci7ndl05bKggp4bEoCQCt5rrjdPtOmkqeQ4oeiSppKlAIr1cUCqmG/C5FMQ4Fj8s1Jox8cLPMuoJ5DZEdhwgMvG0pvvvBD8VHByX+/e1CF6gy8mul7Mh09yuBqz4QwzEU/KEBBXZxZT8mC0mHpD13i/ZeHf+iexyKw5+MSQw+2d/yZObRjZWcXgBU/nbXXy/pRM+1VRquBlURIlHTDDRj6/iWie7DVrgAawKMYl1UEVsArMyTKNgClGTz2uSrWE/QCF30P8hBDT2KEdSwKGJmEi2yTgX8XrKGDOlYDSp5HDyBHEgAClSko52r1PIEGm8YbgiJL1mF46YsGFzQEFapkqCO/daCFgjxMbI9RtBOyjEF6/iNKYtrh8VUBddsPQOrq1+4iCOQypoxFnzFL4Rs8KkdElLnIyQOdNk/tW/F9EYRqj56Wix3NoZ1dABofy9zLZe0o94Kr+kYWYysRS03g5eprQPWgSTA6FuMywQyuh09C0aA2GA3aFIOsB63RHTCn8Hi1p+2ugRh0N6qsxCk2aIbkBrrkHjEDaExUv0BOWirQ4I6tYew45LvryLjyRL8eIPokXgVaN9sbeepRgBkVycXrOLpRYsuIkEBmCGkDmAyCtrLSHqTi5ePIwiitbeHdj+mrU5u2YHm1RD7lgY3v1aUIYPlmJTC1uNKPzwEoJxXn+CuT1uWAq9y/hkWAnzPf02VHc8jZ25EyffoyttXt8h0RfiqEmvzL1fcbJOPKUEFvtJloFWT2EqfWFhPKe1AYt/MJMAGTPwZfEkN6NXAoz9oy7mHtEpdi6v6+5CYplBEecTKJQ0ea1uHqcCoQWRxyKZVKvFdn39RDO7c0Jr49EwU0JbKzQHUefoBjkXcDQhOkej2khj/joem2H9j4lGPQ0tOwndsda0CqD8zzuPXWPwUEXW27AtVb9lHLnPVIqwuvQM3IHAWmkuqXz6SUE7nYqYjMh2SRrQ/sgG8LfoJuTy8Cl0/Xf+eO3a7ogZ0pt09fg2C9vPfKGtv+5eb3xzwt7NtngzUGe7EwUZJMQoy2pA210Zj/rTqZILOIStKEq6wGHNXMkw6nxHwF6lgccuXrtKoxRyoRFCstiw9GJnyTWYOYK70qopsWOjklSQZP7JdIa1LbrIXERUIbyvKuVPkRKg+N6KNWtKWPVYDqMl5tlMciHTz+xXTb2SEJV5MDlEhO2lKOwdILzucjytOHqrbmL2hrfVgEqPK5hLsdsM5bTNlmjDrHmOQV1e8AeFbNIrBvEEf+Hjot2j13P2un7MFTO1QWe/GdV0T62uEDPKm/xmBwxhNzFTUVFAlOAwR84oRTj5eK+XJZXR37lUTCRFzRpjfCyY7FOnpoGLTGfAG7XvsGMPKhy1d49QeRMUR0ijopI1ki0yt9lyYyfGVbttDSY2P4tDPEjh9InCCBeHV3wyUOjob2dNopb9qRTzg03sLQqOTqMMYnKiyq889FRvECkRe8CmzHf8jwam3bwzG4y+Av8mVwbpChxnxmwDUkvMqVKoCwl3qgnc+qboXSUFg45JKX/jX8tqA/kJqZAbB3ymrnPtaMO3eoLNpTdkjyyYo9PK3f+xQC51UGQkLLgDIZDAAiJc1ESqkwF6QNNfiqqz9CbjbGh3lQmNvilJdFhnCSj9MMt5XANCNEzIppa5O2hM+MkdGj2znL6jLC0qcROXm93ho6bcmCAlqrZzmjGbzgbgdNi3ySaFeusOkUcfluJuhJygIkfW5t9OMYryK0JciMa/bF2F2Zbnk+AQa2esCnLuABFKyklF9ERp9zEzrtgcLFyUVDhZ6shaeCVp9mcOKcLyVVkQZ939o21y+HZ2+9T2CxeEo385RXPXJOuVwFXr4jUk9GqO/w23f4mwjGqyp0+rRTpdUToF6mq0ROFohNMha95wScNYGkLBMrQW2YSdthVP6PGAZH2+AbdKElIiNaZG/2bWykJpKZIhIhYSy7SZFaehphrXo8g4he7bMh7bYrKb1SFHzJkiR01kjNnyLD30MkwtAY4rIpndgzwkimEjUvHIwhrCBcDDKkKOuEtnMLFuXRH71u6bFEI8pttGXuMrLj0FJAY1L0R3QBDI9mRhe1uwvHY10Do5ZZoJqq5jbieewEvonnAnvnHYPTdDlG7kgZM3fqhU/LJ5x6oScucVrjY71rR17D9PIGEKe6TmkbCAZEoIYAUBGCvDqHqFe2AbjlzCERgSaXf/6PYrClGx5aBrEAT8DkMlkDkykLkGjxXqYQV5GcGM2Tb2lEG7SJejscsodWcIQDAd5hykoRlE7xFU+AUncZYzEr0crL1h18diSqjmxstIRRBfChL6qGbUO/dLEzxPAopPSG31uekADv44kIdRem+0LpW3PStcGiPAWEuJ+8lQI0O1h9WB69tiETP7P0ZyhAcpuw4A1hbd+1LAR75bMDO5ZL5f3ZEaemMV3PKwBtdc6pkXaSUnh00taPPIHXs1/DlX1fSXGCCR1jJnFgGBkNIxgEmgQ+UDKoizBXrhBBX+QVRGw5t6Jo8EognwyW4rn/IoHWJCtEWYBKjOqiwNqSJIDWh1VB9iBW5qDB1jxcU2EGJp/j2lbCW/AMXHF2I0Q++1WHK3rVIRWHqESKryiUZFHxnY6Um6v4eGgatylfYcNQ14wAwkibmrHXMwp3XfQVlTJoZIBGgRoQe6zsO0YZOq3zGltAdV36WBYX7KjWxpDLV/DZJmTmeYK80kzTOruB17SN/U9A9+n+KPE505t35pWAHVkA2mParnyWObP4wNNE4t/b9t33nUzj1QZOpp8gqCDnbBT0xKvQ8Iphiz/p/C16qY2aRA6VMZMgCVUhJKhYKoIR5F7VQPlU2kaSfRCixz/xkQ+FXcWoY76SlsICauuwg8a4sllrjQ/i5C8hkJrA2hLBYiJYgEi64QIKf/rC/Y8UOtLnHPJuWOjrKsy4kvDqh7bI4enZo54xOOWKr8wTQxHIYdHvoe1yMg8i0NGf0mcsQ96wUj9qY8QorztfGKI4R+9Ifi2VtBY9aONfqujgGYaLeR9LvUCBkAxncTWLwHe2zf33ys5xesoFt+9ITjnqU1+ObO761xtnEMuNO3jK/9VExbVMsO9D6HFWw6x7/ITBiBLYCA1ABnICKsHDgpAAZSdAbaxU0tpIq/PA3sWlQcIXnQIVVHWPtW2w3kzMQdPvgRPoEFcAd9kaxUOyWkyQKb7bCkUR9cUsV0lwlVSQQpuwRwQ9DvuOt2QIzWIYVJcrf5GCDGPXSTt81n2pUFUn7jv5zoNWbCr28mXa0Mdx6rANMBYp0r/Ok/HrDMclXX/fRJI3YwKmXnFpFd14YFs6RADXZuliex93hlL8Qlxsoj/nYlN32JSxJJba2rXt8IFnttX66fm9gbW1CzD0lJf1Uy5RgYvlAdy4I6KPKZSv7m7Lo1cQMVz1ySqTl3lLDm8PYttEw7jqZcunnT6FLmJwMBqY1hSDJzDwGZE7iiIpUyQTEUI7BG7aiilkbY3DDS32Rf42PhcCaEuMerAndsMvPOOxhhXSiswK0IxXTuQWf8RjRukZ+rZ2PMXftVRHXTKngOn2R6Gwgbc2KQOrpMmVU/t9Au9OJEmr/4B10phHW4t1SXAi459Io6e9tOUTTh0/2A+ixjuz0IiKzhPauB4o9tciV20liVdOzvNcKdvbGhdu0ZkIGpFcMmgObr7XggVg7ZnT5oH/vFg7/PG23Dhftl0pR9qO3FLv0AKwwFiduMPFb+3lRzvQ9B1cyXpEOGMGQOKgYlgQphhkJtOoyzqCIvgRHEB7kobJhE+jrmRFTLiUwJIf2fIpUR3qjlBg0HI18yWqbNUFJ9oAq0eeir6qONfn+9WBZuRkIXGXUKCYoKYEvQ3hBv8srmhFRPw4qRg5SfCRBOBi4mxvTwZ5TMoU+AY+NugzGTvaNiXJbzP+C6iEx0ARyFaOusfVfTijRGRMckpSizIdcfLJ33XVIqUxhUrfTvDOZZhASlJzO3CV0PpWOxyjtJ6hxI8ydW6afazSWrAX7De0jQMvbIv97yH+/rStHd2NheAMWgCm1T4dvzOFj+6uHeU7+zb4+afFlepIbNQNWybIiR5b29mMIupm+br1mHgopO/GJn7sM9FCPWcHoJ5Ok+iwLXGyDgyBk1gWRLAkpAyWiEcX+rPwKJXgDx5Y3ZZsk90DMLLVGTukVgb/4uf9tiErTkTVfZgBKQNMmakh2gWZzbDZsU+3+tQDJ0xhPZmLD6SDBBw0duSbkO5HAyZyoQu54+06ZJJfucMWhQmjDip9xkqnSEvO0FnGK282Irw1fPmUpyJlUlw450F1mH0YsrD6DGD4XPpOEvmOS2HAakchwVx439HyJdN0gFA8cENbP3pDWx7xU6U78/HdHfodzZ3ZASyXG7kkzb562A12aSu2+Rt8s9D0UiaEFdfJNrKomcwK9TTTroCYZ5MgZCKdT4pfU+BHVsdVIwnrPBsXmW2IbAMLxIb/EBgY0SYxEeoVaeiWJoU6wRVZLgLYaUALV0K/5cjWU/5uptgoUnQolVZI1dUa12mUFaBwYLGnGxCBxRcbu/0OaCyMSlZ2cle2kHPSLziqZPexJoGHjqGqfFFn+KM6RqUZ3+mfCHaMlUzpmyOMOz6CUHNV7xGDIqHw8VkQ+q97hbEGXkrhgSBjNpNpK1OfVK8Lrr50cOMz7IlJZTMCgEtTdMUPLnMFbMuQTgMuAqLzymlz/5WL1f4722r1bh5C38ZF6tAsjMbDL+sbD1/GAyXszAKwubkxHtw8UOVxQhaLDb6X/562trqEVfwF+PriTEKc3ufDqezzV1fKPslWIixW9uerJtPswgFwDkDbRizgbLm7mPBFDACCrrb11PxFPCffaZeAik4iavCOqJafwypJITd8hptCEnZBQmARzBiLxq46BHJEwNaYI3WGdz7os1A5xMo5EL0h7Vx6O7cWXMmhz7iiRh2lV/0Tn+WPau2krzxtqoTUrDEAmGnm1kbxwqNzjLnYJcq4QwP9NlkRIE/GRW2Tti7QFvte1cMTP9Ef8CBrrNKHSVr1xQeAYmrNU8bsA8bMu6PvpY89PentK3bctgRRMoqrx8AmP03elt82bZxL6J57K8qu5z0oX+A4j/bD3BlsnEELwGJ5NJMSR53QiU/obRxta5t/Dq4XcPDe7Jp0K2c/V+4+mU5wgoIAGa8Nb82i9JQeXNpTCXj/4DNL5nvuBA08Jk/0FT/n6hqIUaCsTpwAoW08CJI3KBHYleABIL0E9GsnUe0urhQQZaEfNJEFnQVxEUFdi5URmdGX3timTqClusuUMUwlYAxMWErJnz/hiJzuoQS8V+56WRRiRWmwLPDHF7MYgRy58ppR2DfLUhHUna8aikBGfCLW8Sis6093+FkUAAcWJ9CnjIXHBVPVis9Klk6njRwtpQ9Bdn3d9vJjgMXbz7M8/W/pNg7rSlP15klh3Ll4ICN+WXjBWr6qsRi0o+feh0+vX6wf+SS7A26PN3lIfoJlWpBTp77szA6g+TbKzeO0lv3x2tG7uJH6ahiez85hmQs0nT5ttLYFgksxgVBP1kWZUNauwtXPBNhLAEpOG55MLCShk9RWrhDWRVPJgw7kFmGntksg1FVPWNHTKLoRmKJGu8dI+qMdfJedjOh2OKbISqhqbheD3dgW6BgHdd1WMOYwqVOZdjhGu+vMjoJx+peEix55ynS74bFWhHqqEZqsbsoUGnyRbE9g/VjDLqEhH4OQUUCS2A5y0jdp7PR+bLeL/11Dhk/Cof5ks2YXjXA7HVKLj3yA9FnI7ViU2X1sN0K6frqaOg/OJkf1IQWn/10kMxddZPwZypJTPNBHD/rKCcrxAd5L2gbVxjmO7A9YCD7a1u89hGKtfOiyQ29N3pkF4MjGl9qB4fgHGZs/vrG2sZ/Ly0tw1CXlcWhddTPxTpht/2lTZyKY3RFXmTRxgUHsds7Z598JdoJKgABb9vW3SJPKSn4pmWDR4adBpNv1JF1oA5BfgB2g4dWmUIQ+IrrtxQipbARG5KcNfR+InFGmLmHh1a4CR7KZp2BWx1rQwA/GbYlV21p1KbS/ImFzLA4yaYdf0UWVMgLVvlf8DDqdGibNkCKjvLalugjQI6v2YGPanpwP9cUhAOxaYhudYkAEuNCAE5YrgHY4RnHCOWzGB/KWg7NDCUHnpV1zoRgYHE/GB330YZ+svmSJrIwHuCo81fiKJuRZfKXXro6PgM4bPmTJrjyP2WahwuFjjjJNKzQvFldzi3B1O3LuF9r65nvavrvc+X7lz/xvrn0pwk7xaWcWgPXHYewXj23qcrqbG6TH4rFX45r6wnsnOl6iwut5bVknOs8JYoLe+1BgCXCgcbiTnYCtB3o18fAxCZwz305NJTd1ZlQekOjrKjttSYzRQaijbFCGEyhFyphglWCfAZZbEHpeYdNnSMERbJizLeh7O7wiOGKsSUQjAQSYpliDJrAQSS5AnjClnZas8kqe2lYiHUD+wfVG5y+/cGuqQxyDY4ke+x6lysbYqgcGuBs206gt5DTiue4H5QgvmwsX9eZjf99A7IgAKK2dc3F2HAKl5p1G5AvQ7k7TdYRVAhXipnpZko5jCdi5UbE1NCkikGOfprxWKfolHWVkIkBrVVHkq8XiO/roSOKDqx2bErpPQ45eHzzSTpyiEKmX8OnD724bj9nE2LcvDtzxRS6K55XyLzvf/qkdWQBqJF+m61R0pw8/8V/hgMfMsvJzW0cfwwP4VzLwJH5W5tkCA8WJAICf0s5rtEqoSdNjFqvaynYHCwiOfp+QWWxQ9nzpDx1OZAIvUvoEgw4OOoPB1b5fPexXiVGd3kmWpdsrgRGk7T1QnGgDbdgcuLBONr9mDiBBBW2ubvZIcrfXscVk6HyxP6qKdgScMpM02+yJTGRkMTDYXDigy0uQ6EJCeDJO2YUEDll3d2AGduRjhHZYMnYb3U4Q8wIhOAZb+z8Wzq5PvOV+OARHh75QTfe1tUV9Kncc6srtGiD0zL4ZOiWV1iMyrZTX5z9obELm8Lt+jl5lyEYnHmIunUKRY3EtvFhpRUhQ+IC0LdLwTUmFDJikxFXtRvr4FD58mTEtNqfFxnWLc+647ct2BF9avPTtPxRFp/i0MzsAjZzaLTiEBcCv3D7ivtUfZdhf92Z4I6U7D0fWjg7HCMIpcbzt+NggohOHZ9pqkhLUJSuTrBzlhg+4NYtIyepJU7FQUzOCJvRFXjyqhc9IsMyrv23p0MNk1iIgDAFZ3UtnuIBprsqrcqYNCopNS/Q6ZhoJUGDKSnR2X0ROuMDV2GkUrwIMXvi9ss07J3lQngUlsiEvI8Kn2lnPuBVQZNSgwwVI8wLTHmUBD1C7DG11dnu6jtyz6yvx2Tprh7rCqNYqjpESeTbGGALrugVHi6Yip/eygGX7Xv6pOdJGBQ0qOe0B7LrKx0VTsVY2qKWgYUi3dpJyM1HwJxbGmOlFrnzjAhVlQHPRQA5jL1+oQxsgGMkf/wCOXcAlsR35bW2xWntVu+eiI9wa/FY7cJtB6FbnFqh2pODFHSrTdAuv3fve/Ktwhr92SvIz1jjOUVOMDgae+6PyhARVZgdJi0OFJ3E02SkAHhq6rtSBgtP5CulBmcVfUheC6K4JrB1ElxG5tkuWjdAO5ghHI3XE2kd3XanUFsYyJzjpkGB7FCcePYLKtM5nFpC82bl0escaup5MEYGwQVMJAVS1/cpeHDp4CClI0UQCuDAUnwhpHXvgvVaP5KKttA9rMh6t6vCRJH0wndgxDgLtiASFbDUjQxwlskXpS/UWPGec5F9EeIoM+vEXtNgcv+vMFGm9ymNDfG2/ZsbFMPJl5y96hA27gLk4Dx2yW4Y9oucdQOepkXmmRFaxx5fqiV3g5fVicT/7sUt1wOrChQzasUe+BblydN/3trsvuaodPchnD1Zn1gIwffr5B9u+5aVsY36QwVzOKCvQnNQ+YRVzOELHzIXVPz4VpudEcAKoq+qhUoAdLRxPGhREsledmS+BrZeFQFfLfvCzykx0ydsKKBm7nCEOkrJLeSwkrvyyoVcLJPOUOvoEgIk91E50pw0fKiI6DMgjiedgzFiCiHwDo+w1QCK219XJlTk+haf7NvUQMeQNHEmSYp/DEWQREdh5Akq/z1cNvouHfjhQEyLORreP2tssvaJvUqyiS5rSX6/LFz5WMD/xQefJfCgWXZEFaa726QNnCoRHv2PRLO8sXYAokQxcVOwFXAmmVXScG+fEsWR8wy/OFzyJjZLklT1xG9ERKCJyAlIbTCVfeSA9otx2LKUhWHzFj5JqTAUS67iL1zdkLS5vhy/4wXbX4y+d3vyjX/khYaSf+Gke5omzHptjuvGZz2xH7nlDWz/3GRkIA54d030sp0E/JrfogNnQK3NdjgrQiQp/wRJHwqRN3d9nkYdH0LjqOpP+Bw8t7X6iAp9gicKojU0kd1ZlJiJ46OoKopwIKDHFBhBdiZYt+ZnkvhhFt7SRo346snBST2RqxwhG8HMiaAOHCw6t8MTumIEc/zk0q0yDzr66HR8EObrfQxflnUHZkIZZFnEA/Ms/cmrM1sCUA+uIa23OAVh6j7Fdx4iAyj9BSAWNOrQKYbCnqFP5kSGw+rmNgUi7kyjQxd1SxDa5geG/4to2nsBBl2O6KsdRY5TT3UrGgk1lioqAa672pDP6NbbCx0NBILGTQZ94wxZiLwLL4bCQzBlEkYgsvrLaWAirIrQlC0T3SfgWz2jL298w/fvXPBOlp7QkFE+VxOlPn30NE/wPGcXj+UaVQ3jijnKkk+jo0JQJ6Q4afWuR8SV1ZkUeJ1akMGkoPWlDArAmVEc6mdToUYULRF5ilbU7VLnKy2YAupIRqZxwhQEeVcoT35UmaALZslFCZWg0h38pgQHRs5FFA1QltQ26Bq9obZRJ2rQdc0mrhggOr45FGYbwmEguDCgq2ZAm6WpckY+WXL2os5AMGdYSYKuGWim47qfTjD0uoEGJo52eLGHQUDtDjjUU9m1mUHJLF1BkbO/HZ6W8aGrwkMug7HnU9PUFxTkCFwqVueBD2jV1VfrMf3mUw3nMZaeoSiKQ2s3uIbTKZ34yjjEYsMrXl91EeLo96pBnINBTixWwcCl/jKPsLrh4ZYTZTteCLYzJd1/2ALmD2vcLPB7Sf8giUL9jEY6Hf3JcD7vk98tuvuHHsPxV9xN25At8icH0ooKV8xxztsaO3eL4cXSuHDgeegGB6VQDKYkdZ4J1AfCBin0nRHmyGEg2qEfTyIg0eUyYmvXM1RwQgzgTKn+p51xFm8Y9HEiTTatUkpgCnSSEOqyeUkBQauWHVjndPk035GSY7dAPKQWPWdBEprS2ho0JOpll0AFU8Z39CKXqvkNuyRKDHbE/jFvmZA7QhfyMTqVexYBnjHGyooEZ6LJTzfKAD1+UHZ1A2xCSRTpswOc50hbQCrNWQOyQxTHZkb/jtWzQRRao9K27D2jGxsEDa+yMA5w76QQWPPriPwTFL6BDG7acxkVk5snCOxQDVVzmVpnaW7IC9+QwqMNB18UzcxAzaM+xOcariCDhCdd7F8vNL3tNffEf2l2r/31x7a8d77vtNOKYRYsfVsn9/k03/PQDkl+py32f2hLOoBxXJqE7Ccc5RGHllAw4dDM8UQIj/slVjAnAbWk7mUF3hyknV630y4kVZH1iepSadAmmPjGZ/CjElkwwvMrwUAy4yNEG/ryyCB60ua+dt7xiOJQH/xatDAbggIOzbQDEXvEUFWVc0IYfjSazQSapNJ0lL+3ZV4ZAeLVOvnEbYDdXwu5je9J6Lpw1fgtMGdjlAstYszjFtrIhkxCj3XkoAT3oDIhudHZHBa2O+KqP1SHRL+0yiC+dacs74iNXZLo1URJ2e9KMnX0UqDB5kGfV6R1PyS9UPbfpsNBBb1gksKTRHg6YoMKV2Bzy6is/D2GZZ02M+D7I2Q7ZlTNkKciF1BJdJd8u0nJotjbUjqkwsw36bpo+LfT+ZXpVO2/x06fia8Ji1v2FH39v+vAzz29H7v1p3lV27B8wXJ67UYESfzFWnRr3FgBVdQWsAMuij0O8ytdKbAciAxxLsxqX58tv4jIbejGeLD56g6/UDZ3U/UpZ1OrptPLbNjjQNQcwDcEitdVkqp+rUgLEVsCnBVvIEHJS6RCcustWDEXZ3qKEvidfAsDAQWCeXSQwkYO9gTpTNCqZVaQQa8XYptHNSVLm5b3tdGEOPa0yNXyOr/tbLCyxLY2uA1iSQV+7aKO35rL7A2R2ZvNY8YVXcehm2yJbegeeDuPUlx4hDe34mbTyQUbZqamyKgmDwbE6EMeQxREYJb6NX4IMoGKpSEMkjyWTbJvDMWo/ZhdWAAnonEfegNNXn3Rs1S3h6+OtBV1ecfoK0S6o1kWdc07RjyDoMiYo8tfjIDTLduzPACzac9r6wZ+e3nQNH0A6+aL2kyrTrVdc2M5Z+xksf8aDClgeOETAfjLO9X7V4IHBvsUV1b5OygO4bDtxhg7ILOg1+JJ0AXReZZTj9KziIlKwM2OvO3H4MnPoJIkbE28dseoEZUeSJBKNAoqghCBVPcBEjmMCU9s6V3FoZoU1pXJGd2dXd/4MHtr5VZzAOr+6kyNDvzLLd7E7V3ulDoHV1A7phNczj6JIAEIaL0Vu6dWGXLGLvfNCBUMk97HPuwyTQSlcbWd8ghx6/Qp9LU4KBCYOQmmTzPNY+Sg2sPIDskIru3Z3GcOHEdBlg3POt+6vS0ZpgEZ8JPekVYdySpm9zMP2HUVwsy4J6tADiSN8kbmTUFwWP2psDrzbBKRgqUtnLnzFDLmO15B4PaIknRWKim7w6Kh1ToDvpeH+/8HKND2j7Tv3Z6Y3vuakv4LPiDnhkm3/nQdez3guf0jm5fIPMni3aTpbp84OBaSTDHDrvrLaHFtMeed5jA9LRomw3S1Qrs5Lnwm0lt6MNnDsmHSxIYhiHfzpAdcGaZ2zTeRAXwnZJ90EjGyDhMIpshO8AizQJmG0Q2zVc5AaOMiPmCxksmBjkrsCvmOj3/jZWhThzb9epGFRnuOKUGptj3DHDSo2BGCvcHYt1An47rC8C1Km+M2aguxCozGLnjJk1Ae08WuusvQ0xRJ6x8aY5iuw/ZogKvhdOPTDYJJXuD6nopN+ZAWA/NjvwhuC4u/tEgM849dGZVD0DUgXqN4EBjy61eE/p4wTm2wGApF6hUeQ2ktWBHWYcydH8YuXDo5+5Rcn/5CZnjaGB8xoB1SauiPJnYcq/GbAocXrT/Z2QMtPqEwffPb+dvjun8L4px0X49p5fKUyTmGynfSx0mfsXXsFKH6zjzN0cgUUfBRdYpDkimXNdnsOCic2k0ut78NiGy47IaTqNvSZiFz5ahcCPokPOPx9EgzsLEoAEV6icw6/gOpBP4JEmUkeByJPp6eqIFOH8k3OckDGqvHShjzE0VFd6Tkcy4xXj0eJSysOBILdXnWHPmn0he6InOinkwVRGDKCo1FE1JmIUqfa4U9MLq1FantcVcdiF3lSyQN9RG6XEakoDL48FBuF67PMmdaXUVEdAnB0goGug8qdKrUALHjOBXNhjSg5VUvdx5mFdV7AJIMiKXwpzQAAQABJREFUrLN300+s6K9Clo1zNwxZwKNmOLPLkaVG0mvx7tYEjguO7RCJQ4vt5epuzsdTntaW5/4UO4H9x0O8naYicDvkodrnrV73oPf8x+Jd7j+fWftQfOHAGVkFRN/WyiPYhMAZRVeCKrCYiAAhG9YygUl64H0eZ2QFzxAaL/a8UQgTv31yaCtbqpp48P0qXDZ2W12hZY8BRW1kF0/vy6A9kmmftPZ7MGvoSPgtoyvJYsSgU5WysC3hqsC+UMSm4IVFePeZ7WEXqL6YJXHops5YtbHTkeC5msMqxHBXZ8kdfboWbWFxybMPfWFRXmzQh7QySSOx7IunDPmRLXwAQVji75rPILuvtaes4Szv4ENAlwxYGR1ncgbHvPQHb10DNM6Fcw91v12x34VmraNDAaYejnmBKINNRsbpzkMhjrzqISPsgRlD4F2Mo1CBwxIFF2Xm1rFmbAAzbvk6+aJ9CODx39/7TOC89rqSfvznkVLHxTF9/Fnfh8F//riItxGtpv0fyPw7OBqZwEwe/XHVimOGU6ULcaQExamu0nBnUnRmhUKSep7QPjmz3BFKTkTR1yRUUGSStk3myPFQKkM7AGZCYayEVhZlBEcMJPDu5Qdc7nxKm448puhin5OKtDgAFtohD/s2W9GToAqSaAivRJogEPkZk5aVn0rmkF02lWxgnTY2Si6COnhw2fkAnGUYtKo1EKMLYpKzAlJ5sMc5NORXEjaWUBfDCvjxkC+jnPGQKVthJvyAyy5f902UmLzGiGRKDw2No3yHxj0XNd4ZVzwZDMjQUWN/aGFUTexOIkIeScjSJ7mKd7nFHj5NGnMTnwTHKGIEJ2TZqXFFafoZijSj0NaOLE4OIhzlm7q4gNTHIeqMCgltgbN4TtMHhsjjrsnN6S3Xft9x02vG8RJPN33tVUTH67n6HzfPLHu12piO3voKAucCIyyB5IANhllaOZtpLGfMvqlgCN1wFBORZClgBYtx5CThWAMtYj1lhoChbySSotOWFkrbEU0wmgDOTV0BtDUdOFCQQDL45ed0H29zuIcvL7r7ydSXMZ5tn60675OtPfF3eT/UXbBVwihKZheT3kSOLcHUPGzI1TQwINEtVjvVKU31K4hoKw+gtEkwaErPoIWmB9xYiPIqSx/PkFsySl4pi0MRjpxcNZPyaipYiAzsSICx4OnRjF3UW+OrdobgPCXxNV4i6XPC/2roMOuj/KjTF59eyQ9Zig9lDvCdM+fc3tq5d7RpH58wlzZl2/xEthYBS0x0Gqr4wgWBMkZQHcdES39aBcgp9lEnxrb1oYia7GTGPAMzjsJd81LzU8JcLDNXLKiJI071WRXxapz4DM3mdTS2BZS44yqYvXz94tW/+v7joZ7H95WIp4/zxH/9wD/DuK2P934lhmPhjnxp1VYb31Vz0tXqYQecMXd3B1XtnJOcuDK0zsO2NrDaBvYJdj5RkMlGzv3uxYUrxEmXL6T2y4YygY7fOyA2SRNkBaW8R7j63M3Pxt3zlKof4jsc2n4+wv3Uf4MKvs4tD4SQEbllQ0l3DN1uKnUnODWs2zwWodwmFRh/OFhI6AdvJwvq4KeP3Ap0YHY9uX7LlImgbyLGJkBFFTr5Yk1sC6MEkXm/MSB0fk7S5UiUBMCXmQvH0VlrMYRizEXkg4yxqtAD0tPa5OXEz1yJ34/9EXm5UvgO2nYOn5nJwaKwfiTjU1YK+v1L13hKr9uUxaisK7isUDuW+Aici4EyaBYlsmxEYG92HQHbhrhua4HE59DR1A5pZllOfpi6rc5HW72JW46aYNWcaJkWX2p3r36cNwrhjK9cjm+FWRz4m5h88smvDeuHDrcjdxzBsXwLEP1MBDXtuhp3B8U7OsXpwAeVHVWL04syxWlWtYrq2BHI8alXEr08aGlC0ctWp66qPeDc4iaIO552guFLz27t1uey/bx4CDi+mluBdhu8F3+gxpikRXZFAjDHh6ieOLFb1cKoPWW3JB7CjFG8IvpgQluknJHXZYcgPixh40qs3O0LjJFer1got/OrqSspWhOgz4d2IVI11jWGDsCYgDnFVhakjEk6fRkWkegpQwrGXMXP4iNYXcDu4ouiHir54cnO6x7mxsPCb3pOhz7fFud9HoEoTyEhk6TEi6DY1v2vM2OWCHTTjq3pekJMMNpXrcQdhFqq3x15ruq04gXAfpdipjjyjFOVxDO9HorQlzlWTuOjwO0w4vgywZMsC76H49CCnG0//VASnImvWKabv/YVfEr56q9IdDzI5Tpflbr2O1ukTgTO0KHOSPkmk5SHKL4TDHAmZKzSfQIr+ODtzsychHLbJIBDZJ9JqsQcJ2VFnxNhWyKqEKQBsUD4lf+Zl3IV4jjR5EdCCrcHmXiDnExXZkrXFxs7KAYLIDgN1tDaNyKlSdu+lht60nV4CMQVaWjpFkEfP3wREX2cHGe/0ESO8vSTqOinKYL/2rYSpfLap3bu6uFfZXdkK1MhXVdoRbsDkjm2IyN6TQralJH4JZidg9vje7nnP5ly9Jy2uO0pLNpXZIjxVLcbxfnXxhqzwwGZ+MAY0DKNRBelL7AQ0xyvtMauhgGDfvZRYIJp5LZJOQqWhpNvzrL0QUevtNBY5Y1Fi+l3WA1OPvlLg+erp3//A6/Y6h671S06NnL6Au/0m1Y/cmzsSUD3nXc3vrxPJxNqFWQJgHJCZotmSpwknENYHAkxsxafyZcu/S4Dd+dPuDwJ2hDTcWIpftWUq20mNUkJLhNMchZB5NpZ3MX9vVfwh1Om2mRpvh84SQoS3I5fRRVo3QZ1qouTdcYVo8QrwI7IXmO3wwtsjmYA2xbMTtD1dFZ9Aa/BrB3lP2Ec8Q104BLYbl97WYx3Ow6fQl/qDSNa8SNAut1CBeXIKzwSe5uCrSFVsb6QBv4aQuFrkpT7MAo7gsXdF2ECz1YQEzXU8b1mqWrAY5C69ItX7pqhQGSOcfhKDq/sImYe2gg3pjKfkasjZbQa4wiXxJEXv2+fq4ncWK5O3S8Rk7sP9U7BYVkMfcDprrUfYYK48T1FxV1AW39r7odxmO6JQw0IVXAKrOMqIIRrpsju0E6ng3MVkreEZRLSAafMOHnQ0wlZrkbBzvxjG1xMUDl5t5+CT18e+AJGYH+ueIzTsbj9jCU1rNnQJDl6M86qE3IjkPqY2iYyYr41dOk4WMbsoewRdNKNW4P4GRzj7yKHS/EDstQrX/QrVtnW/eSEaEPqYObx1C1Cp3WBKQNrPtTbX6Ybuse8QJA5kCO3fJlr9KrzAA9QH25hEZhfkousbeNzuGMerPs4tc24KpzwwjnsEOGf2rHYB8eRLbz4vMqwNb+1KChQWkuEUDtP/An3pNKpvZXTqfwJsAva+jk/otYHK3jj2GW6+corwLzy2NiThy72H+JhYLtVxyS44xnM0JIEXvcUeCnKQ4koHcQ/26XwSM8Bn5XO9MoXXGQXvEihULarrTJcnKNQRqxwYciVSTpggq03HvxdmCF6qBO/bdIu+iB6S73kmef5qqrxGKRSFQZJnasCYFD1HMN2OlBaF09el+9jjb3qmXkMLgdRgTZ8G5BQ6ZTlWWBu0vGecMEe4Mou5fSuJrNIVPDWDEoWWMSVvJoH4fIxZ5kbxMVGr/oQZ8wQ9KTpSkuVOs7/HLjN9E/6tMnX8OO7+MeTfszYlGij7AgIY1OPRSj9gsXUwB17BsW4tsmgXc9NhBnMFoHoHmpKSS0WocdLyogvlrdy9cc7p7gs+A7O3/q+Kx5M6rD0gfjV5mvncTwQe/KQ5XIfnxJ8WxIPKVn1rQmQWhT6/NiPA1WFmV5BM4vxmIxV+mTVTkCvFn+mbSS1QF3r1U1ZWxFecsDV56+L2XlKAD+cX4JeHm7tSTzy2MfTacTmvt4GM56ATDAAF9YDIzudAZdHWxlf7j21iPHro5QykiYNafSP21bx0plwjguKzgFYuPRAenDblq5sUHLJiBzdJUQhSMnLl8iVpp6/lC6xEgmLPFUI6v0uIGRF45YceRGFvsi0TzucykHj2pE2XfIRxsVCerKFVwSMo4wxiebQHaMCS0+1AtAt5Udr/GKFZUqgAY12ASvbg+TkRcm2PrIuWQoofscWChhDEIkRFt+DW67eBh+vee5AWS5f+2BS+xTfH80bfq5kTFfdH3oKewfO249DP60z44ThrzgOTLyLH+8XmOV0J8PtplfwsWAoZ94ZgNPVCaolDxJn2YHSl7gmo1d0TSCZkMtEBSvZYz6sgcdfvOKfd0trj/+91q54Y7UT3IjwtkMdFr7nsVtD2ylwTED6+GNXaLnX1H6Ostg2rc4zFj19EgJ4EmeKgrROCpDHcYmwzb8s1p23vGa/j18ByAsdsNgxBoAspcbmSKDf5dYYkBJ9UlnUq0L56pjtUV8ZQot5cHyWsII7l1eynvyHvJJyc73uP2woqoc+H+QXuiKSkTqeuLsStuzvIoLQNgg0lQHHlLFgChSgXRlbNRWYD3QpxkVXdKdJ5XgBKq/s6ONVkLERv7RPExwn/DZeVR5fWVw1veU1vJ76wHLslwHXFtc+kPQUQniatFrb/7uLzaN/KXMfP+AYPRcvWetIYeilPcODwqnCBQdv4CSUa3KYw9qS9nCGJokd+T3ZEwjKYZVWp4KcQHWlwHvuZ1t7LO+n+OKDrYXwnPNnbSLpFwc/RZstqwGKrNx3VjhEdO6bswhoMIXAKdtJcpUK5sgoEOGCYT9Phu2ndPuk3TKUTg9CF7I+xqiWTFpLZPemw1UTu4ZsitQjSnii1Vrg+OQezRDoWAWlUzB9BiiWy68tAAIzOQa9cxn5XVFGOuZHBEfkKl9byofR68J6AXNx/mfi18V9PJa6j3fJHuZl1sN+VR68xyq8FDjx3oCyvdvpTqmTZ4w16OgTkbdHO0/YEDLtEO7CoGECtS99KvrSdqPpSCscYMg5ZeFRZhFnkZHDLn+rxfS7SH+Y95sq/UolOX3Dl1PE1u3Auvff/N+2w3akvSLz7rnrG7nHu7SWZRNHc0ZS6nCcZCDi7PkXdp2OgKAl+MqJkDhRWcVHUEkkntqmrkZ+PawSULuD/LgDOBCoQaeTRTc6hPPf7vgqXg3wDSkE3BpbexeGg3xPw3mfwvT7ttEqP5pgSoOqAkeNkalwi2PlP4uctBKMIIvengCBgzawwhtJuZpl4ZIt/ApTtnh02iyhjMn+wAHO7UKiciYpan0kmwsKfoQuyRxhIBzcdvtjm7KFK0EaDvpebe37J6rkKrzECJ/pK0Nq+PL1VakuAMrbxhM9Sim/Nt8sdJhPw7ooHCaHfDfmOi+jk/zt4G0Z6xj6vNOTlSt7dgAxCUD3Xb3vAiXCgUUddbVktISpKh7IjgUvkacy/JR290ViQJgvHya+kIfgolp+jp/G+08IGcJLxU6cV+v/3eI7fvnG7aIfuAOYNr9njG874Slv8xuAbd/au9rm6jUJGL/+3KtxuS7qRjLpKP8tdYWhYR8vZmrwuU+xM0mZSCkpCMiESqt7M5EinPAhUIQCnBlxEZs6i4caDt3M1eem8EsaQu2FIVeGyJaZg2FlkYkdXaBVaKgTIFgqqYfJMtslvsTU2Gkr07HFXhmEcVIO/5UkwC0ZlidQyNQEddSp65HPh25ZFIBhL5DYE3khVwBy4l+RUkRs1KatzWHEb12WQmImgoojbLElw8jYu8/CC556JGLZ2jmRmfkU2PVHPoOshc8xwM9Dwunc29riHJJdYe6cSO4s9jOtdgDLqsT8dHz8qnynHsNrPPRjlIbZrP4wQUnbQoUeMesir9kZvI3hG3nBWfRnnvGBEywouOldjO9UPvkv4cc6Lze+B/A/3o7q1hUor/vP3+G3nWyH2vvPcfm825CIV/RynKOzBHVnql4HlpdDGifqeKEzX5FEBLC6nzPI+9wYoMjw7MQkeTL5dL0fE5wooE2dJ9cy85+SmhN6fa04DAkgGPNfgZ8AlTZ0pct2CaIPb0ejV7iwnLGJvsFocKg7lCYz7djGwuO2W66wKV9mx2VwcRZpCb+1skyoTudYezukkSMvR+yxrWO6INmUlzlQHnjHTS08/hzjc/sc2cLxk+0e8XFZ75tw2j/mOTx0U4TDM9TbDt45kWDcl8cnfVxBcHJagGuTvogOTxGmHxVADSi3VwL8d+EoFJ3iD1y6yKKGtoZCLY/9jFH5sjmXXUi3Q0VRrwzxMkLbyz043CvJ7pTF4kVf/r6AYXEZcO/6yzBwZ55EHmuIiyVvC16+R6fq/vKfTtJHTpaupzhJfRKT1L2bIOx46ZI8ON6JyZbZ0SG0Jq0rUY60KrTEAwVzcgzMqjuuZi8MuVJJmklUAEeufto8EgyCEaDg/Zt1wVE7PRcQWMwxrsa5WvWkHgGWgQ8bR+24lC2Stn+xQXtsBYwtktCJbmlKKCzbbAmLi6DkdNIAH0EiHVMEAisbk1xgQqMt8MSGrl8R+eZcKYD5ycAukb6ClUPlWCURGNuo6fPPSY7qSxqfu2AVMvTi1RUe/JH2sDcyuuzSAAT+KFYjf3b5q1cfFNTlUTvGMa6oDJ9CoQFddpjdYMFl/kTHGHnTCa7iQE4PzxZqA11hU3s349+9fJvQtf/Ay8qOOmPJtrKaXrmttzvN9f28U4ai45JMNExi/QTQZE4rNa04uCYxzTErkoXRuuhMlpHQmfBcBWtBMFCz6ifxSoeTUm/dNMRwjYHnlcGJBjLHArNcdOJieM38mP2ZEEOMFQcXnPJtWxe4oioqJKwSfmR3HoHzuHvsBBDVpicNyfkb8rU97xOQOVdnSTreln7rOxFa4U/VZSqygnTL1hqWiuSNR9LOlV0TFDQvhKBKY2hs+19iO7Hjkyl8tJFbY+h0zAHaywyNC14d/svLvxEsv5ydPwBttOi4GKb8LtcafLHp0CKNuzuP7CXBRjk9C/awF2zM77wjOCpeI6T0zvYBk0F6d1exa7NiX/LdKtPifjmueSnTR776SYzpq3p396r1/XxE2O8N7Nvq1PoIx2dCMcWZiONtUOJ0E3n0mcz41G8KckgJI2rwwDOxHR7HC0dedNDMQgEsSaFw5WaupCmFY7eRIDMgnMCuv4IbWGxXvwcyYqiyKtgiP7YrE7j/yujb7tIPObDRlrIWEeG2e1JoF6z18qINypDd1bvl1Mw6ebVHLkyew6udg8d2EdfwE6CgI1qBEnIAyC1OIYAAy/ZZmzsJlfLVlAXJjjhh8vOX8QlOUii3xtWJiji+pxkeQcpTRn/lBFDhSnfGFd+LoMTGbpfKKZ5jQbrd4MAyiyArrsaiJg+CipFWSSlflr4ORFeeGUkQsX2CMgaAwGpOlWWf3/tbTqfuXbaoPc7yVdObX8NHWqtsPQTct96/v3+gdqk2ttb43sDN1Z8zCCwGSX5PDa8lJnFiBV3QYxbAOlljckaQQjMCJuTAdT6CIot2Cnw1mZwhcTKdoJs/s9H+1391R3vP+3lbNvBvfv657W//0GPaEy/xVg1amZShjdQfvWmjffimI+2zf7bR7uZd3AcOLNrjLlxrz3jKvvbsp53DjguW6MRWGya7b9hRkLuPXFaQrT0JjEEPbfyhQhxggkS3MqChnaFHtvYMfNkX+fqhlIe4+NEf7cqn6chDF5LILTXS2bJIqEKOQs5tn5NkgN77czub7XOni319YclCJ7wE1Fgcf6QrQzHDB0It6KX5uS8eaR+8+e5282fva3fcxS9p464Lz93Xrrjs3Pacpx5qFx3CyVIzwDFcGd/zwdvaP3/TTe1D8F50aF+75psubT92zVPbOeulTyPKRn2hTg5vsWxaBj44+xxxRU4FsDkXCPgvEhYJOokrW8hwxxlfS7FcXQ/b7t3/zzbSWCzN9V8TtLUALNs3CjgtZd++u6eNw7XT0mkGgjPjYRbWLHXPVgDrQwM6q+5YODDeOTKj680ZyDIixCtDbJiUK0hdQgv+3j+8t337f/vZdvtdWbYj6ff/+HD7xTfd2X7r55/QXvjcg23inan/4ffubv/6t+5s/+G997Q/+9KDv1X1XBaDl1x1sP2lv3hB+/5XXdAOnaue/Eev7RgSG2nGRsdHCY6TuY/NCWyHAqIeXpHw9NzxVL8WsLD1gK32GDsyhbPgzM9K6JbK8k2StAe9mopeY5ThqtPp6Uc2CZylTLkRBIkIxXlYIlo87Y7McwyvtNLmVgyk+G637T+56e72i7/92famd3++feSTD/75GGU894rz2/f++UvbD73yye2rnuAH6ab2c2+8sf0P/+dHhlnAWnvnH32x/dJ1n2rX/dw3tgvO8y3C+hUB2sHhEGLTaAsW75SINI5csLNwdxhVzaH9YuRMU9n6rM8ddS37yoFi0RwUb2Y4DWUtuZ4FQFsbX/R5qB3c/CWSLf3dN2k1TXfd+xJcdPG8QhIgeY0ep8dfrszdPAMIt5aTkxm0nbzs1xlCJsyBxdHGEzhP0GXy6MAQKY4YunvvW7Wnf/sn26e/cOy3nV5waNn++x++qP3fb7mzffgTR9rTnva09vSnPx0xU/voRz/abrrpJgQ9eLmYXcHf+m8e2/7Of31RO+eABmoCo4hhjNExYUt2NUOMNjvOnIOkVT3hGXQfbB4uYovDSSH2xuIZ3zh2/ZFRo18gvIULmJO6oMGm8SwEYKkcONjy0FK48e2cKBf4sEw5A2Yzh0htlS529nkNEpR4jhs+cVf7yV+4sf3W7/1Zu/jii9uVV17Zzj///HbLLbe0D3zgA7yS5sCOXdaw5Qde9sT2xMceaP/LGz9xbCKgP/IX/lz7v/728xITmm4slZFUER9g8Zv0MVqYPrQydljA4sPOS1x1hl7LVv4MhlP53wVhcWtb23g3FINpi2d3WlO7a/pBvjDkrorE8zZ56+/pSn5HvCSmlu+Pc3W2mUDJS1IGY5I/oMxFtsrCc3kEbvLcbzJ0tkPT68qhVmYCFoBAJzDoonnLf7znQZMfYraeq/ZTP//F9uyv/852ww03tI997GPtrW99a/vt3/7t9olPfKK9733va69+9aslPWa59fbN9vd+/vPt2d9/Y3v3++9NIEnoL9rGxnB5ZcU2xjKCpXDYKG0SOOjw1JbJARrCvh4tnePhyHiVpkwTj0Owbc5eoaRjnQ258kcpOfqoy5LerpDw6Xt5wd8vH4tebK6UVNqfaUJX3e/DJ5mICK16Y3PV/sdf+Hj7+r/6++3jX7qkvelNb2qf//zn2zvf+c725je/ub3//e9vn/nMZ9rf/bt/t+3ff+x3zW4SB7903ae/YvI7hl9++6faPYc3cElGIYjSB9jTQNOGv2OwfuJP2+NLxxi/ZjBb4w1B+VhiqYYf9R1hi79XvL20o4Lf9dOCrxvhnW0ZAedFdXbdjO0K15a8dQvHxYEgCKytj5DS9t45AaPDdasBxVXEOjx9IpSpo+PpManyi2AKU9e0JIw7ycf+9NhXfrlGecMb3tB+/dd/vT3nOc8ZoLm+6qqr2lve8pb29//+359hx2rceMvR9tK/elP7Z7/Cm1ew32+NyVjGuI2LbtMWv1Fj8IlwbDX++MOm/ohPbPe+crJIBgCcBUKf2qVUINIBZsK7UJRsRSh0FGi0MzB9Xrghp0iTzsjh9gK2LMbb58tEc06cr21jiCQEffEOfPI339/+wS/f3F797d/Zrr/++nbNNde0tbX73yI//vGPbz/7sz/b3v72t7cLL+TdfydZDh9dtVs+zy2nF4bhu+6XvPKjYcC1OYtW6AqmyuxgpPfClEF0v+iUyMlSoSM6XiBHp0fy7j/91/DtZX37AjAtv3o77rS019crNsyHBFmfHI1JHwemjisB4kb/nKhMkM52S8tk0E+genkzsHU8pRaKNNKfr5gE6OMvvn+whWDb6Sd+4ifaj//4j2+DHLv5kz/5k+1Hf/RHj43sUC527XU/99n2+l/gswMVQYmVBE9sHYuddg8/MKYebBEzB55j7r6xFj4+FRjC4TbGhz9qESl6/VcyK+VlrwVBRnDB60O7UlsMbhcE6u5raQun/BBl8Z4XkoxJ23xfAAQqdZ6R87nbjraX/PX3tff88e3t677u69qv/uqvtoMHD5aQBzm/+MUvbr/yK7/yINiHBmvj4y7YzwgoJGnFhT7vvCxUud3E7iwCcYF2hyFjjM+Jm3FhKQ9Aw385AeLEIcxxihcrimNfbA5NQk5PmRbJ+cX0RvagL/yaN2Lk7r0h4VhD5ko43XPft5DMF5izOjb3WjhsBBURhxN1tV6u+aitPx1BTlwubWIDiNNDrZA4nwo5Sf7QBsuT5s321G+7qd17+IFzc+mll7Ybb7zxIQNTrZbbbrutPfWpT223384n2R6i/Pz/cFn76//VRWWbNscmHaAdHiRuxj1GZPKJ8hwnVTtj8woMnnZ5CpLs8ceYgNOshU8hpW9OaF9iBFTUeNnGdntUGaRywEOcbp+ryFNmT241yB/a6nS7TTq+V/XeVfvmv/H+9v7/wjf8Uq677rr28pe/PO3jOX3Xd31X+83f/M3jIb0fzcuf97h23T/iQfgYC1iH5uDLP+mkb0u6LGbUoZMvFxtxRqMIMIH3uvPJEXBO0i/v5P7/naJPa5mmo+3udu2yveRr+NK605z8esIPSkyLj8fDCS6BuluHcniV9womWGdySoAK0fnUtYWwqdOF859FgYSyk6QSLT1FnIX+4x+33v7x37mk+l92vvbaa487+WW96KKL2nd/93d/mZRjd//WP/5M+08fuHdGuvDFTBPXlZCReIXyL+NMQtoWAz5j0CEc+idjt+0YQ3T/Njze+4oKD/yRrY8Do5Ldq7b/yq/VuK5oLEjCigcvMy8lqjNHjrJgjgrwsaXUFRwYfH/jn3x0Tv6nPOUpJ5T8iv7hH/5hqxMqF/L0/5//jec6NGw0ZlJlrFm44s8usscLFJjt+CQW57z4zIXx55eJddTAlaj0BUvuYqGuyJ4+Jui0F3P+vH1P5rdHl08+7cYMAxZ8MipXD92GQ6nib4PJD7D4zxHgmKg5uKQsHpM/W13vQ+H11YRsV9WjjOjoHXlcXID/2LUXtp993eNE3K+88IUvvF//eDpXX31836N6dGNqP/L6T7UjR5Uayyt3aY/4c2QZc0joJbmgDcLxCTPAqPVP6GgmaOkEJrF4qHtyR4Cy/BcePomRNS8SdtmF6DNg+hUsMA/pZLK4UNjRDuVFml2KAOei4PTaW/7zre0X38qnKns5GR+fKM+hc9fbb/+Db2zPesp5mN/t0xiLtjGe+DSLr0DHBEEuPoxbWv0Qn8nPIS4LQo1N+vhHnC9hUw9/Z7e6mLzv2xtlscECsDldtjeswYq1BXtmnUobZ2dunKieoHGukzMmT8OdIHl0dGquTsDCm3thaQjgUDgh8qc7n5JCBihy/8KLCY4ZU43HPIaPAZ9gORGeD990uP3z/+fW+9uFLbFjzjB6gWG84/fofgod9lXgaag+cKyUQZd2IBWYCXLl9GcIs1+3yYbcB4cQQaY+auXxP3SnVnOyQ17QJpI+doHI3HXLxPG3Ava6N3xUwXM5mYd6J+JjFT39svPaNzyTX21yAI4hsWMtVp8VLO9TYJyOKeM1jhyH4wmjLL3tiuFBySjj97Tir8gUJ0kW1eVD3xcqbDfKanGZe7kn7oau49KxXNsYznRykgI6Lv41QX2QQid9JVbSGoSZw1zZbPUA7Pe0rsBjIuSqLakJ4qG8LpDqZ37h1pIlYS++/HSi5bOf3bq6HQ/vP/rXn2+Hj2gHYzTYYgWB1E2bxyh+RtOYE1kgx8zQh+XAuRIZ6/GdNPpJ+Z02u6Usmh0Gz/xyoZTQ1UJQi2v81vWqVf9ZZxFIo2AdZQWJOvX31H71us+2j39q67ZH/In6S54TnZc//Pjt7T/esPUNQcPu2MUYtbBODMJ/xy0IRLb6xuT2ZBdpcZHM+Jyv8mGkiXfnGp5OPG0+9MtNytyNsmxPWPKWRJ5A7ZGiv/W2Qa7r9aXdHqhW2UaRIBXM4Lpf43A7fYLq3lUBwFx5I4Paq1jo6iWrTG5X8QUeBP67dzzwm2jf8Y53QHFixZeqTqT4VuI3v4vvD6Qk7DTdtqd+Na9tK9YzFofjSELkghE6uR0dnR6Q4c0CCA0wzp22PFavIHgd6IuhvMpKkcd/AF4FgwCQZwJFEbcKpzG2up0ZX0dbcPV5h8L8i9/89EwyGu9+97vb0aO5Dxqgh6xPZl7+xVturoTVcBM3Y+U0fAO4Fisa4vA9LeKwP4yNr/UI43XYHlqKvIolBQiTizqxSq2+mSCo039aTBcvmaQT39/ulOlry3UfbMWh0VFBaV9HVkzr2KRIt8Iros7lEEXJFQspgRfA3jwxWSN433rkZbZK5q9fd2fbOMYrNL/xG7/RPvnJT0b28Zz+f+reBVz3q67vXO/e+9wvCQkQSAJJgBAEhIKgOCAUBQsCto+0o3Za6+g4faadUTo6D486MFi0+Fj6WKqj09rWxhJEIqLoyBSJCHKTBEEuISEkJCHcQ+7ntm/vfD7f31rv3ufkXJOzzzlZe7///1q/+/qt32+t9f+///d9r7/++vbud7/7eEgPonnru+/CeECJLPquoelb2V4dWOvnmBjGKlNBV32pgCvxirSbSfKga0eQm1j6Ow4JCQd9bsFjJHo8nWTpPpffycJgFpvA7jq9V0CJPhXOti3Uu9gv377UPvAp+nlI8R2Tyy+//BDokZs+Efjrv/7rRyY4AuYPP/SVtsh9F82r3Xol7vBR4sidJoDAuMlXOI4OiS36bO8ihEpgtjJWtsBL0CeP7EDjCwTMTdYev1fE6SzTdrbT2+n4RNLhuz3ftujZuDce1IsGmc6t9SerCmBbY5atLZgRxiuDo5CMVgahRg6Ys7e8PL4/+Etu6XjPRw7elg4j9+/f337iJ36irawc+bn/Qbu4uNh+/Md/vC0vn/hO770fu4+uGJBl5+zBnZ6gWa2p54adlzf0wv9aaeO1mCGoJrfqZ2HseKflXCL1EV6cXRKA74mto8IXYcL5z+SgjwdQRYUTVnK0XSCJ0yeT2B0dk/bnf31nsUNxaPnZn/3ZYz5SPXh8IMhHg0+07Nm/0v7qupqAavJCQuzFZldrt+yOgt2g00lmQZnoOAff29LFL7Qt+KA8w3F2WQA8wvBbsNP65JL0p7/s1io/PXGGFB4unTb2gYSeg4EfE+Q6sCe246AjHbxcl4aGGTtbe4Oud4UByAAboaEBbrDLl7vZndB3CkIwbR+/bn9nvv/JR35/6Id+qO3Zs+f+yA5xFfPtvw9+8IP3o/Eq5FjFx4Vv/TJPqCXBoIYn/cf+9H/4gbarVy5zIhcq+ubOPG/ROdGNbinEYkAqTTpeEeDZ/se4otN/qrPkbcZUAKI7n7VASfAelOlZu9TTOxn7Xf2C5xw8JJSPXV+XOdU6+Hj77be3F73oRe2zn732YMQhrV/5lV9pr3nNaw6BVnN3/5zFYZEdeM0NfH3YCBRNt2grrkjcaa9t+yyun+tt14yIQGToZP0CrMvL5UN3YIaxBCBPvxPb9V6gUk9/4YFgR+f0PgB0qBsmE37ZESAvXV2OxYtZTXC2wb1u8Jyh/U9JMtvog+QgRhAThER9oJIogZQih9nLz1u+cvRr0Kvf80ftqU/+luYjwbfeeiu2ad80Dwm98Y1vbJdddll717veFVMOPVz6xMvaH77tivaxj32sve1tb2vPfOYzDyVJ+3Nf5HvsTaQeRALtbgVTd0yy334O/xTR2qYHnH7SD7CUKI5kpH3NxFjs5Ur8FJokKkGtn4oyvg3OQ/QaMmYKAmZ2Qq+8rqkSQ30BdrBjMG03HHLzT671Zd83bmkve8G3t1e96lXx1dhJ+XCVfnvOc57TXv3qV8fv6/ms79ixo73hX/1i+5uPfTQPFf3Ij/zIoSRp33Abk7i2pU/6o5uafkNiZ8xt4ycdK9paUKSVkWL3glcAr/yXz/WN6OBDHuSRVxhpT3WZtk2T6S3f8odYb3fPiDK9a+k5OI6fhcUcfcY5jkwy21gHjGOhM2bB1+xrcNoVkFndJOp1zjVeIVgbSBi+eedqe/gLD35rSimjPOW8ze2C3Zvau29Y2wH4oRQngGPdvLr00kvb1VdffdDz615WPP/5zw986PD8ll+6uP3wi8+mZsJUd6s/NASkof06hDMdcmXKB6PiiBABIwAlsxlBnIFlIpFPvLxuaXUKJ6HjOGgr6EVK4xm74uviKfoOj/AuaySY4zV2WWh47v96TfsQj/0erlz8sE3taY/a0t7/hb3tLj6daZnjHYytW7e2vXuP/JHgQff+97+/+Zjw+vLa1762vf71r18Paj/4ggvbW3+uP6ehmln8mAZOqvaKfsSB+CimVEKDSghWYEJjESgTSV/3XvC+KCfM4TfQjNPtk4XFD8tyRhS2dPb4jCo1keK9rGD4T+cnaznHqZobb8bvBXNwQHqndtDIH2bhDgQ8BG8oGRTJAgfnoO3nAyJHKpc9YnN7/Lmb23KuY9eovN4/VvJL7ecDDn2f26D+hV/4hTVhvba46Dqp7dibs/Z3pEbb7ImYScJuQTB714O+6S633WGLGPuID3hl9YYj4qXAT3FN5KqAIg99zVa+CIGJK5nGtERlRxTQ9Lq5/NqllH7k57sZnDj4O0D/DlcetYtPp5D89m953VB4s+9Yya+8V7ziFfdLfuE///M/n48TWx9lEQWxXYtiLIfqFPDhG6j1M7d9XFicYON2DulB/JLgjM15q1W/RolH/a0MXsrOfzhDcaYczIyj73tPtaVzk61jq5UA7y7NqSJ7ZlGuLQ2wGkW6goOtd7qRFBmyQTPGgPaAO2y7th7+5ux5O+ebE4Bli98k8wDKk570pMNyHQ6+czvvTvRgTLoZcNpsAhNUCVDx6WfFVgWZRAadPujncUkkbBbgZUo96WfPxSm/6vUMQokSrtTgS0lNCkFAH76BHzoFUgajyeMGMzbMtR3b6p2CIqqjfn3m+dz/7az5xp71BMdRP5wvZduyZUu75JJLDpKwfYs+BpQJEUPjAs9OesC1lz6a9nn708VE3xYhvCHCZYNOTKhDE9HMDRVy0LpwoIt3W86kG4AauGREnVETAAGe70jPDI0TdaZ+L29aoXTHB+YYWEQ5UCExaQw8GsCy1Z0RdVokZ6KRBdqdOwzOISzEbYEt3dMevTZmm+Yn7Sy+yfxEyw033HBYli/ceP/Hwh/9cG7JJLnTc/pqolk3osofTgLmU7qqL6QxQPuOx25nolCrrLwC45Cw1jcJSgmBKNqzdLyUXdt2ZApMAogsgcGnXhPSmt/ByxLDYgSNoil7pu18dlKHlqect6Ut4NtRzmESPNFyJB8vLy22W2655SBx559LiGljOSW4cW/O7gaZPtAwfoTps1Ss60XY8WHiLHVgnSd+5NKqRHHEJ8pkeBLbts6IwtWrph3+va/TYiHrj19drKN9aR0BXq7U6QYTwFmig88kIb3jUkE8tvpjoDz7N7viySgzWuroA+v9rCdedHBwXvSwhbZtU0Yvg/kodgPPOP/Ex/CXf/mX2cau3TvQtSvLS+33fvMNVmdFc570WIOTTlnS11TS99S6vZm87EcnFRcnAPKcrwlLHfuh885/JkJ5VERJwM6a4uPw8NfbXUWXpMYC6fWxiZA6sNwIhEyxGR8vHcLQZSk/EqFlR3LZYw/+Bawdm+fahbvXdl/OA8+6cOswUTOPq/ipwGuuufp+tO/47X/Xtq0e7PtvecxO7Nfg6odMusQ+xa+x2LrrOqX7LC15pA+ifBH8epgs4EPC0ZhNDM8ltg8aMUhPX+GLsBylw9+ROR1mLbUDeSglnjNwy4sGULZrulFceZazGEeOf5zsgGUAcbGsjmpd80oQKZztMm1Xzgys7Sr/3dN3jGrOl3BTyuLk4GTgyvSsC7ec8C7gOt7WesOPvbh9+v1/0r588+faNe/7/9rP/chL2lc/e3Vb/7bVUy7Z1s7e7erXJzrt9MYSffQvZidSIaGZHuUQFH2m0W/rzLby+iHk9rfq5QP77UsehaBH2dY8B4bmTMD61hdW+CiE7pMO/mw6ZNL3SX7lBJDxqIGQwX5M2/O+1Ruca+UJ5+LjUts2k/2XnLOpPfbshdwMXKM6ds13C17zY69oH7jyN9pXv/DZdsMnr26/+S9f1d78pl9oFyFvfXneU7zHXEo99zCbxUrcJFA/xEXUbdoANnjtZ+LMg3QzWVCAq8kkUOqKgGh1wm/LnSFl2u5ewDImgHLGaTdrOl3O23wYMq6zyibtw4Oj6Gy9T/Ql6MENinK6owVElrCFYXAXLiiDVk7wbNleygeB/u/f++aM7gBPjO1gU/DYsze17Zuk41tUScgfeOqudsXH72mLh3lqcMa8rvLiS3e05a9d3674v/5JAubWu/go9tI0NxX3LK4tCC9+zi4sQY9B5hbdkq5UkMYCV5Os5uCcxCzShFxe24aoK0+wtE1eGxWYtcMABq2bDcUUvykKDaRhVU50Ia2LVmJJGj5VSCRXElhXVyZYzvyL9aRVz33yWe2sHQvt7j31oNQ+/GBZQJyJ6mWW5UVP2N6+xjcAf/Xe43ug6vFMJE8/Z6n9v79Rzwfovpv5shHLF+9ek3HpBTvb4x/NRB/zq1PpO/SxMaCC68CKp7W2jvD+yeCxTyk6yBLnSe84SQe9QyyodnZrxoThNB7m2t24YY6PoZ0hhZ95q2hyKCg6zldGxrOjxiuXADjWwNbJfRBcpQzhRLYw6UsifJ1KGvjr2q0GKezQvejZu9qj+V6AUW745lLz7vRI/gH3xuA/esbudvYh9wwG3vO2bdvaL73+X7aPXPUn7X/6sR+doUy6C5lQDPgv37PMhzFnqPaPX3JuAiVGu+1IlHLC3lgvMyVBOfrlGbBi8oBPOmxLYH+5THeQ/OVHz1AZqHEATfXIE5+qRxralGyHqYe22zHQ8bm4jEvxiIMrR891eTHlLb359srnn9fhrX2er/z28esLz9o0S36RTgT/8G/tak98+MGXZTPGXvnhH/7h9ufv+qP2W2/6lbZl+9oOTvc95qyFtp9JXD+P8g9f+Bhu2IPMBNv9kj7Gw5CBGzOn8WMZSW2nvLaXF7LyVSjwC3/Q1TgBi4wOQ0zg5bByTbGd3iNfTjr/up98xEXE2dNPryVd+yJvuiy3pyaB2crWTIunkwiecSiDZa2ClFqC0qZeLt+uG0pYbUFH0GZ4rMpuEDjwNZbBL5D7e3lU473X1DXjfazOjyTZnQQOLV67ej9g5+ZJO0AASztG1kuF//ybb2r/9Cd/ul14yRPbk5/3fe0rn/9U+8YXPx8xqjYwr7px7yzWvpvJ56f/0aMSnLNEtL9abxz2pBs2l0/AIivbcyrpp/4Q5t84U/eOdUSITKeDLPngi6NcYkshtYLZq1GPhu5m5UdLztLbHpdwnVJJvdAXxwK6i87b3n7rT27Tiryc4//Wuputg8Nv+f2WR25mclhovkurj/06Ncs2dmQ/+sqXtsvf+gftkidc1i55Gl/1fc557doPrj2IxVfN8tzG3vDJs53J57/8zLPabsYnO0ft1x89buxnXnF4+UJQtv6xlIEYRkOZ/ngOn7useK6fwxh5JR7GkvtZPoB3hjx8N/3gQptf+fLp+n0CvHNQmS5NzzKIdLJ+XhuXAaiw6pHsCEDn0219YPS/TASJCZ7tbWfNMGWwHRiAXsuaWIFxtjDp/LO/f277jbd9s331m7VqvJck9Zr0YYd5+2oe/mdesDUv2feznd3MW1om+HOf9zxBs3Lx075zFpw+T3DV5/fOgtkuv/bHHp1dQV17w2Zf+g5G27EYULcdhkyEAjsuBNLQn8V7oKd/m3diCxOUuGzLS4hMKV6T1nbdJp1RPL4rN3Vfg1m8Dy8vsiqzwM67IBvIElGy6jsGGTcnpJITZBcWPfi8HrNt7amP39H+wd8+r/3ee78ashvZaf3NVw60px9mEpDAB4R8Wbws07/uEF708hcGNg4XP/07RzXnv7x530GXEP/s5Y9rj3qY7+rYUftaZ4lz1UIzC7e20p+6PIyTcSFt4PE7XUyMxZ/dT2PF73T6pyYX1Sk4WuCbnMWXKp0h77xNvsJPdM/dpmlnRFmdy97Q7fkorig1W5PsSXhwBl+2ZzVQoQUUmDfBdLjbWWEUz32Y+kAIELlG42Rhmp3DavPLP/mo8Hlwpf69T97b9q67Vp8hD6lsZVUyOC03feKDVenH0bZrf/zZPQdtS3/0Zee25z7du+NGln2y//bTxDLosFQQ9q6fFGwOnunKpH3tr1bbZ357qV335uV2/e8utU/9x8V20x8ttb1fZXeS/iJ/vZxsg5WpHIpnmopdZVfz9U8stWuv2Nc+e8Xedv2Ve9un/8ue9vl37m/33tbvBGY1hmlMCI6L3+04ZGW83HkIYfywwaRYgP4NP3FpO5tf6xnlv31uT/vCHcfOC58ZGPcJbvrEBwZ7zjd9fK39qa8eaB+6Ze0NLncdP/eDl/GdM3RTk/krnwjQ7555WUt8iddu4y/Y2TmOcoGRuK7rqZecmgiVw6uPnXGVcSr5a8El/+ks04Xb5l/3Hbff1y54+CsZpRN/8/VkGu+qfaDxgPxkSxI2Y1EB06vlUx1LyUycwOtGMEr+1dYeGGTZSicjbTjIFvn74DuwNuHNjM8AKfLJF29pN/O5gE/eUI9uOwlcf/ti7lBv728LKuloxeBcWV5se+++o/3Fm3+VdwD+ODcN3/GZ+9oNfCR2lMsu2tre+ktPaDvYniZ4MKiCSStrSLKqDgZtpy/SGlZu/1e4r/z5t6+0u29kpV673A2Hu4E7rlttm7ZP2vZH6gfABi/8xneSwE5bALib4kea2s1/egC+5az8hazjEruBO29YanNsf3Y8ikujOFDeLg9+XWox3ruVaWQiiL95nmLnQnvco7a3339/fUOWZl33jcV2Nn7wsut4yp1fvbV9jTv++kL/vvs//RIT13L7qy/uz9Z/yNiErX/wmue0Jz5mV/oXW7USpWWTOyGauCH3KnoHsgMITEL7ZYeKL37sfdX2TNShIAr1hWSRjwDPvAJvkx18KejNw7bTds6Xgq7+p3R1evOT34jtTzxtxqj4wPS+dt/cD8dTOjoJHfNsVdGrejMzKY42Ybt3Z9vZUPaw6/QZCOEZlYhOtUcoEgj8LhOiSLjr3tX2/f/iC+0vP7H2HrKrzwsu2c61/9pTayE+jsMt3JH+b1yP3rHX1bPKebzl9Z5f5x4BMr2YKaPE9R4DGlW3nKljZw8k+u/lz6Td+Ecr7b7bJD56Oe/bFtp538ZEkwlAcepBnjsBYLYO3DFtt7znQNv3zSzvRxV48Yu3t7MuYRJwK01x+sgkpsNjjtkjIgcqnIV74sX82P7VW25sr7u87o2ASfFS4IWP297cUZ1IuffAavszfPw5JutRHPLf+qlntn/yvRex86ARkRyy/ddOAfUacRDToQ2pbqAbM3qhwDJJUw8N6PTdzoVZBiuV/JEv4QjEueXfbXMrBz8QAfoUl89Nvu9tP5Op9nX/4tyLMfL0TgD75pa4Ll/3ixt4DB9WguMaA193z2Dd+RkB6sG7MkKbQ9yeeigdaMckq1yYSl7I3Z4ive8S1LN183x72Xftah/99D5+lLICyhtQN7JNvYE7196gOpebSd5oOlrxrairbtzX3veFfW285SX9+Tzx9843Xtqeduk2ZGmafehBk+XCIKIoPrlo2+R3tSqg/br3Vn4885oQSH3Usucrq6zeq22OiWwLP3U24Zw/xO2/fYqcpXbb+/l8w17tOHbZxzcoPfzJ45oaIf5rG/9ZTrljnmb8DkxfBafsOX74Y9qe8yS/kGqSr+oSavHtv79hC++Nv3O493KsR7Dv3LfCdn9/+9Pr97Sv71mbYB2jX/vnT2//4/dezJOGxobKMY3LRKMpPgdUE+ra+EsXyuGG9Z1IX8BDECrHqmoOIsVxUjbQjptRWImsyWeYALybcvrKZPrhX7ji2o9VP29+0neyLPzs6bMGv9w52c49o+8pG8plOra8ypnkyIDFuQnbjuPkaMS51PF/8ghHF1iEhXZf6fIWUI1g8a2XOWZp6L28u+velfbTb/py++133v/dUq9FL+Aptgu4b7CTdwV8ht1nA0x037/2/ef17/OXHa19+5N3tN953SV8SeWWNg9PgsK+8l/G0wmDx/sZKdSD683UOQD+4l+stjuuPb4JoHPn5K5/68P4RjjC0MuEpT3DT+upjl2/7JW72la+WMpSl2VWNLDsSz+4lMkHghyT4Lqu2nM3PhjZ3nzVbe2nfuOzvAuzlsDKdJjO43LBdwLO5jFsL8Hk3svs4G5KH9++LunlsZzLD3/8x1c9s33fs89rm3jP1Uubg3w4s6/GWX843rPLLZTUvSdgI/bslvbz0gajsHZhNrTLSaRwMVwwO43Q2hFL3Xe5qm3ef/SPNxb1xh1Xpm+YvOLKD8eq0/7joKt45ZsLz2OMzom3RrfHSpgzwOF42mMyqIyvm1xxPrNIXceZFAZmDVXOVhMFNRiV6wAzeGLk6QPVad1kHziw0t7J9/X9H0wEX/za2vZSaSdStvFlFa/+kUe3V/3QeXz4iORj95xikKDWgIr+zGDDjiCAYxAJE7rYRpOGN/nu+1IHlLRTerzoe7e3sy/agnUGv1aa5JjA6ouBsflgg4QLGf2jSXIsLa20a2/e2376/7m2/fkn1h7GOpj3+Fo/8Nzz2y//+FN5u3EbTxf2+wk6Tr3oqt1ety+JiV+T/OBzaSApPQmJkwdteDM+AUoHwEmDQ+3cSn7onE1msUS909alUiaEOyeb9/0lRIo+HWX246AzA7gP8G8w59LTYQ2fRrin7Zn/HzJC+NWxqkjXQx0wJgEHUFgGjiHRucFVV2jB48h0uIPB4PKDjCAcLHvIIdt9JCEnMzzsJYYKvCWj09Ja4iOkd7E1/a9/emf7jd+/vd14G3fKjrM8bNd8+8cvfXj7337wke1CPlm4mbfmSP/oSUBqaqkFpiGGmjZ2o0I7bOGclZMT1S/88RKXAdZOT7n4Jdvbbh6P1nnxH7ZVojApY/9YETNcdilYehe/azNjQNJ5X2KF3dN+3m256q9vb//2D76Qn/N2GI+n+GGilzzrvPa/v/IJ7dsvO6dt4xKuHvgZPlSVPo/G7u9YCgAaUCP5o086+5KBkddYoZshLKPKtuojiPQtsdPHLfwqFFkEfUhpLyzya9wrp+fr+CaTGyYv/b2ftp9jDTJJPsJO7TRNAJOdSWp8ZSBkRtVnepgB0J8OXqU+DQCVIHbBwugJhl5SajWg0EUEkLq+dzAq8aIP4sjsAxYdThR9kMf71wDapk3z7eH8xPc///uPbP/z33tEu/rave09H72nfeTTe9rnbj3Qvs61/iJbf687H8bz/E8gKZ5x2fb2wmfubt/97bvyoaItXCbM58cisCM6Eaw6jdY0S81QViAxqapHwUnjhJZgLdJt3Nk/bRMApm3nXkaNhUbpf4xMtps81an0ofcvkwSkcbO0knOvQD/oux18VPelz35E+55nPpzd1v72ro9+vf3lp+9sn7313nbrN/blEkHxO/j49iW8tffki3a15z/t3PbSZz26PfLsrW0L7ywqJya4mlt64qfKobb55ds8zCOZCwmlhxxmVbzFQOMoAkPCoeT2KLQLQPizoq7eyfILOxDJFRwqzrZXFnYyAVA5DWWFXO+lekJjev0TL+Ai9jcH4pSdTYA7556B4y4sT+KgkRwC4jfMzLlbNbJ6lhzVjTwU5ABYGISwJAjAhwRl2Z4hLnAoRM10WJHXoesDanuFr03c90iCZFObbrmrTTbfzuOrLTepfL/clwYu8178PBfVk/3n8cToFq6v97aF7d9oPmFYFkKFzbObQ6rvgewe7bYAAEAASURBVJUtaDfdlahcIBdENnoABZ4+lq3771ptn3srP3WtH09x2X0xD+i8qH5lZ7aTcnbqZsev3cG5nsa+4QdrgQHIhG/HhB3Y3SbL7iiW2/Kme/NoqD/7vYq/pV+ho0XJWry8gxzaGv/Ob93PTUXeA+0K9I5JWV6yjl3xURGsn1xrrKV0AOps9BQlsNgGPIkNNOMj1hgpSnUVryfqoRVS/FoScNrSrN7Wtuz3Z8JPfVmZ/i9c/39JxbMdwOSyz32Jy4Cb6cfFp9SiA+2e6er8hZN1K2+CPVt3B2M4Vkc6gjVI9dFeBikJVDQZZNtJFmbwsHvoBZkJOvCuOkk66CVXwvqBS1CykrQ7n9LaPU8Gp95Ot/mONv+IDxN4vEXY36oyXKb3PbZN7nwmelmGLD6H4peInvuRNt3MF1FSoscj0RAdqdsPQHYvBEpDHoFfzzUUV6CdZiTcFp5SfMSzeGjno6d2NZnfOmmPevY2+qBfvO+i7XYCK+lbvF5DVZ2yC2bAGI5ZWwCEy0yyd1xUyQ/EskBMLJz1ZZ775Vt8oc8izde5OxFP7noMX2XTf0XYqzFvYu7g3sGO22lgg/EDKD5OvesxzrC5ngIE5jjIge2eY0vvQzpF3b8ar6IImTT213/qYcbA8biz2sTHF2HzoJw68XNrF7bVhfcxi53qy4CbR/LbD4dorayuvGetcWpq031zj4gDdUx3dAWSbQIJJ3otVZ7DiaHr27PRdJBG0K1LosSbfpdOvIMtvzDoMoCs2o4jwykABLo8qffuy/iwNO9M9uQHWmXxnDb5+ncBZ/4MDoZ9rPp3fAfye/IPWlap9o3v4mO02xGrYAtnjbM57NE2dBYNCFaZ1NNfecZQyYe17mDSn2l75NM3tYc/vd/sknSDy/wWnud/8Y62lUuidEBf9T7FhdgcPzsWJoe+9g977bYlk69c8vpo/O2PYxJg5V9f9O1dF/Ie5a6o8UrBkZ+78+K15J/RI3gPv+u4lw9UxZaO8JJrDLouWxdLVdcgbHNV19fOMrGzzpECjz1ci4/0RmEZvlmf7HyXP/rvuwQA8782hkoFtrzpEZF/Kg+r04NyfERVmbCrvZdOrT2mttGGrbTFycrc80zyOB19WaHVm9HQ0d3vDopwSQfO93P1LTjpys8AkhyQyuCAdHxoQlewCDSqKLUaVz1ylH03K/+RyhIT971PAuvNLvjv/tYjUULCe2138Yu0Ea/LsYSVyKTp2mkDM1aCHTTivfMvVVIsdJnMIE/g0T/fTTjv2fPtvO/wIZ+I2LDDZr5J3ht/Ox852zyWrupI+TuOto/1ivV03nPuB9DvjJi2ApzcR+KuHiJvfQ/uOZ+WbyVS9vN9AodOFOtpmQScUKJTeE/okAQYKbN5Hu3FjY8ryTUJGuNG+ynjks3xKZyU/IG3P+lLF1txBFMXkSkrspBTARCVkjMBPQ8hD/xtJY07kTLh6/9WDrx3PctB4TJ5xPX8UPvkQ+sJNrR+3/wqTqh9XHdm9BnZCR5a3bEBmQxxN3id2ssI+gQX2/awBJ+h6YmnKDAZsJxKRibo4qmffwIs79JZlbhDyeHO97BD8IEuV/1FH2g5StnLr7AvOuGT+NnLGjyJhRgT21ytnLxiqb3oND4PkE7ZbzyQPngGnsDl3gNvdz38aQvtMS/Z3DbtUsbJL2c9blN73Mt2tB18rVftVtShza6Q3e9dteOVhNFWx9a/4DpB8NpPZXHtY7yHtXoF/97LJGFZ7Nv+at3/qL57H4lbKlIkqLxDz/C3cZQx6G7VtzHYs16nP9oVODYCsfgNyvYjHwmWRsGS5Zwelhj5ghDmRJGZo2DKER3Wyfa2urVP+wI3uEynH5r83XeS42vF3h1cJvPvOBiwQa1VhuDA3PPjWpyva1M8pe1ZiABeBntmc9G0syqG9GC6BKPdgjmDmiFjkOAxufi3ZICRoYoax86D7ASsOo5V/Bbiu74VkTH0WNTcT3g6yvgOFgMwExQ6o8dk1r4uIuLADbGaIp00nLV6bafUeeiLk8Du8+fb4//epnbuty6sPWdwbMuOSrGFH5B6LI/9Xvhd29vm7SSj9qTX2lOsMc1qHCpQHL4EkR2LBL0/VgsPoCeikKOWPedyGcVOaig8GvEBLhmWnFSQn9VB3SrXJhcR/B0baHZwiTMGpLEFIjwMSsal+hK6Pk7jl4+qjyVIeYlPh1ZNLEiO90yhGsoB0CFoZe754LrESN+4w+rC/XLbHh9UJhd96iY6/jcHATegsbpnYS+DcJ4joKPi8xEwOC0ri1CrOCxfy9yX+tDiMv3oKhhuHQ9ptmshqIF2EIU7AJP1b8HBPBJf6aVDXfWazjNR8nTyMcvexxBsrP6buVF1rOKuYs9j0VF3sqMrKz6gGNkF0KfZdtFOgkvCp19YK96gqo7BpAeEMQnwZOGmbQvcoFtoT3jltkwEC9vCeCzr7off/sj5dsELtrVLvn9nO+sxm9sCb4WqwzKz12bGsHxYl1/a2O3mVFtoxiFZJ674ZTVBGu+WHLM4Yd7LB+k2HQetwu7jXRt9ZPaiIgcv98i1StjuP3Ha6inVqlcHqfMZuboE6zTpOPWI4hBex6t7Rha9lJSm5vjC445j5rNO03dI57WlLcfZqZj5wA7T9jeTl7/lpkOZD3/htTJ9G7dgWa42qKxOV+b2L7wgM2v8UxOAQZ73hPGUToyX3f7i7VDouDjcoXIsAYCW0rK2bau2SV/RliFJLOS6DbQSSsfgLp68/+tIOSnv+hw3AXkX4FjlDly163ruYn/HsSjzjsJ021fQ3S/9zAaTNwatCyLbva+eCuPOodeppC8gCyY9eIJ8jolywiOz82dN26Oetak94hmb254v8YGhL6+0vXweYPHuum9xqLHzPKC09Vw+5ffoTW3XY3kG/yzkzM3zbgcGqAcG/V/vTNASlkm725rMlkjJGgptjOMsjPGCBRhyxdvwtIOf7GaF1/6jlv3cd9l+J7cDmJi9LDha8T7BPui33I29EPoyKTEkbwFSr1jo7W6LdtbzJLFwzU7tp5V+dIcnVgJWWI1hJmp12Rf75gGmg2JTPwkLDXqWF17A5zI+CvUG3sklpw9TDjsBTB5/3aemX3jyx3HaMw7D86BBq/duXsQH5+vipHpGSG/hZXw5ksGRC0X8JbWjAERnc85ouIWsUekDTFvsgK04GnBxciWK05XUV97wzgbUQZG6n3fewEpyCcF2jOtOdwDeB9jC21AHCOSjlVUC894ntrb7M0VV5qoyJRNcVip9UciySbQRTIzYN3zVv2OOs8y+7J9ndxh2mLfSNtWlwNkXz7VdFzHceW6BTQsf6/VjxFPaczygtMDbegu8EzfhQzN610d589ASJuSOvUbEiaoB330W2zQreM7w1pg5BtIKA6rNax0REDlJRnZa052359q9qI9yvOc8aL/OTdcLjkLUUd4Q3HwfajWCV8zGb6ITH4LxGXUpAsfoOtsG3u2v/prUHZDOKRX+cJT81F3tu7/Sb/HwyVpqaTtndJ8BO78tbV1sm/YxAhtRph+fvOzKTx1OcmXH4TBLy5cn3g6HezCw1enS5MDci3VyZmCDR8/EfxwsQQrTnUwCTgR4aS1+DC6dKjE46ByG8GXHUNVcWZFMkqZuAMvU1ZTAGsIMjuLULQHKpjxYMn3YYf0m0cGFdwymuz4NbAg/GL2+NbnvcdzJ5ubh6EJsrn6E38nJV0RVEGZlMTU11InBcxnLqfrfYxI4/Uw/OEPmL676+X0/FLNpy0LbzFN028+dbzvPX+Ax3k25o7+Npxc38xjdJiaMeXYP0scH+r0bOlzuChl/Ax/vyDhWs9LrQnw/PpNS56kJqlMCGxNW2/GNWtlnQo5QWeYrw10oj+eywZ+Az9uC3ZUuHKMTiteFlnG2Pz3oK77WjYF8lixW1NM0tga8n5GlbxKrHpwMxlhFD3415su9Dl21V+dfjA+P45pTI06wrK5efiQOzDh8mTzxczeBOeg9w8NTniD0br7vY9oeFqfrED3Af2KGVSe+inesOyCi+RsrNjD9GgfLGCwnBQCPnOwclNsFDz2FhAa5Iaf7VKgWqRNEEk8IQeYNxW1fJNhY2Y9VVgnMA1yj7rj1WJTg0ZOHi9Iz2i4H9oTi97JYic1MCvwZZPFEt3/4TPLyl/ZDl4kkUtKvIEczxDRMOuTNccPQFd5E9+XKH8V18Vr+xSz9nJVKC6IshkVG6JXfdbhDCFY6fRwe+dVb41aCu5/Fi+Oc+wS76ivCNPWoxbcNnTCOp+zjvsuylwvoUZUG2lV1Dpio+FZo+WGGoxnbZLFffONRZCRGgdG0rwEGpTDbfULPcwii2ZXFD1x+hTwjCpxG3fN6WFs6yrfMIuIBlWl7z+Tlb7/pSLxxxZGQbefKb2P4kX/P+YiMR0As8WzcgbmXptMGhE6MUwnAnnhZ8fFwAsmg7gMTSCYBvWfhPByf2UC4MqFk1h030Wa7AyVKgj6plOtfCifpxpZamMGeIVL/2cd5T3TP47gXcC16jmMi3/9oArPv+LKqqJT/rO7aVbYNG6dODHEK/UsggR+TlXDpHc34iLN+FRbf4N/0X5kdBp09zFgINpBTCNy+i0pgois2dH/Fb9Jb9FF2VcoUGEN6vZqCZ360hhxd2ikZd2oChGwj1I5rZfdShncEth7HjVf7yL2DaFBpXtiQxKVpX4WNEr/RGP6IbfQhNEjhP5Ex869OBxk8flaRxdj1rI/SdkJw7EQV0fhMgjRRuLrwErada99jJt+DK/e05f2/fTQRWn/EkucCJnNHFXBE5sMh7t7Mg+P+9BcOMHAyCt0EPRenl8N0uMESx1LPZJFoAja8LD04vRp64HV/YMg38H1VO+qgHWM3qyAnNM7akFYrlRrXTdx42n6ziKMXH0BRgDcPj6NMl3cVPUkQPu2MO7ARfl/aol8CcaVI0schRQvIYp/s32y1li8C7G8R9SYy6Cd6IlMyZcan0pUnwhtd4MOokk4XZUVbuDV7hWYEh0+jW+i6grwaQviyQpas6Nz9lXWER6lyKTDdxc4s13ZHoRO1wseVtUdjuymZc+mf5+wIhwj7mv5yyNm2gwJj+lKTqfZn8lM/cG8IpsCjnoo1BchXKEkqjsELKud1GmRwD5ZdgO9fnpxC7h76vv+hgrvVh4LX2pOLrr0KQ7lD+SCLq/8K1zkGe3yJC7iW0xFxRvyoVwVgFkRWq51aUc5WDPniNODVDcciE4F8YGulpAp7xj5kyI1SB41XlHeCkFof+vrk4WjvdmVfVvDRi0bsvJG7b/cdnQ7sRHmqw67SiDF9G1/bfpG9j9qJ6BCOVQtYdkwIkL+CsiTJb1BW8suMEn0sDAfUJZXyleGh+KSMMOm9lJI2NoDvzq1tO6wzNmngi9+UUwEuPvIGipajOlZAdc7yt/NOF7gzuY0J91iFnyjio0H4+jguz/w5IyfP3seyEwVzOESfqluzPeRstSrpu8B0xH71HqXzMoOCP98lIZlsvPJOSc0uABwHwe7iir980InDoF8gXZ3jXsBJ2AVM20cnL33rVUg8aklKHJVC5MqBX8Pw49lvHVnUPfxMa75/xkDsnTXG4jz9C4xo4INB3Uk6p+BxKs6RJgOTyNLp0igPHAOWWRinD+dmJuYmYAZI0sgwqGl0vTXO8io7JBoFse1+1oB5AnP3dcCPUrhXMMmzA/CNu/xHIp9D3iZcqgpX5OizR3amM+UMxkRMQgLQbgOXs+gKLCvd+ADlp4L95SNwTpwUu5SgthIQcphAculREqXiX57+vALVlNlMBUBeZOjbvGwyFAFjq+yyZdV1vG1po0XVyR34lQEuL8ZfiukuPtAzmxnCcf/Dlj3R1fh0Zps/xtO0XFYoLjpiQ9ldOyGgODEx0/1RglWpbXJRNJ+DbkvMJXAAMna5R9D9P5PTd0/FoHzYevI74yt34KwGV/7Z3Ba3kisPokwnd/HhqF87HgkM2bHL5PE33Y21v0pApPvH5jiEYnm6zO+QvjCDjs9yM0SvKk7HZgWj7l1bAwLnli9wbp8shCVwMxxGmgJwrIFU1bSFVbu6Fn4wGbToEa3ScKOzdGXgHMwMpAHJHzTSlS54dtzENeodCrt/cZU5i3cMFI2M6RZuaG277f50HTI969PRUQEFMHyemQAtKE/oaU98YARL5MsAgrT3hwrggitn0FmlUaCelAHFl5JBAa90Jq+ldhRy8ZdLDhHle6GhMbgpQ3/64MGxkGaECdXo6ODItK5OdGdihib6hTvJ2fIeyq6vBXLYg58OZEJO4iFrGloEHa5s4pKayUK5SfTI70nrO0SOPzBti27HDjsKlkgBXrJ1V23Xitb4CJ9NxiJ+p5o6zshQpS2dcA8U+++567ZavBFIff67gRzHdjOchx4QPvnVyX9/JTl77KLHj6tMLr724/Tpd46L+BCi1fu2HqCDu9PpOBsCvROPWtczBn4fBpqzmRSoA2N8SefZt2ri3BJYFOsAERfCTtB5Q6h+CByCrE54oCaRCoKyQFifDFSrneqV8Fw+KrH9ls5UErOSn/tBHgW4h5UNWmXy187+BO9Z30Bj3VjO89DXw64hKL+cJFCC4tWeTplF9kX+cU4TobbLAZ0XayVDZ/wjXWg4GZDKSFJVwOsG1aR0UaGRTLUJYu2grRPxgcVErQrHBC1nQCHjqH/S33GWrfNkHDEuMuyoZeBSXdt9SKv/Q7WdJD/rS4TFuhuq+t+P+5rw6tdezpNNfKng2dB6+TArWLf17jbd/WW1QKS18qDBCUobEDcr6k7giJN2xNrwY0YItpIjjXbWYgYNu7J0K6Kl6TtZ24MOjtm49Bm3XGInJOIVmsmutrR9fWdEHF+Ztt+ZfN9bP358xF3l8RJLx3cG/Aw2Pv9EeNpXtz0e7/BGOVze9MnKn94qsaxwMADp+2wlDWpwcTPwzPYqjZetWBRoQaZVRQbU4T1AAsygQuB4ZuCpGJgyILMCGIRBL003psQOwZ4hd/B98Ifnzadzi3y7LgHY5WieMZKkSD8Rph1+LNgAdgJIENE7mnnyMUIrwFTuuxHZ8nNcr3nNFhnE8FKHK7XIKBenATaVZbvwTpzp5+DNlkz7wPvwUeRVs+hKVPCKsYwkRkHuoGf2RE8MUFaRRRbVrPIBoiOOgSYFDmhrXLsvkB1Y7AOJXenS0mYkYNFCTQaBOYaxBbpRV3c+L0DycYllMyR2nzHgVLSaIDKC+lmAsKIqRvGU2JTDYBSqreKjpbombwdVPElHcdIUpZ0RsUY3Y5BxZhO+ncxdO9l6143hP/7D+/mq7zceP3mZcyL0PMs++XdcCvjEy/GVAzxUvzpH8ttzvUM/RxD1RCjHsxLgpTjO5JfUACa4rWZl1ZEORIpQedyuVXFmz6AMQAKuN5xVfCFD4XXtSTW6lEXRxpEIg01YBhoeBxB47uS6Q2PFr+Qv3pgmX3iwJTeeaHt5sMBbXLkxCEEPHPuYFE8bsui0D5VQ1XOOXWbuOms/k1S5AUS26d3+7ldxTiDpvjaX0WV3OTagcrL20ex9sx69JSTIMq/riC0ydBv7OX2Cx/44Br1LikPg4MWX2tJlC82KiG51ZmJdhw+rEkz82XV+Olc2SxBF0AhWoA9vze9PPfJDI52GA4m/ZsACd1xNt500fqt65MgnvzHnGWV1CeJZMH2j4i6m7tlIA1yj6j/4wGSIvZwD4BjjJRSGjNXpk3nc+V4ax1em7dPti2e/6fiI16gckRMqk6d8ZrFt2fGLmHxcs9P0Ht76m2mx430g7KerrR3nVX6Kx0AUXb5MYTgRWDhxUERAZdDqr9o6xm3df32Q1GHSm5CWMFjpA6VAy0yHdZPLQAaYQRnXcgy78lJU2qvDGOjdDgYs2sRI/2I1xNoPYqZTu6Tr8I6Xv/R0m+UJwIlBltGmrn09UCNXu5WZ5FcR9hi46Uc/hT5EwReubLdeNsITPZyUwXFsfXOOIcoAE9scE6nCBQgpZayc+Y99tmJWn8BkBzGCX19krCKX/nMe45CttgrWTTg1YUYItPpTHv+VI/GoA7FvmmL/le9iYjV0tIuLs9Xu+y5DcSkxPlySI0+dJVfh6XNmXf3ZTQgP3LClL0GkUbq1Z9Yn4G4TlKuCpa3H+5bgjW113y9O/ul/WHe9FIuPeeg9PSbdQQST8z+2l9+Peh09uuUgxGEak6WFb7NDw3cGGF2bDYBecNwzEDoz2HJyVjwY/QvPWMG74yPJFVG8LBbPGQzgfNtPFKs8+BqwMka6cnRQEdODIjZWPTTsLLRlBLlqDJJKCmQkqdSluu7S7CSYPEaflO9MmOAqu0IKPijRlgSEFa3qdJ4JnPx18TotCQM0gRXaLks7lJCDdQHFX/oRQju7IfnCW6e6gdcF6Fv9P+NFhonTWeAI3ok83gLhSMVPIRJtn2GQR3vsv+MDrJsXtKJcnbMzU71IpSlH3kGdBClY+ENLm8xWjcYpw956rD4CD0y9XRQrdtnQdQIupd2H0ilBO+lzxVeAkRwNNIXXxAW5MRGsnDR7H9NQXMaes0iLtrtzSGeNpz4uEYrw1flvK8KjHSe3tPumr5u84o+5tjzxgsYHVvLOwP6Vn6MTNxxRwv553wy/0J5mJcI5ca8dt6Y/41wqBhoBEDxHvJX/EBlEBg3Q+M5KarYU5iAK7N2xLsqAihxxvDIg4ka3IQIWndJHg6zFH5EGTuQoTxoOXndrjwnCfyGsIKkiBRrhEb8WPBloZ3hp3SFIUbKK13bJ1AbJx1Y+cPV7mSOVxilGncgSVrKqnh2ItgQhoXXO3S6rhfJII8FX0uLP4iiUJLKHF7vxX+5RpB/wYlf5H1ugi9+0CTxYkDKnVr6gai+Gq0qJwHV04evjF78Vf94m7iKVLjS+KE0lw0lKuDIyEWOgRgnU/Z456OO4cezURoIObpHQj/sUJcCjY+d9miEfOpVloQiUvnHu/gpScOIGfk0pJ4VOVC5tUym/6WtE8L2Bm478QAlf792W9v3c8d7xR839iiH1gMvkSXyD0OZtryEyeP/rMGXv5oV4iY7F6SRSBkBnWXoC2W9HYjaT4k0HJ47LAIQAIUJ64mRl0fwSJm+cqncdUOSpc6gqr9PWsUmMCpIMUoKzdCaAM1BwlmEJ/ASbgdVpaxJBjzCCLHB1Jhu0d12SaAR8OWXy0TCFQ5NA6LqGP6CJPo+hE8/LgFKIZ9jj0zgloTyTJYl08WHkS6+vYDIhEqjKlhL4kK1J4fOkDRb6lMqgl4jST2FwjDIeALtvq38loQsIadjsH8ZngghAv1JJvyXTj7apBa/t6uTc/VE0wzaJ0KX/5KZf1uIfYiEf8NFnwhRhv2eyAeKT8gVyRDku1WnafWzD3eUPm3IGJo+CNbOv4msoajaAZyGRfL1ubRUnSXQUvR6ITct8euvw5VPt3tX/81hP+h2edQ2qyQ+q5HLgom99LVny7vsJ2j9/Ab0oZ5dn46jceNMr4oBX4hfdcLwOiEtwzkiukr9u0McgIaMCBgqTkQwJt76EJjcQQfUYm63cWTmxoSYEpcuAPrZlSZ7Ix64M6rBHOu32JAxKAi9dCUj9yqwgjEjFJgCV1QOqB2Qls/pkBp9JQGTJDl6cMlQ7C7R1fpMHfLbnVCqAqy0i/lWQAnqSSJ+SLKFGJGhzVrecu8LQg5c+PBqxvhQi92tiB3hJANsdK5GbxrAZqO3IW3u7bB0TfF2OErCxxpC+lFAF0y8E+B/HBJQu6gFBg7Ymp3DUAqDePnYxQVQqcUJQZXqEpB/Ki9zBAH/RAMCOeohNOWWjuGHX4FVHdk/2Icz4W3k5cLZAnC66WFqWFy6oyvrj9N1s+1/Lyv+gPzfQtawX/sDr01uf8v1tZfXH2HrPJd6+svsFdGZ3ObcnmkGi8/SK048OMClo5Ck41YPLdZwxK1pnUJHKpK0ioJsfj0npqx/hDV8CGLik0snWB6kcHwQ4ecUbPEUnpqSZoNocQNQmvbWzQHBSgy9tdStLhm6jY1wwpQpXjwEnW/UslxRZodEHrHRAHnNoKUR5oddftgtfZ+UJECy9ujBGn6VP4uRZ50NxvR+SlJziM4CVMVSkf8jPGKRvkAdZK1hsC7Vy4ENguDUhwos+iRlT1CNp71uaHCLTs37RPvn9L1gmaWGCtaO0iKVID6zj1yZvcRHScZ1OJid9/a3NMz6o46eSlZhQBM3qCozr+mV/Y55aiDnF1FEmdAmRJgLQJ4FFeaEUIB3t9Buoilan97Sdd74vCGfZufafJy+98p1pn4RDaTwJghQxeexn3slU/Wp697W2OH8fDiX56cRwJI4ZfwHjQMPJ1TGfxNNHcZJUmmZgxQmIKc54bAywiaB42w6GDXWgL8kvL/81YoUbDo8cQLrdY1bome4KBpmTpBGhLIdUgRRt5VSD3GucfMev3gYasE5Pd4TUyJeskkZde7XfQj3TQYKgQGrp+Wa16MU7uVU0FuG4dKElWTGpGE3ihKaPIqmmTcXgDwSYZPHnoBUDMAQZjTTLX9jtuHQe7fZ/psN6+qWsEpMg127tiMwB5+yY9zFIHFDXL8qPf2IcfaHh3GnXZ31IXwSoiJOLRsaLRtcTlLpDW3SJTRHdLxmTrjdyuj2xAT77G7+HfchSIf9eWsnU/VmxY5/wjIguKwuQlsMTj4Lz7GSm/op1ycO3m48z860m7Wu459UnM/k1FetObpk87vrr+ebIn2r3buXmYHqNgniLc2+n4+ql09YZzXTdiUInSc7Lk4PoK6tjcLpIs311fukY8MgwMixxthXgQyYUmcmVmW9f6hMMeEExRqVJLHkBjYmljEGaPF13mKCJTmXSDwMvz9D7ZKM4dEqfO+UBJEYjzv6CrRd8irDJ2f7pG0u2wPZu9KnTqHZt4iofFi99HoEuDTK6qb0RscBKZwjUs57OfvSS/sYP1Zf6dtxuuzaFlEO3d2a4gCjm3G0PqaypeMb3pRkalXQ5kQVh6DwIT4MzfYVUawY6vrEhH3QjXjoH7MqypW84WdLmctF7AJroH7C1OAI4BkHBfXDGrkNZdWMPHqrRFdnVUJLmiBn2Kdu/DuZUFNJY815CsIpgDDNGy+TS8tk/RfJfX4wn7+hQnPSS+wL37fwav392Bd24eSTrTFHvv522xCn2HmfPgtJmIauWgYDIwRWuu9YPJM1skeNGKYrWDM44j6QNqzgGJ6MGrYNuMvbEd+ZOMKRd2iLWQyKlw7Kqyqc67CKyYibfo6d8YbWFBa5eD4rgPLaXY8fTOxX+JBw0+iWRxfnQ5DcJUhQWPcMvYSycJmgboCQNEuuyg/7JY/+gqfHRpt4UJk7GOA9AjA6kkktGZKSMxIgifWm/ofUcGvwhqYmrkrFTERc9JSZ9iix5tbUPMF11PHIEpHTF2WOhOYxxib1Bls7g1aPMkhNPSRfxjl/5Mj6WLhNCJMNjLKBnyI1daqcoUFbPlkwynHtT/0jZJSUkymKh6VSdqwMQAh99lnOyektb2H8Fr69NXvEfHtDbfCg4ajnSHcajMh0Xco63MKZzbF+2fIKfP/prHPhy+PgWB4teM9mt4yQ8ZGBWAhes3GbAMCIZqBDDI3Hxm1xpg9fJujtUBpE0IXMALaWv6sUX2iQxvCZ956tBghmC2q7JTzv4iKKp8F5HduT63rKDaNbl/d3Cm9B1jVkyDKZZn1ORu3YM6YBBBkj7EhM21K9oarnGhE/W6LOujxLUAu0f7Q6KkBktQIVwyGSbAC/fzN7PF9vlI4zGsF8+izAVKAhv5WSfVMJ/5EtX7dInKTSxsxP0esZRchmRKzb2O4bKDLn+xk6P0Q0NPslE0VmLEbw2OK4ICetMXo8PhVg4O3IZnzS7TzLxD07OVqPYMYBGBbFdIR0tWe9/9QPbBi41zSltM6vsZPrXKa3LM5ks8onPP2kLe/x0HN9s6lvpG1M2bgIYRvNN1ewE5hn4d/Ade2eT0N/DCoBeB6M67PZdp9bqQH1EkCtq+j2Cvzss/qqAGAORwJI6ToVJZ4+BRE3egomDS+JQnVkbeCW/7I6kcsq2bO8TTMh0pVCtzH41lDN+ioNNu68kMxvg86vIZ3fIo5pDt6MSRl0lUrFq1dZZYmtLisgeVGFBN/6pCUpP9sBUmP3hHM7OnxOHyA2t/FJoI/zwVN9L29ihuFpHlrSKVm6x9TantLVc1V2vMEpO6VQBIsbE1r/df3F1hMAgP/XqVxgjpA8HLsAHJh+S9Wu0SdaHIvol7pcwobWO3HVeSVspAHuhIo12+D8mvV6Xrvg5U4/pia81GcKyk9SXyo0o9VKMBWQrPjZGCBJhymQFFahl7L6Krz7nF2hX+SZaIFU2bALobht6Ts55+ran8OmN6dkHSZu27ZPlhcXJ8ubfx7l/RrDxjQ46hwTp28B8Ak/P6TEjJQ4oE8ufHOPB7sQoAA9/DZzeTXQEE4crZQa2wiAoTL2hKslZTUQbnCkmLgDFcQLDmZf/sW1s8wMYRJ1WBl4GXiYPv08/rJ0OHek70Mga7AYJ8uRBkTFSujkb4VFloFgpw7KKAym3gJEHWtsp2pCGNB0oO0ivfYsRmaPfOSsH+bFN/i5LctXKLAx8JhTOsSqkInhJo4+V1/VrXLFx7GNedNLCMHxhYsMTETKos+PXdomI7SxYUbzaI2XkiKQRfvFWbQgLleb0qv0vnMfo0Ab5LamMBr6FVl4nhPgAuaVTfyBL26OiZBY/dZv0W5rEfddJnPDdzNM/a1sP/H7bvIdPl5n868vk7Onb/kHfPa+HP/j6xuwAzrqA5D/ClzRMGx+h4+Nz0/b7fIRyM++fPo/OPyIei0PKeTUr0sE+WEAraLpjE8wJrrWByYrYB9nBzgCbOAxg2AikfPrO4POfl59oi2zrbFZmOwDERrXB54DK25mkGSuvXEnOjIX10htSePJ0YyaBKIgs9ZVtKoHFfth3SdQzWxmjtPAGYQwuOdEUXtARZtKnJyWq97GSp1hj6pChW6DJHfUkvXYo0DO4+C1VAOqM1UFbV0wdOMdmUQil6O34CrsiUWO1kVZwVGslxw+OjfqREeLYpz+kX4OHu0+oqafPSE8/Oy0cyqhJiXoIBYigIa0m2s/RhyEntEWXSzTp8x9mQwgxYYaV3onLkq/h+t4xBR+EfaqxGBNCWBMH6ugxN537Bm8bfYBr/EX4TfojP/u/sNUF9etyn8yyMRPA9pWzR+Ad0Vh2BPwsEg6b/xBf7cTbHKuXEgzPwnEOc3Iirq9xAN2dyzA4fhkdb9bofx3aBzJ3fwUxEDV0UDrYGUDqCVYw0AcuguIxMmYNKtE5kCIcVFcG5Ck8tmGXuvnveRu9gmIX+qxG/7CbQEl4dBlFAF1iaSZYrjAXv6spfYq66k/xUVeVTtGG1DlA1x1VygPXh4Wr5LepJchN4oHE0PhF9vQToXbGoJdZYyye7ZR6MaqaOYJIRwonj6W7KS0PXkKJGxNV7JVQGbKireuVLMMkC41M0ggc6N5ZcAqBFxHpT/oUCAeFiOwE/VT9ps/SKhvm6LJPofcQFLwYgL1Fytl+0og+fRW6GqdUh3+is/cJCcTQNZP5lRv4yPJO+M3BY+fhlsWH0ATQVnfpgOMqmTa5WTid+xq+/IPVyXSJvH4MfnoWLtuq77prU+ujUoPkVEEyze4WZ3AcfWD8VZLVANpyPNLqkWP9cPDEdBQrv5hig8GhhERGJKVdqyjgHtPSJIh0AJ2qr/kyMNIECKEy1JGbf1REhq8SUowaCmoD3UaeMRdMJ+AkUd7KSjA6GULUJ8xazRQPfAhUaO9LBb5Nbe42KD/BW7Ire7siE6/LSR9n9TGRyFPZXCukPitYnW1YK8b0Rb0ZxzW1Ua/vYmtGssuhLkwJIGeTVGFrggcXrZFbmkpdLJAzirLzwFfxATKjy/5hfiZ5HetlkvrSpy43xuln5MjH37hpOs7RJ1zeSdtPV66ZzC1/kY82b4LLr/zi5t6wh9axynT++HPqWLLW4Y8986wjPu7qMt+WUZPxcbOEcNq2zE0nOudOvkDxXfhnL3dDuTxoTAbtnPJlF6nvGZQRGgkktwM9Osd2LYsRxpSra1pQQgYvo9elmjwMbOB15yiDW8EvTS9OLjRLbwV6ZAMfd56HDXJkez7sVIcJDG2E5wzAokwFRTZncdojzqMmzDKPaoIbnRLwquCt81pAi4cx+uV3pUNu16XI0tflO2ihX5dYTiRRrn/i5bJJZnUrnpNHfWdClgxog7ctXPKiXLO3cDOwRJTiUyR4QbFJYTYVZL3a6bfVmWjx2gwwSqu/qQ450mfnUbIy5v0yLRESP3eZSfw+Rsgsf4LrJZd4CC87wHs1rxtXJ3fgzmv4EpNv8B0Fbu/NtZ2D74TPqxO+gebkl42ZADbRWZ6Ie5DFDxLt5jKBr0aafAAP30sAncOoPo9R2JWtmOHAYJbzjQBHtl7ZLmcW6kkEOBQ9yGIbzFKnEACusPXBEd+SG/IScrMBrru5lRSlA0r4as5AmoEk2gDrlyhKOmgiSTQCGoE2rKAd82CdxSrMsSTnsnHwuWLXCghNKUmAplfDMdEhsz3t/bWaFofwcRBmPW0aoe9tEkov1I3CQWQnKeaGVVngSe4laaCTND7VbojS7jxdxUic+FI+V1xlDnuoaktyfpyjTH2SYVu3YSZL9iA1zBiBX93DLg1RP4eCi0wHuh6aw9iAXUCUI1geWjBSK1slD67dy32tD7C9v6Nt4jvfS5pv4z34MlndkFzdEKFtiQlA35+0osf9TAFfrjedXMUsvBf5T8XBTxvb1ox3RUnGLlWT0ZHRlp7gDmCy1QETB2NAqQtjsCuyqFdkqTxjKSFlTC7VAgVaTZmUcqOKusioN3gsPWBGYIYB3ZHZEwTCwSbHuDOfILVdghL45d9uKzKTCNqBvEFX+pWEA2IkApJcXZAEVGNDVWkA8F+S1FMBxHlkmiJtelY0MrPqkby+o5NVUgILp6ywEguKS2WOxJxzXyWEg6F4c9QQeeM36/qshOVuUfreabrOTIyKko7xGOOTcZRGGWOcaUcaYDsjS6o5CKMEqBz5pOcoE6V+zHbySZ51+TTX9NtBu3qc2PY+ko51mN+QXN0QoQwu30zSPXSsfp0oPg52B8CXkUzapwi4i9r89LkZGWU5cKrugZyTAxjEOEEEouK5AgQMbA4vJfcWBIzgEMprJFHqgAz8gJHhJGPDSUdyS7KCtuotOYeQBkRhpupuQbLOh7TgK9CwgWaCL8lFfdihvCGDaswauMjiUMw5V+96H6Xv9gwWm+oOmEPsCLKT0sk0+0qqiprAoJVJHlXil9kEEmH2gQq2VD4LpO5kYC27A6Xp0NpteNaS5J7kuK12CdqvD1XEyUOJow6/vkRJeoHcDD2H4pHeojDPnTZENgUqL8po9wkBeVGh/aENH8atfLDN87Te3Iqr/IZcoyO3Cr+pOaon87wxE8Cmtt+x2PDCroCxuZMbXr/LqD0Ofc+pAEK5QdUDamZHv6ufwWQMEyja2W/0JEh6MGQllSQBkQqBTVBmWw+zdMZBKGxTB1ZbQ4OYtoEDLHKjD6AThElpKRE0FdThSdiOS2LIX8ydK3zaHnDsQx/8dQ0uuCjLBhUZ0PXeep+psKuohr1Ddng0RRM4ZPVWIvL9i970Sf2dUGYZhr1OoJbA9KB9sD14TO4qldS9ob+oKjYEnGvV9QyHLwvw0d8iLD9bD0X4K4kLAlSE48PJaqdMHwOJLhD6KrQcxo5HR2TSKb0M4kcmCys3MYOZ9Cdni6/qo5X5qd88e9KLWXLyC3c9T77Qo0mcOhDfICquIKCuc3ANIhNvBFAevHBMFZPELBoHu7bABpFIXaIEGyD5L/qqusLkAZpQlMCQJCqlqVbYvexQnoLlc3WyHRIOJvEI6kyYwtTbk60MsllFvjS0ERrgsR05s0QdSQZe8SmRox0CZOqqaWcVHvLDI82avJqcSkzeOhTbV0bllUSOQ7a+pS9RKVhWV1Rh/g06Oeu/WNNvaPVD/JKKDZo1GiWsT67KUb6usJoXDW0LosuhHp1OvNTLT1RTbAPt/Ygc4NLb7zwXAl55yqd2Hdf3V0w2cWOvkj9STslhdWMmgI3ZAays8BW4jsypLlN2BBN/mO+TDODLGdztI0gd/AogR9RQ7EElnJIVJTsEH69l4siI94BNsBlAFoKhB2m2g656eSzYCAQtGfJr1U/0dDiwgc9EUHplGMlbmaCOXiSRyckjKzi6lJ+L7hIr3t4YycqxH2KGKpsG9Ey3NPwVmfVBHbOho3P2yVJie71gvtMx9ZeJoqG0xP5SVLpkLcHosULJtTj0vVmJDhxdkaLPtFNazgd3QN0dZi1E0lHnFXIP6gK5hpewKxxA+zaM45wJLmxDaKniuEbXGveceDZ/btHftTw1K34MWHfwewE2oGzMBHDPnm+23Rt7SXRkXxgJbRuB8ccM1uOIm2cnAcKQVCFAeqBldQaRgGDlyKWAgSSMVw+aCiMCpyoF78HmkjULonVBOpMRWfIW8xCbM0RZnbRHgCXm9yAOb4EzIQWnud1+zgGN7T30pUZd1A1wKxKJcGm2yh/pFjjHFCmTTPikzkUnmWV0152UjUyCVIN3UrAPaarRpOZsVaDMTnoRrM0w9kupeoYDeu0LbWezb67aThwKUr7zjjqV6yt9KrG0BPCqPq+9YwGfdJY4i/HSvoDsq7IVNvBKoR3aSLuaFf8maryV1+UU9ak9zpNTG1B050kvk1fwrcGTySm+DDi0GwzYdPWrjOWVDHZuShr0/iUYHeAx7rLSzOIHcWiEEbS1gnE2yKXPyyCW31ABN+OhTZCGTn6LdAo3pnhFdnQDi/xAEm9SFr3E1H1ZRLjXTaAW/VAiqn50UkJZKkO0K4zoqpuGYsHF5hB2OHQYVqu4smmnP0Uzs0NxFmml8UNOJjX1JP/oU/QHXLZkj65N+qbo7UaSGaj9iuj0d+C7X8euYazamUAgVJfy7EuYlaMwC9Z1YF321YQQApRm8uwKvf8QfytSfuDxm3autiV2Olfyq0P8xlse043003TY/0C/9fdY9joyG1Vw3GkuDvRklW3b6pUM9Jdqoq/gStQ56gloB15ag8qaq4RtjgRfAs1VA5DBbkjlkWN5DTa+fjyBI7lsCVhqYQDgzkKJ0noCUbZILGrIS2pJUqSD35VPuwxMkZb+G4KZcCK0rn27dUWDPkWMySOsSe4hB+rYRht4Sog4jAkHvfY/hkYePNJgUzjGufsq9sVH9jHCyuYuvpjgj3ztU9fQ3WUHJg3wvJQjTW9Ti8/UKT62ixfu2YlO6hqfma+dbEK7XqeEjq2yo0EpX2qblq6czPMb5GNCE3q6ynS6Ybm0cRPAdHrL6fLX/fVyk3A6/TDbyY9X9DLYJpXJbUAYAAx+ht8kS0BUQhUdgUSiSJLrVIM3wQ0twMRytsE2lF1Zkaec4fHdA5M+8iGxFoVJFAmABGjdqvZU8A622VneBLmEJbOnUTUN8pGUoVN22SU5tZgedfoAmvggmKRM2SpB7EpqRASQ2Bm1MVRpCpXYs5dDnDRN2T0Rg4qTQErqIXSluzyLT7Gz0Gv4AJSnKnRKUROyArBNZdFVuCjXDsktnS+DNOMvVN2nMQUQELro/Ti/QvRhBJ+ua9gybv1x7ti/v7Ge/ETqGzgBzN16IoZsOO1klUeMV25lYN9tmPdQo2kg9cAiDmZ37QkIMMSYQYabDLaCVDTmrS4pxHPK59QTQIB0qwkMInyAREmXLKQRmcJKhgFYNtm2GOiemTy6/myh19GHSnKvlStDaNgXT/ayziVDTJGtBb6226tQSp0eJqEARZXYmNQB2YUMm9dwsVVfKaH7s3e4FMMeTSWsdJVDYkOewJQ3uqCULnWNss4rsGgoF5cUjtrPxOc5PNBI7wQUgOeiEjrGc5b4+rfKu/mB0Vth83H0M6esTG/dKGNmPT/pCubajSdd5oMWyEhPVv3VSL5VlVDIykFgGFgErcFRBx7msgE84ZZ6tUW47a4E7hNJsQNcg4dOIfIamL7DkLIGM2zVUcljPQQ94aAniPM+uUJiC/jIswleRhMyN8qkKf7EPo3kDAxDxphsZh+ekjzEClVe8UcJyRlVwHLu4jO9DIN1Z7DdT7Rr+qGtT7t/9RVWxF4pZ5cUcgvOORQ0er+Eao9yZj7qRnAqf1rpL08p5Tfhs0lFePoBjkpEylcm5Uz339kWFv0Va4nOrDI3t2G5tHGd3b7jOgbBITzzyvyyqfX2bH0NDGIh720LxdrxI6M1MWi+0AoYoycrqLAknvT2tAQl6BLE8iEvwTuiUxnRoEJ4VGyVYZBdFip1f8E2f7IMJPrqLjy4FZTKb8mq7FAqZ7zEqaMSuY6AtD+TUbdD401U7RJEcfX0PfCYKkA4PEJr90AtQ1s31dSTwk5EvDbLVJcWNEJb3JEFKKrUS9HGGW2UlrzAqloatL3jxyQWOfR5jFn0St37krbyBwydiiwb8VXctvp2foa8a4pJZ9DBDm8nlzam2P0NKZNn8Vtlx/HbgRui/HiEzi37m9Nvr6QhOA0u+IzVcVd/JF+tWCIVbGQRUCRd7QQILZMuAQaBwRgyg7VklmBJwEdoNGUCKXFydJhyaUZLgt3EQz6y6ilChVPnksOz4NJXQW5bdM4htdFXYBGh5uykYTs21WVGTS7A0JsvOEVvJabyOr0SEF4TQZcLff68oejliAX62fS/BiqU8mOLusqG+D0Tgn1VWp2rI4NOduFr5/rcwXjKURQ2jUuiMS6QD/Prt/gAqEsXTk1+YuFMLeTQRn0hqF3WBRtX5viQxBlcJvOLDPxqLgcMwEr0HmxGWQ/OShQ64sppJCWhrFbizLqYKLZFYvoagS+fdUUaeIFzsI48aWfbZROH5kiQyJAPmMNVK6C8AoUpIsjgrMnjpJT+pA9F6LGzZKOglrxg0IpkLPXoFCcoSSnKpAwVR3G2PZUMYXWJIUw/gRcVKirdxjTlF8Mp9oyzLX2Yfq6xdIMULBcvdUnbhWTX3oXgl/gT4aJDGzz08IzfnwhydfrOycIZnPwxf2NzaGMngOXp1RmDM/mQrR8/tZSsM4gSVQmcCjSOBhvwBJaJ1/M53ZI8kcaBVXXMAaEOLkhoOCdm+6oaefAK60EvTRJKltCq27qBW7jYEFEmmSuwxkDUVzv5o1F+eUObQ+CZGKhFnkqksUASWe4sMrEppfjqDA/2Ca0DJ3UEQNJlksPG0CgX2kwe8USpUdcQgB8LA6BPMl1Y9Uc9ivGcIl2YuwwnOBDxI/r1kcI1n1PxeUQ4uDFRxU+ZEPgpu01n6ra/etyPG5pDuGsDywsf/mmGY0O+z/ykWj2/tI+L6o8nYBM9BpovA2gtogzYtA3YinwrFYQEoiVbV2BJVNuyiHLigKeuXTkjI9f+UFZwQhu58hDcsMhYCa+OsAea6/Goq8A3CaKjsBy1WRaY5DMBChCKTAzUxi4h+kwujTUxYzR1kqd3q+QLEqCdWeVl0UYmIiOJ/iUJAwPuOyX2U+3yQld9pREceAunuF3ZvqTzb/i4k9mtKuCwMbqkceJViHq0zRJeYbyiO0APgFZ5q48xP+MLH3vfd4Ac2rgyc+lGqJhMruRrQR4CuwCjebJyI7HyJZMggRuHEIgEl/kwEjtxRkzlup9grcCzDU3aVkbQdbztHszyZatM2yAGEZEhsZUAJpBhMXA9eTDfNKSoASQJOz6jqF7bnVHRYQQMKMmuHOExtug8+vx/fRNjscx2Fia2MlzdI6t4rKaoj7oJrj1JWpUBUUVuZsbuYlB3anaGenHKa1tBJrZn//3WZUFKLdzsvgU0QKpEZufLDNEx2qMOZGc8u12AvtQmS4x1pqwh5cw8T9rV/ADog/9qnaP0zuHZ2DKZe+/GKjhJ0n1OYG75fUTW0tqWP7EIyKQloox2g4qSu+AGVdoEGbi6Fq/Va9zZjwTJEoAwJsgJ6c6XwDdws0OI6EqmmR6ZkZ3tL3X+Z9EfewBk9RZBka8HfyDaZcKh0IknLNrCf01q8qi/2rHTpIOwEm+d3MjvIZPsihCgRRv5JahslHXYre4oxUDlx4YOU6TuxQ7t09ZMjtKEB/ngs2uwf/FNx4Wx5MQk0BaxHv3gUtlFc9qW+Yqu9+HuM+t9/th6mMN08t7DQE8qqI/mSZV5sLDvev4nGIg7Dgaeoa3J8i6C6A+TlATZCCJjzC/vNChNGuOvLhds2wpBBSY0ThhCsy8Ouie8dV8uPgg3bQQYuK54nvNAES2DNkmiaOHSJXsdMhkQ4O6kjIy80fCt7Eo2+SBQltUcijU6OVSSVy+clORTpmJrIoQtjwvLLx1EyqlM7TLhGnaQxFHjpNL11luGnR9CUUWvLBk5e0kQB9gseUWTnkAPU7+Mkrns0DldsRNc/K6c6q+ck9XaSYRsbuUddOrMecIP649cpne0jz2B3NnYYjRtaJlMXueF5FUbquQkCp/M7+f57+nVicUEZ78OzgrqTsDE8FufCDQS0HaugWNDBZ/VhGWEGIwVkDZr1SV8e5CGV2KSzACGoHMjG7jyUzEpRLIUhsTqOnwlcrGHB7aY34mzC1CCevt8pZVF21deaQGMzzlgFABA2WFYyX8JljaTE0AVmZzKLutAVm28Q5HJyw5Bo7zYO+g9BxY2Dp71kfq7fOXpnvRHMA1f8EZvZgtWe3lnRWJe0cul6Lwf532IlOn0qsnryJ0NLnp448vy5E8ZvQ29ljlpnTCC+Pgngbs3KzBJkOQxCUgO4y1BNcuGmhSCEJeXgVdBnng1UIOogDXpTHZ3ERGXBKMWYkmLPzL7zbK11b/bA6e7hKyG8Kc+WE0WUWtLLRhKGV8TS5rQBc5RG9brEj+zhwZ9qISkD9KRVDXpULcXnlLDvl6zH9LkF5/6BOGEUMkforIRRZGSJAYeO+0nDho2rPdX8CDSSTgxqe6d6GdL90fvL5R7+ZLOm8aEVjRn8nF1pS0v/OmpsHB4bEN1TV501TcZoQ9sqJKTKnxl++pk5U/yNVjJgrWJeLY1R19is7K5tBcgq5nIBLVnA5xgTDuUul0EyRAegVTqv1bDWTIAnk0IEo/Ek4eSVVJGpFNPKsGrLuVF5pCFnGD6hONKHDrxVuwmiW4ymez1MWIQyM5d9xB3OkmT4FToRHY2wxaEOXmmz9olX+e1v/LZrL4L6GGonk4Hlvq4lLKlUWuCdIndy1GUfxHYBeQkVNV8mcfp/0hvrD2uw2TygckP/M6GfP7/UP2nZAKI0qWFd/QRO9SGM7I9t3BgK0F83bix5+pRO4IKYJM3qy5JlC11D86kmMFn5PVoTrjH0wapyZFMS79DmmCFoPN5qiRUhiuhiYpAE9VTVlOqCXgBI4GoKjV31U0e4WhPwougNZsMbInnpZ0mr/J45a55BNnUXlXHgt6l3g944wO0Su5bnJCmhF1x/ikg7yQoqGR2sjqJt3AuW23r34KnpY3y+hfh1bf4NrQBKiT2FnFg1/GM/0Nn61/XVe/QHaei6MVTUiYves9NBOqHTomyk6KEVFlYvCbbXgKxPliSGOVgUggz3Ax+2iM5o1u3JlolSPLkhp2Ry2u8xRUa+FzNpPNU1+rwQzpyVZFlh8AIlDIE4RnzSZZFE19hWiaCKqTSZ1UXmwmjywptCCCpcMiORZY+gQxDaiKCNn0ou0t2iNHgX++7cmmVcs4lWgiwQnljL5OUejPBdD/Gl9aHPTJ1vfor9UDKd6KExWFFl0lH2rmlj3WEQh4CZfKhycvfctOpMrQPyylSt9z49t6E+ylS+CDVzC2eRTJ8ZFx/z26kJQBd/WoFFJ9rUAN6ZETFId3FxbO719WsDOAorclAMWkreQAIFkf+1iovSMIZMXBg0GiDnLVSF9UfdCbSAAAWR0lEQVTYtVQCjVUa+kwQyOV/iMrKrwHqFLwuiYTYlDwKZ2f6VAagXy4p1B3K2CKpzWDcXeCD4OlTJbA2Q9NfkVLswMDpUzmsd2G6xEY++CMsu5ZiymVFEXab0Tm3+hG+Mv70fIdfbD7RAx6Zm5Ijp67gpVNXJt/z57cwgA+ZdwTimc37byJv/KP0u8yM0yyZBI8k8CydJ7a82c6Kn61kBGvkzE4gHQKDfeBMFiESAjMDE/l9tTToLcKiF5IOckUFGlzdN9AQAUiLHAhpZwpGhwk0e4suOsH1+wOyVUIXT+xEX8HEIjN2UbV0/sj3EPu67TU7JplDGyORwNmX/Shf4QVFpxdcTmijrcCgUWx0Siczbb+oJXTYqawUCZlx5vjq7odU4c7/y95yy6k0uYfOKVS5c/5yRurMfzx4uIRnA6h+0CTzI7IjYfPlHEYkQefKPUsWYNazMhqQBueYGCQ2mH2Z+ARxoYBLJ1oAlcjjbrsialUGkp1EmEObTwRqg/DwoTsZJVPZRS24cd+glChVZRx5pQiyBNATzHa3x6o2F1mFzdhpKMi/JL22xwYoVeErEw3sMs/soxG7B0x+6hbOeZdEhm6PgobcJP+gy41MfSmzylRimXwQhz1E3vPXXh773bp0ubVTWWokT6HGybPeczfq3nIKVT54VZsWbzG+arub9KbRgw14pbxqwBGAxqw30iomR1COwISsJ4GQvAzavAUnquiywyC4XfEqeaWBwUdbswugnQTiDM+MD6WxNROMSQGTMnmpJi+gY1IZCZMJJwkE0iJL2ipVTpV86CcZCoE976g8qCMJnc8NTHFMavqstufdH+t05KO5ihk2WpUPGVnpk/yAQiNKK8Hxlz6lFUOFlJnxHzYvLN8i6CFTJpO3TF58pblxSouje+rL89/LV3a360+94geocW5xN4n9yQRdIm2shBWIdW8A2W6fE5QGvrURuYDNFLIvIZxdgbYozAQtnJAkJGxJ8hm8D1MSXx7pTQPkZZKwaYLVK8keXUWqWOnrnoW2RwHAsjdmRKwy0WV9vY3D7tEd7Ap57uwrG56xO3GCCl3v/YyntIUx+sHLY93vUAyME+ey07q2KJsXjE5y9jmTXZc7Ex+ltPTzavtU/7kuhZz5ZUIuvOzN5sQpL3r2lJeM42p7E4O9Ib93tiEdWuDHH43XBGoqVA1Qgm6WqBXQ2aJaTcJKYpganMW/tr0VTjHATeie4MZwFZJV2Um4zo++4q9EzuqK/OjseqLNhD9ocpHfRNMeRI4bBxhl0ptaJpwrtpz+B+SZEjM80x4f/S3dYuHtO5ihstgNL/vGpODkmCSVnroCKdFVlbRn/lRmSKBVjDy2A9NXwrqtToIxuOMXlj8l9iFRpvzm39z0Tfg1PTrVNse1p1qp+iYv/IvbOF1+OnQ/IJ3z+/1hiHuyNY0AXeeYGZjUOY27cUKzknqDKkEPMnhOiVx5ePWVzTA2s2Y5acRnZR/yTfpekuTSl5aY0BfQyA4c6mRqJJeZsmfCIlVmq3vRleyuITTFkj70xFVbbFZ1J43u9E975fEsJdEMX2K6m7nG0yM9k50Tj49aK5CXZ19RVvoUX034aERqdIoPV/CZKAHBz090LzNWD5EyN7l88n1XmAunpTBip69MXvBevo2n/dXps+AENPupknl+DZaATNi5UiZJS0atSFWvwCcj+M/KKbInkgFeAQ2/yAR18Zk8FeRGNolahEU/45evZ0UmHofQNvCkB3WTMbyu6N6gpCThiiZ9sB8gxEmb5O1y3GLXH4Jc2Xs79J2vThxNRmaUmBLBypKb0ieTWsHVhK3aLpb/8XRfqLWhvzozNE5WMU5p4VVKJKRi36GJoxQoZvoBCLxbe+aX6fSvJi9/szlw2sppnQDS6/2b/y1D+vXT5oETUTy3dIchVoFmJQGXdq5LK5MCT1AnJqUZL6pkSgLWYHUCEZSl37o4mQAmWRieBDUw4Saj/OTlSOgZHlBuviUhi7wSDGGRVzxIqHYyVnmV6oH3CchpYmaDk0naUMQ27IztNJXlodsUOvqSXknLtX2eKhyTV20Tyn5ZtcF+po8mMs1e1BGzlRcdIPBvSACk5iXNrG8y0phffoh88rR9vW2ZI/ZPbzntE8Dk77x7T1uYvJ5wOPO/oWX+AD8w0r5ZwWniVEBWgpg0fbUNxjo0BrdB6uSQ8K2gTex3fLbu0I04T0LJZKIT7AVHiwkaYUAE8opoqiZS7QyEUIKQiCHOBLOON4wRDp00RT5b7SNC4SVrrQ8hnSVqzXfQzOiVZbt7xsyNGmDaYKddrXNpJBN0nkpATuktl0aRECdBEFJld3plCo486+IsfOx8Lm/bVvNMPU6mfAPV6usnf+e/7jndJp72CUAHTJ7LA0Kr039NzaE9gwuRNjf9mL8SZByb4Fm1TTLq+TcoIUu4jsA0+F29KVntXdWgkztMWQVLng/EhC3yQc8uC5DpZCCLBU+ZAGsyxKkXSGjAuVLSkMbJwb/S50k7JeTVcbn8ECaZKGlSBUCfBWaHosTwQCLY0tliPMDodOWPo7pATwrXzp68AYVaW53ESo82pdjsUSEoUA/SDdkzP69eA7AzFvsZd/Qjjisr//pUP/BzJD/UCB8Jewrh3BS8htH/96dQ5QNTNbf4jQQ5SVtJjJixFTVQCUpj1pIa8TjyLEmSgObgeYTqLOkKkKOTRJKh0ladkYPerPQwB4P80EdpCc3df21KAsaUmlqjlkO25EWbvmg3zdJr6hIW5lEUIt+zPFIM2tm1uROJ9LyY5NLnJCS0gq2rSj6LfMipvjgxVTuTF6SznA5xSEtu9ElQCOki22Zg3E6crNxe2DP4uNr+/eTvvpWJ6swoDNGZUyZ/+8/fxQ9tXn7mWHQYSxYO8KvDbX+Cug4c+xOCSZoepMZ1T5jEp0mSSO0JJjqJYzJAMVbLrLS2xYezs7mq2jYhB4pKEjPKsKPTKzsJKQS9IyFBS1Fia+hrRQcmnKzM3fuI41BiS5b44qaNlH5zMEQRCgE2R19ooY7QrhRM+qkM4IrIWR9IJ7jTK6OSWyCvyC16jhR47J+4CMp5/9zC8rbCn6HH6crlk++/4l1nknUVBWeQRZPvfu/bGdW3nkEmHWzKZHWByGO3AtiXwUqlxy5tE5SAtBY8lYpsUcUSZA9eaDo19KzunVcSgzyXDIFJv8Y/SxCAUQONckplPwKzVvcGFEgdQL0Vic3BC8g/uURfRkRkwip77N3YdXRKhZY8k1G51aRiC1vyFqeCu31dh1hLVv4kcQz6/9s72xi7ijKOz9x79263W9vapqxKFQIoxrQIAdRUoxYqimRrKrSJLxH95CeDMTEmBqMfiIlfTIwfTPwgiQnWUBSlEgTaVGpsjKAgVGNEjZWiNChht/t+X8bf/5lzrtvYl7vbe885d/dMe/fMmfPMzDP/eZ5nXs8cQohjtNBbGtDoCogxSeWDzzLS1aLEq/yBOmH/H7+CuvBDv3s/sl0sl1Z3obhiefAHhe4J1BZesBZQZ+gn0qqGKL5IkwiptUwoEIJtLacJu8mz9M3kV5N6Ft9oFao0pHTms5GFnYqjW/UINDkWtYKbJB98FsesTWJ8TLEJ1z/ITAUtfwtBh7QBy59G4RjOVF4midOk3YhMcYdH2YhvKaU4S3/yWE8BTzQKkQ/jXs9i9Kjg8isVMyai11Ou8Bex4qmVnavKp6ekYfxC2lktSWjsoTHwv3wiWBBXmi/EFAr4Vy3/+H2F3P5eWIupnkD4xU0zSM9nqe5iGaqhuaHQWKNXA+kIm0YkEinplYBzUUul/5J5WklTdp51egeJMojGtAY6KYjJuimwUlZkGRl8okdLRB61TJBERVWYUUux7KGfhJyjr8MpOJwgXpNXYyELNSbzhnnWwdPSU5oaxWhXTtvPS5t8W9apUuN+A72QMeiuJP568WK52bxHwoPii1V7JAOWlIMsRa7gGC/yawGi52f8Ur3pNSp0Ekk0uBg/8QkHQow+MarctDnnn688FczJemvMv3t/obr9i1EybBcHFM0fjrz/BoT4i0hLscZ3M5vGEPN3RAVVKwdyyUy/tdYCUugmQpzeRIWIihO1AwJ1lzm+2lpGxZMjrrWKUg6lowyIbPpnt2niCq9o7ftpJsFeho6l97CO+967dnWKvGCissW1q9eh6JvsewK03mrJoxIrW/V8cLAoLlPjYPML0NmJSKK38oBdOv+heFZOFVeR+Zk15aoewuLELB3iKvnA+fnDsy8pq8I4LfVptr9AE35nw8YgPduDIoWFX910mWuGr1DVlxSFr/bC6KRvrP2ECX0UQxNQ2ycPqh1lSIXYQiT0lCJ9rsLEG3QkPojjYOJbOFKvIYEmBlESpak36JLF0pO88KJxL72kthQ+67pkn1GNoUNtlOHaDfQStkbdFZ8qF7yqnGkrrTC5pFzR2BkQiX2gdHQ6ktgCgCRiR0XpWqJKODEWRpmGV5v3ceJvcQ7+8Gzy0Tp/xu/2C96lOqurpUbKgz48esuoW7PwefJ+Zx75/3+ebFKd3rIDidxiQivBliirZRKx/ujWGvvkWaqjeibDIALz608U9rTFSwXchgWdEVB7GgvAdmRa+kq7OAIP965Vm3TNoS0U+N0o96iVTkMBa9UproqIM5iEg7XoQg6PtebyGxgJJNDw34YTimgJph6FK8ACX/b16WPR0uh5zo7tvdrhV4RNPt0gIQQHyoUndu6G4TsRgaHcGZ/b1AzNoT2S7ijgCLC1+BHWeI5gnLiLXWRxrLY+bdmiVtgzBDqKPxRKD72Q3ls3OfhTvhqOomWEhOKNdc+oCL/gWsNt16y+l3KOpbiozPJbGTtSh8cKqgB+hoGZvqj4mmTVVIQeGQUYRQtiOJoN9eFBNzSb/1yWvdXHiz057+0/oyq6uBHyA+eYF9iKPN0F41fnyny7PuNmNt4BD5pCw3UkFS8iq+6qwpBjJFd/4n1CZ4pvc216TAtotQGNhNzoK/9EQZ7gJSTtPVAqg+PUtDeGZ1yr/j54f4NwsNKrjCkMusp1egCyehAICHDREmhn1UPxUqfeg0whFtEPzT0ARvm+/af3+fVKb45v9aXQLPW6GNalxs2V3nqXR3eOw8THEYXcBCBMb2ZWvXpLbLfgBsY0TxZbPkEkiBFVBDtt2S1M43pTALMOIjSahPwVEjhEN5/W3j5DFJ8P5F/fco0RegXVXZR3k2luAkliB63IEaJkGGDjfBFpeCBNj70mmRDZRRNa+9N+3NXn5vKDhWO8OMlHh3nIhuXHx/JzNhiXHz3/mOGpXRvcVOtOpOLmqEEZ89SuT7uZ19IL8NogROZAalKKRHCNACcwS0qSLq11h20fgZb2EukJfs5XWj9H8BWY/xCnl1CGSiMsjLBAUfsQAK1JobIsNNZJNDsiKLxS/BJ/alE1GRrhbLnhmQNEHO0lm92lJWbDYZ3hl8cxXt3x2B1VIpndEReZKhxmpaDmPoaG7UB2snUzW+osi31Q7ZRthZV8pBK+mBcLJoD/UdAlR0awQIv/uKtqkq9gy529RjJUZ11j7SirGx8g6bqAEBbqGUSo1L+PPutVqTeQbo8G184LUJX2o64+u2BRM/tjvB2Dn/2DMMPfDSwR6W4oB4QmHNp1Bd+B20M//D2MDZOxeZ+ZZy4gzGzew+aZup3Uq+yskeBqLVfs5pugo/Ba6osuTEJwhHfY51e84icl7lxkCBZGhlk92EnYehvTq8cvaGweQBB2cLIw6yeJILgFlP8nDJEy2hvCt/r4XBcZP5jlRzs6WPXRkyLcxyzySTocunmzq4UPo4AaGjD27LOb2dxgwuujnW6/NgXJCEhg1e03p11yeCrhj4Q+y4a7Ye7yn8GOzOX01zfbC2vnme64ho1PbzOB1B/hpCs9gOjlr1kHAivNHzt2Y/afYT7RzVd69aHOrL7V1/8ynZmD4X1m0Mq6C+FrFffLo9cyNNiJBN2IZPVnwlBfP54eIx93uUmuSS1/7ArMbfcC3t/5WotDIAbpvPoM5aFdn3KNNSOhXbue1cE3Jh0B6wl47ZRsWe/phBs+/QzGQN2qPjhN7Lkn6YUccb+96pksPtHdh0J0neSKNwCLkQhhb9Ud+fc2TiC6kVb5Gir6MjS0dxg0RifC3PpPalKPdCdR/uN4X2TjTpOeSH+25y4u4EryNzEGzWHeRaheyrh/G5iuN1hrCz3e9aeJBXcCg/Is8D3pZueP+30HBuNT9j2o794Jfw+YyTqJ8NT4Wjcz/VZa5yuZL3gTtuAyxqKvo8lZ2tdkg38V3k/ab+qSMZT9zaXC97g2ZRDaa553lblTGIKtKO1WlHbjEnPhHIfwEnV8wrXCP5iv+atza//kx787OF+qWmKBL0S+qg3AucAJB69f69aPbnbVKm+/uTWMQ4dZmauzMNd0DX41XqdttyZR8lfdS69M+H1/6MxGh4MYldrItxC0sXOlX4YvAwHvT7nm7F1+/GBHWcP9e+tundvgWkMbMQrrqachDDlzKtUa99RJe56e3hy/SVed/s/iuMvgYEVGKQ1AH6o1PLL3anoV30AI+zRO7QPTRU5Se6or7kv+1gOD8zWpIuO5iLdSQBeB0SuvCWrFfa9X6a36dMCyVP7+SEFpAPqDq0NgHyLpx/qU/GpK9rEEy9VU5szKWhqAfkI95b7DasDgfKeun1gsK22wMwyXFbmM1AUCpQHoAqTlkthy0pS/h7mA55ebxqqNJ8zAbjUtyeVR1+UkYAaoh5/ufo0bGv46WbHvoHRdIHDCNea/7D/y0OkuaEuSi0Cg7AFcBHjdRjVBnnJ3s0OQdefSnR8BMAKrUvnPj1KvnpY9gF4h2UU6tkegMnI3+we2dUG++kiCP+7as/eU6/XZVX3ZA8gOa2eCfXLjV+kJHM0w2wHJCkzAplT+bKur7AFki3cnt/DwvtvpCXyKgNVeB+zF99/3t91fuK/mdCprBXtWu/DlWrXh4b3XwsAXMAFL3dOeK989yzw4vUPxTX/bgWd6lmaZ0JIQKA3AkuDqPTH72Te40fA5XmzhIyOryIXwGzftv80y38QqKnXhiloagIJUSXjkjps5xegzbBwq1nn/PcfH8xJV+15/6wOHe550meCSESgNwJIh61+EuF+g/mmmBXRe3spzwR9yzbl7yyW+4lRtaQCKUxcdTsLPbr+Cd9XvJOC6TuBge57mdWo+mvGjvw12MVYe96UBKHCdMkm4nd7APlYL3l5gNs/NWvC/Z0hzP5N85fsQ50Yp1yelAcgV/u4yjz0CzyfI/A4OKMngMMzu+DorlefIlBCOcQgHJ+iWLf5ZMSpQYGkAClQZF2LF5giqwzv5DPkuWtbLL0Sf7XP/d5T+kGvNHynH+NkifzG5lQbgYtDLMW44uPdShgY7XNW/i17BVbCSdV3qMM2/0Nr/mo08x/z4gRdzhKPMepkIZC00y2SzjHY+BNhLsM6NuO18YWA7yviWpHfAdwV76jhjj1behz9zKuJzbtY9xxr+VE9zKBPLHIHSAGQOef8zxCBU3WiLU3NrWzEGr7ef58OcbQ7Q9PwC5sLrAM1kPiHYuL3B/SzPJjh/b4LrKyj8v+wXmifddPVk+W5+/+su6xz+C5ElLs5GCBdpAAAAAElFTkSuQmCC';

    function IslandsHeroMark(props) {
      const size = props !== null && typeof props === 'object' && typeof props.size === 'number' ? props.size : 34;
      const hostClass = props !== null && typeof props === 'object' && typeof props.className === 'string' ? props.className : '';
      return h('img', {
        className: hostClass === '' ? 'isl-heroMark' : hostClass + ' isl-heroMark',
        src: ISL_HERO_MARK,
        alt: '',
        draggable: false,
        width: size,
        height: size,
        style: { width: size, height: size },
      });
    }

    function IslandsPinnedSection({ useWorkspaces, useSessions, useSessionStatus }) {
      const pinnedIds = useWorkspaces((state) => state.pinnedSessionIds ?? []);
      const sessions = useSessions((state) => state.byId ?? {});
      // Global slot props carry the unified status snapshot: running turns,
      // pending interactions and unviewed completions per Session id.
      const statuses = typeof useSessionStatus === 'function'
        ? useSessionStatus((state) => state)
        : EMPTY_SESSION_STATUS;
      const [host, setHost] = React.useState(null);
      const [collapsed, setCollapsed] = React.useState(() => {
        try {
          return window.localStorage.getItem('dsh-islands-ui:pinned-collapsed') === '1';
        } catch {
          return false;
        }
      });
      const lang = useLocale() ?? 'en';
      const copy = String(lang).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;

      React.useEffect(() => {
        let current = null;
        const attach = () => {
          const header = document.querySelector(partSelector('section-header'));
          const tree = document.querySelector(partSelector('tree-body')) ?? document.querySelector(partSelector('list'));
          const target = header?.parentElement ?? tree?.parentElement;
          if (target === null || target === undefined) return;
          let anchor = target.querySelector(':scope > .isl-pinnedHost');
          if (anchor === null || !anchor.isConnected) {
            anchor = document.createElement('div');
            anchor.className = 'isl-pinnedHost';
          }
          // Sit between the New Session row and the Workspace section header.
          if (header !== null && header !== undefined) {
            if (anchor.nextElementSibling !== header) target.insertBefore(anchor, header);
          } else if (tree !== null && tree !== undefined) {
            if (anchor.nextElementSibling !== tree) target.insertBefore(anchor, tree);
          } else {
            target.appendChild(anchor);
          }
          if (current !== anchor) {
            current = anchor;
            setHost(anchor);
          }
        };
        attach();
        const timer = window.setInterval(attach, 800);
        return () => {
          window.clearInterval(timer);
          current?.remove();
        };
      }, []);

      const rows = pinnedIds.map((id) => sessions[id]).filter((session) => session !== undefined);
      const pinIcon = defaultPinIcon();
      if (host === null || rows.length === 0) return null;

      const toggle = () => {
        const next = !collapsed;
        setCollapsed(next);
        try {
          window.localStorage.setItem('dsh-islands-ui:pinned-collapsed', next ? '1' : '0');
        } catch {
          /* ignore */
        }
      };

      return ReactDOM.createPortal(
        h(
          'div',
          { className: 'isl-pinned', 'data-open': collapsed ? undefined : '' },
          h(
            'button',
            {
              type: 'button',
              className: 'isl-pinnedHead',
              'aria-expanded': !collapsed,
              title: copy.pinned,
              onClick: toggle,
            },
            h('span', { className: 'isl-pinnedChevron' }, h(ChevronGlyph)),
            h('span', { className: 'isl-pinnedTitle' }, copy.pinned),
            h('span', { className: 'isl-pinnedCount' }, String(rows.length)),
          ),
          collapsed
            ? null
            : h(
                'div',
                { className: 'isl-pinnedList' },
                rows.map((session) => {
                  const id = session.id ?? session.sessionId;
                  return h(PinnedRow, {
                    key: id,
                    session,
                    status: pinnedStatusOf(pinnedStatusFor(statuses, id), copy),
                    copy,
                    pinIcon,
                  });
                }),
              ),
        ),
        host,
      );
    }

    function WarningGlyph() {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M8 2.4 14.2 13H1.8L8 2.4Z', stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round' }),
        h('path', { d: 'M8 6.4v3', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
        h('circle', { cx: 8, cy: 11.3, r: 0.9, fill: 'currentColor' }),
      );
    }

    /** Amber bar at the top of the Islands page explaining the auto-disable. */
    function CompatibilityBanner({ copy, compat, onForce }) {
      if (compat.status !== 'missing') return null;
      return h(
        'div',
        { className: 'isl-compatBanner', role: 'alert' },
        h('span', { className: 'isl-compatBannerIcon' }, h(WarningGlyph)),
        h(
          'div',
          { className: 'isl-compatBannerText' },
          h('div', { className: 'isl-compatBannerTitle' }, copy.compatBannerTitle),
          h('div', { className: 'isl-compatBannerBody' }, copy.compatBannerBody),
          h(
            'div',
            { className: 'isl-compatBannerList' },
            h('span', null, `${copy.compatMissing}:`),
            compat.missing.map((selector) => h('code', { key: selector, className: 'isl-compatAnchor' }, selector)),
          ),
          h('div', { className: 'isl-compatBannerHint' }, copy.compatFix),
        ),
        h('button', { type: 'button', className: 'isl-compatBannerAction', onClick: onForce }, copy.compatForce),
      );
    }

    /**
     * Turn the skin on only when the build still matches the stylesheet.
     *
     * The plugin's own chrome is plain React and keeps rendering no matter what
     * DSH does, while every layout rule is keyed to host contracts and skin parts. A
     * renamed anchor therefore yields a half-skinned, overlapping UI instead of
     * a clean fallback, so a mismatched build stays on the untouched default.
     */
    function startCompatibilityGate() {
      let frameHandle = null;
      let settled = false;
      let retries = 0;
      let contentSeenAt = null;
      const startedAt = Date.now();

      const stop = () => {
        if (frameHandle !== null) cancelAnimationFrame(frameHandle);
        frameHandle = null;
      };

      const fail = (missing) => {
        if (settled) return;
        settled = true;
        stop();
        setCompat({ status: 'missing', missing, forced: false, version: shellVersion, structure: shellStructure });
        console.warn('[islands-ui] host contracts missing; the skin stayed off:', {
          version: shellVersion,
          structure: shellStructure,
          missing,
        });
        // Someone who already switched the skin off does not need a popup; the
        // settings page still carries the explanation.
        if (readStored()) showCompatibilityToast();
      };

      const pass = () => {
        if (settled) return;
        settled = true;
        stop();
        setCompat({ status: 'ok', missing: [], forced: false, version: shellVersion, structure: shellStructure });
        activate();
      };

      const settle = () => {
        frameHandle = null;
        if (settled) return;
        shellStructure = detectStructure();
        const missing = missingAnchors();
        if (missing.length === 0) {
          pass();
          return;
        }
        // Siblings can mount a frame after the frame element itself.
        retries += 1;
        if (retries < 4) {
          frameHandle = requestAnimationFrame(settle);
          return;
        }
        fail(missing);
      };

      const watch = () => {
        frameHandle = null;
        if (settled) return;
        if (document.querySelector(HOST.ROOT_SLOT) !== null) {
          settle();
          return;
        }
        // Anything rendered into the app root means the shell mounted; if the
        // frame anchor is still absent after a grace period it was renamed,
        // and waiting for the hard timeout would only delay the notice.
        const root = document.getElementById('root') ?? document.body;
        if (contentSeenAt === null && root !== null && root.childElementCount > 0) {
          contentSeenAt = Date.now();
        }
        if (contentSeenAt !== null && Date.now() - contentSeenAt > COMPAT_CONTENT_GRACE_MS) {
          fail(missingAnchors());
          return;
        }
        if (Date.now() - startedAt > COMPAT_TIMEOUT_MS) {
          fail(missingAnchors());
          return;
        }
        frameHandle = requestAnimationFrame(watch);
      };

      frameHandle = requestAnimationFrame(watch);
      return stop;
    }

    function activate() {
      if (activated || skinRegistrar === null) return;
      activated = true;
      syncAttribute();
      applyAccent(readAccent());
      try {
        skinRegistrar();
      } catch (error) {
        console.warn('[islands-ui] failed to mount the skin', error);
        document.body?.removeAttribute(ATTRIBUTE);
      }
    }

    function forceEnable() {
      try {
        window.sessionStorage.setItem(FORCE_KEY, '1');
      } catch {
        /* private mode: the choice still applies for this page. */
      }
      shellStructure = detectStructure();
      setCompat({ status: 'ok', missing: [], forced: true, version: shellVersion, structure: shellStructure });
      activate();
    }

    /**
     * Plain-DOM toast: it must work while the shell is in an unknown state, so
     * it is appended to `body`, styled by the always-injected stylesheet and
     * removed without React.
     */
    function showCompatibilityToast() {
      if (document.body === null) return;
      const copy = currentCopy();
      const host = document.createElement('div');
      host.className = 'isl-compatToast';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      host.tabIndex = 0;
      host.title = copy.compatView;

      const body = document.createElement('div');
      body.className = 'isl-compatToastBody';
      const title = document.createElement('div');
      title.className = 'isl-compatToastTitle';
      title.textContent = copy.compatTitle;
      const text = document.createElement('div');
      text.className = 'isl-compatToastText';
      text.textContent = copy.compatBody;
      const action = document.createElement('div');
      action.className = 'isl-compatToastAction';
      action.textContent = copy.compatView;
      body.append(title, text, action);

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'isl-compatToastClose';
      close.setAttribute('aria-label', copy.compatDismiss);
      close.textContent = '\u00d7';

      let timer = null;
      let closed = false;
      const dismiss = () => {
        if (closed) return;
        closed = true;
        if (timer !== null) window.clearTimeout(timer);
        host.classList.remove('is-visible');
        window.setTimeout(() => host.remove(), 200);
      };

      const openSection = () => {
        dismiss();
        openSettings({ section: 'Islands UI' });
      };

      timer = window.setTimeout(dismiss, 5000);
      close.addEventListener('click', (event) => {
        event.stopPropagation();
        dismiss();
      });
      host.addEventListener('click', openSection);
      host.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openSection();
      });

      host.append(body, close);
      document.body.append(host);
      requestAnimationFrame(() => host.classList.add('is-visible'));
    }

    /** Islands settings page: skin switch + accent color. */
    function IslandsSettingsPage() {
      const on = useEnabled();
      const compat = useCompat();
      const lang = useLocale() ?? 'en';
      const copy = String(lang).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
      const blocked = compat.status === 'missing';
      const [accent, setAccent] = React.useState(readAccent);
      const chooseAccent = (color) => {
        setAccent(color);
        applyAccent(color);
        storeAccent(color);
      };
      return h(
        'div',
        { className: 'isl-settingsPage' },
        h(
          'div',
          { className: 'isl-settingsPageHead' },
          h('span', { className: 'isl-settingsPageLogo' }, h(IslandsLogo, { size: 30 })),
          h(
            'div',
            { className: 'isl-settingsPageHeadText' },
            h('div', { className: 'isl-settingsPageTitle' }, copy.title),
            h('div', { className: 'isl-settingsPageDesc' }, copy.description),
          ),
        ),
        h(
          'div',
          { className: 'isl-settingsMeta' },
          h('span', null, copy.compatDetected),
          h('code', { className: 'isl-settingsMetaValue' }, shellVersion ?? 'unknown'),
          h('span', { className: 'isl-settingsMetaSeparator', 'aria-hidden': true }, '·'),
          h('span', null, copy.compatStructure),
          h(
            'code',
            { className: 'isl-settingsMetaValue' },
            shellStructure === 'scroll' ? copy.compatStructureScroll : copy.compatStructureFlat,
          ),
        ),
        h(CompatibilityBanner, { copy, compat, onForce: forceEnable }),
        compat.forced ? h('div', { className: 'isl-compatForced' }, copy.compatForced) : null,
        h(
          'div',
          { className: 'isl-prefRow' },
          h(
            'div',
            { className: 'isl-prefText' },
            h('div', { className: 'isl-prefTitle' }, copy.enable),
            h('div', { className: 'isl-prefDesc' }, copy.enableDesc),
          ),
          h(
            'button',
            {
              type: 'button',
              role: 'switch',
              className: 'isl-switch',
              'aria-checked': on,
              'aria-label': copy.enable,
              title: blocked ? copy.compatBannerTitle : copy.enable,
              disabled: blocked,
              onClick: () => setEnabled(!on),
            },
            h('span', { className: 'isl-switchThumb' }),
          ),
        ),
        h(
          'div',
          { className: 'isl-prefRow' },
          h(
            'div',
            { className: 'isl-prefText' },
            h('div', { className: 'isl-prefTitle' }, copy.accent),
            h('div', { className: 'isl-prefDesc' }, copy.accentDesc),
          ),
          h(
            'div',
            { className: 'isl-accentPicker' },
            h('button', {
              type: 'button',
              className: 'isl-accentSwatch is-default' + (accent === null ? ' is-selected' : ''),
              title: copy.accentDefault,
              'aria-label': copy.accentDefault,
              'aria-pressed': accent === null,
              onClick: () => chooseAccent(null),
            }),
            ACCENT_PRESETS.map((color) =>
              h('button', {
                type: 'button',
                key: color,
                className:
                  'isl-accentSwatch' + (accent !== null && accent.toLowerCase() === color.toLowerCase() ? ' is-selected' : ''),
                style: { background: color },
                title: color,
                'aria-label': color,
                'aria-pressed': accent !== null && accent.toLowerCase() === color.toLowerCase(),
                onClick: () => chooseAccent(color),
              }),
            ),
            h(
              'label',
              { className: 'isl-accentCustom', title: copy.accentCustom },
              h('input', {
                type: 'color',
                value: accent ?? DEFAULT_ACCENT,
                'aria-label': copy.accentCustom,
                onChange: (event) => chooseAccent(event.target.value),
              }),
            ),
          ),
        ),
        // Preview hidden on request. The component and its styles stay in place;
        // restore the next line to show the state gallery again.
        // h(IslandsUpdateShowcase, { copy }),
      );
    }

    function IslandsSectionIcon({ size = 16 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('rect', { x: 1.5, y: 1.5, width: 5.5, height: 5.5, rx: 1.6, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('rect', { x: 9, y: 1.5, width: 5.5, height: 5.5, rx: 1.6, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('rect', { x: 1.5, y: 9, width: 5.5, height: 5.5, rx: 1.6, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('rect', { x: 9, y: 9, width: 5.5, height: 5.5, rx: 1.6, stroke: 'currentColor', strokeWidth: 1.3 }),
      );
    }

    return {
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        ctx.inject(['uiWorkspace', 'workspaces'], (scope) => {
          uiWorkspaceService = scope.uiWorkspace;
          workspacesService = scope.workspaces;
        });

        pluginCtx = ctx;
        localeService = ctx.locale;
        layoutService = ctx.layout;
        slotsService = ctx.slots;
        applyAccent(readAccent());

        // The stylesheet is one sheet for every build. Structure differences
        // are expressed by the parts the walker writes, not by a release map.
        shellVersion = readDshVersion();

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-islands-ui';
          tag.dataset.pluginCss = 'dsh-islands-ui/islands.css';
          tag.textContent = CSS;
          styleTag = tag;
          document.head.appendChild(tag);
          return () => {
            styleTag = null;
            tag.remove();
            document.body?.removeAttribute(ATTRIBUTE);
          };
        }, 'dsh-islands-ui: stylesheet');

        // Mark host nodes before the gate reads them. The walker is the only
        // place that turns a host local class name into a skin part.
        ctx.effect(() => installParts(), 'dsh-islands-ui: host parts');

        // Everything below turns the chrome on, so it runs only after the gate
        // has confirmed this build still matches the stylesheet.
        const registerSkinChrome = (ctx) => {
          ctx.effect(() => {
            const root = document.documentElement;
            let panel = null;
            let styleObserver = null;
            let mountObserver = null;
            let locateFrame = null;
            let retryTimer = null;

            // Publish the right pane's PREFERRED width, not the width the column
            // currently has. The column is 0 while the pane is closed (and while
            // the independent workspace collapse pins the right track), so a
            // measurement-based value can never recover after the pane opens:
            // the track would stay 0 and the panel clamp would keep it hidden.
            // The panel itself always carries its resolved width in
            // `--dsh-sidebar-width` (and its inline width), even while closed.
            const publish = () => {
              if (panel === null) return;
              const value = (panel.style.getPropertyValue('--dsh-sidebar-width') || panel.style.width || '').trim();
              if (value !== '') root.style.setProperty('--isl-rightbar-w', value);
            };

            const watch = (next) => {
              if (next === panel) return;
              styleObserver?.disconnect();
              styleObserver = null;
              panel = next;
              if (panel === null) return;
              styleObserver = new MutationObserver(publish);
              styleObserver.observe(panel, { attributes: true, attributeFilter: ['style'] });
              publish();
            };

            const locate = () => {
              locateFrame = null;
              const next = document.querySelector(HOST.RIGHT_PANEL);
              watch(next);
              if (next === null) return;
              mountObserver?.disconnect();
              mountObserver = null;
              if (retryTimer !== null) {
                clearTimeout(retryTimer);
                retryTimer = null;
              }
            };

            const scheduleLocate = () => {
              if (locateFrame !== null) return;
              locateFrame = requestAnimationFrame(locate);
            };

            locate();
            publishRightbarWidth = locate;
            // The client applies before the shell mounts, so the first query can
            // miss the right pane. Watch until it appears (bounded: a profile
            // without the right pane must not keep a document-wide observer).
            if (panel === null && document.body !== null) {
              mountObserver = new MutationObserver(scheduleLocate);
              mountObserver.observe(document.body, { childList: true, subtree: true });
              retryTimer = setTimeout(() => {
                mountObserver?.disconnect();
                mountObserver = null;
                retryTimer = null;
              }, 10_000);
            }

            return () => {
              if (locateFrame !== null) cancelAnimationFrame(locateFrame);
              if (retryTimer !== null) clearTimeout(retryTimer);
              mountObserver?.disconnect();
              styleObserver?.disconnect();
              if (publishRightbarWidth === locate) publishRightbarWidth = null;
              root.style.removeProperty('--isl-rightbar-w');
            };
          }, 'dsh-islands-ui: rightbar width');

          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register({ name: 'shell.overlay', id: 'islands-topbar', order: -100 }, IslandsTopBar),
          );

          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register({ name: 'shell.overlay', id: 'islands-rail', order: -90 }, IslandsRail),
          );


          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register({ name: 'shell.overlay', id: 'islands-update', order: -87 }, IslandsUpdateButton),
          );

          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register({ name: 'shell.overlay', id: 'islands-pinned', order: -88 }, IslandsPinnedSection),
          );

          // The hero brand slot is a single seat the blank session fills with
          // the shipped fish; occupying it swaps the artwork, nothing else.
          ctx.slots.inject('conversation.hero.brand.mark', () =>
            ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: 0 }, IslandsHeroMark),
          );

          ctx.inject(['slots', 'modelDirectories'], (scope) => {
            modelDirectories = scope.modelDirectories;
            // Single slots render the lowest priority; a negative priority shadows
            // the shipped selector without colliding with it.
            scope.slots.inject('conversation.input.model', () =>
              scope.slots.register({ name: 'conversation.input.model', priority: -1 }, ModelPicker),
            );
          });

          // Take the workspace shortcut over at the shortcut service layer: fixed
          // input listeners run before the catalog dispatch, so the DSH
          // sidebar.left.toggle never swaps in its rail-only render tree.
          ctx.inject(['shortcuts'], (scope) => {
            shortcutsService = scope.shortcuts;

            ctx.effect(
              () => {
                try {
                  return scope.shortcuts.register({
                    id: 'islands.model.open',
                    label: () => 'Model picker',
                    aliases: [],
                    defaults: {
                      'desktop:macos': { code: 'KeyM', modifiers: ['primary', 'shift'] },
                      'desktop:windows': { code: 'KeyM', modifiers: ['primary', 'shift'] },
                      'desktop:linux': { code: 'KeyM', modifiers: ['primary', 'shift'] },
                    },
                    regions: ['page', 'editable'],
                    modals: [],
                    resolve: () => ({
                      status: 'handled',
                      run: () => window.dispatchEvent(new CustomEvent('islands:model-open')),
                    }),
                  });
                } catch (error) {
                  console.warn('[islands-ui] model picker shortcut unavailable', error);
                  return undefined;
                }
              },
              'dsh-islands-ui: model picker shortcut',
            );

            if (typeof scope.shortcuts.observeFixedInput !== 'function') return;
          const off = scope.shortcuts.observeFixedInput((input) => {
              if (input.type !== 'keydown') return;
              if (!document.body.hasAttribute(ATTRIBUTE)) return;
              const gesture = input.gesture;
              if (gesture.code !== 'KeyB' || gesture.repeat || gesture.composing) return;
              if (!(gesture.meta || gesture.control) || gesture.alt || gesture.shift) return;
              const modal = input.context?.modal;
              if (modal !== null && modal !== undefined && modal !== 'sidebar') return;
              // Desktop delivers the platform's primary chord through the native
              // keyboard bridge, bypassing fixed input. Let that path collapse the
              // DSH and let the frame observer below convert it; intercepting both
              // would toggle twice. The secondary chord is handled here.
              const runtime = scope.shortcuts.runtime;
              const platform = scope.shortcuts.platform;
              const nativeOwned =
                runtime === 'desktop' &&
                ((platform === 'macos' && gesture.meta && !gesture.control) ||
                  (platform !== 'macos' && gesture.control && !gesture.meta));
              if (nativeOwned) return;
              input.consume();
              toggleWorkspace();
            });
            scope.effect(() => off, 'dsh-islands-ui: workspace collapse shortcut');
          });

          // The native primary chord reaches DSH's own sidebar collapse before any
          // fixed listener. Convert that collapse into our workspace collapse
          // immediately (and restore the expanded sidebar render tree) so the
          // old rail never stays on screen. Drawer mode is different: its open
          // state is native, and the independent desktop collapse must never hide
          // the drawer's workspace, so entering the drawer clears that attribute.
          ctx.effect(() => {
            let observer;
            let timer;
            const fix = () => {
              const frame = document.querySelector(FRAME);
              if (frame === null) return;
              if (frame.hasAttribute('data-sidebar-drawer')) {
                document.body.removeAttribute(WORKSPACE_ATTR);
                return;
              }
              if (!frame.hasAttribute('data-sidebar-collapsed')) return;
              const wasCollapsed = document.body.hasAttribute(WORKSPACE_ATTR);
              if (wasCollapsed) document.body.removeAttribute(WORKSPACE_ATTR);
              else document.body.setAttribute(WORKSPACE_ATTR, '');
              layoutService?.toggleSidebar();
            };
            const attach = () => {
              const frame = document.querySelector(FRAME);
              if (frame === null) {
                timer = window.setTimeout(attach, 200);
                return;
              }
              fix();
              observer = new MutationObserver(fix);
              observer.observe(frame, {
                attributes: true,
                attributeFilter: ['data-sidebar-collapsed', 'data-sidebar-drawer'],
              });
            };
            attach();
            return () => {
              window.clearTimeout(timer);
              observer?.disconnect();
            };
          }, 'dsh-islands-ui: native collapse conversion');
        };
        skinRegistrar = () => registerSkinChrome(ctx);

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'islands-ui', order: 30, label: 'Islands UI' },
            IslandsSettingsPage,
          ),
        );

        ctx.slots.inject('settings.section.icon', () =>
          ctx.slots.register({ name: 'settings.section.icon', id: 'islands-ui' }, IslandsSectionIcon),
        );

        if (isForced()) {
          shellStructure = detectStructure();
          setCompat({ status: 'ok', missing: [], forced: true, version: shellVersion, structure: shellStructure });
          activate();
          return;
        }
        ctx.effect(() => startCompatibilityGate(), 'dsh-islands-ui: compatibility gate');      },
    };
  },
});
