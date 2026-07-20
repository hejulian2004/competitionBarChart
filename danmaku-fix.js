(() => {
  "use strict";

  const DANMAKU_CARD_HEIGHT = 58;
  const DANMAKU_CARD_GAP = 26;
  const DANMAKU_CARD_RADIUS = 12;
  const DANMAKU_HORIZONTAL_PADDING = 16;
  const DANMAKU_MIN_WIDTH = 180;
  const DANMAKU_MAX_WIDTH = 620;
  const CHART_BOTTOM_MARGIN = 36;
  const DATE_RIGHT_PADDING = 24;
  const DATE_BOTTOM_PADDING = 12;

  const originalUpdateResponsiveChartMargins = updateResponsiveChartMargins;
  const originalRenderFrame = renderFrame;
  const originalDrawDirectCanvasVideoFrame = drawDirectCanvasVideoFrame;
  const originalGetYScaleTargetRange = getYScaleTargetRange;

  let lastLayoutSignature = "";

  function getLayoutSignature() {
    const enabled = isDanmakuEnabled() && danmakuMap.size > 0;
    const title = Boolean(document.querySelector("#titleInput")?.value.trim());
    const subtitle = Boolean(document.querySelector("#subtitleInput")?.value.trim());
    return [WIDTH, HEIGHT, enabled, title, subtitle, categories.length].join("|");
  }

  function getDanmakuLayout(key = "", text = "") {
    const title = Boolean(document.querySelector("#titleInput")?.value.trim());
    const subtitle = Boolean(document.querySelector("#subtitleInput")?.value.trim());
    const headerBottom = subtitle ? 98 : title ? 72 : 18;
    const cardY = headerBottom + 12;
    const chartTop = cardY + DANMAKU_CARD_HEIGHT + DANMAKU_CARD_GAP + 42;
    const isPortrait = WIDTH < 960;
    const startX = (isPortrait || !title)
      ? TITLE_LEFT
      : Math.max(TITLE_LEFT, WIDTH - CHART_SIDE_PADDING - DANMAKU_MAX_WIDTH);
    const availableWidth = Math.max(DANMAKU_MIN_WIDTH, WIDTH - startX - CHART_SIDE_PADDING);
    const labelText = `节点 · ${key}`;
    const requiredWidth = Math.max(
      measureLogicalText(labelText, 13, 700),
      measureLogicalText(text, 18, 800)
    ) + DANMAKU_HORIZONTAL_PADDING * 2;
    const cardWidth = Math.max(
      DANMAKU_MIN_WIDTH,
      Math.min(DANMAKU_MAX_WIDTH, availableWidth, requiredWidth)
    );

    return {
      startX,
      cardY,
      cardWidth,
      chartTop,
      labelText,
      labelX: startX + DANMAKU_HORIZONTAL_PADDING,
      labelY: cardY + 19,
      textX: startX + DANMAKU_HORIZONTAL_PADDING,
      textY: cardY + 43,
      textMaxWidth: Math.max(60, cardWidth - DANMAKU_HORIZONTAL_PADDING * 2)
    };
  }

  function getDatePosition() {
    return {
      x: WIDTH - CHART_SIDE_PADDING - DATE_RIGHT_PADDING,
      y: HEIGHT - CHART_BOTTOM_MARGIN - DATE_BOTTOM_PADDING
    };
  }

  function applyChartGeometry() {
    const cardHeight = HEIGHT - margin.top - margin.bottom + 60;
    const datePosition = getDatePosition();

    plotSurface
      .attr("x", CHART_SIDE_PADDING)
      .attr("y", margin.top - 42)
      .attr("width", WIDTH - CHART_SIDE_PADDING * 2)
      .attr("height", cardHeight);

    timeLabel
      .attr("x", datePosition.x)
      .attr("y", datePosition.y)
      .attr("text-anchor", "end");

    valueLabelClipRect
      .attr("x", CHART_SIDE_PADDING)
      .attr("width", Math.max(1, WIDTH - CHART_SIDE_PADDING * 2));

    xScale.range([margin.left, WIDTH - margin.right]);
    yScale.range(getYScaleTargetRange(categories.length));
  }

  updateResponsiveChartMargins = function patchedUpdateResponsiveChartMargins() {
    originalUpdateResponsiveChartMargins();
    margin.bottom = CHART_BOTTOM_MARGIN;

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

    const layout = getDanmakuLayout(entry.key, entry.text);
    danmakuGroup.style("display", null);

    danmakuGroup.append("rect")
      .attr("x", layout.startX).attr("y", layout.cardY)
      .attr("width", layout.cardWidth).attr("height", DANMAKU_CARD_HEIGHT)
      .attr("rx", DANMAKU_CARD_RADIUS).attr("fill", "#eff6ff")
      .attr("stroke", "#bfdbfe").attr("stroke-width", 1);

    danmakuGroup.append("circle")
      .attr("cx", layout.labelX + 4).attr("cy", layout.labelY - 4)
      .attr("r", 4).attr("fill", "#2563eb");

    danmakuGroup.append("text")
      .attr("x", layout.labelX + 14).attr("y", layout.labelY)
      .attr("font-size", 13).attr("font-weight", 700)
      .attr("fill", "#2563eb").text(layout.labelText);

    const textEl = danmakuGroup.append("text")
      .attr("x", layout.textX).attr("y", layout.textY)
      .attr("font-size", 18).attr("font-weight", 800)
      .attr("fill", "#0f172a").text(entry.text);

    if (measureLogicalText(entry.text, 18, 800) > layout.textMaxWidth) {
      textEl.attr("textLength", layout.textMaxWidth).attr("lengthAdjust", "spacingAndGlyphs");
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
    const datePosition = getDatePosition();
    timeLabel.attr("x", datePosition.x).attr("y", datePosition.y).attr("text-anchor", "end");
    renderSvgDanmaku(frame);
  };

  function getExportEntry(fromFrame, toFrame) {
    if (!isDanmakuEnabled()) return null;
    const activeFrame = toFrame || fromFrame;
    const key = getDanmakuKey(activeFrame?.time);
    return key && danmakuMap.has(key) ? { key, text: danmakuMap.get(key) } : null;
  }

  function fillCanvasRoundedRect(context, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
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
    const layout = getDanmakuLayout(entry.key, entry.text);
    withLogicalCanvas(context, outputWidth, outputHeight, () => {
      context.textBaseline = "alphabetic";
      context.fillStyle = "#eff6ff";
      fillCanvasRoundedRect(context, layout.startX, layout.cardY, layout.cardWidth, DANMAKU_CARD_HEIGHT, DANMAKU_CARD_RADIUS);
      context.strokeStyle = "#bfdbfe";
      context.lineWidth = 1;
      drawRoundedStroke(context, layout.startX, layout.cardY, layout.cardWidth, DANMAKU_CARD_HEIGHT, DANMAKU_CARD_RADIUS);
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
    const position = getDatePosition();
    withLogicalCanvas(context, outputWidth, outputHeight, () => {
      context.globalAlpha = 0.20;
      context.fillStyle = "#2563eb";
      context.font = '900 104px "Microsoft YaHei","PingFang SC",Arial,sans-serif';
      context.textAlign = "right";
      context.textBaseline = "alphabetic";
      context.fillText(String(text), position.x, position.y);
      context.globalAlpha = 1;
    });
  }

  drawDirectCanvasVideoFrame = function patchedDrawDirectCanvasVideoFrame(
    context, outputWidth, outputHeight, fromFrame, toFrame, easedProgress, linearProgress
  ) {
    ensureLayout();
    const checkbox = document.querySelector("#showDanmakuInput");
    const enabled = checkbox ? checkbox.checked : true;
    const activeFrame = toFrame || fromFrame;
    const hiddenFrom = { ...fromFrame, time: "" };
    const hiddenTo = { ...(toFrame || fromFrame), time: "" };
    const savedRangeFunction = getYScaleTargetRange;

    // 导出时让柱形区域完整延伸到面板底部，消除固定柱高造成的大块底部留白。
    getYScaleTargetRange = function exportYScaleRange() {
      return [margin.top, HEIGHT - margin.bottom];
    };

    if (checkbox && enabled) checkbox.checked = false;
    try {
      originalDrawDirectCanvasVideoFrame(
        context, outputWidth, outputHeight,
        hiddenFrom, hiddenTo, easedProgress, linearProgress
      );
    } finally {
      getYScaleTargetRange = savedRangeFunction || originalGetYScaleTargetRange;
      if (checkbox && enabled) checkbox.checked = true;
    }

    drawCanvasDate(context, outputWidth, outputHeight, activeFrame?.time);
    if (enabled) {
      const entry = getExportEntry(fromFrame, toFrame);
      if (entry) drawCanvasDanmaku(context, outputWidth, outputHeight, entry);
    }
  };

  updateResponsiveChartMargins();
  if (raceData.length > 0) renderFrame(raceData[currentFrameIndex], false);
})();
