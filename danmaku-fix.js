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

  const DANMAKU_CARD_HEIGHT = 58;
  const DANMAKU_CARD_RADIUS = 12;
  const DANMAKU_MAX_WIDTH = 620;
  const DANMAKU_MIN_WIDTH = 180;
  const DANMAKU_HORIZONTAL_PADDING = 16;
  const DANMAKU_SIDE_INSET = 28;
  const DANMAKU_CHART_GAP = 18;
  const DATE_RIGHT_PADDING = 24;
  const DATE_BOTTOM_PADDING = 18;
  const EXPORT_SWITCH_PROGRESS = Math.min(0.96, Math.max(0.5, MOTION_RATIO));

  const originalUpdateResponsiveChartMargins = updateResponsiveChartMargins;
  const originalRenderFrame = renderFrame;
  const originalDrawDirectCanvasVideoFrame = drawDirectCanvasVideoFrame;
  const originalGetYScaleTargetRange = getYScaleTargetRange;

  let lastLayoutSignature = "";
  let applyingAspectGeometry = false;

  function getAspectPreset() {
    const mode = document.querySelector("#aspectRatioModeInput")?.value || "16:9";
    return ASPECT_PRESETS[mode] || ASPECT_PRESETS["16:9"];
  }

  function getSelectedScale() {
    const raw = Number(document.querySelector("#chartWidthScaleInput")?.value || 100);
    return Number.isFinite(raw) ? Math.max(70, Math.min(160, raw)) : 100;
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
    const sideInset = Math.max(DANMAKU_SIDE_INSET, Math.round(WIDTH * 0.022));
    const availableWidth = Math.max(DANMAKU_MIN_WIDTH, WIDTH - sideInset * 2);
    const isPortrait = WIDTH < HEIGHT;
    const cardWidth = isPortrait
      ? availableWidth
      : Math.min(DANMAKU_MAX_WIDTH, availableWidth);
    const startX = isPortrait || !title
      ? sideInset
      : WIDTH - sideInset - cardWidth;
    const cardY = headerBottom + 14;

    return {
      startX,
      cardY,
      cardWidth,
      chartTop: cardY + DANMAKU_CARD_HEIGHT + DANMAKU_CHART_GAP + 42,
      labelText: `节点 · ${key}`,
      labelX: startX + DANMAKU_HORIZONTAL_PADDING,
      labelY: cardY + 19,
      textX: startX + DANMAKU_HORIZONTAL_PADDING,
      textY: cardY + 43,
      textMaxWidth: Math.max(60, cardWidth - DANMAKU_HORIZONTAL_PADDING * 2)
    };
  }

  function getPlotPanelBounds() {
    const top = margin.top - 42;
    const bottom = HEIGHT - margin.bottom + 18;
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
    const widthScale = measuredWidth > 0 ? Math.min(1, maxTextWidth / measuredWidth) : 1;

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
    const panelHeight = HEIGHT - margin.top - margin.bottom + 60;
    plotSurface
      .attr("x", CHART_SIDE_PADDING)
      .attr("y", margin.top - 42)
      .attr("width", WIDTH - CHART_SIDE_PADDING * 2)
      .attr("height", panelHeight);

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
    }
  }

  function getDanmakuEntry(frame) {
    if (!frame || !isDanmakuEnabled()) return null;
    const key = getDanmakuKey(frame.time);
    return danmakuMap.has(key) ? { key, text: danmakuMap.get(key) } : null;
  }

  function renderSvgDanmaku(frame) {
    danmakuGroup.selectAll("*").remove();
    const entry = getDanmakuEntry(frame);
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
      .attr("height", DANMAKU_CARD_HEIGHT)
      .attr("rx", DANMAKU_CARD_RADIUS)
      .attr("fill", "#eff6ff")
      .attr("stroke", "#bfdbfe")
      .attr("stroke-width", 1);

    danmakuGroup.append("circle")
      .attr("cx", layout.labelX + 4)
      .attr("cy", layout.labelY - 4)
      .attr("r", 4)
      .attr("fill", "#2563eb");

    danmakuGroup.append("text")
      .attr("x", layout.labelX + 14)
      .attr("y", layout.labelY)
      .attr("font-size", 13)
      .attr("font-weight", 700)
      .attr("fill", "#2563eb")
      .text(layout.labelText);

    const textElement = danmakuGroup.append("text")
      .attr("x", layout.textX)
      .attr("y", layout.textY)
      .attr("font-size", 18)
      .attr("font-weight", 800)
      .attr("fill", "#0f172a")
      .text(entry.text);

    if (measureLogicalText(entry.text, 18, 800) > layout.textMaxWidth) {
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

  function getExportActiveFrame(fromFrame, toFrame, linearProgress) {
    if (!toFrame) return fromFrame;
    return linearProgress >= EXPORT_SWITCH_PROGRESS ? toFrame : fromFrame;
  }

  function fillCanvasRoundedRect(context, x, y, width, height, radius) {
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
    context.fill();
  }

  function withLogicalCanvas(context, outputWidth, outputHeight, draw) {
    context.save();
    context.setTransform(outputWidth / WIDTH, 0, 0, outputHeight / HEIGHT, 0, 0);
    draw();
    context.restore();
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawCanvasDanmaku(context, outputWidth, outputHeight, entry) {
    const layout = getDanmakuLayout(entry.key);
    withLogicalCanvas(context, outputWidth, outputHeight, () => {
      context.textBaseline = "alphabetic";
      context.fillStyle = "#eff6ff";
      fillCanvasRoundedRect(
        context,
        layout.startX,
        layout.cardY,
        layout.cardWidth,
        DANMAKU_CARD_HEIGHT,
        DANMAKU_CARD_RADIUS
      );
      context.strokeStyle = "#bfdbfe";
      context.lineWidth = 1;
      drawRoundedStroke(
        context,
        layout.startX,
        layout.cardY,
        layout.cardWidth,
        DANMAKU_CARD_HEIGHT,
        DANMAKU_CARD_RADIUS
      );

      context.fillStyle = "#2563eb";
      context.beginPath();
      context.arc(layout.labelX + 4, layout.labelY - 4, 4, 0, Math.PI * 2);
      context.fill();
      context.font = '700 13px "Microsoft YaHei","PingFang SC",Arial,sans-serif';
      context.textAlign = "left";
      context.fillText(layout.labelText, layout.labelX + 14, layout.labelY);
      context.fillStyle = "#0f172a";
      context.font = '800 18px "Microsoft YaHei","PingFang SC",Arial,sans-serif';
      context.fillText(entry.text, layout.textX, layout.textY, layout.textMaxWidth);
    });
  }

  function drawCanvasDate(context, outputWidth, outputHeight, text) {
    if (!text) return;
    const layout = getDateLayout(text);
    withLogicalCanvas(context, outputWidth, outputHeight, () => {
      context.globalAlpha = 0.20;
      context.fillStyle = "#2563eb";
      context.font = `900 ${layout.fontSize}px "Microsoft YaHei","PingFang SC",Arial,sans-serif`;
      context.textAlign = "right";
      context.textBaseline = "alphabetic";
      context.fillText(String(text), layout.x, layout.y, layout.maxTextWidth);
      context.globalAlpha = 1;
    });
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
    const activeFrame = getExportActiveFrame(fromFrame, toFrame, linearProgress);
    const hiddenFrom = { ...fromFrame, time: "" };
    const hiddenTo = { ...(toFrame || fromFrame), time: "" };
    const savedRangeFunction = getYScaleTargetRange;

    getYScaleTargetRange = function exportFullHeightRange() {
      return [margin.top, HEIGHT - margin.bottom];
    };

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
      getYScaleTargetRange = savedRangeFunction || originalGetYScaleTargetRange;
      if (checkbox && enabled) checkbox.checked = true;
    }

    drawCanvasDate(context, outputWidth, outputHeight, activeFrame?.time);
    if (enabled) {
      const entry = getDanmakuEntry(activeFrame);
      if (entry) drawCanvasDanmaku(context, outputWidth, outputHeight, entry);
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

  syncVideoResolutionOptions();
  applyExactAspectGeometry(false);
  updateResponsiveChartMargins();
  if (raceData.length > 0) {
    renderFrame(raceData[currentFrameIndex], false);
  }
})();