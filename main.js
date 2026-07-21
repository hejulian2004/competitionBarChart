(() => {
  "use strict";

  const entryScript = document.currentScript;
  const baseUrl = new URL(".", entryScript?.src || window.location.href);

  function loadClassicScript(filename, onload) {
    const script = document.createElement("script");
    script.src = new URL(filename, baseUrl).href;
    script.async = false;
    script.onload = onload;
    script.onerror = () => console.error(`${filename} 加载失败`);
    document.head.appendChild(script);
  }

  loadClassicScript("main-core.js", () => {
    const core = {
      updateMargins: updateResponsiveChartMargins,
      renderFrame,
      drawCanvasFrame: drawDirectCanvasVideoFrame
    };

    loadClassicScript("main-layout-base.js", () => {
      const MAX_LINES = 3;
      const CACHE_LIMIT = 96;
      const FADE_START = 0.70;
      const FADE_END = 0.94;
      const contentCache = new Map();
      let layoutSignature = "";

      const clamp = (value, minimum, maximum) =>
        Math.max(minimum, Math.min(maximum, value));

      const smoothstep = value => {
        const t = clamp(value, 0, 1);
        return t * t * (3 - 2 * t);
      };

      function getAspectMode() {
        return document.querySelector("#aspectRatioModeInput")?.value || "16:9";
      }

      function getUiScale() {
        return clamp(Math.min(WIDTH / 1280, HEIGHT / 720), 0.72, 1.40);
      }

      function wrapText(text, maximumWidth, fontSize, maximumLines = MAX_LINES) {
        const characters = Array.from(String(text ?? "").trim());
        if (characters.length === 0) return [];

        const lines = [];
        let current = "";
        let index = 0;

        while (index < characters.length) {
          const candidate = current + characters[index];
          if (!current || measureLogicalText(candidate, fontSize, 800) <= maximumWidth) {
            current = candidate;
            index += 1;
            continue;
          }

          lines.push(current);
          current = "";

          if (lines.length >= maximumLines - 1) {
            let finalLine = characters.slice(index).join("");
            if (measureLogicalText(finalLine, fontSize, 800) <= maximumWidth) {
              lines.push(finalLine);
              return lines;
            }
            while (
              finalLine.length > 0 &&
              measureLogicalText(`${finalLine}…`, fontSize, 800) > maximumWidth
            ) {
              finalLine = Array.from(finalLine).slice(0, -1).join("");
            }
            lines.push(finalLine ? `${finalLine}…` : "…");
            return lines;
          }
        }

        if (current) lines.push(current);
        return lines.slice(0, maximumLines);
      }

      function getDanmakuTextLines(text, metrics, maxLines = 3) {
        const rawText = String(text ?? "").trim();
        if (!rawText) return [];

        if (rawText.includes("\n")) {
          const parts = rawText.split("\n");
          while (parts.length > 0 && parts[parts.length - 1].trim() === "") {
            parts.pop();
          }
          const lines = parts.slice(0, maxLines).map(line => {
            const trimmed = line.trim();
            if (!trimmed) return "";
            const wrapped = wrapText(trimmed, metrics.textWidth, metrics.textFontSize, 1);
            return wrapped[0] || trimmed;
          });
          return lines;
        }

        return wrapText(rawText, metrics.textWidth, metrics.textFontSize, maxLines);
      }

      function getBaseMetrics() {
        const isPortrait = WIDTH < HEIGHT;
        const scale = isPortrait ? Math.max(1.05, Math.min(1.35, HEIGHT / 960)) : getUiScale();
        const padding = Math.max(14, Math.round((isPortrait ? 20 : 18) * scale));
        const labelFontSize = isPortrait ? Math.max(15, Math.round(16 * scale)) : Math.max(11, Math.round(14 * scale));
        const textFontSize = isPortrait ? Math.max(22, Math.round(24 * scale)) : Math.max(15, Math.round(20 * scale));
        const lineHeight = Math.max(21, Math.round((isPortrait ? 30 : 26) * scale));
        const sideInset = Math.max(Math.round(28 * scale), Math.round(WIDTH * 0.025));
        const availableWidth = Math.max(Math.round(200 * scale), WIDTH - sideInset * 2);
        const cardWidth = isPortrait
          ? availableWidth
          : Math.min(Math.round(720 * scale), availableWidth);

        return {
          scale,
          padding,
          labelFontSize,
          textFontSize,
          lineHeight,
          cardWidth,
          textWidth: Math.max(56, cardWidth - padding * 2)
        };
      }

      function getReservedLineCount(metrics = getBaseMetrics()) {
        let count = 1;
        danmakuMap.forEach(text => {
          const lines = getDanmakuTextLines(text, metrics, 3);
          count = Math.max(count, lines.length || 1);
        });
        return Math.min(3, count);
      }

      function getDanmakuLayout(key = "", text = "") {
        const metrics = getBaseMetrics();
        const lineCount = getReservedLineCount(metrics);
        const title = Boolean(document.querySelector("#titleInput")?.value.trim());
        const subtitle = Boolean(document.querySelector("#subtitleInput")?.value.trim());
        const headerBottom = subtitle ? 104 : title ? 72 : 22;
        const labelArea = Math.max(22, Math.round(25 * metrics.scale));
        const labelGap = Math.max(6, Math.round(8 * metrics.scale));
        const cardHeight =
          metrics.padding +
          labelArea +
          labelGap +
          lineCount * metrics.lineHeight +
          metrics.padding;
        const cardY = headerBottom + Math.max(10, Math.round(12 * metrics.scale));
        const textLines = getDanmakuTextLines(
          text,
          metrics,
          lineCount
        );

        return {
          x: Math.round((WIDTH - metrics.cardWidth) / 2),
          y: cardY,
          width: metrics.cardWidth,
          height: cardHeight,
          radius: Math.max(10, Math.round(14 * metrics.scale)),
          padding: metrics.padding,
          labelFontSize: metrics.labelFontSize,
          textFontSize: metrics.textFontSize,
          lineHeight: metrics.lineHeight,
          labelBaseline: metrics.padding + metrics.labelFontSize,
          textBaseline:
            metrics.padding + labelArea + labelGap + metrics.textFontSize,
          dotRadius: Math.max(3, Math.round(4.5 * metrics.scale)),
          dotGap: Math.max(8, Math.round(10 * metrics.scale)),
          textLines,
          labelText: `节点 · ${key}`,
          chartTop:
            cardY +
            cardHeight +
            Math.max(16, Math.round(20 * metrics.scale)) +
            42
        };
      }

      function getPanelBounds() {
        const liftRatio = {
          "16:9": 0,
          "3:4": 0.065,
          "4:5": 0.030,
          "9:16": 0.020
        }[getAspectMode()] || 0;
        const lift = Math.round(HEIGHT * liftRatio);
        
        const top = margin.top - 42;
        const fullHeight = HEIGHT - margin.top - margin.bottom + 60 - lift;
        const cardHeight = fullHeight;
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
        const panel = getPanelBounds();
        const portrait = WIDTH < HEIGHT;
        const baseFontSize = Math.min(104, WIDTH * 0.115, HEIGHT * 0.145);
        const maximumWidth = Math.max(120, panel.width * (portrait ? 0.64 : 0.42));
        const measured = measureLogicalText(String(text), baseFontSize, 900);
        const scale = measured > 0 ? Math.min(1, maximumWidth / measured) : 1;
        const extraInsetRatio = {
          "16:9": 0,
          "3:4": 0.030,
          "4:5": 0.018,
          "9:16": 0.014
        }[getAspectMode()] || 0;

        return {
          x: panel.right - 24,
          y: panel.bottom - 18 - Math.round(HEIGHT * extraInsetRatio),
          fontSize: Math.max(32, Math.floor(baseFontSize * scale)),
          maximumWidth
        };
      }

      function getSignature() {
        const danmaku = Array.from(danmakuMap.entries())
          .map(([key, value]) => `${key}:${value}`)
          .join("\u0001");
        return [
          WIDTH,
          HEIGHT,
          isDanmakuEnabled(),
          document.querySelector("#titleInput")?.value || "",
          document.querySelector("#subtitleInput")?.value || "",
          categories.length,
          danmaku
        ].join("|");
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
        if (
          measureLogicalText(String(text), layout.fontSize, 900) >
          layout.maximumWidth
        ) {
          timeLabel
            .attr("textLength", layout.maximumWidth)
            .attr("lengthAdjust", "spacingAndGlyphs");
        }
      }

      getYScaleTargetRange = function integratedYRange(barCount) {
        const liftRatio = {
          "16:9": 0,
          "3:4": 0.065,
          "4:5": 0.030,
          "9:16": 0.020
        }[getAspectMode()] || 0;
        const lift = Math.round(HEIGHT * liftRatio);
        const fullAvailableHeight = HEIGHT - margin.top - margin.bottom - lift;
        const targetHeight = Math.max(0, fullAvailableHeight);
        return [margin.top, margin.top + targetHeight];
      };

      updateResponsiveChartMargins = function integratedMargins() {
        const checkbox = document.querySelector("#showDanmakuInput");
        const enabled = checkbox ? checkbox.checked : true;
        if (checkbox && enabled) checkbox.checked = false;
        try {
          core.updateMargins();
        } finally {
          if (checkbox && enabled) checkbox.checked = true;
        }

        margin.bottom = Math.max(24, Math.min(42, Math.round(HEIGHT * 0.035)));
        if (enabled && danmakuMap.size > 0) {
          margin.top = getDanmakuLayout().chartTop;
        }

        const panel = getPanelBounds();
        plotSurface
          .attr("x", panel.left)
          .attr("y", panel.top)
          .attr("width", panel.width)
          .attr("height", panel.height);
        valueLabelClipRect
          .attr("x", panel.left)
          .attr("width", panel.width)
          .attr("height", HEIGHT);
        xScale.range([margin.left, WIDTH - margin.right]);
        const barCapacity = typeof getMaxCapacityBarCount === "function" ? getMaxCapacityBarCount() : categories.length;
        yScale.range(getYScaleTargetRange(barCapacity));
        zeroLine.attr("y2", getYScaleTargetRange(barCapacity)[1]);
        applyDateLayout();
        layoutSignature = getSignature();
      };

      function ensureLayout() {
        if (layoutSignature !== getSignature()) {
          contentCache.clear();
          updateResponsiveChartMargins();
        }
      }

      function getEntry(frame) {
        if (!frame || !isDanmakuEnabled()) return null;
        const key = getDanmakuKey(frame.time);
        return key && danmakuMap.has(key)
          ? { key, text: String(danmakuMap.get(key) ?? "") }
          : null;
      }

      function renderSvgDanmaku(frame) {
        danmakuGroup.selectAll("*").remove();
        const entry = getEntry(frame);
        if (!entry) {
          danmakuGroup.style("display", "none");
          return;
        }

        const layout = getDanmakuLayout(entry.key, entry.text);
        danmakuGroup.style("display", null);
        danmakuGroup.append("rect")
          .attr("x", layout.x)
          .attr("y", layout.y)
          .attr("width", layout.width)
          .attr("height", layout.height)
          .attr("rx", layout.radius)
          .attr("fill", "#eff6ff")
          .attr("stroke", "#bfdbfe");

        const dotX = layout.x + layout.padding + layout.dotRadius;
        const dotY = layout.y + layout.labelBaseline - layout.dotRadius;
        danmakuGroup.append("circle")
          .attr("cx", dotX)
          .attr("cy", dotY)
          .attr("r", layout.dotRadius)
          .attr("fill", "#2563eb");
        danmakuGroup.append("text")
          .attr("x", dotX + layout.dotRadius + layout.dotGap)
          .attr("y", layout.y + layout.labelBaseline)
          .attr("font-size", layout.labelFontSize)
          .attr("font-weight", 700)
          .attr("fill", "#2563eb")
          .text(layout.labelText);

        const body = danmakuGroup.append("text")
          .attr("font-size", layout.textFontSize)
          .attr("font-weight", 800)
          .attr("fill", "#0f172a");
        layout.textLines.forEach((line, index) => {
          body.append("tspan")
            .attr("x", layout.x + layout.padding)
            .attr("y", layout.y + layout.textBaseline + index * layout.lineHeight)
            .text(line);
        });
      }

      renderFrame = function integratedRenderFrame(frame, animate = true) {
        ensureLayout();
        const checkbox = document.querySelector("#showDanmakuInput");
        const enabled = checkbox ? checkbox.checked : true;
        if (checkbox && enabled) checkbox.checked = false;
        try {
          core.renderFrame(frame, animate);
        } finally {
          if (checkbox && enabled) checkbox.checked = true;
        }
        applyDateLayout(frame?.time || "");
        renderSvgDanmaku(frame);
      };

      function roundedPath(context, x, y, width, height, radius) {
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
      }

      function getPixelLayout(outputWidth, outputHeight, entry) {
        const logical = getDanmakuLayout(entry.key, entry.text);
        const scale = Math.min(outputWidth / WIDTH, outputHeight / HEIGHT);
        const offsetX = (outputWidth - WIDTH * scale) / 2;
        const offsetY = (outputHeight - HEIGHT * scale) / 2;
        return {
          x: Math.round(offsetX + logical.x * scale),
          y: Math.round(offsetY + logical.y * scale),
          width: Math.round(logical.width * scale),
          height: Math.round(logical.height * scale),
          radius: Math.round(logical.radius * scale),
          padding: Math.round(logical.padding * scale),
          labelBaseline: Math.round(logical.labelBaseline * scale),
          textBaseline: Math.round(logical.textBaseline * scale),
          labelFontSize: Math.max(8, Math.round(logical.labelFontSize * scale)),
          textFontSize: Math.max(10, Math.round(logical.textFontSize * scale)),
          lineHeight: Math.max(12, Math.round(logical.lineHeight * scale)),
          dotRadius: Math.max(2, Math.round(logical.dotRadius * scale)),
          dotGap: Math.max(5, Math.round(logical.dotGap * scale)),
          textLines: logical.textLines,
          lineWidth: Math.max(1, Math.round(scale))
        };
      }

      function getCachedContent(outputWidth, outputHeight, entry, layout) {
        const key = [
          outputWidth,
          outputHeight,
          WIDTH,
          HEIGHT,
          layout.width,
          layout.height,
          entry.key,
          entry.text
        ].join("|");
        if (contentCache.has(key)) return contentCache.get(key);

        const canvas = document.createElement("canvas");
        canvas.width = layout.width;
        canvas.height = layout.height;
        const context = canvas.getContext("2d", { alpha: true });
        if (!context) return null;
        context.textAlign = "left";
        context.textBaseline = "alphabetic";

        const dotX = layout.padding + layout.dotRadius;
        const dotY = layout.labelBaseline - layout.dotRadius;
        context.fillStyle = "#2563eb";
        context.beginPath();
        context.arc(dotX, dotY, layout.dotRadius, 0, Math.PI * 2);
        context.fill();
        context.font =
          `700 ${layout.labelFontSize}px ` +
          '"Microsoft YaHei","PingFang SC",Arial,sans-serif';
        context.fillText(
          `节点 · ${entry.key}`,
          dotX + layout.dotRadius + layout.dotGap,
          layout.labelBaseline
        );

        context.fillStyle = "#0f172a";
        context.font =
          `800 ${layout.textFontSize}px ` +
          '"Microsoft YaHei","PingFang SC",Arial,sans-serif';
        layout.textLines.forEach((line, index) => {
          context.fillText(
            line,
            layout.padding,
            layout.textBaseline + index * layout.lineHeight
          );
        });

        contentCache.set(key, canvas);
        while (contentCache.size > CACHE_LIMIT) {
          contentCache.delete(contentCache.keys().next().value);
        }
        return canvas;
      }

      function drawDanmaku(context, outputWidth, outputHeight, entry, alpha, shell = false) {
        if (!entry || alpha <= 0.001) return;
        const layout = getPixelLayout(outputWidth, outputHeight, entry);
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = clamp(alpha, 0, 1);

        if (shell) {
          const inset = layout.lineWidth / 2;
          roundedPath(
            context,
            layout.x + inset,
            layout.y + inset,
            layout.width - layout.lineWidth,
            layout.height - layout.lineWidth,
            layout.radius
          );
          context.fillStyle = "#eff6ff";
          context.fill();
          context.strokeStyle = "#bfdbfe";
          context.lineWidth = layout.lineWidth;
          context.stroke();
        } else {
          const content = getCachedContent(outputWidth, outputHeight, entry, layout);
          if (content) context.drawImage(content, layout.x, layout.y);
        }
        context.restore();
      }

      function drawStableDanmaku(
        context,
        outputWidth,
        outputHeight,
        fromFrame,
        toFrame,
        linearProgress
      ) {
        const fromEntry = getEntry(fromFrame);
        const toEntry = toFrame ? getEntry(toFrame) : fromEntry;
        if (!fromEntry && !toEntry) return;

        const same = Boolean(
          fromEntry &&
          toEntry &&
          fromEntry.key === toEntry.key &&
          fromEntry.text === toEntry.text
        );
        if (same) {
          drawDanmaku(context, outputWidth, outputHeight, fromEntry, 1, true);
          drawDanmaku(context, outputWidth, outputHeight, fromEntry, 1, false);
          return;
        }

        const progress = clamp(Number(linearProgress) || 0, 0, 1);

        if (fromEntry && toEntry) {
          const blend = smoothstep((progress - 0.35) / 0.30);
          drawDanmaku(context, outputWidth, outputHeight, fromEntry, 1, true);
          drawDanmaku(context, outputWidth, outputHeight, fromEntry, 1 - blend, false);
          drawDanmaku(context, outputWidth, outputHeight, toEntry, blend, false);
          return;
        }

        if (fromEntry) {
          const alpha = progress < 0.45 ? 1 : smoothstep(1 - (progress - 0.45) / 0.15);
          drawDanmaku(context, outputWidth, outputHeight, fromEntry, alpha, true);
          drawDanmaku(context, outputWidth, outputHeight, fromEntry, alpha, false);
          return;
        }

        if (toEntry) {
          const alpha = progress < 0.40 ? 0 : smoothstep((progress - 0.40) / 0.15);
          drawDanmaku(context, outputWidth, outputHeight, toEntry, alpha, true);
          drawDanmaku(context, outputWidth, outputHeight, toEntry, alpha, false);
          return;
        }
      }

      function drawDate(context, outputWidth, outputHeight, text) {
        if (!text) return;
        const opacity = typeof getDateOpacity === "function" ? getDateOpacity() : 0.20;
        if (opacity <= 0.001) return;

        const color = typeof getDateColor === "function" ? getDateColor() : "#2563eb";
        const logical = getDateLayout(text);
        const scale = Math.min(outputWidth / WIDTH, outputHeight / HEIGHT);
        const offsetX = (outputWidth - WIDTH * scale) / 2;
        const offsetY = (outputHeight - HEIGHT * scale) / 2;
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = opacity;
        context.fillStyle = color;
        context.font =
          `900 ${Math.max(18, Math.round(logical.fontSize * scale))}px ` +
          '"Microsoft YaHei","PingFang SC",Arial,sans-serif';
        context.textAlign = "right";
        context.textBaseline = "alphabetic";
        context.fillText(
          String(text),
          Math.round(offsetX + logical.x * scale),
          Math.round(offsetY + logical.y * scale),
          Math.round(logical.maximumWidth * scale)
        );
        context.restore();
      }

      drawDirectCanvasVideoFrame = function integratedCanvasFrame(
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
        if (checkbox && enabled) checkbox.checked = false;
        try {
          core.drawCanvasFrame(
            context,
            outputWidth,
            outputHeight,
            { ...(fromFrame || {}), time: "" },
            { ...(toFrame || fromFrame || {}), time: "" },
            easedProgress,
            linearProgress
          );
        } finally {
          if (checkbox && enabled) checkbox.checked = true;
        }

        const activeFrame = (toFrame && (Number(linearProgress) || 0) >= 1)
          ? toFrame
          : fromFrame;
        drawDate(context, outputWidth, outputHeight, activeFrame?.time);
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

      document.querySelector("#titleInput")
        ?.addEventListener("input", () => {
          layoutSignature = "";
          contentCache.clear();
        });
      document.querySelector("#subtitleInput")
        ?.addEventListener("input", () => {
          layoutSignature = "";
          contentCache.clear();
        });
      document.querySelector("#danmakuTextInput")
        ?.addEventListener("input", () => {
          layoutSignature = "";
          contentCache.clear();
        });

      layoutSignature = "";
      updateResponsiveChartMargins();
      if (raceData.length > 0) {
        renderFrame(raceData[currentFrameIndex], false);
      }
    });
  });
})();
