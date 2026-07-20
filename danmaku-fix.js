(() => {
  "use strict";

  const DANMAKU_CARD_HEIGHT = 58;
  const DANMAKU_CARD_GAP = 26;
  const DANMAKU_CARD_RADIUS = 12;
  const DANMAKU_HORIZONTAL_PADDING = 16;
  const DANMAKU_MIN_WIDTH = 180;
  const DANMAKU_MAX_WIDTH = 620;

  const originalUpdateResponsiveChartMargins = updateResponsiveChartMargins;
  const originalRenderFrame = renderFrame;
  const originalDrawDirectCanvasVideoFrame = drawDirectCanvasVideoFrame;

  let lastLayoutSignature = "";

  function getDanmakuLayoutSignature() {
    const enabled = isDanmakuEnabled() && danmakuMap.size > 0;
    const title = Boolean(document.querySelector("#titleInput")?.value.trim());
    const subtitle = Boolean(document.querySelector("#subtitleInput")?.value.trim());
    return [WIDTH, HEIGHT, enabled, title, subtitle].join("|");
  }

  function getDanmakuLayout(key = "", text = "") {
    const title = Boolean(document.querySelector("#titleInput")?.value.trim());
    const subtitle = Boolean(document.querySelector("#subtitleInput")?.value.trim());
    const headerBottom = subtitle ? 98 : title ? 72 : 18;
    const cardY = headerBottom + 12;
    const chartCardY = cardY + DANMAKU_CARD_HEIGHT + DANMAKU_CARD_GAP;
    const chartTop = chartCardY + 42;
    const isPortrait = WIDTH < 960;
    const startX = (isPortrait || !title)
      ? TITLE_LEFT
      : Math.max(TITLE_LEFT, WIDTH - CHART_SIDE_PADDING - DANMAKU_MAX_WIDTH);
    const availableWidth = Math.max(
      DANMAKU_MIN_WIDTH,
      WIDTH - startX - CHART_SIDE_PADDING
    );
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
      chartCardY,
      chartTop,
      labelText,
      labelX: startX + DANMAKU_HORIZONTAL_PADDING,
      labelY: cardY + 19,
      textX: startX + DANMAKU_HORIZONTAL_PADDING,
      textY: cardY + 43,
      textMaxWidth: Math.max(60, cardWidth - DANMAKU_HORIZONTAL_PADDING * 2)
    };
  }

  function applyChartGeometry() {
    const cardHeight = HEIGHT - margin.top - margin.bottom + 60;

    plotSurface
      .attr("x", CHART_SIDE_PADDING)
      .attr("y", margin.top - 42)
      .attr("width", WIDTH - CHART_SIDE_PADDING * 2)
      .attr("height", cardHeight);

    timeLabel
      .attr("x", WIDTH - margin.right - 10)
      .attr("y", HEIGHT - margin.bottom - 10);

    valueLabelClipRect
      .attr("x", CHART_SIDE_PADDING)
      .attr("width", Math.max(1, WIDTH - CHART_SIDE_PADDING * 2));

    xScale.range([margin.left, WIDTH - margin.right]);
    yScale.range(getYScaleTargetRange(categories.length));
  }

  updateResponsiveChartMargins = function patchedUpdateResponsiveChartMargins() {
    originalUpdateResponsiveChartMargins();

    if (isDanmakuEnabled() && danmakuMap.size > 0) {
      margin.top = getDanmakuLayout().chartTop;
      applyChartGeometry();
    }

    lastLayoutSignature = getDanmakuLayoutSignature();
  };

  function ensureDanmakuLayout() {
    const signature = getDanmakuLayoutSignature();
    if (signature !== lastLayoutSignature) {
      updateResponsiveChartMargins();
    }
  }

  function getDanmakuEntry(frame) {
    if (!frame || !isDanmakuEnabled()) return null;
    const key = getDanmakuKey(frame.time);
    if (!danmakuMap.has(key)) return null;
    return { key, text: danmakuMap.get(key) };
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

    const textEl = danmakuGroup.append("text")
      .attr("x", layout.textX)
      .attr("y", layout.textY)
      .attr("font-size", 18)
      .attr("font-weight", 800)
      .attr("fill", "#0f172a")
      .text(entry.text);

    const textWidth = measureLogicalText(entry.text, 18, 800);
    if (textWidth > layout.textMaxWidth) {
      textEl
        .attr("textLength", layout.textMaxWidth)
        .attr("lengthAdjust", "spacingAndGlyphs");
    }
  }

  renderFrame = function patchedRenderFrame(frame, animate = true) {
    ensureDanmakuLayout();

    const checkbox = document.querySelector("#showDanmakuInput");
    const shouldRenderDanmaku = checkbox ? checkbox.checked : true;

    if (checkbox && shouldRenderDanmaku) checkbox.checked = false;
    try {
      originalRenderFrame(frame, animate);
    } finally {
      if (checkbox && shouldRenderDanmaku) checkbox.checked = true;
    }

    renderSvgDanmaku(frame);
  };

  function getExportDanmakuEntry(fromFrame, toFrame) {
    if (!isDanmakuEnabled()) return null;

    // 网页播放在每段过渡开始时即切换到目标时间节点。
    // 导出也固定使用目标节点，避免在过渡中点突然切换弹幕。
    const activeFrame = toFrame || fromFrame;
    const key = getDanmakuKey(activeFrame?.time);
    if (!key || !danmakuMap.has(key)) return null;
    return { key, text: danmakuMap.get(key) };
  }

  function fillCanvasRoundedRect(context, x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - safeRadius,
      y + height
    );
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
    context.fill();
  }

  function drawCanvasDanmaku(context, outputWidth, outputHeight, entry) {
    const layout = getDanmakuLayout(entry.key, entry.text);
    const scaleX = outputWidth / WIDTH;
    const scaleY = outputHeight / HEIGHT;

    context.save();
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.textBaseline = "alphabetic";

    context.save();
    context.shadowColor = "rgba(37, 99, 235, 0.10)";
    context.shadowBlur = 10;
    context.shadowOffsetY = 3;
    context.fillStyle = "#eff6ff";
    fillCanvasRoundedRect(
      context,
      layout.startX,
      layout.cardY,
      layout.cardWidth,
      DANMAKU_CARD_HEIGHT,
      DANMAKU_CARD_RADIUS
    );
    context.restore();

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
    context.fillText(
      entry.text,
      layout.textX,
      layout.textY,
      layout.textMaxWidth
    );

    context.restore();
    context.setTransform(1, 0, 0, 1, 0, 0);
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
    ensureDanmakuLayout();

    const checkbox = document.querySelector("#showDanmakuInput");
    const shouldRenderDanmaku = checkbox ? checkbox.checked : true;

    if (checkbox && shouldRenderDanmaku) checkbox.checked = false;
    try {
      originalDrawDirectCanvasVideoFrame(
        context,
        outputWidth,
        outputHeight,
        fromFrame,
        toFrame,
        easedProgress,
        linearProgress
      );
    } finally {
      if (checkbox && shouldRenderDanmaku) checkbox.checked = true;
    }

    if (!shouldRenderDanmaku) return;
    const entry = getExportDanmakuEntry(fromFrame, toFrame);
    if (entry) {
      drawCanvasDanmaku(context, outputWidth, outputHeight, entry);
    }
  };

  updateResponsiveChartMargins();
  if (raceData.length > 0) {
    renderFrame(raceData[currentFrameIndex], false);
  }
})();
