(() => {
  "use strict";

  const ASPECT_PRESETS = {
    "16:9": {
      ratioWidth: 16,
      ratioHeight: 9,
      baseUnit: 80,
      label: "16:9",
      video: [
        { value: "1280x720", label: "1280×720（标准）", quality: "standard" },
        { value: "1920x1080", label: "1920×1080（高清）", quality: "high" }
      ],
      gif: { width: 960, height: 540 }
    },
    "3:4": {
      ratioWidth: 3,
      ratioHeight: 4,
      baseUnit: 270,
      label: "3:4",
      video: [
        { value: "810x1080", label: "810×1080（标准）", quality: "standard" },
        { value: "1080x1440", label: "1080×1440（高清）", quality: "high" }
      ],
      gif: { width: 540, height: 720 }
    },
    "9:16": {
      ratioWidth: 9,
      ratioHeight: 16,
      baseUnit: 80,
      label: "9:16",
      video: [
        { value: "720x1280", label: "720×1280（标准）", quality: "standard" },
        { value: "1080x1920", label: "1080×1920（高清）", quality: "high" }
      ],
      gif: { width: 540, height: 960 }
    },
    "4:5": {
      ratioWidth: 4,
      ratioHeight: 5,
      baseUnit: 216,
      label: "4:5",
      video: [
        { value: "864x1080", label: "864×1080（标准）", quality: "standard" },
        { value: "1080x1350", label: "1080×1350（高清）", quality: "high" }
      ],
      gif: { width: 576, height: 720 }
    }
  };

  const DANMAKU_BASE_HEIGHT = 58;
  const DANMAKU_BASE_RADIUS = 12;
  const DANMAKU_BASE_MAX_WIDTH = 620;
  const DANMAKU_BASE_MIN_WIDTH = 180;
  const DANMAKU_BASE_PADDING = 16;
  const DANMAKU_BASE_SIDE_INSET = 28;
  const DANMAKU_BASE_CHART_GAP = 18;
  const DANMAKU_FADE_START = 0.70;
  const DANMAKU_FADE_END = 0.94;
  const DATE_RIGHT_PADDING = 24;
  const DATE_BOTTOM_PADDING = 18;
  const MAX_DANMAKU_CACHE_ITEMS = 64;

  const originalUpdateResponsiveChartMargins = updateResponsiveChartMargins;
  const originalRenderFrame = renderFrame;
  const originalDrawDirectCanvasVideoFrame = drawDirectCanvasVideoFrame;
  const originalGetYScaleTargetRange = getYScaleTargetRange;

  let lastLayoutSignature = "";
  let applyingAspectGeometry = false;
  const danmakuContentCache = new Map();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function getAspectPreset() {
    const mode = document.querySelector("#aspectRatioModeInput")?.value || "16:9";
    return ASPECT_PRESETS[mode] || ASPECT_PRESETS["16:9"];
  }

  function getSelectedScale() {
    const raw = Number(document.querySelector("#chartWidthScaleInput")?.value || 100);
    return Number.isFinite(raw) ? clamp(raw, 70, 160) : 100;
  }

  function getExactLogicalDimensions() {
    const preset = getAspectPreset();
    const unit = Math.max(1, Math.round(preset.baseUnit * getSelectedScale() / 100));
    return {
      width: preset.ratioWidth * unit,
      height: preset.ratioHeight * unit
    };
  }

  function getCurrentVideoQuality() {
    const select = document.querySelector("#videoResolutionInput");
    const selected = select?.selectedOptions?.[0];
    if (selected?.dataset.quality) return selected.dataset.quality;

    const [width, height] = String(select?.value || "").split("x").map(Number);
    return width * height >= 1_500_000 ? "high" : "standard";
  }

  function syncVideoResolutionOptions() {
    const select = document.querySelector("#videoResolutionInput");
    if (!select) return;

    const preset = getAspectPreset();
    const desiredQuality = getCurrentVideoQuality();
    select.replaceChildren();

    preset.video.forEach(item => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = `${item.label} · ${preset.label}`;
      option.dataset.quality = item.quality;
      option.selected = item.quality === desiredQuality;
      select.appendChild(option);
    });

    if (!select.value && select.options.length > 0) {
      select.selectedIndex = select.options.length - 1;
    }
  }

  function parseExactDimensions(value, fallback) {
    const [rawWidth, rawHeight] = String(value || "").split("x").map(Number);
    if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight)) return fallback;
    return {
      width: Math.max(2, Math.round(rawWidth / 2) * 2),
      height: Math.max(2, Math.round(rawHeight / 2) * 2)
    };
  }

  getVideoDimensions = function patchedGetVideoDimensions() {
    const preset = getAspectPreset();
    const fallback = parseExactDimensions(
      preset.video[preset.video.length - 1].value,
      { width: 1920, height: 1080 }
    );
    const selected = parseExactDimensions(
      document.querySelector("#videoResolutionInput")?.value,
      fallback
    );
    const selectedRatio = selected.width / selected.height;
    const expectedRatio = preset.ratioWidth / preset.ratioHeight;
    return Math.abs(selectedRatio - expectedRatio) < 0.001 ? selected : fallback;
  };

  getGifDimensions = function patchedGetGifDimensions() {
    return { ...getAspectPreset().gif };
  };

  function syncCaptureAspectRatio() {
    const captureArea = document.querySelector("#captureArea");
    if (!captureArea) return;
    captureArea.style.aspectRatio = `${WIDTH} / ${HEIGHT}`;
    captureArea.style.height = "auto";
    captureArea.style.minHeight = "0";

    if (document.fullscreenElement === captureArea) {
      captureArea.style.width = "100%";
      captureArea.style.height = "100%";
      captureArea.style.maxWidth = "100%";
      captureArea.style.maxHeight = "100%";
      captureArea.style.margin = "0";
    } else {
      const ratio = WIDTH / HEIGHT;
      captureArea.style.maxWidth = "100%";
      captureArea.style.maxHeight = "min(74vh, 700px)";
      captureArea.style.width = `min(100%, calc(min(74vh, 700px) * ${ratio}))`;
      captureArea.style.margin = "0 auto";
    }
  }

  function clearDanmakuCache() {
    danmakuContentCache.clear();
  }

  function applyExactAspectGeometry(render = true) {
    if (applyingAspectGeometry) return;
    applyingAspectGeometry = true;

    try {
      const preset = getAspectPreset();
      const dimensions = getExactLogicalDimensions();

      baseWidth = preset.ratioWidth * preset.baseUnit;
      WIDTH = dimensions.width;
      HEIGHT = dimensions.height;

      svg
        .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
        .attr("width", WIDTH)
        .attr("height", HEIGHT)
        .attr("preserveAspectRatio", "xMidYMid meet");

      valueLabelClipRect.attr("height", HEIGHT);
      syncCaptureAspectRatio();
      clearDanmakuCache();

      const label = document.querySelector("#chartWidthScaleValue");
      if (label) {
        label.textContent = `${getSelectedScale()}% · ${preset.label} (${WIDTH}×${HEIGHT}px)`;
      }

      updateResponsiveChartMargins();
      if (render && raceData.length > 0) {
        renderFrame(raceData[currentFrameIndex], false);
      }
    } finally {
      applyingAspectGeometry = false;
    }
  }

  function getUiScale() {
    return clamp(Math.min(WIDTH / 1280, HEIGHT / 720), 0.72, 1.40);
  }

  function getBottomMargin() {
    return Math.max(24, Math.min(42, Math.round(HEIGHT * 0.035)));
  }

  function getLayoutSignature() {
    const enabled = isDanmakuEnabled() && danmakuMap.size > 0;
    const title = Boolean(document.querySelector("#titleInput")?.value.trim());
    const subtitle = Boolean(document.querySelector("#subtitleInput")?.value.trim());
    return [WIDTH, HEIGHT, enabled, title, subtitle, categories.length].join("|");
  }

  function getDanmakuLayout(key = "") {
    const title = Boolean(document.querySelector("#titleInput")?.value.trim());
    const subtitle = Boolean(document.querySelector("#subtitleInput")?.value.trim());
    const headerBottom = subtitle ? 98 : title ? 72 : 18;

    const isPortrait = WIDTH < HEIGHT;
    const baseScale = getUiScale();
    const uiScale = isPortrait ? Math.max(1.05, Math.min(1.35, HEIGHT / 960)) : baseScale;

    const baseCardHeight = isPortrait ? 68 : DANMAKU_BASE_HEIGHT;
    const cardHeight = Math.round(baseCardHeight * uiScale);
    const cardRadius = Math.round(DANMAKU_BASE_RADIUS * uiScale);
    const padding = Math.round((isPortrait ? 20 : DANMAKU_BASE_PADDING) * uiScale);
    const sideInset = Math.max(
      Math.round(DANMAKU_BASE_SIDE_INSET * uiScale),
      Math.round(WIDTH * 0.025)
    );
    const availableWidth = Math.max(
      Math.round(DANMAKU_BASE_MIN_WIDTH * uiScale),
      WIDTH - sideInset * 2
    );

    const cardWidth = (isPortrait || !title)
      ? Math.max(Math.round(DANMAKU_BASE_MIN_WIDTH * uiScale), Math.min(WIDTH - sideInset * 2, Math.round((isPortrait ? 720 : DANMAKU_BASE_MAX_WIDTH) * uiScale)))
      : Math.min(Math.round(DANMAKU_BASE_MAX_WIDTH * uiScale), availableWidth);

    const startX = (isPortrait || !title)
      ? Math.max(sideInset, Math.round((WIDTH - cardWidth) / 2))
      : Math.max(sideInset, WIDTH - sideInset - cardWidth);

    const cardY = headerBottom + Math.round(14 * uiScale);
    const chartGap = Math.round(DANMAKU_BASE_CHART_GAP * uiScale);

    const labelFontSize = isPortrait
      ? Math.max(15, Math.round(16 * uiScale))
      : Math.max(10, Math.round(13 * uiScale));

    const textFontSize = isPortrait
      ? Math.max(22, Math.round(24 * uiScale))
      : Math.max(13, Math.round(18 * uiScale));

    return {
      startX,
      cardY,
      cardWidth,
      cardHeight,
      cardRadius,
      padding,
      chartTop: cardY + cardHeight + chartGap + 42,
      labelText: `节点 · ${key}`,
      labelOffsetX: padding,
      labelBaseline: Math.round(cardHeight * 0.33),
      textOffsetX: padding,
      textBaseline: Math.round(cardHeight * 0.76),
      textMaxWidth: Math.max(48, cardWidth - padding * 2),
      labelFontSize,
      textFontSize,
      dotRadius: Math.max(3, Math.round((isPortrait ? 5 : 4) * uiScale)),
      dotLabelGap: Math.max(8, Math.round((isPortrait ? 11 : 10) * uiScale))
    };
  }

  function getPlotPanelBounds() {
    const top = margin.top - 42;
    const yTargetRange = getYScaleTargetRange(categories.length);
    const targetHeight = yTargetRange[1] - yTargetRange[0];
    const fullHeight = HEIGHT - margin.top - margin.bottom + 60;
    const cardHeight = Math.min(fullHeight, targetHeight + 78);
    const bottom = top + cardHeight;
    return {
      left: CHART_SIDE_PADDING,
      right: WIDTH - CHART_SIDE_PADDING,
      top,
      bottom,
      width: WIDTH - CHART_SIDE_PADDING * 2,
      height: Math.max(1, bottom - top)
    };
  }

  function getDateLayout(text = "") {
    const panel = getPlotPanelBounds();
    const isPortrait = WIDTH < HEIGHT;
    const baseFontSize = Math.min(104, WIDTH * 0.115, HEIGHT * 0.145);
    const maxTextWidth = Math.max(120, panel.width * (isPortrait ? 0.64 : 0.42));
    const measuredWidth = measureLogicalText(String(text), baseFontSize, 900);
    const widthScale = measuredWidth > 0
      ? Math.min(1, maxTextWidth / measuredWidth)
      : 1;

    return {
      x: panel.right - DATE_RIGHT_PADDING,
      y: panel.bottom - DATE_BOTTOM_PADDING,
      fontSize: Math.max(32, Math.floor(baseFontSize * widthScale)),
      maxTextWidth
    };
  }

  function applyDateLayout(text = timeLabel.text()) {
    const layout = getDateLayout(text);
    timeLabel
      .attr("x", layout.x)
      .attr("y", layout.y)
      .attr("text-anchor", "end")
      .style("font-size", `${layout.fontSize}px`)
      .attr("textLength", null)
      .attr("lengthAdjust", null);

    if (measureLogicalText(String(text), layout.fontSize, 900) > layout.maxTextWidth) {
      timeLabel
        .attr("textLength", layout.maxTextWidth)
        .attr("lengthAdjust", "spacingAndGlyphs");
    }
  }

  function applyChartGeometry() {
    const panel = getPlotPanelBounds();
    plotSurface
      .attr("x", panel.left)
      .attr("y", panel.top)
      .attr("width", panel.width)
      .attr("height", panel.height);

    applyDateLayout();
    valueLabelClipRect
      .attr("x", CHART_SIDE_PADDING)
      .attr("width", Math.max(1, WIDTH - CHART_SIDE_PADDING * 2))
      .attr("height", HEIGHT);
    xScale.range([margin.left, WIDTH - margin.right]);
    yScale.range(getYScaleTargetRange(categories.length));
    syncCaptureAspectRatio();
  }

  updateResponsiveChartMargins = function patchedUpdateResponsiveChartMargins() {
    originalUpdateResponsiveChartMargins();
    margin.bottom = getBottomMargin();

    if (isDanmakuEnabled() && danmakuMap.size > 0) {
      margin.top = getDanmakuLayout().chartTop;
    }

    applyChartGeometry();
    lastLayoutSignature = getLayoutSignature();
  };

  function ensureLayout() {
    if (getLayoutSignature() !== lastLayoutSignature) {
      updateResponsiveChartMargins();
      clearDanmakuCache();
    }
  }

  function getDanmakuEntry(frame) {
    if (!frame) return null;
    const key = getDanmakuKey(frame.time);
    return key && danmakuMap.has(key)
      ? { key, text: String(danmakuMap.get(key) ?? "") }
      : null;
  }

  function renderSvgDanmaku(frame) {
    danmakuGroup.selectAll("*").remove();
    const entry = isDanmakuEnabled() ? getDanmakuEntry(frame) : null;
    if (!entry) {
      danmakuGroup.style("display", "none");
      return;
    }

    const layout = getDanmakuLayout(entry.key);
    danmakuGroup.style("display", null);

    danmakuGroup.append("rect")
      .attr("x", layout.startX)
      .attr("y", layout.cardY)
      .attr("width", layout.cardWidth)
      .attr("height", layout.cardHeight)
      .attr("rx", layout.cardRadius)
      .attr("fill", "#eff6ff")
      .attr("stroke", "#bfdbfe")
      .attr("stroke-width", 1);

    const dotX = layout.startX + layout.labelOffsetX + layout.dotRadius;
    const dotY = layout.cardY + layout.labelBaseline - layout.dotRadius;

    danmakuGroup.append("circle")
      .attr("cx", dotX)
      .attr("cy", dotY)
      .attr("r", layout.dotRadius)
      .attr("fill", "#2563eb");

    danmakuGroup.append("text")
      .attr("x", dotX + layout.dotRadius + layout.dotLabelGap)
      .attr("y", layout.cardY + layout.labelBaseline)
      .attr("font-size", layout.labelFontSize)
      .attr("font-weight", 700)
      .attr("fill", "#2563eb")
      .text(layout.labelText);

    const textElement = danmakuGroup.append("text")
      .attr("x", layout.startX + layout.textOffsetX)
      .attr("y", layout.cardY + layout.textBaseline)
      .attr("font-size", layout.textFontSize)
      .attr("font-weight", 800)
      .attr("fill", "#0f172a")
      .text(entry.text);

    if (measureLogicalText(entry.text, layout.textFontSize, 800) > layout.textMaxWidth) {
      textElement
        .attr("textLength", layout.textMaxWidth)
        .attr("lengthAdjust", "spacingAndGlyphs");
    }
  }

  renderFrame = function patchedRenderFrame(frame, animate = true) {
    ensureLayout();
    const checkbox = document.querySelector("#showDanmakuInput");
    const enabled = checkbox ? checkbox.checked : true;
    if (checkbox && enabled) checkbox.checked = false;

    try {
      originalRenderFrame(frame, animate);
    } finally {
      if (checkbox && enabled) checkbox.checked = true;
    }

    applyDateLayout(frame?.time || "");
    renderSvgDanmaku(frame);
  };

  function roundedRectPath(context, x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }

  function getPixelDanmakuLayout(outputWidth, outputHeight, entry) {
    const logical = getDanmakuLayout(entry?.key || "");
    const scaleX = outputWidth / WIDTH;
    const scaleY = outputHeight / HEIGHT;
    const fontScale = Math.min(scaleX, scaleY);

    return {
      x: Math.round(logical.startX * scaleX),
      y: Math.round(logical.cardY * scaleY),
      width: Math.max(1, Math.round(logical.cardWidth * scaleX)),
      height: Math.max(1, Math.round(logical.cardHeight * scaleY)),
      radius: Math.max(1, Math.round(logical.cardRadius * fontScale)),
      paddingX: Math.max(1, Math.round(logical.labelOffsetX * scaleX)),
      labelBaseline: Math.round(logical.labelBaseline * scaleY),
      textBaseline: Math.round(logical.textBaseline * scaleY),
      labelFontSize: Math.max(8, Math.round(logical.labelFontSize * fontScale)),
      textFontSize: Math.max(10, Math.round(logical.textFontSize * fontScale)),
      dotRadius: Math.max(2, Math.round(logical.dotRadius * fontScale)),
      dotLabelGap: Math.max(5, Math.round(logical.dotLabelGap * scaleX)),
      maxTextWidth: Math.max(20, Math.round(logical.textMaxWidth * scaleX)),
      lineWidth: Math.max(1, Math.round(fontScale))
    };
  }

  function getDanmakuCacheKey(outputWidth, outputHeight, entry, pixelLayout) {
    return [
      outputWidth,
      outputHeight,
      WIDTH,
      HEIGHT,
      pixelLayout.width,
      pixelLayout.height,
      entry.key,
      entry.text
    ].join("|");
  }

  function trimDanmakuCache() {
    while (danmakuContentCache.size > MAX_DANMAKU_CACHE_ITEMS) {
      const firstKey = danmakuContentCache.keys().next().value;
      danmakuContentCache.delete(firstKey);
    }
  }

  function getCachedDanmakuContent(outputWidth, outputHeight, entry, pixelLayout) {
    const cacheKey = getDanmakuCacheKey(
      outputWidth,
      outputHeight,
      entry,
      pixelLayout
    );
    const cached = danmakuContentCache.get(cacheKey);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = pixelLayout.width;
    canvas.height = pixelLayout.height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = "alphabetic";
    context.textAlign = "left";
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const dotX = pixelLayout.paddingX + pixelLayout.dotRadius;
    const dotY = pixelLayout.labelBaseline - pixelLayout.dotRadius;
    context.fillStyle = "#2563eb";
    context.beginPath();
    context.arc(dotX, dotY, pixelLayout.dotRadius, 0, Math.PI * 2);
    context.fill();

    context.font =
      `700 ${pixelLayout.labelFontSize}px ` +
      '"Microsoft YaHei","PingFang SC",Arial,sans-serif';
    context.fillText(
      `节点 · ${entry.key}`,
      dotX + pixelLayout.dotRadius + pixelLayout.dotLabelGap,
      pixelLayout.labelBaseline
    );

    context.fillStyle = "#0f172a";
    context.font =
      `800 ${pixelLayout.textFontSize}px ` +
      '"Microsoft YaHei","PingFang SC",Arial,sans-serif';
    context.fillText(
      entry.text,
      pixelLayout.paddingX,
      pixelLayout.textBaseline,
      pixelLayout.maxTextWidth
    );

    danmakuContentCache.set(cacheKey, canvas);
    trimDanmakuCache();
    return canvas;
  }

  function drawDanmakuShell(context, pixelLayout, alpha) {
    if (alpha <= 0.001) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = clamp(alpha, 0, 1);

    const inset = pixelLayout.lineWidth / 2;
    roundedRectPath(
      context,
      pixelLayout.x + inset,
      pixelLayout.y + inset,
      Math.max(1, pixelLayout.width - pixelLayout.lineWidth),
      Math.max(1, pixelLayout.height - pixelLayout.lineWidth),
      pixelLayout.radius
    );
    context.fillStyle = "#eff6ff";
    context.fill();
    context.strokeStyle = "#bfdbfe";
    context.lineWidth = pixelLayout.lineWidth;
    context.stroke();
    context.restore();
  }

  function drawDanmakuContent(context, outputWidth, outputHeight, entry, alpha) {
    if (!entry || alpha <= 0.001) return;
    const pixelLayout = getPixelDanmakuLayout(outputWidth, outputHeight, entry);
    const content = getCachedDanmakuContent(
      outputWidth,
      outputHeight,
      entry,
      pixelLayout
    );
    if (!content) return;

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = clamp(alpha, 0, 1);
    context.drawImage(content, pixelLayout.x, pixelLayout.y);
    context.restore();
  }

  function sameDanmakuEntry(a, b) {
    return Boolean(a && b && a.key === b.key && a.text === b.text);
  }

  function getDanmakuTransition(fromFrame, toFrame, linearProgress) {
    const fromEntry = getDanmakuEntry(fromFrame);
    const toEntry = toFrame ? getDanmakuEntry(toFrame) : fromEntry;

    if (sameDanmakuEntry(fromEntry, toEntry)) {
      return {
        shellAlpha: fromEntry ? 1 : 0,
        layers: fromEntry ? [{ entry: fromEntry, alpha: 1 }] : []
      };
    }

    const progress = clamp(Number(linearProgress) || 0, 0, 1);

    if (fromEntry && toEntry) {
      const blend = smoothstep((progress - 0.35) / 0.30);
      return {
        shellAlpha: 1,
        layers: [
          { entry: fromEntry, alpha: 1 - blend },
          { entry: toEntry, alpha: blend }
        ]
      };
    }

    if (fromEntry) {
      const alpha = progress < 0.45 ? 1 : smoothstep(1 - (progress - 0.45) / 0.15);
      return {
        shellAlpha: alpha,
        layers: [{ entry: fromEntry, alpha }]
      };
    }

    if (toEntry) {
      const alpha = progress < 0.40 ? 0 : smoothstep((progress - 0.40) / 0.15);
      return {
        shellAlpha: alpha,
        layers: [{ entry: toEntry, alpha }]
      };
    }

    return { shellAlpha: 0, layers: [] };
  }

  function drawStableDanmaku(
    context,
    outputWidth,
    outputHeight,
    fromFrame,
    toFrame,
    linearProgress
  ) {
    const transition = getDanmakuTransition(
      fromFrame,
      toFrame,
      linearProgress
    );
    if (transition.shellAlpha <= 0.001 || transition.layers.length === 0) return;

    const placementEntry = transition.layers[0].entry;
    const pixelLayout = getPixelDanmakuLayout(
      outputWidth,
      outputHeight,
      placementEntry
    );
    drawDanmakuShell(context, pixelLayout, transition.shellAlpha);
    transition.layers.forEach(layer => {
      drawDanmakuContent(
        context,
        outputWidth,
        outputHeight,
        layer.entry,
        layer.alpha
      );
    });
  }

  function getTimelineActiveFrame(fromFrame, toFrame, linearProgress) {
    if (!toFrame) return fromFrame;
    return (Number(linearProgress) || 0) >= 0.82 ? toFrame : fromFrame;
  }

  function drawPixelAlignedDate(context, outputWidth, outputHeight, text) {
    if (!text) return;
    const opacity = typeof getDateOpacity === "function" ? getDateOpacity() : 0.20;
    if (opacity <= 0.001) return;

    const logical = getDateLayout(text);
    const scaleX = outputWidth / WIDTH;
    const scaleY = outputHeight / HEIGHT;
    const fontScale = Math.min(scaleX, scaleY);

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = opacity;
    context.fillStyle = "#2563eb";
    context.font =
      `900 ${Math.max(18, Math.round(logical.fontSize * fontScale))}px ` +
      '"Microsoft YaHei","PingFang SC",Arial,sans-serif';
    context.textAlign = "right";
    context.textBaseline = "alphabetic";
    context.fillText(
      String(text),
      Math.round(logical.x * scaleX),
      Math.round(logical.y * scaleY),
      Math.max(40, Math.round(logical.maxTextWidth * scaleX))
    );
    context.restore();
  }

  drawDirectCanvasVideoFrame = function patchedDrawDirectCanvasVideoFrame(
    context,
    outputWidth,
    outputHeight,
    fromFrame,
    toFrame,
    easedProgress,
    linearProgress
  ) {
    ensureLayout();
    const checkbox = document.querySelector("#showDanmakuInput");
    const enabled = checkbox ? checkbox.checked : true;
    const hiddenFrom = { ...(fromFrame || {}), time: "" };
    const hiddenTo = { ...(toFrame || fromFrame || {}), time: "" };
    if (checkbox && enabled) checkbox.checked = false;
    try {
      originalDrawDirectCanvasVideoFrame(
        context,
        outputWidth,
        outputHeight,
        hiddenFrom,
        hiddenTo,
        easedProgress,
        linearProgress
      );
    } finally {
      if (checkbox && enabled) checkbox.checked = true;
    }

    const activeFrame = getTimelineActiveFrame(
      fromFrame,
      toFrame,
      linearProgress
    );
    drawPixelAlignedDate(
      context,
      outputWidth,
      outputHeight,
      activeFrame?.time
    );

    if (enabled) {
      drawStableDanmaku(
        context,
        outputWidth,
        outputHeight,
        fromFrame,
        toFrame,
        linearProgress
      );
    }
  };

  function syncAspectAndExportSettings() {
    syncVideoResolutionOptions();
    applyExactAspectGeometry(true);
  }

  document.querySelector("#aspectRatioModeInput")
    ?.addEventListener("change", syncAspectAndExportSettings);
  document.querySelector("#chartWidthScaleInput")
    ?.addEventListener("input", () => applyExactAspectGeometry(true));
  document.querySelector("#titleInput")
    ?.addEventListener("input", clearDanmakuCache);
  document.querySelector("#subtitleInput")
    ?.addEventListener("input", clearDanmakuCache);
  document.querySelector("#danmakuTextInput")
    ?.addEventListener("input", clearDanmakuCache);

  if (document.fonts?.ready) {
    document.fonts.ready.then(clearDanmakuCache).catch(() => {});
  }

  window.addEventListener("resize", syncCaptureAspectRatio);
  document.addEventListener("fullscreenchange", syncCaptureAspectRatio);

  syncVideoResolutionOptions();
  applyExactAspectGeometry(false);
  updateResponsiveChartMargins();
  if (raceData.length > 0) {
    renderFrame(raceData[currentFrameIndex], false);
  }
})();
