    let baseWidth = 1280;
    let WIDTH = 1280;
    let HEIGHT = 720;
    const BASE_FRAME_DURATION = 1500;

    const MOTION_RATIO = 0.82;
    const MOTION_EASING = d3.easeCubicInOut;

    const GIF_WIDTH = 960;
    const GIF_HEIGHT = 540;

    const NAME_BAR_GAP = 12;
    const CHART_SIDE_PADDING = 16;
    const VALUE_ICON_SIZE = 32;
    const VALUE_ICON_TEXT_GAP = 9;
    const VALUE_BAR_GAP = 10;
    const MIN_VALUE_LABEL_GUTTER = 40;
    const MAX_VALUE_LABEL_GUTTER = 180;
    const margin = { top: 154, right: 60, bottom: 58, left: 120 };

    const sampleRows = [
      ["年份", "Python", "Java", "JavaScript", "C++", "Go", "Kotlin", "Rust", "Swift"],
      ["2020", 66, 96, -12, 74, -24, 22, -38, 31],
      ["2021", 78, 82, 18, 61, -10, 34, -22, 19],
      ["2022", 92, 54, 47, 33, 12, 49, -5, -14],
      ["2023", 111, 24, 76, 8, 36, 66, 18, -28],
      ["2024", 132, -16, 98, -21, 59, 85, 44, -9],
      ["2025", 153, -42, 121, -37, 83, 105, 73, 16],
      ["2026", 177, -68, 145, -55, 108, 128, 101, 38]
    ];

    let rows = structuredClone(sampleRows);
    let raceData = [];
    let categories = [];
    let categoryOrderMap = new Map();
    let globalXAxisDomain = [-1, 1];
    let symmetricXAxisDomain = [-1, 1];
    let dynamicAxisTimeline = [];
    let globalValueStats = {
      min: 0,
      max: 0,
      minAbsNonZero: 0,
      maxAbs: 0,
      ratio: 1
    };
    let activeXAxisScaleType = "linear";
    let autoColors = new Map();
    const customColors = new Map();
    const customIcons = new Map();
    const iconImageCache = new Map();
    let currentFrameIndex = 0;
    let isPlaying = false;
    let playToken = 0;
    let videoExportCancelled = false;
    let gifExportCancelled = false;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const defs = svg.append("defs");

    const valueLabelClipRect = defs
      .append("clipPath")
      .attr("id", "valueLabelClip")
      .attr("clipPathUnits", "userSpaceOnUse")
      .append("rect")
      .attr("x", CHART_SIDE_PADDING)
      .attr("y", 0)
      .attr(
        "width",
        WIDTH - CHART_SIDE_PADDING * 2
      )
      .attr("height", HEIGHT);

    defs.append("clipPath")
      .attr("id", "circleIconClip")
      .attr("clipPathUnits", "objectBoundingBox")
      .append("circle")
      .attr("cx", 0.5)
      .attr("cy", 0.5)
      .attr("r", 0.5);

    const iconShadow = defs.append("filter")
      .attr("id", "iconShadow")
      .attr("x", "-45%")
      .attr("y", "-45%")
      .attr("width", "190%")
      .attr("height", "190%");

    iconShadow.append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 2)
      .attr("stdDeviation", 2.2)
      .attr("flood-color", "#0f172a")
      .attr("flood-opacity", 0.22);

    const barShadow = defs.append("filter")
      .attr("id", "barShadow")
      .attr("x", "-12%")
      .attr("y", "-35%")
      .attr("width", "130%")
      .attr("height", "180%");

    barShadow.append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 3)
      .attr("stdDeviation", 3.2)
      .attr("flood-color", "#0f172a")
      .attr("flood-opacity", 0.16);

    const surfaceShadow = defs.append("filter")
      .attr("id", "surfaceShadow")
      .attr("x", "-8%")
      .attr("y", "-12%")
      .attr("width", "116%")
      .attr("height", "128%");

    surfaceShadow.append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 6)
      .attr("stdDeviation", 8)
      .attr("flood-color", "#334155")
      .attr("flood-opacity", 0.07);

    svg.append("rect")
      .attr("width", WIDTH)
      .attr("height", HEIGHT)
      .attr("fill", "transparent");

    const plotSurface = svg.append("rect")
      .attr("class", "plot-surface")
      .attr("x", CHART_SIDE_PADDING)
      .attr("y", margin.top - 42)
      .attr(
        "width",
        WIDTH -
          CHART_SIDE_PADDING -
          margin.right +
          18
      )
      .attr(
        "height",
        HEIGHT - margin.top - margin.bottom + 60
      )
      .attr("rx", 19)
      .attr("filter", "url(#surfaceShadow)");

    const TITLE_LEFT = CHART_SIDE_PADDING + 16;

    const titleAccent = svg.append("rect")
      .attr("x", TITLE_LEFT - 14)
      .attr("y", 34)
      .attr("width", 5)
      .attr("height", 31)
      .attr("rx", 2.5)
      .attr("fill", "#2563eb");

    const titleLabel = svg.append("text")
      .attr("class", "chart-title")
      .attr("x", TITLE_LEFT)
      .attr("y", 55);

    const subtitleLabel = svg.append("text")
      .attr("class", "chart-subtitle")
      .attr("x", TITLE_LEFT)
      .attr("y", 88);

    const zeroLine = svg.append("line")
      .attr("class", "zero-line")
      .attr("y1", margin.top)
      .attr("y2", HEIGHT - margin.bottom);

    const chartGroup = svg.append("g");
    const xAxisGroup = svg.append("g").attr("class", "axis");
    const timeLabel = svg.append("text")
      .attr("class", "time-label")
      .attr("x", WIDTH - margin.right)
      .attr("y", HEIGHT - margin.bottom + 2)
      .attr("text-anchor", "end");

    const danmakuMap = new Map();
    const danmakuGroup = svg.append("g").attr("class", "danmaku-group");

    function getDateOpacity() {
      const el = document.querySelector("#dateOpacityInput");
      const raw = el ? Number(el.value) : 20;
      const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 20;
      return clamped / 100;
    }

    function getDateColor() {
      const codeEl = document.querySelector("#dateColorCodeInput");
      const pickerEl = document.querySelector("#dateColorInput");
      const raw = (codeEl ? codeEl.value : pickerEl ? pickerEl.value : "").trim();
      const normalized = normalizeHexColorInput(raw);
      return normalized || "#2563EB";
    }

    function updateDateOpacity() {
      const opacity = getDateOpacity();
      const label = document.querySelector("#dateOpacityValue");
      if (label) {
        label.textContent = `${Math.round(opacity * 100)}%`;
      }
      timeLabel.style("opacity", opacity);
    }

    function updateDateColor(colorHex) {
      const picker = document.querySelector("#dateColorInput");
      const code = document.querySelector("#dateColorCodeInput");
      const validHex = normalizeHexColorInput(colorHex) || "#2563EB";

      if (picker && picker.value.toUpperCase() !== validHex.toUpperCase()) {
        picker.value = validHex;
      }
      if (code && code.value.toUpperCase() !== validHex.toUpperCase()) {
        code.value = validHex;
      }

      timeLabel.style("fill", validHex);
    }

    function isDanmakuEnabled() {
      const el = document.querySelector("#showDanmakuInput");
      return el ? el.checked : true;
    }

    function getDanmakuKey(t) {
      return String(t ?? "").trim();
    }

    function shouldShowXAxis() {
      const el = document.querySelector("#showXAxisInput");
      return el ? el.checked : true;
    }

    function updateDanmakuTimeSelect() {
      const select = document.querySelector("#danmakuTimeSelect");
      if (!select) return;
      select.replaceChildren();

      const timeNodes = raceData.map(f => f.time);
      timeNodes.forEach(t => {
        const option = document.createElement("option");
        const k = getDanmakuKey(t);
        option.value = k;
        option.textContent = k;
        select.appendChild(option);
      });

      updateDanmakuFormState();
    }

    function updateVideoCoverSelect() {
      const select = document.querySelector("#videoCoverFrameInput");
      if (!select) return;

      const currentValue = select.value || "last";
      select.replaceChildren();

      const optionLast = document.createElement("option");
      optionLast.value = "last";
      const lastTimeStr = raceData.length > 0 ? `（最终结果：${raceData[raceData.length - 1].time}）` : "";
      optionLast.textContent = `最后一帧${lastTimeStr}`;
      select.appendChild(optionLast);

      const optionFirst = document.createElement("option");
      optionFirst.value = "first";
      const firstTimeStr = raceData.length > 0 ? `（初始状态：${raceData[0].time}）` : "";
      optionFirst.textContent = `第一帧${firstTimeStr}`;
      select.appendChild(optionFirst);

      if (raceData && raceData.length > 0) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = "—— 指定具体时间节点 ——";

        raceData.forEach(frame => {
          const opt = document.createElement("option");
          opt.value = `node:${frame.time}`;
          opt.textContent = `时间节点：${frame.time}`;
          optgroup.appendChild(opt);
        });

        select.appendChild(optgroup);
      }

      const matched = Array.from(select.options).some(opt => opt.value === currentValue);
      if (matched) {
        select.value = currentValue;
      } else {
        select.value = "last";
      }
    }

    function updateDanmakuFormState() {
      const timeSelect = document.querySelector("#danmakuTimeSelect");
      const addBtn = document.querySelector("#addDanmakuButton");
      const line1El = document.querySelector("#danmakuLine1Input");
      const line2El = document.querySelector("#danmakuLine2Input");
      const line3El = document.querySelector("#danmakuLine3Input");
      if (!timeSelect || !addBtn) return;

      const key = getDanmakuKey(timeSelect.value);
      if (danmakuMap.has(key)) {
        addBtn.textContent = "更新解说";
        addBtn.classList.add("primary");
        const fullText = danmakuMap.get(key) || "";
        const lines = fullText.split("\n");
        if (line1El && document.activeElement !== line1El && document.activeElement !== line2El && document.activeElement !== line3El) {
          line1El.value = lines[0] || "";
          if (line2El) line2El.value = lines[1] || "";
          if (line3El) line3El.value = lines[2] || "";
        }
      } else {
        addBtn.textContent = "保存解说";
        addBtn.classList.remove("primary");
        if (line1El && document.activeElement !== line1El && document.activeElement !== line2El && document.activeElement !== line3El) {
          line1El.value = "";
          if (line2El) line2El.value = "";
          if (line3El) line3El.value = "";
        }
      }
    }

    function editDanmaku(time) {
      const timeSelect = document.querySelector("#danmakuTimeSelect");
      const line1El = document.querySelector("#danmakuLine1Input");
      const line2El = document.querySelector("#danmakuLine2Input");
      const line3El = document.querySelector("#danmakuLine3Input");
      if (!timeSelect) return;

      const key = getDanmakuKey(time);
      timeSelect.value = key;

      if (danmakuMap.has(key)) {
        const fullText = danmakuMap.get(key) || "";
        const lines = fullText.split("\n");
        if (line1El) line1El.value = lines[0] || "";
        if (line2El) line2El.value = lines[1] || "";
        if (line3El) line3El.value = lines[2] || "";
      } else {
        if (line1El) line1El.value = "";
        if (line2El) line2El.value = "";
        if (line3El) line3El.value = "";
      }

      if (line1El) line1El.focus();
      updateDanmakuFormState();
      setStatus(`已将【${key}】的解说内容载入输入框，修改后点击“更新解说”即可保存。`);
    }

    function renderDanmakuList() {
      const container = document.querySelector("#danmakuList");
      if (!container) return;
      container.replaceChildren();

      if (danmakuMap.size === 0) {
        const empty = document.createElement("span");
        empty.style.color = "#94a3b8";
        empty.style.fontSize = "12.5px";
        empty.textContent = "尚未添加任何时间节点解说。";
        container.appendChild(empty);
        updateDanmakuFormState();
        return;
      }

      danmakuMap.forEach((text, time) => {
        const item = document.createElement("div");
        item.className = "danmaku-item";
        item.title = "点击编辑此条解说";

        const timeSpan = document.createElement("span");
        timeSpan.className = "danmaku-time";
        timeSpan.textContent = time;

        const textSpan = document.createElement("span");
        textSpan.className = "danmaku-text";
        const lines = String(text ?? "").split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          textSpan.textContent = `${lines[0]} [共 ${lines.length} 行]`;
        } else {
          textSpan.textContent = lines[0] || text;
        }

        const editBtn = document.createElement("button");
        editBtn.className = "danmaku-edit";
        editBtn.innerHTML = "✏️";
        editBtn.title = "编辑此条解说";
        editBtn.onclick = (e) => {
          e.stopPropagation();
          editDanmaku(time);
        };

        const removeBtn = document.createElement("button");
        removeBtn.className = "danmaku-remove";
        removeBtn.textContent = "✕";
        removeBtn.title = "删除此条解说";
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          removeDanmaku(time);
        };

        item.onclick = () => editDanmaku(time);

        item.append(timeSpan, textSpan, editBtn, removeBtn);
        container.appendChild(item);
      });

      updateDanmakuFormState();
    }

    function addDanmaku() {
      const timeSelect = document.querySelector("#danmakuTimeSelect");
      const line1El = document.querySelector("#danmakuLine1Input");
      const line2El = document.querySelector("#danmakuLine2Input");
      const line3El = document.querySelector("#danmakuLine3Input");
      if (!timeSelect) return;

      const key = getDanmakuKey(timeSelect.value);
      const l1 = line1El ? line1El.value.trim() : "";
      const l2 = line2El ? line2El.value.trim() : "";
      const l3 = line3El ? line3El.value.trim() : "";

      if (!key || (!l1 && !l2 && !l3)) {
        setStatus("请选择时间节点并至少输入一行解说文字！", true);
        return;
      }

      const combinedText = [l1, l2, l3].join("\n").replace(/\n+$/, "");
      const isUpdate = danmakuMap.has(key);
      danmakuMap.set(key, combinedText);

      if (line1El) line1El.value = "";
      if (line2El) line2El.value = "";
      if (line3El) line3El.value = "";

      renderDanmakuList();
      saveAppState();
      updateResponsiveChartMargins();
      renderFrame(raceData[currentFrameIndex], false);
      setStatus(isUpdate ? `已更新【${key}】的解说内容！` : `已为【${key}】添加解说！`);
    }

    function removeDanmaku(time) {
      const key = getDanmakuKey(time);
      danmakuMap.delete(key);
      renderDanmakuList();
      saveAppState();
      updateResponsiveChartMargins();
      renderFrame(raceData[currentFrameIndex], false);
      setStatus(`已移除【${key}】的解说。`);
    }

    let xScale = d3.scaleLinear()
      .range([margin.left, WIDTH - margin.right]);

    const yScale = d3.scaleBand()
      .range([margin.top, HEIGHT - margin.bottom])
      .padding(0.16);

    const colorScale = d3.scaleOrdinal();

    function setStatus(message, isError = false) {
      const status = document.querySelector("#status");
      status.textContent = message;
      status.classList.toggle("error", isError);
    }

    function normalizeRows(rawRows) {
      const filtered = rawRows
        .map(row => row.map(cell => cell ?? ""))
        .filter(row => row.some(cell => String(cell).trim() !== ""));

      if (filtered.length < 2) {
        throw new Error("数据至少需要表头和一行数据。");
      }

      const maxColumns = Math.max(...filtered.map(row => row.length));
      const normalized = filtered.map(row => {
        const output = [...row];
        while (output.length < maxColumns) output.push("");
        return output;
      });

      const headers = normalized[0].map((cell, index) => {
        const value = String(cell).trim();
        if (index === 0) return value || "时间";
        return value || `对象${index}`;
      });

      const uniqueHeaders = new Set(headers.slice(1));
      if (uniqueHeaders.size !== headers.length - 1) {
        throw new Error("除时间列外，表头名称不能重复。");
      }

      const dataRows = normalized.slice(1).map((row, rowIndex) => {
        const time = String(row[0]).trim();
        if (!time) throw new Error(`第 ${rowIndex + 2} 行缺少时间。`);

        const values = row.slice(1).map(cell => {
          if (cell === "" || cell === null || cell === undefined) return 0;
          const cleaned = String(cell).replaceAll(",", "").trim();
          const number = Number(cleaned);
          if (!Number.isFinite(number)) {
            throw new Error(`第 ${rowIndex + 2} 行存在非数值内容：“${cell}”。`);
          }
          return number;
        });

        return [time, ...values];
      });

      return [headers, ...dataRows];
    }

    function makeNiceDomain(
      rawMin,
      rawMax,
      symmetric = false
    ) {
      let domainMin = Number.isFinite(rawMin)
        ? rawMin
        : 0;
      let domainMax = Number.isFinite(rawMax)
        ? rawMax
        : 0;

      if (symmetric) {
        const maximumAbsoluteValue = Math.max(
          1,
          Math.abs(domainMin),
          Math.abs(domainMax)
        );

        domainMin = -maximumAbsoluteValue * 1.10;
        domainMax = maximumAbsoluteValue * 1.10;
      } else {
        domainMin = Math.min(0, domainMin);
        domainMax = Math.max(0, domainMax);

        if (domainMin === domainMax) {
          domainMin = Math.min(0, domainMin - 1);
          domainMax = Math.max(1, domainMax + 1);
        }

        const span = domainMax - domainMin || 1;

        if (domainMin < 0) {
          domainMin -= span * 0.10;
        }

        if (domainMax > 0) {
          domainMax += span * 0.10;
        }
      }

      return d3.scaleLinear()
        .domain([domainMin, domainMax])
        .nice(6)
        .domain();
    }

    function updateGlobalXAxisDomains() {
      let rawMin = Infinity;
      let rawMax = -Infinity;
      let minAbsNonZero = Infinity;
      let maxAbs = 0;

      /*
       * 不使用 flatMap 复制全部数值，避免大数据集产生额外内存峰值。
       */
      raceData.forEach(frame => {
        Object.values(frame.values).forEach(rawValue => {
          const value = Number(rawValue);
          if (!Number.isFinite(value)) return;

          rawMin = Math.min(rawMin, value);
          rawMax = Math.max(rawMax, value);

          const absoluteValue = Math.abs(value);
          maxAbs = Math.max(maxAbs, absoluteValue);

          if (absoluteValue > 0) {
            minAbsNonZero = Math.min(
              minAbsNonZero,
              absoluteValue
            );
          }
        });
      });

      if (!Number.isFinite(rawMin)) rawMin = 0;
      if (!Number.isFinite(rawMax)) rawMax = 0;
      if (!Number.isFinite(minAbsNonZero)) {
        minAbsNonZero = 0;
      }

      const ratio =
        minAbsNonZero > 0
          ? maxAbs / minAbsNonZero
          : 1;

      globalValueStats = {
        min: rawMin,
        max: rawMax,
        minAbsNonZero,
        maxAbs,
        ratio
      };

      globalXAxisDomain = makeNiceDomain(
        rawMin,
        rawMax,
        false
      );

      symmetricXAxisDomain = makeNiceDomain(
        rawMin,
        rawMax,
        true
      );
    }

    function getDynamicAxisMinimumMagnitude() {
      const minimum = globalValueStats.minAbsNonZero;

      if (!(minimum > 0)) {
        return 1;
      }

      return Math.pow(
        10,
        Math.floor(Math.log10(minimum))
      );
    }

    function getValueExtents(values) {
      let minimum = 0;
      let maximum = 0;

      Object.values(values).forEach(rawValue => {
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return;

        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      });

      return {
        minimum,
        maximum,
        negativeMagnitude: Math.abs(
          Math.min(0, minimum)
        ),
        positiveMagnitude: Math.max(
          0,
          maximum
        ),
        maximumAbsolute: Math.max(
          Math.abs(minimum),
          Math.abs(maximum)
        )
      };
    }

    function smoothAxisTargetSeries(
      targets,
      shrinkAlpha = 0.20,
      deadZoneRatio = 0.05
    ) {
      if (targets.length === 0) return [];

      let current = targets[0];

      return targets.map((rawTarget, index) => {
        const target = Math.max(
          getDynamicAxisMinimumMagnitude(),
          rawTarget
        );

        if (index === 0) {
          current = target;
          return current;
        }

        /*
         * 扩张时直接到达目标，防止柱体被裁剪；
         * 收缩时缓慢跟随，并设置 5% 死区，防止范围来回抖动。
         * 相邻时间点之间仍会由动画连续插值。
         */
        if (target > current) {
          current = target;
        } else {
          const changeRatio =
            (current - target) /
            Math.max(
              current,
              getDynamicAxisMinimumMagnitude()
            );

          if (changeRatio > deadZoneRatio) {
            current +=
              (target - current) *
              shrinkAlpha;
          }
        }

        return current;
      });
    }

    function updateDynamicAxisTimeline() {
      const minimumMagnitude =
        getDynamicAxisMinimumMagnitude();

      const extents = raceData.map(frame =>
        getValueExtents(frame.values)
      );

      const symmetricTargets = extents.map(
        extent => Math.max(
          minimumMagnitude,
          extent.maximumAbsolute * 1.12
        )
      );

      const negativeTargets = extents.map(
        extent => Math.max(
          minimumMagnitude,
          extent.negativeMagnitude * 1.12
        )
      );

      const positiveTargets = extents.map(
        extent => Math.max(
          minimumMagnitude,
          extent.positiveMagnitude * 1.12
        )
      );

      const symmetricSeries =
        smoothAxisTargetSeries(
          symmetricTargets,
          0.20,
          0.05
        );

      const negativeSeries =
        smoothAxisTargetSeries(
          negativeTargets,
          0.20,
          0.05
        );

      const positiveSeries =
        smoothAxisTargetSeries(
          positiveTargets,
          0.20,
          0.05
        );

      dynamicAxisTimeline = raceData.map(
        (frame, index) => ({
          symmetricMaximum:
            symmetricSeries[index],
          negativeMagnitude:
            negativeSeries[index],
          positiveMagnitude:
            positiveSeries[index]
        })
      );

      raceData.forEach((frame, index) => {
        frame.axisState =
          dynamicAxisTimeline[index];
      });
    }

    function interpolateAxisState(
      fromFrame,
      toFrame,
      ratio,
      interpolatedValues
    ) {
      const minimumMagnitude =
        getDynamicAxisMinimumMagnitude();

      const fromState =
        fromFrame.axisState || {
          symmetricMaximum:
            getValueExtents(
              fromFrame.values
            ).maximumAbsolute * 1.12,
          negativeMagnitude:
            getValueExtents(
              fromFrame.values
            ).negativeMagnitude * 1.12,
          positiveMagnitude:
            getValueExtents(
              fromFrame.values
            ).positiveMagnitude * 1.12
        };

      const toState =
        toFrame.axisState || {
          symmetricMaximum:
            getValueExtents(
              toFrame.values
            ).maximumAbsolute * 1.12,
          negativeMagnitude:
            getValueExtents(
              toFrame.values
            ).negativeMagnitude * 1.12,
          positiveMagnitude:
            getValueExtents(
              toFrame.values
            ).positiveMagnitude * 1.12
        };

      const currentExtent =
        getValueExtents(interpolatedValues);

      return {
        symmetricMaximum: Math.max(
          minimumMagnitude,
          currentExtent.maximumAbsolute * 1.08,
          d3.interpolateNumber(
            fromState.symmetricMaximum,
            toState.symmetricMaximum
          )(ratio)
        ),
        negativeMagnitude: Math.max(
          minimumMagnitude,
          currentExtent.negativeMagnitude * 1.08,
          d3.interpolateNumber(
            fromState.negativeMagnitude,
            toState.negativeMagnitude
          )(ratio)
        ),
        positiveMagnitude: Math.max(
          minimumMagnitude,
          currentExtent.positiveMagnitude * 1.08,
          d3.interpolateNumber(
            fromState.positiveMagnitude,
            toState.positiveMagnitude
          )(ratio)
        )
      };
    }

    function getRequestedValueScaleType() {
      return document
        .querySelector("#valueScaleInput")
        .value;
    }

    function resolveXAxisScaleType() {
      const requested = getRequestedValueScaleType();

      if (requested !== "auto") {
        return requested;
      }

      /*
       * 当数量级跨度超过 10^4 时，线性轴通常会让小值不可见。
       */
      return globalValueStats.ratio >= 10_000
        ? "symlog"
        : "linear";
    }

    function getSymlogConstant() {
      const minimum = globalValueStats.minAbsNonZero;

      if (!(minimum > 0)) {
        return 1;
      }

      return Math.pow(
        10,
        Math.floor(Math.log10(minimum))
      );
    }

    function getValueLabelGutter(frame = null) {
      let maximumTextWidth = 45;

      if (frame && frame.values) {
        Object.entries(frame.values).forEach(([cat, val]) => {
          const v = Number(val);
          if (Number.isFinite(v)) {
            const formatted = formatValue(v);
            const w = measureLogicalText(formatted, 22, 800);
            if (w > maximumTextWidth) maximumTextWidth = w;
          }
        });
      } else if (raceData && raceData.length > 0) {
        categories.forEach(cat => {
          raceData.forEach(f => {
            const v = Number(f?.values?.[cat]);
            if (Number.isFinite(v)) {
              const formatted = formatValue(v);
              const w = measureLogicalText(formatted, 22, 800);
              if (w > maximumTextWidth) maximumTextWidth = w;
            }
          });
        });
      }

      const iconSize = typeof getSvgValueIconSize === "function"
        ? getSvgValueIconSize()
        : VALUE_ICON_SIZE;

      return Math.max(
        100,
        Math.min(
          320,
          Math.ceil(
            maximumTextWidth +
            iconSize +
            VALUE_ICON_TEXT_GAP +
            VALUE_BAR_GAP +
            28
          )
        )
      );
    }

    function configureXAxisScale(domain, frame = null) {
      const scaleType = resolveXAxisScaleType();
      const mode = document
        .querySelector("#xAxisModeInput")
        .value;

      activeXAxisScaleType = scaleType;

      const valueLabelGutter = getValueLabelGutter(frame);

      const rangeStart = mode === "non-negative"
        ? margin.left
        : margin.left + Math.min(30, Math.ceil(valueLabelGutter * 0.4));

      const rangeEnd = Math.max(rangeStart + 100, WIDTH - margin.right - valueLabelGutter);

      if (mode === "smooth-split") {
        const zeroPosition =
          (rangeStart + rangeEnd) / 2;

        const domainMinimum = Math.min(
          -getDynamicAxisMinimumMagnitude(),
          domain[0]
        );

        const domainMaximum = Math.max(
          getDynamicAxisMinimumMagnitude(),
          domain[1]
        );

        const splitDomain = [
          domainMinimum,
          0,
          domainMaximum
        ];

        const splitRange = [
          rangeStart,
          zeroPosition,
          rangeEnd
        ];

        if (scaleType === "symlog") {
          xScale = d3.scaleSymlog()
            .constant(getSymlogConstant())
            .domain(splitDomain)
            .range(splitRange);
        } else {
          xScale = d3.scaleLinear()
            .domain(splitDomain)
            .range(splitRange);
        }

        return;
      }

      if (scaleType === "symlog") {
        xScale = d3.scaleSymlog()
          .constant(getSymlogConstant())
          .domain(domain)
          .range([rangeStart, rangeEnd]);
      } else {
        xScale = d3.scaleLinear()
          .domain(domain)
          .range([rangeStart, rangeEnd]);
      }
    }

    function formatAxisTick(value) {
      if (value === 0) return "0";

      const absoluteValue = Math.abs(value);

      if (
        absoluteValue >= 1e15 ||
        absoluteValue < 1e-4
      ) {
        return d3.format(".2e")(value);
      }

      return d3.format(".3~s")(value);
    }

    function getCurrentXAxisDomain(
      ranking,
      frame = null
    ) {
      const mode = document
        .querySelector("#xAxisModeInput")
        .value;

      if (mode === "non-negative") {
        const currentExtent = getValueExtents(
          frame?.values ||
          Object.fromEntries(
            ranking.map(item => [
              item.name,
              item.value
            ])
          )
        );

        const positiveMagnitude = Math.max(
          getDynamicAxisMinimumMagnitude(),
          currentExtent.positiveMagnitude * 1.08,
          frame?.axisState?.positiveMagnitude || 0
        );

        return [0, positiveMagnitude];
      }

      if (mode === "fixed") {
        return [...globalXAxisDomain];
      }

      if (mode === "symmetric") {
        return [...symmetricXAxisDomain];
      }

      if (mode === "smooth-symmetric") {
        const currentExtent = getValueExtents(
          frame?.values ||
          Object.fromEntries(
            ranking.map(item => [
              item.name,
              item.value
            ])
          )
        );

        const maximum = Math.max(
          getDynamicAxisMinimumMagnitude(),
          currentExtent.maximumAbsolute * 1.08,
          frame?.axisState?.symmetricMaximum || 0
        );

        return [-maximum, maximum];
      }

      if (mode === "smooth-split") {
        const currentExtent = getValueExtents(
          frame?.values ||
          Object.fromEntries(
            ranking.map(item => [
              item.name,
              item.value
            ])
          )
        );

        const negativeMagnitude = Math.max(
          getDynamicAxisMinimumMagnitude(),
          currentExtent.negativeMagnitude * 1.08,
          frame?.axisState?.negativeMagnitude || 0
        );

        const positiveMagnitude = Math.max(
          getDynamicAxisMinimumMagnitude(),
          currentExtent.positiveMagnitude * 1.08,
          frame?.axisState?.positiveMagnitude || 0
        );

        return [
          -negativeMagnitude,
          positiveMagnitude
        ];
      }

      /*
       * 旧的自由动态模式：根据当前可见排名直接计算，
       * 0 刻度可能随最小值和最大值变化而移动。
       */
      const numericValues =
        ranking.map(item => item.value);
      const rawMin =
        d3.min(numericValues) ?? 0;
      const rawMax =
        d3.max(numericValues) ?? 0;

      return makeNiceDomain(
        rawMin,
        rawMax,
        false
      );
    }

    function isXAxisFixed() {
      return document
        .querySelector("#xAxisModeInput")
        .value !== "dynamic";
    }

    function convertRowsToRaceData(normalizedRows) {
      const headers = normalizedRows[0];
      categories = headers.slice(1);

      categoryOrderMap = new Map(
        categories.map(
          (name, index) => [name, index]
        )
      );

      updateResponsiveChartMargins();

      /*
       * 自动配色：
       * - 主体数量不受固定调色板限制
       * - 使用黄金角分布色相，尽量拉开相邻颜色
       * - 同一批主体、同一排序下颜色保持稳定
       * - 超过 10 个主体时不会像 schemeTableau10 那样重复
       */
      const sortedCategories = [...categories].sort((a, b) =>
        a.localeCompare(b, "zh-CN")
      );

      autoColors = new Map(
        sortedCategories.map((name, index) => {
          const goldenAngle = 137.508;
          const hue = (index * goldenAngle + 18) % 360;

          // 轻微调整饱和度和亮度，让大量颜色更容易区分
          const saturation = 0.64 + (index % 3) * 0.06;
          const lightness = 0.46 + (index % 2) * 0.07;

          return [
            name,
            d3.hsl(hue, saturation, lightness).formatHex()
          ];
        })
      );

      refreshColorScale();

      raceData = normalizedRows.slice(1).map(row => ({
        time: String(row[0]),
        values: Object.fromEntries(
          categories.map((name, index) => [name, Number(row[index + 1]) || 0])
        )
      }));

      updateGlobalXAxisDomains();
      updateDynamicAxisTimeline();
    }

    function getBarColor(name) {
      return (
        customColors.get(name) ||
        autoColors.get(name) ||
        "#2563eb"
      );
    }

    let gradientIdMap = new Map();
    let gradientIdCounter = 0;

    function getGradientId(name) {
      if (!gradientIdMap.has(name)) {
        gradientIdMap.set(name, "bar-grad-" + (++gradientIdCounter));
      }
      return gradientIdMap.get(name);
    }

    function getGradientColors(baseHex) {
      const color = d3.hsl(baseHex);
      if (isNaN(color.h)) color.h = 0;
      const startColor = color.copy({ l: Math.max(0, color.l * 0.95) }).formatHex();
      const endColor = color.copy({ h: (color.h + 15) % 360, l: Math.min(1, color.l * 1.25), s: Math.min(1, color.s * 1.1) }).formatHex();
      return { start: startColor, end: endColor };
    }

    function refreshColorScale() {
      colorScale
        .domain(categories)
        .range(categories.map(name => getBarColor(name)));

      const gradientData = categories.map(name => {
        const { start, end } = getGradientColors(getBarColor(name));
        return { name, id: getGradientId(name), start, end };
      });
      
      const grads = defs.selectAll("linearGradient.bar-grad").data(gradientData, d => d.name);
      
      const gradsEnter = grads.enter()
        .append("linearGradient")
        .attr("class", "bar-grad")
        .attr("id", d => d.id)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
        
      gradsEnter.append("stop").attr("class", "stop-start").attr("offset", "0%");
      gradsEnter.append("stop").attr("class", "stop-end").attr("offset", "100%");
        
      const gradsMerge = gradsEnter.merge(grads);
      gradsMerge.select(".stop-start").attr("stop-color", d => d.start);
      gradsMerge.select(".stop-end").attr("stop-color", d => d.end);
      grads.exit().remove();
    }

    function getContrastTextColor(color) {
      const parsed = d3.color(color);
      if (!parsed) return "#ffffff";

      const linearize = channel => {
        const value = channel / 255;
        return value <= 0.03928
          ? value / 12.92
          : Math.pow((value + 0.055) / 1.055, 2.4);
      };

      const luminance =
        0.2126 * linearize(parsed.r) +
        0.7152 * linearize(parsed.g) +
        0.0722 * linearize(parsed.b);

      return luminance > 0.52 ? "#172033" : "#ffffff";
    }

    function normalizeHexColorInput(rawValue) {
      let value = String(rawValue ?? "")
        .trim()
        .toUpperCase();

      if (!value) return null;

      if (!value.startsWith("#")) {
        value = `#${value}`;
      }

      if (/^#[0-9A-F]{3}$/.test(value)) {
        value = (
          "#" +
          value[1] + value[1] +
          value[2] + value[2] +
          value[3] + value[3]
        );
      }

      return /^#[0-9A-F]{6}$/.test(value)
        ? value
        : null;
    }

    function applyCustomColor(
      name,
      normalizedColor,
      picker,
      textInput
    ) {
      customColors.set(
        name,
        normalizedColor.toLowerCase()
      );

      picker.value =
        normalizedColor.toLowerCase();
      textInput.value = normalizedColor;
      textInput.classList.remove("invalid");
      textInput.setCustomValidity("");

      refreshColorScale();
      renderFrame(
        raceData[currentFrameIndex],
        false
      );
      saveAppState();
    }

    function getIconInitial(name) {
      const characters = Array.from(
        String(name || "").trim()
      );

      return characters[0] || "•";
    }

    function getIconDataUrl(name) {
      return customIcons.get(name) || "";
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(
          String(reader.result || "")
        );

        reader.onerror = () => reject(
          new Error("读取图片失败。")
        );

        reader.readAsDataURL(file);
      });
    }

    function loadImageElement(source) {
      return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => reject(
          new Error("图片解码失败。")
        );

        image.src = source;
      });
    }

    async function optimizeUploadedIcon(file) {
      if (!file) {
        throw new Error("未选择图片。");
      }

      if (!file.type.startsWith("image/")) {
        throw new Error("请选择 PNG、JPG、WebP 等图片文件。");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("图标图片不能超过 10MB。");
      }

      const originalDataUrl =
        await readFileAsDataUrl(file);

      const image =
        await loadImageElement(originalDataUrl);

      const outputSize = 256;
      const canvas =
        document.createElement("canvas");

      canvas.width = outputSize;
      canvas.height = outputSize;

      const context = canvas.getContext("2d", {
        alpha: true
      });

      if (!context) {
        throw new Error("无法创建图标处理画布。");
      }

      const sourceSize = Math.min(
        image.naturalWidth,
        image.naturalHeight
      );

      const sourceX =
        (image.naturalWidth - sourceSize) / 2;

      const sourceY =
        (image.naturalHeight - sourceSize) / 2;

      context.clearRect(
        0,
        0,
        outputSize,
        outputSize
      );

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize
      );

      return canvas.toDataURL(
        "image/png"
      );
    }

    async function cacheIconImage(
      name,
      dataUrl
    ) {
      if (!dataUrl) {
        iconImageCache.delete(name);
        return null;
      }

      const cached =
        iconImageCache.get(name);

      if (
        cached &&
        cached.dataUrl === dataUrl &&
        cached.image?.complete
      ) {
        return cached.image;
      }

      const promise = loadImageElement(dataUrl)
        .then(image => {
          iconImageCache.set(name, {
            dataUrl,
            image,
            promise: Promise.resolve(image)
          });

          return image;
        });

      iconImageCache.set(name, {
        dataUrl,
        image: null,
        promise
      });

      return promise;
    }

    function getCachedIconImage(name) {
      const dataUrl = getIconDataUrl(name);
      const cached = iconImageCache.get(name);

      if (
        !dataUrl ||
        !cached ||
        cached.dataUrl !== dataUrl
      ) {
        return null;
      }

      return cached.image || null;
    }

    async function ensureAllIconImagesLoaded() {
      const tasks = [];

      customIcons.forEach(
        (dataUrl, name) => {
          tasks.push(
            cacheIconImage(name, dataUrl)
          );
        }
      );

      await Promise.all(tasks);
    }

    function clearCustomIcon(name) {
      customIcons.delete(name);
      iconImageCache.delete(name);

      renderColorControls();
      renderFrame(
        raceData[currentFrameIndex],
        false
      );
      saveAppState();

      setStatus(
        `已移除 ${name} 的自定义图标。`
      );
    }

    function renderColorControls() {
      const container =
        document.querySelector("#colorControls");

      const fragment =
        document.createDocumentFragment();

      categories.forEach((name, categoryIndex) => {
        const item =
          document.createElement("div");

        item.className = "color-item";
        item.title = name;

        const currentColor =
          normalizeHexColorInput(
            getBarColor(name)
          ) || "#2563EB";

        const picker =
          document.createElement("input");

        picker.type = "color";
        picker.value =
          currentColor.toLowerCase();

        picker.setAttribute(
          "aria-label",
          `${name} 的颜色选择器`
        );

        const iconWrap =
          document.createElement("div");

        iconWrap.className =
          "entity-icon-wrap";

        const iconInput =
          document.createElement("input");

        iconInput.type = "file";
        iconInput.accept = "image/*";
        iconInput.className =
          "entity-icon-input";
        iconInput.id =
          `entityIconInput-${categoryIndex}`;

        const iconUpload =
          document.createElement("label");

        iconUpload.className =
          "entity-icon-upload";
        iconUpload.htmlFor = iconInput.id;
        iconUpload.title =
          `点击上传 ${name} 的图标`;

        const iconDataUrl =
          getIconDataUrl(name);

        if (iconDataUrl) {
          const previewImage =
            document.createElement("img");

          previewImage.src = iconDataUrl;
          previewImage.alt =
            `${name} 图标`;
          iconUpload.appendChild(previewImage);
        } else {
          const placeholder =
            document.createElement("span");

          placeholder.className =
            "entity-icon-placeholder";
          placeholder.textContent =
            getIconInitial(name);

          iconUpload.appendChild(placeholder);
        }

        iconWrap.append(
          iconUpload,
          iconInput
        );

        if (iconDataUrl) {
          const removeButton =
            document.createElement("button");

          removeButton.type = "button";
          removeButton.className =
            "entity-icon-remove";
          removeButton.textContent = "×";
          removeButton.title =
            `移除 ${name} 的图标`;

          removeButton.addEventListener(
            "click",
            event => {
              event.preventDefault();
              event.stopPropagation();
              clearCustomIcon(name);
            }
          );

          iconWrap.appendChild(
            removeButton
          );
        }

        iconInput.addEventListener(
          "change",
          async () => {
            const file =
              iconInput.files?.[0];

            if (!file) return;

            try {
              setStatus(
                `正在处理 ${name} 的图标……`
              );

              const dataUrl =
                await optimizeUploadedIcon(file);

              customIcons.set(
                name,
                dataUrl
              );

              await cacheIconImage(
                name,
                dataUrl
              );

              renderColorControls();
              renderFrame(
                raceData[currentFrameIndex],
                false
              );
              saveAppState();

              setStatus(
                `已更新 ${name} 的圆形图标。`
              );
            } catch (error) {
              console.error(error);
              setStatus(
                `图标上传失败：${error.message}`,
                true
              );
            } finally {
              iconInput.value = "";
            }
          }
        );

        const nameLabel =
          document.createElement("span");

        nameLabel.className =
          "color-name";
        nameLabel.textContent = name;

        const codeInput =
          document.createElement("input");

        codeInput.type = "text";
        codeInput.className =
          "color-code";
        codeInput.value = currentColor;
        codeInput.placeholder = "#RRGGBB";
        codeInput.maxLength = 7;
        codeInput.spellcheck = false;
        codeInput.autocomplete = "off";
        codeInput.inputMode = "text";

        codeInput.setAttribute(
          "aria-label",
          `${name} 的十六进制颜色`
        );

        picker.addEventListener("input", () => {
          applyCustomColor(
            name,
            picker.value.toUpperCase(),
            picker,
            codeInput
          );
        });

        codeInput.addEventListener("input", () => {
          const normalized =
            normalizeHexColorInput(
              codeInput.value
            );

          if (!normalized) {
            codeInput.classList.add(
              "invalid"
            );

            codeInput.setCustomValidity(
              "请输入 #RRGGBB、RRGGBB 或 #RGB 格式。"
            );

            return;
          }

          applyCustomColor(
            name,
            normalized,
            picker,
            codeInput
          );
        });

        const commitOrRestoreColor = () => {
          const normalized =
            normalizeHexColorInput(
              codeInput.value
            );

          if (normalized) {
            applyCustomColor(
              name,
              normalized,
              picker,
              codeInput
            );

            return;
          }

          const restored =
            normalizeHexColorInput(
              getBarColor(name)
            ) || currentColor;

          codeInput.value = restored;
          codeInput.classList.remove(
            "invalid"
          );
          codeInput.setCustomValidity("");

          setStatus(
            `${name} 的颜色格式无效，已恢复为 ${restored}。`,
            true
          );
        };

        codeInput.addEventListener(
          "blur",
          commitOrRestoreColor
        );

        codeInput.addEventListener(
          "keydown",
          event => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitOrRestoreColor();
              codeInput.blur();
            }

            if (event.key === "Escape") {
              codeInput.value =
                normalizeHexColorInput(
                  getBarColor(name)
                ) || currentColor;

              codeInput.classList.remove(
                "invalid"
              );

              codeInput.setCustomValidity("");
              codeInput.blur();
            }
          }
        );

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "entity-delete-btn";
        deleteBtn.innerHTML = "🗑️";
        deleteBtn.title = `移除主体对象：${name}`;
        deleteBtn.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          removeEntity(name);
        });

        item.append(
          picker,
          iconWrap,
          nameLabel,
          codeInput,
          deleteBtn
        );

        fragment.appendChild(item);
      });

      container.replaceChildren(fragment);
    }

    function removeEntity(name) {
      if (!name || rows.length < 2) return;

      const headers = rows[0];
      const colIndex = headers.indexOf(name);
      if (colIndex <= 0) return;

      if (headers.length <= 2) {
        setStatus("至少需要保留 1 个主体对象！", true);
        return;
      }

      const updatedRows = rows.map(row => row.filter((_, idx) => idx !== colIndex));

      customColors.delete(name);
      customIcons.delete(name);
      iconImageCache.delete(name);

      applyRows(updatedRows, `移除“${name}”`);
      setStatus(`已成功从图表中移除主体“${name}”。`);
    }

    function clearAllData() {
      if (!confirm("确定要清空当前所有导入的数据、自定义配置和本地缓存吗？")) {
        return;
      }

      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn("无法清空本地缓存:", e);
      }

      customColors.clear();
      customIcons.clear();
      iconImageCache.clear();
      danmakuMap.clear();

      const fileInput = document.querySelector("#fileInput");
      if (fileInput) fileInput.value = "";

      const emptyRows = [
        ["时间", "主体A", "主体B"],
        ["2026", 0, 0]
      ];

      applyRows(emptyRows, "空白数据框");
      renderDanmakuList();
      setStatus("已成功清空所有数据与本地缓存！您可以重新导入新的表格或选择恢复示例。");
    }

    function resetCustomColors() {
      customColors.clear();
      refreshColorScale();
      renderColorControls();
      renderFrame(raceData[currentFrameIndex], false);
      saveAppState();
      setStatus("已恢复全部主体的自动配色。");
    }

    function getPlaybackSpeed() {
      const rawSpeed = Number(document.querySelector("#speedInput").value) || 1;
      return Math.max(0.25, Math.min(5, rawSpeed));
    }

    function getFrameDuration() {
      return BASE_FRAME_DURATION / getPlaybackSpeed();
    }

    function getRequestedGifFps() {
      const input = document.querySelector("#gifFpsInput");
      const value = Math.round(Number(input.value) || 60);
      const clamped = Math.max(1, Math.min(120, value));

      if (Number(input.value) !== clamped) {
        input.value = clamped;
      }

      return clamped;
    }

    function getGifCompatibilityMode() {
      return document.querySelector(
        "#gifCompatibilityInput"
      ).value;
    }

    function getGifMinimumDelayCentiseconds() {
      /*
       * PowerPoint 对高频 GIF 的解码和计时不稳定：
       * - 10ms 帧可能被放大或来不及实时解码
       * - 20ms 在部分 Office 环境仍可能掉速
       *
       * 因此 PPT 模式使用至少 30ms；
       * 浏览器模式使用至少 20ms。
       */
      return getGifCompatibilityMode() === "powerpoint"
        ? 3
        : 2;
    }

    function getGifCompatibilityMaxFps() {
      return getGifCompatibilityMode() === "powerpoint"
        ? 30
        : 50;
    }

    function getMotionDuration() {
      return getFrameDuration() * MOTION_RATIO;
    }

    function getHoldDuration() {
      return getFrameDuration() - getMotionDuration();
    }

    function updateSpeedLabel() {
      document.querySelector("#speedValue").textContent =
        `${getPlaybackSpeed().toFixed(2)}×`;
    }

    function syncProgress(index) {
      const safeIndex = Math.max(0, Math.min(raceData.length - 1, index));
      const progressInput = document.querySelector("#progressInput");
      progressInput.max = Math.max(0, raceData.length - 1);
      progressInput.value = safeIndex;
      document.querySelector("#progressValue").textContent =
        raceData[safeIndex]?.time ?? "—";
    }

    function getCategoryOrder(name) {
      return categoryOrderMap.get(name) ??
        Number.MAX_SAFE_INTEGER;
    }

    function compareRankItems(a, b) {
      const aValue = Number(a.value) || 0;
      const bValue = Number(b.value) || 0;
      const maximumMagnitude = Math.max(
        1,
        Math.abs(aValue),
        Math.abs(bValue)
      );

      const tolerance = maximumMagnitude * 1e-9;
      const difference = bValue - aValue;

      if (Math.abs(difference) > tolerance) {
        return difference;
      }

      return (
        getCategoryOrder(a.name) -
          getCategoryOrder(b.name) ||
        a.name.localeCompare(b.name, "zh-CN")
      );
    }

    function shouldShowZeroValues() {
      return document.querySelector(
        "#showZeroInput"
      ).checked;
    }

    function isGradientEnabled() {
      const el = document.querySelector("#enableGradientInput");
      return el ? el.checked : true;
    }

    function isEffectivelyZero(value) {
      return Math.abs(Number(value) || 0) < 1e-12;
    }

    function getSortedRankItems(frame) {
      return Object.entries(frame.values)
        .map(([name, value]) => ({
          name,
          value: Number(value) || 0
        }))
        .filter(item =>
          shouldShowZeroValues() ||
          !isEffectivelyZero(item.value)
        )
        .sort(compareRankItems);
    }

    function getRanking(frame) {
      const rawValue = Number(
        document.querySelector("#barsInput").value
      );

      const requestedBars =
        Number.isFinite(rawValue) && rawValue >= 0
          ? Math.floor(rawValue)
          : 8;

      const sortedItems = getSortedRankItems(frame);

      const visibleItems =
        requestedBars === 0
          ? sortedItems
          : sortedItems.slice(0, requestedBars);

      return visibleItems.map(
        (item, index) => ({
          ...item,
          rank: index + 1
        })
      );
    }

    function getValueStep() {
      const input = document.querySelector("#valueStepInput");
      const rawValue = Number(input.value);
      const step = Number.isFinite(rawValue) && rawValue > 0
        ? rawValue
        : 1;

      if (!Number.isFinite(rawValue) || rawValue <= 0) {
        input.value = "1";
      }

      return step;
    }

    function getStepDecimals(step) {
      const text = String(step);

      if (text.includes("e-")) {
        return Math.min(
          8,
          Number(text.split("e-")[1]) || 0
        );
      }

      const decimalPart = text.split(".")[1];
      return Math.min(8, decimalPart?.length || 0);
    }

    function quantizeDisplayValue(value) {
      const step = getValueStep();
      const quantized = Math.round(value / step) * step;
      const decimals = getStepDecimals(step);

      return Number(quantized.toFixed(decimals));
    }

    function formatValue(value) {
      const unit = document.querySelector("#unitInput").value.trim();
      const step = getValueStep();
      const decimals = getStepDecimals(step);
      const quantized = quantizeDisplayValue(value);

      const absoluteValue = Math.abs(quantized);

      let formatted;
      if (
        absoluteValue >= 1e15 ||
        (absoluteValue > 0 && absoluteValue < 1e-4)
      ) {
        formatted = d3.format(".3e")(quantized);
      } else if (absoluteValue >= 1e9) {
        formatted = d3.format(".4~s")(quantized);
      } else {
        formatted = d3.format(`,.${decimals}f`)(quantized);
      }

      return `${formatted}${unit}`;
    }

    function getFrameLabelValue(frame, name, fallbackValue) {
      const labelValue = frame.labelValues?.[name];
      return Number.isFinite(labelValue)
        ? labelValue
        : fallbackValue;
    }

    const textMeasureCanvas =
      document.createElement("canvas");
    const textMeasureContext =
      textMeasureCanvas.getContext("2d");

    function getChartWidthScale() {
      const el = document.querySelector("#chartWidthScaleInput");
      const raw = el ? Number(el.value) : 100;
      return Number.isFinite(raw) && raw >= 50 && raw <= 250 ? raw : 100;
    }

    function updateChartWidth() {
      const mode = document.querySelector("#aspectRatioModeInput")?.value || "16:9";
      const scale = getChartWidthScale();

      let targetBaseW = 1280;
      let targetBaseH = 720;

      if (mode === "3:4") {
        targetBaseW = 810;
        targetBaseH = 1080;
      } else if (mode === "9:16") {
        targetBaseW = 720;
        targetBaseH = 1280;
      } else if (mode === "4:5") {
        targetBaseW = 864;
        targetBaseH = 1080;
      }

      HEIGHT = targetBaseH;
      baseWidth = targetBaseW;
      WIDTH = Math.round(baseWidth * (scale / 100));

      const label = document.querySelector("#chartWidthScaleValue");
      if (label) {
        label.textContent = `${scale}% (${WIDTH}×${HEIGHT}px)`;
      }

      svg.attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
        .attr("width", WIDTH)
        .attr("height", HEIGHT);

      const captureArea = document.querySelector("#captureArea");
      if (captureArea) {
        captureArea.style.aspectRatio = `${WIDTH} / ${HEIGHT}`;

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

      if (raceData && raceData.length > 0) {
        updateResponsiveChartMargins();
        renderFrame(raceData[currentFrameIndex], false);
      }
    }

    function updateResponsiveChartMargins() {
      const longestNameWidth = d3.max(
        categories,
        name => measureLogicalText(
          name,
          20,
          700
        )
      ) || 0;

      const isPortrait = WIDTH < 960;
      const hasTitle = Boolean(document.querySelector("#titleInput")?.value.trim());
      const hasSubtitle = Boolean(document.querySelector("#subtitleInput")?.value.trim());

      let maxDanmakuLines = 0;
      if (isDanmakuEnabled() && danmakuMap.size > 0) {
        danmakuMap.forEach(text => {
          const l = String(text).split("\n").map(s => s.trim()).filter(Boolean).length;
          if (l > maxDanmakuLines) maxDanmakuLines = l;
        });
      }

      const neededCardHeight = maxDanmakuLines > 0 ? Math.max(104, 38 + maxDanmakuLines * 34 + 14) : 0;

      if (!hasTitle && !hasSubtitle) {
        if (neededCardHeight > 0) {
          margin.top = 14 + neededCardHeight + 12 + 42;
        } else {
          margin.top = 58;
        }
      } else if (hasTitle && !hasSubtitle) {
        if (neededCardHeight > 0) {
          margin.top = 64 + neededCardHeight + 12 + 42;
        } else {
          margin.top = 118;
        }
      } else {
        if (neededCardHeight > 0) {
          margin.top = 96 + neededCardHeight + 12 + 42;
        } else {
          margin.top = 154;
        }
      }

      margin.left = Math.max(
        78,
        Math.min(
          260,
          Math.ceil(
            longestNameWidth +
            NAME_BAR_GAP +
            CHART_SIDE_PADDING + 4
          )
        )
      );

      const valueGutter = getValueLabelGutter();
      margin.right = isPortrait
        ? Math.max(170, Math.min(320, valueGutter + 28))
        : Math.max(150, Math.min(320, valueGutter + 16));

      titleLabel.attr("x", TITLE_LEFT);
      subtitleLabel.attr("x", TITLE_LEFT);

      titleAccent
        .attr("x", TITLE_LEFT - 14);

      const cardHeight = HEIGHT - margin.top - margin.bottom + 60;

      plotSurface
        .attr("x", CHART_SIDE_PADDING)
        .attr("y", margin.top - 42)
        .attr(
          "width",
          WIDTH -
            CHART_SIDE_PADDING * 2
        )
        .attr("height", cardHeight);

      timeLabel
        .attr("x", WIDTH - margin.right - 10)
        .attr("y", HEIGHT - margin.bottom - 10);

      valueLabelClipRect
        .attr("x", CHART_SIDE_PADDING)
        .attr(
          "width",
          Math.max(
            1,
            WIDTH -
              CHART_SIDE_PADDING * 2
          )
        );

      xScale.range([
        margin.left,
        WIDTH - margin.right
      ]);

      yScale.range(getYScaleTargetRange(categories.length));
    }

    const MAX_BAR_HEIGHT = 44;

    function getRequestedBarCount() {
      const el = document.querySelector("#barsInput");
      const raw = el ? Number(el.value) : 8;
      return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 8;
    }

    function getMaxCapacityBarCount() {
      const requested = getRequestedBarCount();
      const totalCats = categories && categories.length > 0 ? categories.length : 8;
      if (requested > 0) {
        return Math.min(requested, Math.max(1, totalCats));
      }
      return Math.max(1, totalCats);
    }

    function getMaxBarHeightSetting() {
      const el = document.querySelector("#maxBarHeightInput");
      const raw = el ? Number(el.value) : 52;
      return Number.isFinite(raw) && raw >= 24 && raw <= 84 ? raw : 52;
    }

    function updateMaxBarHeight() {
      const val = getMaxBarHeightSetting();
      const label = document.querySelector("#maxBarHeightValue");
      if (label) {
        label.textContent = `${val}px`;
      }
      if (raceData && raceData.length > 0) {
        updateResponsiveChartMargins();
        renderFrame(raceData[currentFrameIndex], false);
      }
      saveAppState();
    }

    function getYScaleTargetRange(barCount) {
      const fullAvailableHeight = HEIGHT - margin.top - margin.bottom;
      const capacity = getMaxCapacityBarCount();
      const count = Math.max(1, capacity);
      const maxBarHeight = getMaxBarHeightSetting();
      const maxStep = maxBarHeight / 0.84;
      const neededHeight = count * maxStep;
      const targetHeight = Math.min(fullAvailableHeight, neededHeight);
      return [margin.top, margin.top + targetHeight];
    }

    function measureLogicalText(
      text,
      fontSize,
      fontWeight = 800
    ) {
      if (!textMeasureContext) {
        return String(text).length * fontSize * 0.62;
      }

      textMeasureContext.font =
        `${fontWeight} ${fontSize}px ` +
        '"Microsoft YaHei","PingFang SC",Arial,sans-serif';

      return textMeasureContext.measureText(
        String(text)
      ).width;
    }

    function getEffectiveValueIconSize(
      rowHeight = Infinity
    ) {
      if (!Number.isFinite(rowHeight)) {
        return VALUE_ICON_SIZE;
      }

      return Math.max(
        18,
        Math.min(
          VALUE_ICON_SIZE,
          rowHeight * 0.72
        )
      );
    }

    function getSvgValueIconSize() {
      return getEffectiveValueIconSize(
        yScale.bandwidth()
      );
    }

    function getAdaptiveLabelLayout(
      value,
      barColor,
      valueText,
      rankText,
      valueFontSize = 21,
      rankFontSize = 15,
      iconSize = getSvgValueIconSize()
    ) {
      const zeroX = xScale(0);
      const valueX = xScale(value);
      const barWidth = Math.abs(
        valueX - zeroX
      );
      const isNegative = value < 0;

      const plotLeft = CHART_SIDE_PADDING + 4;
      const plotRight =
        WIDTH - CHART_SIDE_PADDING - 4;

      const availableWidth = Math.max(
        1,
        isNegative
          ? (
              valueX -
              VALUE_BAR_GAP -
              plotLeft
            )
          : (
              plotRight -
              valueX -
              VALUE_BAR_GAP
            )
      );

      let effectiveIconSize = Math.min(
        iconSize,
        Math.max(
          10,
          availableWidth * 0.36
        )
      );

      let effectiveGap = Math.min(
        VALUE_ICON_TEXT_GAP,
        Math.max(
          2,
          availableWidth * 0.065
        )
      );

      let effectiveFontSize =
        valueFontSize;

      let measuredTextWidth =
        measureLogicalText(
          valueText,
          effectiveFontSize,
          800
        );

      let maximumTextWidth = Math.max(
        1,
        availableWidth -
          effectiveIconSize -
          effectiveGap
      );

      const desiredTotalWidth =
        measuredTextWidth +
        effectiveIconSize +
        effectiveGap;

      if (
        desiredTotalWidth >
        availableWidth
      ) {
        const scaleRatio =
          availableWidth /
          desiredTotalWidth;

        effectiveIconSize = Math.max(
          10,
          effectiveIconSize *
            scaleRatio
        );

        effectiveGap = Math.max(
          2,
          effectiveGap *
            scaleRatio
        );

        effectiveFontSize = Math.max(
          9,
          effectiveFontSize *
            scaleRatio
        );

        measuredTextWidth =
          measureLogicalText(
            valueText,
            effectiveFontSize,
            800
          );

        maximumTextWidth = Math.max(
          1,
          availableWidth -
            effectiveIconSize -
            effectiveGap
        );
      }

      /*
       * 字体达到下限后仍然过宽时，SVG 使用 textLength，
       * Canvas 使用 fillText(maxWidth) 做有限水平压缩。
       */
      const valueTextCompressed =
        measuredTextWidth >
        maximumTextWidth;

      const renderedTextWidth =
        valueTextCompressed
          ? maximumTextWidth
          : measuredTextWidth;

      const groupWidth = Math.min(
        availableWidth,
        effectiveIconSize +
          effectiveGap +
          renderedTextWidth
      );

      let groupLeft;

      if (isNegative) {
        const groupRight = Math.min(
          valueX - VALUE_BAR_GAP,
          plotRight
        );
        groupLeft = Math.max(plotLeft, groupRight - groupWidth);
      } else {
        groupLeft = valueX + VALUE_BAR_GAP;
        if (groupLeft + groupWidth > plotRight) {
          groupLeft = Math.max(valueX + VALUE_BAR_GAP, plotRight - groupWidth);
        }
      }

      const iconCenterX =
        groupLeft +
        effectiveIconSize / 2;

      const valueLabelX =
        groupLeft +
        effectiveIconSize +
        effectiveGap;

      const rankTextWidth =
        measureLogicalText(
          rankText,
          rankFontSize,
          800
        );

      const canFitRank =
        barWidth >=
        rankTextWidth + 20;

      let rankLabelX;
      let rankAnchor;
      let rankColor;

      if (canFitRank) {
        rankLabelX = isNegative
          ? zeroX - 10
          : zeroX + 10;

        rankAnchor = isNegative
          ? "end"
          : "start";

        rankColor =
          getContrastTextColor(barColor);
      } else {
        rankLabelX = isNegative
          ? zeroX + 10
          : zeroX - 10;

        rankAnchor = isNegative
          ? "start"
          : "end";

        rankColor = "#334155";
      }

      return {
        zeroX,
        valueX,
        barWidth,
        groupLeft,
        groupWidth,
        iconCenterX,
        iconSize: effectiveIconSize,
        iconTextGap: effectiveGap,
        valueLabelX,
        valueAnchor: "start",
        valueColor: "#263244",
        valueInside: false,
        valueFontSize:
          effectiveFontSize,
        valueTextMaxWidth:
          maximumTextWidth,
        valueTextCompressed,
        rankLabelX,
        rankAnchor,
        rankColor,
        rankInside: canFitRank
      };
    }

    function getSvgExternalLabelLayout(
      frame,
      datum
    ) {
      const valueText = formatValue(
        getFrameLabelValue(
          frame,
          datum.name,
          datum.value
        )
      );

      return getAdaptiveLabelLayout(
        datum.value,
        getBarColor(datum.name),
        valueText,
        "",
        21,
        15,
        getSvgValueIconSize()
      );
    }

    function getTickVisualBounds(
      tick,
      rotate
    ) {
      const text = formatAxisTick(tick);
      const width = measureLogicalText(
        text,
        14,
        400
      );
      const height = 16;
      const x = xScale(tick);

      if (rotate) {
        const angle =
          38 * Math.PI / 180;

        /*
         * 文本锚点为 end，向左倾斜。
         * 使用旋转后的水平投影估算碰撞边界。
         */
        const projectedWidth =
          width * Math.cos(angle) +
          height * Math.sin(angle);

        return {
          tick,
          text,
          x,
          left: x - projectedWidth - 7,
          right: x + 5
        };
      }

      return {
        tick,
        text,
        x,
        left: x - width / 2 - 7,
        right: x + width / 2 + 7
      };
    }

    function getAxisTickLayout() {
      const targetTickCount =
        activeXAxisScaleType === "symlog"
          ? 18
          : 12;

      let candidates = xScale
        .ticks(targetTickCount)
        .filter(Number.isFinite);

      const axisDomain = xScale.domain();
      const domainMin = axisDomain[0];
      const domainMax =
        axisDomain[axisDomain.length - 1];

      if (
        domainMin <= 0 &&
        domainMax >= 0 &&
        !candidates.some(
          value => Math.abs(value) < 1e-12
        )
      ) {
        candidates.push(0);
      }

      candidates = [...new Set(candidates)]
        .sort((a, b) => a - b);

      if (candidates.length <= 1) {
        return {
          ticks: candidates,
          rotate: false,
          angle: 0
        };
      }

      const rawBounds = candidates.map(
        tick => getTickVisualBounds(
          tick,
          false
        )
      );

      const hasRawCollision = rawBounds.some(
        (item, index) =>
          index > 0 &&
          item.left <
            rawBounds[index - 1].right
      );

      /*
       * 仅在原始横向标签确实发生碰撞时倾斜。
       */
      const rotate =
        hasRawCollision ||
        candidates.length > 9;

      const plotLeft = margin.left + 4;
      const plotRight =
        WIDTH - margin.right - 4;

      const bounds = candidates
        .map(tick =>
          getTickVisualBounds(
            tick,
            rotate
          )
        )
        .filter(item =>
          item.left >= plotLeft &&
          item.right <= plotRight
        );

      const zeroItem = bounds.find(
        item => Math.abs(item.tick) < 1e-12
      );

      const selected = [];
      const minimumGap = rotate ? 8 : 10;

      const collides = item =>
        selected.some(existing =>
          !(
            item.right + minimumGap <=
              existing.left ||
            item.left >=
              existing.right +
              minimumGap
          )
        );

      /*
       * 先固定 0 刻度，再从 0 向左右两侧扩展。
       * Symlog 的局部像素间距不均匀，因此必须逐项检测，
       * 不能使用平均间距来决定跳过数量。
       */
      if (zeroItem) {
        selected.push(zeroItem);
      }

      const zeroX = zeroItem
        ? zeroItem.x
        : xScale(0);

      const leftItems = bounds
        .filter(item => item.x < zeroX)
        .sort((a, b) => b.x - a.x);

      const rightItems = bounds
        .filter(item => item.x > zeroX)
        .sort((a, b) => a.x - b.x);

      leftItems.forEach(item => {
        if (!collides(item)) {
          selected.push(item);
        }
      });

      rightItems.forEach(item => {
        if (!collides(item)) {
          selected.push(item);
        }
      });

      /*
       * 当数据域不包含 0 时，从左到右执行普通贪心选择。
       */
      if (!zeroItem) {
        selected.length = 0;

        bounds
          .sort((a, b) => a.x - b.x)
          .forEach(item => {
            if (!collides(item)) {
              selected.push(item);
            }
          });
      }

      selected.sort((a, b) => a.x - b.x);

      return {
        ticks: selected.map(
          item => item.tick
        ),
        rotate,
        angle: rotate ? -38 : 0
      };
    }

    function styleSvgAxisTicks(axisLayout) {
      const tickText = xAxisGroup
        .selectAll(".tick text");

      if (axisLayout.rotate) {
        tickText
          .attr("text-anchor", "end")
          .attr("dx", "-0.38em")
          .attr("dy", "-0.16em")
          .attr(
            "transform",
            `rotate(${axisLayout.angle})`
          );
      } else {
        tickText
          .attr("text-anchor", "middle")
          .attr("dx", null)
          .attr("dy", "-0.35em")
          .attr("transform", null);
      }
    }

    function getMaximumValueSteps(fromFrame, toFrame) {
      const step = getValueStep();

      return d3.max(
        categories,
        name => {
          const startValue = Number(fromFrame.values[name]) || 0;
          const endValue = Number(toFrame.values[name]) || 0;
          return Math.ceil(
            Math.abs(endValue - startValue) / step
          );
        }
      ) || 0;
    }

    function renderFrame(frame, animate = true) {
      if (!frame) return;

      const ranking = getRanking(frame);
      const [domainMin, domainMax] =
        getCurrentXAxisDomain(
          ranking,
          frame
        );

      const titleText = document.querySelector("#titleInput").value.trim();
      const subtitleText = document.querySelector("#subtitleInput").value.trim();

      titleLabel.text(titleText);
      subtitleLabel.text(subtitleText);
      titleAccent.style("display", titleText ? null : "none");
      titleAccent.style("display", titleText ? null : "none");

      const dataFrameIndex = raceData.indexOf(frame);
      if (dataFrameIndex >= 0) {
        syncProgress(dataFrameIndex);
      }

      configureXAxisScale([domainMin, domainMax], frame);
      yScale.range(getYScaleTargetRange(getMaxCapacityBarCount()));
      yScale.domain(ranking.map(d => d.name));

      const duration = animate
        ? Math.max(120, getMotionDuration())
        : 0;

      const transition = svg.transition("layout")
        .duration(duration)
        .ease(MOTION_EASING);

      // 数字标签使用线性时间轴，避免缓动曲线造成中段跳值过快。
      const numberTransition = svg.transition("numbers")
        .duration(duration)
        .ease(d3.easeLinear);
        
      timeLabel.interrupt().text(frame.time);
      renderDanmakuDOM(danmakuGroup, frame.time, danmakuMap.get(getDanmakuKey(frame.time)));

      const axisLayout = getAxisTickLayout();

      const axis = d3.axisTop(xScale)
        .tickValues(axisLayout.ticks)
        .tickSize(-(HEIGHT - margin.top - margin.bottom))
        .tickFormat(formatAxisTick);

      xAxisGroup
        .attr("transform", `translate(0, ${margin.top})`);

      const zeroLineOpacity =
        domainMin < 0 && domainMax > 0
          ? 0.9
          : 0.55;

      /*
       * 横轴即时重绘，避免刻度文本在 transition 中重叠。
       * 密集刻度会自动抽稀，并在必要时向左倾斜 35°。
       */
      if (shouldShowXAxis()) {
        xAxisGroup
          .style("display", null)
          .interrupt()
          .call(axis);

        styleSvgAxisTicks(axisLayout);

        zeroLine
          .style("display", null)
          .interrupt()
          .attr("x1", xScale(0))
          .attr("x2", xScale(0))
          .attr("y1", margin.top)
          .attr("y2", HEIGHT - margin.bottom)
          .style("opacity", zeroLineOpacity);
      } else {
        xAxisGroup.style("display", "none");
        zeroLine.style("display", "none");
      }

      const aspectMode = document.querySelector("#aspectRatioModeInput")?.value || "16:9";
      const liftRatio = { "16:9": 0, "3:4": 0.065, "4:5": 0.030, "9:16": 0.020 }[aspectMode] || 0;
      const lift = Math.round(HEIGHT * liftRatio);
      
      const bottomY = HEIGHT - margin.bottom - lift + 20;

      const rowTracks = chartGroup
        .selectAll("rect.row-track")
        .data(ranking, d => d.name);

      rowTracks.enter()
        .append("rect")
        .attr("class", "row-track")
        .attr("x", margin.left)
        .attr("width", WIDTH - margin.left - margin.right)
        .attr("y", bottomY)
        .attr("height", yScale.bandwidth())
        .attr("rx", 10)
        .style("opacity", 0)
        .merge(rowTracks)
        .transition(transition)
        .attr("x", margin.left)
        .attr("width", WIDTH - margin.left - margin.right)
        .attr("y", d => yScale(d.name))
        .attr("height", yScale.bandwidth())
        .attr("rx", Math.min(10, yScale.bandwidth() / 3))
        .style("opacity", (_, index) =>
          index % 2 === 0 ? 0.82 : 0.42
        );

      rowTracks.exit()
        .transition(transition)
        .attr("y", bottomY)
        .style("opacity", 0)
        .remove();

      const bars = chartGroup.selectAll("rect.bar")
        .data(ranking, d => d.name);

      bars.enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", xScale(0))
        .attr("y", bottomY)
        .attr("height", yScale.bandwidth())
        .attr("width", 0)
        .attr("rx", 11)
        .style("opacity", 0)
        .attr("fill", d => isGradientEnabled() ? `url(#${getGradientId(d.name)})` : getBarColor(d.name))
        .attr("filter", "url(#barShadow)")
        .attr("stroke", "rgba(255,255,255,0.50)")
        .attr("stroke-width", 1)
        .merge(bars)
        .transition(transition)
        .attr(
          "x",
          d => Math.min(xScale(0), xScale(d.value))
        )
        .attr("y", d => yScale(d.name))
        .attr("height", yScale.bandwidth())
        .attr("rx", Math.min(11, yScale.bandwidth() / 3))
        .attr(
          "width",
          d => Math.abs(xScale(d.value) - xScale(0))
        )
        .style("opacity", 1)
        .attr("fill", d => isGradientEnabled() ? `url(#${getGradientId(d.name)})` : getBarColor(d.name));

      bars.exit()
        .transition(transition)
        .attr("y", bottomY)
        .attr("x", xScale(0))
        .attr("width", 0)
        .style("opacity", 0)
        .remove();

      const names = chartGroup.selectAll("text.bar-label")
        .data(ranking, d => d.name);

      names.enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", margin.left - NAME_BAR_GAP)
        .attr("y", bottomY)
        .style("opacity", 0)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .text(d => d.name)
        .merge(names)
        .transition(transition)
        .attr("x", margin.left - NAME_BAR_GAP)
        .attr("y", d => yScale(d.name) + yScale.bandwidth() / 2)
        .style("opacity", 1);

      names.exit()
        .transition(transition)
        .attr("y", bottomY)
        .style("opacity", 0)
        .remove();

      const values = chartGroup.selectAll("text.value-label")
        .data(ranking, d => d.name);

      const mergedValues = values.enter()
        .append("text")
        .attr("class", "value-label")
        .attr(
          "x",
          d => getAdaptiveLabelLayout(
            d.value,
            getBarColor(d.name),
            formatValue(getFrameLabelValue(frame, d.name, d.value)),
            `#${d.rank}`
          ).valueLabelX
        )
        .attr("y", bottomY)
        .style("opacity", 0)
        .attr("dominant-baseline", "middle")
        .attr(
          "text-anchor",
          d => getAdaptiveLabelLayout(
            d.value,
            getBarColor(d.name),
            formatValue(getFrameLabelValue(frame, d.name, d.value)),
            `#${d.rank}`
          ).valueAnchor
        )
        .style(
          "fill",
          d => getSvgExternalLabelLayout(
            frame,
            d
          ).valueColor
        )
        .attr(
          "font-size",
          d => getSvgExternalLabelLayout(
            frame,
            d
          ).valueFontSize
        )
        .attr(
          "lengthAdjust",
          "spacingAndGlyphs"
        )
        .attr(
          "textLength",
          d => {
            const layout =
              getSvgExternalLabelLayout(
                frame,
                d
              );

            return layout.valueTextCompressed
              ? layout.valueTextMaxWidth
              : null;
          }
        )
        .attr(
          "clip-path",
          "url(#valueLabelClip)"
        )
        .each(function(d) {
          const initialValue = getFrameLabelValue(
            frame,
            d.name,
            d.value
          );

          if (this.dataset.value === undefined) {
            this.dataset.value = String(initialValue);
            this.textContent = formatValue(initialValue);
          }
        })
        .merge(values);

      mergedValues
        .transition(transition)
        .attr(
          "x",
          d => getAdaptiveLabelLayout(
            d.value,
            getBarColor(d.name),
            formatValue(getFrameLabelValue(frame, d.name, d.value)),
            `#${d.rank}`
          ).valueLabelX
        )
        .attr(
          "text-anchor",
          d => getAdaptiveLabelLayout(
            d.value,
            getBarColor(d.name),
            formatValue(getFrameLabelValue(frame, d.name, d.value)),
            `#${d.rank}`
          ).valueAnchor
        )
        .style(
          "fill",
          d => getSvgExternalLabelLayout(
            frame,
            d
          ).valueColor
        )
        .attr(
          "font-size",
          d => getSvgExternalLabelLayout(
            frame,
            d
          ).valueFontSize
        )
        .attr(
          "clip-path",
          "url(#valueLabelClip)"
        )
        .attr("y", d => yScale(d.name) + yScale.bandwidth() / 2)
        .style("opacity", 1);

      mergedValues
        .transition(numberTransition)
        .tween("text", function(d) {
          const oldValue = Number(
            this.dataset.value ??
            getFrameLabelValue(frame, d.name, d.value)
          );

          const targetValue = getFrameLabelValue(
            frame,
            d.name,
            d.value
          );

          const interpolate = d3.interpolateNumber(
            oldValue,
            targetValue
          );

          this.dataset.value = String(targetValue);

          return t => {
            this.textContent = formatValue(interpolate(t));
          };
        });

      values.exit()
        .transition(transition)
        .attr("y", bottomY)
        .style("opacity", 0)
        .remove();

      const valueIcons = chartGroup
        .selectAll("g.value-icon")
        .data(ranking, d => d.name);

      const valueIconEnter = valueIcons
        .enter()
        .append("g")
        .attr("class", "value-icon")
        .attr("transform", `translate(${margin.left}, ${bottomY})`)
        .style("opacity", 0);

      valueIconEnter
        .append("circle")
        .attr("class", "value-icon-shell")
        .attr(
          "r",
          VALUE_ICON_SIZE / 2
        )
        .attr("filter", "url(#iconShadow)");

      valueIconEnter
        .append("image")
        .attr("class", "value-icon-image")
        .attr(
          "x",
          -VALUE_ICON_SIZE / 2
        )
        .attr(
          "y",
          -VALUE_ICON_SIZE / 2
        )
        .attr("width", VALUE_ICON_SIZE)
        .attr("height", VALUE_ICON_SIZE)
        .attr(
          "clip-path",
          "url(#circleIconClip)"
        )
        .attr(
          "preserveAspectRatio",
          "xMidYMid slice"
        );

      valueIconEnter
        .append("text")
        .attr(
          "class",
          "value-icon-placeholder"
        )
        .attr("x", 0)
        .attr("y", 0);

      const mergedValueIcons =
        valueIconEnter.merge(valueIcons);

      mergedValueIcons
        .select("circle")
        .attr(
          "r",
          d => getSvgExternalLabelLayout(
            frame,
            d
          ).iconSize / 2
        )
        .attr(
          "fill",
          d => getBarColor(d.name)
        );

      mergedValueIcons
        .select("image")
        .attr(
          "x",
          d => -getSvgExternalLabelLayout(
            frame,
            d
          ).iconSize / 2
        )
        .attr(
          "y",
          d => -getSvgExternalLabelLayout(
            frame,
            d
          ).iconSize / 2
        )
        .attr(
          "width",
          d => getSvgExternalLabelLayout(
            frame,
            d
          ).iconSize
        )
        .attr(
          "height",
          d => getSvgExternalLabelLayout(
            frame,
            d
          ).iconSize
        )
        .attr(
          "href",
          d => getIconDataUrl(d.name) || null
        )
        .style(
          "display",
          d => getIconDataUrl(d.name)
            ? null
            : "none"
        );

      mergedValueIcons
        .select("text")
        .text(
          d => getIconInitial(d.name)
        )
        .attr(
          "fill",
          d => getContrastTextColor(
            getBarColor(d.name)
          )
        )
        .attr(
          "font-size",
          d => Math.max(
            8,
            getSvgExternalLabelLayout(
              frame,
              d
            ).iconSize * 0.44
          )
        )
        .style(
          "display",
          d => getIconDataUrl(d.name)
            ? "none"
            : null
        );

      mergedValueIcons
        .transition(transition)
        .style("opacity", 1)
        .attr(
          "transform",
          d => {
            const layout =
              getSvgExternalLabelLayout(
                frame,
                d
              );

            const centerY =
              yScale(d.name) +
              yScale.bandwidth() / 2;

            return (
              `translate(` +
              `${layout.iconCenterX},` +
              `${centerY}` +
              `)`
            );
          }
        );

      valueIcons.exit()
        .transition(transition)
        .attr("transform", `translate(${margin.left}, ${bottomY})`)
        .style("opacity", 0)
        .remove();

    }

    function getDanmakuCardLayout(text) {
      if (!isDanmakuEnabled() || !text) return null;
      const lines = String(text).split("\n").map(s => s.trim()).filter(Boolean);
      if (lines.length === 0) return null;

      const hasTitle = Boolean(document.querySelector("#titleInput")?.value.trim());
      const hasSubtitle = Boolean(document.querySelector("#subtitleInput")?.value.trim());

      let startY = 14;
      if (hasTitle && hasSubtitle) {
        startY = 96;
      } else if (hasTitle || hasSubtitle) {
        startY = 64;
      }

      const startX = CHART_SIDE_PADDING;
      const cardWidth = WIDTH - CHART_SIDE_PADDING * 2;
      const targetPlotY = margin.top - 42;
      const cardHeight = Math.max(
        32 + lines.length * 24 + 8,
        targetPlotY - 12 - startY
      );

      return {
        startX,
        startY,
        cardWidth,
        cardHeight,
        lines
      };
    }

    function renderDanmakuDOM(group, time, text) {
      group.selectAll("*").remove();
      if (!isDanmakuEnabled() || !text) {
        group.style("display", "none");
        return;
      }

      const layout = getDanmakuCardLayout(text);
      if (!layout) {
        group.style("display", "none");
        return;
      }

      group.style("display", null);

      group.append("rect")
        .attr("x", layout.startX)
        .attr("y", layout.startY)
        .attr("width", layout.cardWidth)
        .attr("height", layout.cardHeight)
        .attr("rx", 14)
        .attr("ry", 14)
        .attr("fill", "#eff6ff")
        .attr("stroke", "#dbeafe")
        .attr("stroke-width", 1.5);

      const headerY = layout.startY + 28;
      group.append("text")
        .attr("x", layout.startX + 20)
        .attr("y", headerY)
        .attr("font-size", 16)
        .attr("font-weight", 700)
        .attr("fill", "#2563eb")
        .text(`● 节点 · ${getDanmakuKey(time)}`);

      const maxW = layout.cardWidth - 40;
      const lineCount = layout.lines.length;
      const availableTextH = layout.cardHeight - 40;
      const lineGap = lineCount > 1
        ? Math.min(38, Math.floor((availableTextH - 10) / lineCount))
        : 34;

      layout.lines.forEach((lineText, i) => {
        const lineY = headerY + 8 + (i + 1) * lineGap;
        const textEl = group.append("text")
          .attr("x", layout.startX + 20)
          .attr("y", lineY)
          .attr("font-size", 24)
          .attr("font-weight", 800)
          .attr("fill", "#0f172a")
          .text(lineText);

        const textWidth = measureLogicalText(lineText, 24, 800);
        if (textWidth > maxW) {
          textEl.attr("textLength", maxW).attr("lengthAdjust", "spacingAndGlyphs");
        }
      });
    }

    function updatePreviewTable() {
      const container = document.querySelector("#previewTable");
      if (!container || !rows || rows.length === 0) return;

      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const tbody = document.createElement("tbody");

      const headerRow = document.createElement("tr");
      rows[0].forEach(cell => {
        const th = document.createElement("th");
        th.textContent = cell;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);

      rows.slice(1).forEach(row => {
        const tr = document.createElement("tr");
        row.forEach(cell => {
          const td = document.createElement("td");
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      table.append(thead, tbody);
      container.replaceChildren(table);
    }

    const STORAGE_KEY = "bar_chart_race_saved_state";

    const configInputIds = [
      "titleInput", "subtitleInput", "barsInput", "maxBarHeightInput", "showZeroInput",
      "aspectRatioModeInput", "chartWidthScaleInput", "enableGradientInput", "showXAxisInput",
      "xAxisModeInput", "valueScaleInput", "speedInput", "gifFpsInput", "gifCompatibilityInput",
      "exportFilenameInput", "videoFormatInput", "videoFpsInput", "videoResolutionInput",
      "videoCoverFrameInput", "valueStepInput", "unitInput", "dateOpacityInput",
      "dateColorInput", "dateColorCodeInput", "showDanmakuInput"
    ];

    function saveAppState() {
      try {
        const inputsState = {};
        configInputIds.forEach(id => {
          const el = document.querySelector(`#${id}`);
          if (el) {
            inputsState[id] = el.type === "checkbox" ? el.checked : el.value;
          }
        });

        const state = {
          rows: rows,
          inputs: inputsState,
          customColors: Array.from(customColors.entries()),
          customIcons: Array.from(customIcons.entries()),
          danmaku: Array.from(danmakuMap.entries()),
          savedAt: Date.now()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("无法保存状态到 LocalStorage:", err);
      }
    }

    function loadAppState() {
      try {
        const json = localStorage.getItem(STORAGE_KEY);
        if (!json) return false;
        const state = JSON.parse(json);
        if (!state || !Array.isArray(state.rows) || state.rows.length < 2) return false;

        customColors.clear();
        if (Array.isArray(state.customColors)) {
          state.customColors.forEach(([name, val]) => customColors.set(name, val));
        }

        customIcons.clear();
        if (Array.isArray(state.customIcons)) {
          state.customIcons.forEach(([name, val]) => customIcons.set(name, val));
        }

        danmakuMap.clear();
        if (Array.isArray(state.danmaku)) {
          state.danmaku.forEach(([t, text]) => danmakuMap.set(t, text));
        }

        if (state.inputs) {
          Object.entries(state.inputs).forEach(([id, val]) => {
            const el = document.querySelector(`#${id}`);
            if (el) {
              if (el.type === "checkbox") {
                el.checked = Boolean(val);
              } else {
                el.value = val;
              }
              // 触发 input 和 change 事件，以同步各个联动组件的状态（如数值显示、渲染等）
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
        }

        rows = normalizeRows(state.rows);
        convertRowsToRaceData(rows);
        currentFrameIndex = 0;
        updatePreviewTable();
        refreshColorScale();
        renderColorControls();
        updateDanmakuTimeSelect();
        updateVideoCoverSelect();
        renderDanmakuList();
        syncProgress(0);
        renderFrame(raceData[0], false);
        setStatus("已成功为您自动恢复上次编辑的数据和配置！");
        return true;
      } catch (err) {
        console.warn("恢复本地状态失败:", err);
        return false;
      }
    }

    function applyRows(rawRows, sourceName, targetFrameIndex = -1) {
      stopPlayback();
      rows = normalizeRows(rawRows);
      convertRowsToRaceData(rows);
      currentFrameIndex = targetFrameIndex >= 0 && targetFrameIndex < raceData.length
        ? targetFrameIndex
        : Math.max(0, raceData.length - 1);
      updatePreviewTable();
      renderColorControls();
      updateDanmakuTimeSelect();
      updateVideoCoverSelect();
      renderDanmakuList();
      syncProgress(currentFrameIndex);
      renderFrame(raceData[currentFrameIndex], false);
      saveAppState();

      const timeRangeStr = raceData.length > 0
        ? `（${raceData[0].time} ~ ${raceData[raceData.length - 1].time}）`
        : "";
      setStatus(`已加载 ${sourceName}：共 ${raceData.length} 个时间节点${timeRangeStr}，${categories.length} 个主体对象。已自动跳转至最新节点【${raceData[currentFrameIndex]?.time}】！`);
    }

    function stopPlayback() {
      isPlaying = false;
      playToken += 1;
      svg.interrupt();
      chartGroup.selectAll("*").interrupt();
      xAxisGroup.interrupt();
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function startPlayback() {
      if (isPlaying || raceData.length === 0) return;

      if (currentFrameIndex >= raceData.length - 1) {
        currentFrameIndex = 0;
        renderFrame(raceData[0], 0, false);
      }

      isPlaying = true;
      const token = ++playToken;

      if (currentFrameIndex === 0) {
        renderFrame(raceData[0], 0, false);
        await sleep(getFrameDuration());
        if (!isPlaying || token !== playToken) return;
      }

      while (isPlaying && token === playToken && currentFrameIndex < raceData.length - 1) {
        currentFrameIndex += 1;
        renderFrame(raceData[currentFrameIndex], currentFrameIndex, true);

        await sleep(getFrameDuration());
      }

      if (token === playToken) isPlaying = false;
    }

    async function restartPlayback() {
      stopPlayback();
      currentFrameIndex = 0;
      renderFrame(raceData[0], 0, false);
      startPlayback();
    }

    function mergeImportedRows(currentRows, newRows) {
      const normalizedCurrent = normalizeRows(currentRows);
      const normalizedNew = normalizeRows(newRows);

      if (normalizedCurrent.length < 2) return normalizedNew;
      if (normalizedNew.length < 2) return normalizedCurrent;

      const currentHeaders = normalizedCurrent[0].slice(1);
      const newHeaders = normalizedNew[0].slice(1);

      const allHeaders = ["时间"];
      currentHeaders.forEach(h => {
        if (h && !allHeaders.includes(h)) allHeaders.push(h);
      });
      newHeaders.forEach(h => {
        if (h && !allHeaders.includes(h)) allHeaders.push(h);
      });

      const timeDataMap = new Map();

      normalizedCurrent.slice(1).forEach(row => {
        const time = String(row[0] ?? "").trim();
        if (!time) return;
        const entityMap = new Map();
        currentHeaders.forEach((name, idx) => {
          const val = Number(row[idx + 1]);
          entityMap.set(name, Number.isFinite(val) ? val : 0);
        });
        timeDataMap.set(time, entityMap);
      });

      normalizedNew.slice(1).forEach(row => {
        const time = String(row[0] ?? "").trim();
        if (!time) return;
        if (!timeDataMap.has(time)) {
          timeDataMap.set(time, new Map());
        }
        const entityMap = timeDataMap.get(time);
        newHeaders.forEach((name, idx) => {
          const val = Number(row[idx + 1]);
          entityMap.set(name, Number.isFinite(val) ? val : 0);
        });
      });

      const times = Array.from(timeDataMap.keys()).sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (Number.isFinite(numA) && Number.isFinite(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b, "zh-CN", { numeric: true });
      });

      const mergedRows = [allHeaders];
      times.forEach(time => {
        const entityMap = timeDataMap.get(time);
        const row = [time];
        allHeaders.slice(1).forEach(name => {
          row.push(entityMap.has(name) ? entityMap.get(name) : 0);
        });
        mergedRows.push(row);
      });

      return mergedRows;
    }

    async function importFile(file) {
      try {
        if (!file) return;

        const extension = file.name.split(".").pop().toLowerCase();
        let importedRows;

        if (extension === "csv") {
          const text = await file.text();
          importedRows = d3.csvParseRows(text);
        } else if (extension === "xlsx" || extension === "xls") {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer);
          const firstSheetName = workbook.SheetNames[0];

          if (!firstSheetName) {
            throw new Error("Excel 文件中没有可读取的工作表。");
          }

          importedRows = XLSX.utils.sheet_to_json(
            workbook.Sheets[firstSheetName],
            { header: 1, raw: false, defval: "" }
          );
        } else {
          throw new Error("仅支持 CSV、XLSX 和 XLS 文件。");
        }

        let finalRows = importedRows;
        let isMerged = false;

        if (rows && rows.length > 2 && raceData && raceData.length > 0) {
          const choice = confirm(
            `检测到已有图表数据！\n\n` +
            `点击【确定】：以【覆盖合并】模式导入（覆盖同名主体的数值与时间节点，100%保留已有主体图标与自定义配色）。\n\n` +
            `点击【取消】：以【全新替换】模式导入（用新表格完全替换现有表格，同名主体仍自动保留图标与配色）。`
          );

          if (choice) {
            finalRows = mergeImportedRows(rows, importedRows);
            isMerged = true;
          }
        }

        applyRows(finalRows, file.name);

        if (isMerged) {
          setStatus(`已完成数据覆盖合并：更新了主体数值与时间节点，完好保留了已配置的主体图标与配色！`);
        }
      } catch (error) {
        console.error(error);
        setStatus(`导入失败：${error.message}`, true);
      }
    }

    function downloadTemplateCsv() {
      const csv = rows
        .map(row => row.map(cell => {
          const text = String(cell);
          return /[",\n]/.test(text)
            ? `"${text.replaceAll('"', '""')}"`
            : text;
        }).join(","))
        .join("\n");

      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8"
      });

      downloadBlob(blob, "bar-chart-race-template.csv");
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }


    function sanitizeExportSvg(svgElement) {
      svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svgElement.setAttribute(
        "xmlns:xlink",
        "http://www.w3.org/1999/xlink"
      );
      svgElement.setAttribute("width", WIDTH);
      svgElement.setAttribute("height", HEIGHT);
      svgElement.setAttribute(
        "viewBox",
        `0 0 ${WIDTH} ${HEIGHT}`
      );

      /*
       * 动画被中断或浏览器仍在计算过渡时，极少数属性可能暂时出现
       * NaN / Infinity。此类属性会让整个 SVG 无法作为图片加载。
       */
      svgElement.querySelectorAll("*").forEach(node => {
        [...node.attributes].forEach(attribute => {
          const value = attribute.value;

          if (
            /(^|[\s,(])-?(?:NaN|Infinity)(?=$|[\s,)])/.test(value) ||
            value === "undefined"
          ) {
            node.removeAttribute(attribute.name);
          }
        });
      });

      return svgElement;
    }

    function createExportSvgClone() {
      const clonedSvg = sanitizeExportSvg(
        svg.node().cloneNode(true)
      );

      const background = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      background.setAttribute("width", WIDTH);
      background.setAttribute("height", HEIGHT);
      background.setAttribute("fill", "#ffffff");
      clonedSvg.insertBefore(
        background,
        clonedSvg.firstChild
      );

      const style = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "style"
      );
      style.setAttribute("type", "text/css");
      style.textContent = `
        text {
          font-family:
            "Microsoft YaHei",
            "PingFang SC",
            Arial,
            sans-serif;
        }
        .chart-title {
          font-size: 34px;
          font-weight: 800;
          fill: #172033;
        }
        .chart-subtitle {
          font-size: 16px;
          fill: #64748b;
        }
        .axis text {
          font-size: 14px;
          fill: #64748b;
        }
        .axis line {
          stroke: #dbe5f0;
          stroke-dasharray: 3 6;
        }
        .axis path {
          display: none;
        }
        .zero-line {
          stroke: #475569;
          stroke-width: 2;
          opacity: 0.88;
        }
        .bar-label {
          font-size: 20px;
          font-weight: 700;
          fill: #263244;
        }
        .value-label {
          font-size: 21px;
          font-weight: 800;
          fill: #263244;
        }
        .time-label {
          font-size: 104px;
          font-weight: 900;
          fill: #2563eb;
          opacity: 0.075;
        }
        .rank-label {
          font-size: 15px;
          font-weight: 800;
        }
      `;
      clonedSvg.insertBefore(
        style,
        clonedSvg.firstChild
      );

      return clonedSvg;
    }

    function serializeExportSvg() {
      const clonedSvg = createExportSvgClone();
      const serialized =
        new XMLSerializer().serializeToString(clonedSvg);

      return (
        `<?xml version="1.0" encoding="UTF-8"?>` +
        serialized
      );
    }

    function utf8ToBase64(text) {
      const bytes = new TextEncoder().encode(text);
      const chunkSize = 0x8000;
      let binary = "";

      for (
        let offset = 0;
        offset < bytes.length;
        offset += chunkSize
      ) {
        const chunk = bytes.subarray(
          offset,
          offset + chunkSize
        );

        binary += String.fromCharCode(...chunk);
      }

      return btoa(binary);
    }

    function loadImageFromSource(source) {
      return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => reject(
          new Error("图片源加载失败")
        );
        image.src = source;
      });
    }

    async function loadSerializedSvgImage(serialized) {
      const attempts = [];

      try {
        return await loadImageFromSource(
          `data:image/svg+xml;base64,${utf8ToBase64(serialized)}`
        );
      } catch (error) {
        attempts.push("Base64");
      }

      try {
        return await loadImageFromSource(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`
        );
      } catch (error) {
        attempts.push("URI");
      }

      const svgBlob = new Blob(
        [serialized],
        { type: "image/svg+xml;charset=utf-8" }
      );
      const blobUrl = URL.createObjectURL(svgBlob);

      try {
        return await loadImageFromSource(blobUrl);
      } catch (error) {
        attempts.push("Blob");
        throw new Error(
          `图表帧渲染失败，已尝试：${attempts.join("、")}。`
        );
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    }

    async function captureSvgCanvas(
      targetWidth,
      targetHeight
    ) {
      const serialized = serializeExportSvg();
      const image = await loadSerializedSvgImage(serialized);

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true
      });

      if (!context) {
        throw new Error("浏览器无法创建 Canvas 绘图上下文。");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(
        0,
        0,
        targetWidth,
        targetHeight
      );
      context.drawImage(
        image,
        0,
        0,
        targetWidth,
        targetHeight
      );

      return canvas;
    }

    async function captureSvgImageData(
      targetWidth,
      targetHeight
    ) {
      const canvas = await captureSvgCanvas(
        targetWidth,
        targetHeight
      );
      const context = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true
      });

      return context.getImageData(
        0,
        0,
        targetWidth,
        targetHeight
      ).data;
    }

    function interpolateRaceFrame(
      fromFrame,
      toFrame,
      easedRatio,
      linearRatio = easedRatio
    ) {
      const values = Object.fromEntries(
        categories.map(name => {
          const startValue = Number(fromFrame.values[name]) || 0;
          const endValue = Number(toFrame.values[name]) || 0;

          return [
            name,
            d3.interpolateNumber(
              startValue,
              endValue
            )(easedRatio)
          ];
        })
      );

      const labelValues = Object.fromEntries(
        categories.map(name => {
          const startValue = Number(fromFrame.values[name]) || 0;
          const endValue = Number(toFrame.values[name]) || 0;

          return [
            name,
            d3.interpolateNumber(
              startValue,
              endValue
            )(linearRatio)
          ];
        })
      );

      let displayTime = (toFrame && linearRatio > 0) ? toFrame.time : fromFrame.time;

      return {
        time: displayTime,
        values,
        labelValues,
        axisState: interpolateAxisState(
          fromFrame,
          toFrame,
          easedRatio,
          values
        )
      };
    }

    async function settleSvgFrame() {
      await new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    }

    function getAllRankMap(frame) {
      return new Map(
        getSortedRankItems(frame)
          .map((item, index) => [item.name, index])
      );
    }

    /*
     * renderFrame 会负责条形长度、坐标轴和数值。
     * 此函数进一步覆盖纵向位置，使排名互换也按照同一条缓动曲线连续移动，
     * 避免 GIF 在两个名次之间整行跳动。
     */
    function applyContinuousRankPositions(
      fromFrame,
      toFrame,
      easedProgress
    ) {
      const fromRanks = getAllRankMap(fromFrame);
      const toRanks = getAllRankMap(toFrame);
      const fallbackRank = categories.length + 1;

      const getInterpolatedRank = name => {
        const startRank =
          fromRanks.get(name) ?? fallbackRank;
        const endRank =
          toRanks.get(name) ?? fallbackRank;

        return d3.interpolateNumber(
          startRank,
          endRank
        )(easedProgress);
      };

      const step = yScale.step();
      const bandwidth = yScale.bandwidth();

      const topY = name =>
        margin.top + getInterpolatedRank(name) * step;

      chartGroup
        .selectAll("rect.bar")
        .attr("y", d => topY(d.name));

      chartGroup
        .selectAll("text.bar-label")
        .attr(
          "y",
          d => topY(d.name) + bandwidth / 2
        );

      chartGroup
        .selectAll("text.value-label")
        .attr(
          "y",
          d => topY(d.name) + bandwidth / 2
        );

      chartGroup
        .selectAll("text.rank-label")
        .attr(
          "y",
          d => topY(d.name) + bandwidth / 2
        );
    }

    function getBarShadowColor(color) {
      const parsed = d3.color(color);
      if (!parsed) return "rgba(15, 23, 42, 0.18)";

      return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, 0.30)`;
    }

    function getBarHighlightColor(color) {
      const parsed = d3.color(color);
      if (!parsed) return "rgba(255,255,255,0.28)";

      const brighter = parsed.brighter(0.45);
      return brighter.formatHex();
    }

    function drawRoundedStroke(
      context,
      x,
      y,
      width,
      height,
      radius
    ) {
      if (width <= 0 || height <= 0) return;

      const safeRadius = Math.max(
        0,
        Math.min(radius, width / 2, height / 2)
      );

      context.beginPath();
      context.moveTo(x + safeRadius, y);
      context.lineTo(x + width - safeRadius, y);
      context.quadraticCurveTo(
        x + width,
        y,
        x + width,
        y + safeRadius
      );
      context.lineTo(
        x + width,
        y + height - safeRadius
      );
      context.quadraticCurveTo(
        x + width,
        y + height,
        x + width - safeRadius,
        y + height
      );
      context.lineTo(x + safeRadius, y + height);
      context.quadraticCurveTo(
        x,
        y + height,
        x,
        y + height - safeRadius
      );
      context.lineTo(x, y + safeRadius);
      context.quadraticCurveTo(
        x,
        y,
        x + safeRadius,
        y
      );
      context.closePath();
      context.stroke();
    }

    function drawEntityIcon(
      context,
      name,
      centerX,
      centerY,
      size,
      barColor
    ) {
      const radius = size / 2;
      const image =
        getCachedIconImage(name);

      context.save();
      context.shadowColor =
        "rgba(15, 23, 42, 0.24)";
      context.shadowBlur = 6;
      context.shadowOffsetY = 2;

      context.beginPath();
      context.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
      );

      context.fillStyle = barColor;
      context.fill();
      context.restore();

      if (
        image &&
        image.complete &&
        image.naturalWidth > 0
      ) {
        const sourceSize = Math.min(
          image.naturalWidth,
          image.naturalHeight
        );

        const sourceX =
          (image.naturalWidth - sourceSize) / 2;

        const sourceY =
          (image.naturalHeight - sourceSize) / 2;

        context.save();
        context.beginPath();
        context.arc(
          centerX,
          centerY,
          radius,
          0,
          Math.PI * 2
        );
        context.clip();

        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          centerX - radius,
          centerY - radius,
          size,
          size
        );

        context.restore();
      } else {
        context.save();
        context.fillStyle =
          getContrastTextColor(barColor);
        context.font =
          `900 ${Math.max(10, size * 0.48)}px ` +
          '"Microsoft YaHei","PingFang SC",Arial,sans-serif';
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(
          getIconInitial(name),
          centerX,
          centerY + 0.5
        );
        context.restore();
      }

      context.save();
      context.beginPath();
      context.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
      );
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2;
      context.stroke();

      context.beginPath();
      context.arc(
        centerX,
        centerY,
        Math.max(0, radius - 1),
        0,
        Math.PI * 2
      );
      context.strokeStyle =
        "rgba(100, 116, 139, 0.28)";
      context.lineWidth = 1;
      context.stroke();
      context.restore();
    }

    function fillRoundedRect(
      context,
      x,
      y,
      width,
      height,
      radius
    ) {
      if (width <= 0 || height <= 0) return;

      const safeRadius = Math.max(
        0,
        Math.min(radius, width / 2, height / 2)
      );

      context.beginPath();
      context.moveTo(x + safeRadius, y);
      context.lineTo(x + width - safeRadius, y);
      context.quadraticCurveTo(
        x + width,
        y,
        x + width,
        y + safeRadius
      );
      context.lineTo(
        x + width,
        y + height - safeRadius
      );
      context.quadraticCurveTo(
        x + width,
        y + height,
        x + width - safeRadius,
        y + height
      );
      context.lineTo(x + safeRadius, y + height);
      context.quadraticCurveTo(
        x,
        y + height,
        x,
        y + height - safeRadius
      );
      context.lineTo(x, y + safeRadius);
      context.quadraticCurveTo(
        x,
        y,
        x + safeRadius,
        y
      );
      context.closePath();
      context.fill();
    }

    function getVisibleBarCount() {
      const rawValue = Number(
        document.querySelector("#barsInput").value
      );

      const availableCount = shouldShowZeroValues()
        ? categories.length
        : Object.values(
            raceData[currentFrameIndex]?.values || {}
          ).filter(value => !isEffectivelyZero(value))
            .length;

      if (
        Number.isFinite(rawValue) &&
        rawValue === 0
      ) {
        return availableCount;
      }

      const requested = Number.isFinite(rawValue)
        ? Math.max(1, Math.floor(rawValue))
        : 8;

      return Math.min(requested, availableCount);
    }

    function drawDirectCanvasVideoFrame(
      context,
      outputWidth,
      outputHeight,
      fromFrame,
      toFrame,
      easedProgress,
      linearProgress
    ) {
      const frame = interpolateRaceFrame(
        fromFrame,
        toFrame,
        easedProgress,
        linearProgress
      );

      const ranking = getRanking(frame);
      const [domainMin, domainMax] =
        getCurrentXAxisDomain(
          ranking,
          frame
        );

      configureXAxisScale([domainMin, domainMax], frame);
      const zeroX = xScale(0);

      const logicalWidth = WIDTH;
      const logicalHeight = HEIGHT;
      const scaleX = outputWidth / logicalWidth;
      const scaleY = outputHeight / logicalHeight;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;

      const backgroundGradient =
        context.createLinearGradient(
          0,
          0,
          0,
          outputHeight
        );

      backgroundGradient.addColorStop(0, "#ffffff");
      backgroundGradient.addColorStop(1, "#f5f9ff");

      context.fillStyle = backgroundGradient;
      context.fillRect(
        0,
        0,
        outputWidth,
        outputHeight
      );

      context.save();
      context.scale(scaleX, scaleY);
      context.textBaseline = "middle";
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const aspectMode = document.querySelector("#aspectRatioModeInput")?.value || "16:9";
      const liftRatio = { "16:9": 0, "3:4": 0.065, "4:5": 0.030, "9:16": 0.020 }[aspectMode] || 0;
      const lift = Math.round(logicalHeight * liftRatio);
      
      const yTargetRange = getYScaleTargetRange(ranking.length);
      const targetHeight = yTargetRange[1] - yTargetRange[0];
      const fullHeight = logicalHeight - margin.top - margin.bottom + 60 - lift;
      const cardHeight = fullHeight;

      // 独立图表画布面板
      context.save();
      context.shadowColor = "rgba(51, 65, 85, 0.08)";
      context.shadowBlur = 16;
      context.shadowOffsetY = 6;
      context.fillStyle = "rgba(255,255,255,0.82)";
      fillRoundedRect(
        context,
        CHART_SIDE_PADDING,
        margin.top - 42,
        logicalWidth -
          CHART_SIDE_PADDING * 2,
        cardHeight,
        19
      );
      context.restore();

      context.strokeStyle = "#e3ebf5";
      context.lineWidth = 1;
      drawRoundedStroke(
        context,
        CHART_SIDE_PADDING,
        margin.top - 42,
        logicalWidth -
          CHART_SIDE_PADDING * 2,
        cardHeight,
        19
      );

      const titleText = document.querySelector("#titleInput").value.trim();
      const subtitleText = document.querySelector("#subtitleInput").value.trim();

      if (titleText) {
        // 标题前的强调色竖线
        context.fillStyle = "#2563eb";
        fillRoundedRect(
          context,
          TITLE_LEFT - 14,
          34,
          5,
          31,
          2.5
        );

        // 标题
        context.fillStyle = "#14213a";
        context.font =
          '850 36px "Microsoft YaHei","PingFang SC",Arial,sans-serif';
        context.textAlign = "left";
        context.fillText(
          titleText,
          TITLE_LEFT,
          55
        );
      }

      if (subtitleText) {
        context.fillStyle = "#64748b";
        context.font =
          '550 15px "Microsoft YaHei","PingFang SC",Arial,sans-serif';
        context.fillText(
          subtitleText,
          TITLE_LEFT,
          88
        );
      }

      if (shouldShowXAxis()) {
        // 横轴、网格和刻度
        const axisLayout = getAxisTickLayout();
        const ticks = axisLayout.ticks;

        context.font =
          '400 14px "Microsoft YaHei","PingFang SC",Arial,sans-serif';

        ticks.forEach(tick => {
          const x = xScale(tick);

          context.beginPath();
          context.strokeStyle = "#dbe5f0";
          context.lineWidth = 1;
          context.setLineDash([3, 6]);
          context.moveTo(x, margin.top);
          context.lineTo(
            x,
            logicalHeight - margin.bottom
          );
          context.stroke();

          context.setLineDash([]);
          context.fillStyle = "#64748b";

          if (axisLayout.rotate) {
            context.save();
            context.translate(
              x - 3,
              margin.top - 14
            );
            context.rotate(
              axisLayout.angle *
              Math.PI / 180
            );
            context.textAlign = "right";
            context.fillText(
              formatAxisTick(tick),
              0,
              0
            );
            context.restore();
          } else {
            context.textAlign = "center";
            context.fillText(
              formatAxisTick(tick),
              x,
              margin.top - 17
            );
          }
        });

        // 稳定零轴
        context.beginPath();
        context.strokeStyle = "#475569";
        context.lineWidth = 2;
        context.setLineDash([]);
        context.globalAlpha =
          domainMin < 0 && domainMax > 0
            ? 0.90
            : 0.55;
        context.moveTo(zeroX, margin.top);
        context.lineTo(
          zeroX,
          logicalHeight - margin.bottom
        );
        context.stroke();
        context.globalAlpha = 1;
      }

      const fromRanking = getRanking(fromFrame);
      const toRanking = getRanking(toFrame);
      
      const fromYBand = d3.scaleBand()
        .domain(fromRanking.map(d => d.name))
        .range(getYScaleTargetRange(fromRanking.length))
        .padding(0.16);

      const toYBand = d3.scaleBand()
        .domain(toRanking.map(d => d.name))
        .range(getYScaleTargetRange(toRanking.length))
        .padding(0.16);

      const step = d3.interpolateNumber(fromYBand.step(), toYBand.step())(easedProgress);
      const bandwidth = d3.interpolateNumber(fromYBand.bandwidth(), toYBand.bandwidth())(easedProgress);

      const fromRanks = getAllRankMap(fromFrame);
      const toRanks = getAllRankMap(toFrame);
      const fallbackRank = categories.length + 1;

      const interpolatedRank = name => {
        const startRank =
          fromRanks.get(name) ?? fallbackRank;
        const endRank =
          toRanks.get(name) ?? fallbackRank;

        return d3.interpolateNumber(
          startRank,
          endRank
        )(easedProgress);
      };

      const maxBarCount = Math.max(fromRanking.length, toRanking.length);
      const nameFontSize =
        maxBarCount <= 10
          ? 20
          : maxBarCount <= 20
            ? 16
            : 12;

      const valueFontSize =
        maxBarCount <= 10
          ? 22
          : maxBarCount <= 20
            ? 17
            : 13;

      const rankFontSize =
        maxBarCount <= 10
          ? 15
          : maxBarCount <= 20
            ? 12
            : 10;

      ranking.forEach((item, itemIndex) => {
        const y =
          margin.top +
          interpolatedRank(item.name) * step;

        const centerY = y + bandwidth / 2;

        if (
          centerY < margin.top - bandwidth ||
          centerY >
            logicalHeight - margin.bottom - lift + bandwidth
        ) {
          return;
        }

        const valueX = xScale(item.value);
        const barX = Math.min(zeroX, valueX);
        const barWidth = Math.abs(valueX - zeroX);

        // 行背景，提高排名阅读层级
        context.globalAlpha =
          itemIndex % 2 === 0
            ? 0.82
            : 0.42;
        context.fillStyle = "#f1f5f9";
        fillRoundedRect(
          context,
          margin.left,
          y,
          logicalWidth - margin.left - margin.right,
          bandwidth,
          Math.min(10, bandwidth / 3)
        );
        context.globalAlpha = 1;

        const barColor = getBarColor(item.name);
        const { start: gradStart, end: gradEnd } = getGradientColors(barColor);
        const barRadius = Math.min(
          11,
          bandwidth / 3
        );

        context.save();
        context.shadowColor =
          getBarShadowColor(barColor);
        context.shadowBlur = 9;
        context.shadowOffsetY = 3;
        
        if (isGradientEnabled()) {
          const gradient = context.createLinearGradient(barX, y, barX + barWidth, y);
          gradient.addColorStop(0, gradStart);
          gradient.addColorStop(1, gradEnd);
          context.fillStyle = gradient;
        } else {
          context.fillStyle = barColor;
        }
        
        fillRoundedRect(
          context,
          barX,
          y,
          barWidth,
          bandwidth,
          barRadius
        );
        context.restore();

        // 轻微高光，使柱体更有层次
        if (barWidth > 10) {
          context.save();
          context.globalAlpha = 0.24;
          context.strokeStyle =
            getBarHighlightColor(barColor);
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(
            barX + Math.min(barRadius, barWidth / 2),
            y + 1.5
          );
          context.lineTo(
            barX + barWidth -
              Math.min(barRadius, barWidth / 2),
            y + 1.5
          );
          context.stroke();
          context.restore();
        }

        context.save();
        context.globalAlpha = 0.46;
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1;
        drawRoundedStroke(
          context,
          barX,
          y,
          barWidth,
          bandwidth,
          barRadius
        );
        context.restore();

        // 主体名称
        context.fillStyle = "#263449";
        context.font =
          `700 ${nameFontSize}px ` +
          '"Microsoft YaHei","PingFang SC",Arial,sans-serif';
        context.textAlign = "right";
        context.fillText(
          item.name,
          margin.left - NAME_BAR_GAP,
          centerY
        );

        // 数值与排名使用零轴安全布局。
        const labelValue = getFrameLabelValue(
          frame,
          item.name,
          item.value
        );

        const valueText = formatValue(labelValue);
        const rankText = "";

        const effectiveIconSize =
          getEffectiveValueIconSize(
            bandwidth
          );

        const labelLayout = getAdaptiveLabelLayout(
          item.value,
          getBarColor(item.name),
          valueText,
          rankText,
          valueFontSize,
          rankFontSize,
          effectiveIconSize
        );

        context.save();
        context.beginPath();
        context.rect(
          CHART_SIDE_PADDING,
          0,
          Math.max(
            1,
            logicalWidth -
              CHART_SIDE_PADDING * 2
          ),
          logicalHeight
        );
        context.clip();

        drawEntityIcon(
          context,
          item.name,
          labelLayout.iconCenterX,
          centerY,
          labelLayout.iconSize,
          getBarColor(item.name)
        );

        context.fillStyle = labelLayout.valueColor;
        context.font =
          `800 ${labelLayout.valueFontSize}px ` +
          '"Microsoft YaHei","PingFang SC",Arial,sans-serif';
        context.textAlign =
          labelLayout.valueAnchor === "end"
            ? "right"
            : "left";
        context.fillText(
          valueText,
          labelLayout.valueLabelX,
          centerY,
          labelLayout.valueTextMaxWidth
        );

        context.restore();
      });

      // 时间标签
      const dateOpacity = typeof getDateOpacity === "function" ? getDateOpacity() : 0.20;
      if (dateOpacity > 0.001) {
        const dateColor = typeof getDateColor === "function" ? getDateColor() : "#2563eb";
        context.save();
        context.globalAlpha = dateOpacity;
        context.fillStyle = dateColor;
        context.font =
          '900 104px "Microsoft YaHei","PingFang SC",Arial,sans-serif';
        context.textAlign = "right";
        context.fillText(
          frame.time,
          logicalWidth - margin.right - 10,
          logicalHeight - margin.bottom - 10
        );
        context.restore();
      }

      const frameKey = getDanmakuKey(frame.time);
      if (isDanmakuEnabled() && danmakuMap.has(frameKey)) {
        const text = danmakuMap.get(frameKey);
        const layout = getDanmakuCardLayout(text);
        if (layout) {
          context.save();

          context.fillStyle = "#eff6ff";
          fillRoundedRect(
            context,
            layout.startX,
            layout.startY,
            layout.cardWidth,
            layout.cardHeight,
            12
          );

          context.strokeStyle = "#dbeafe";
          context.lineWidth = 1.5;
          drawRoundedStroke(
            context,
            layout.startX,
            layout.startY,
            layout.cardWidth,
            layout.cardHeight,
            12
          );

          const headerY = layout.startY + 28;
          context.fillStyle = "#2563eb";
          context.font = '700 16px "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
          context.textAlign = "left";
          context.textBaseline = "alphabetic";
          context.fillText(`● 节点 · ${frameKey}`, layout.startX + 20, headerY);

          context.fillStyle = "#0f172a";
          context.font = '800 24px "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
          const maxTextW = layout.cardWidth - 40;
          const lineCount = layout.lines.length;
          const availableTextH = layout.cardHeight - 40;
          const lineGap = lineCount > 1
            ? Math.min(38, Math.floor((availableTextH - 10) / lineCount))
            : 34;

          layout.lines.forEach((lineText, i) => {
            const lineY = headerY + 8 + (i + 1) * lineGap;
            context.fillText(lineText, layout.startX + 20, lineY, maxTextW);
          });

          context.restore();
        }
      }

      context.restore();
      context.setTransform(1, 0, 0, 1, 0, 0);
    }

    function formatBytes(bytes) {
      if (!(bytes > 0)) return "0 MB";

      const units = ["B", "KB", "MB", "GB"];
      let value = bytes;
      let index = 0;

      while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
      }

      return `${value.toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
    }

    function getVideoExportPlan() {
      const fps = getVideoFps();
      const { width, height } = getVideoDimensions();
      const intervalCount = Math.max(
        0,
        raceData.length - 1
      );
      const periodSeconds = getFrameDuration() / 1000;
      const framesPerPeriod = Math.max(
        1,
        Math.round(periodSeconds * fps)
      );
      const effectiveFps =
        framesPerPeriod / periodSeconds;

      const totalPeriods = raceData.length > 0 ? (1 + intervalCount) : 0;

      const totalFrames =
        totalPeriods > 0
          ? totalPeriods * framesPerPeriod
          : 1;

      const durationSeconds =
        totalPeriods > 0
          ? totalPeriods * periodSeconds
          : periodSeconds;

      const bitrate = getVideoBitrate(
        width,
        height,
        fps
      );

      const estimatedBytes =
        bitrate *
        durationSeconds /
        8 *
        1.08;

      const visibleBars = getVisibleBarCount();
      const drawingUnits =
        totalFrames * Math.max(1, visibleBars);

      let loadLevel;
      if (
        totalFrames <= 3000 &&
        drawingUnits <= 80_000
      ) {
        loadLevel = "low";
      } else if (
        totalFrames <= 10_000 &&
        drawingUnits <= 350_000
      ) {
        loadLevel = "medium";
      } else if (
        totalFrames <= 25_000 &&
        drawingUnits <= 1_200_000
      ) {
        loadLevel = "high";
      } else {
        loadLevel = "extreme";
      }

      const formatValue =
        document.querySelector("#videoFormatInput").value;

      const formatLabel =
        formatValue === "mp4"
          ? "MP4 / H.264"
          : formatValue === "webm"
            ? "WebM"
            : "自动：MP4 优先";

      return {
        fps,
        effectiveFps,
        width,
        height,
        intervalCount,
        periodSeconds,
        framesPerPeriod,
        totalFrames,
        durationSeconds,
        bitrate,
        estimatedBytes,
        visibleBars,
        drawingUnits,
        loadLevel,
        formatLabel
      };
    }

    function showVideoPreflight(plan) {
      const modal =
        document.querySelector("#videoPreflightModal");
      const warning =
        document.querySelector("#estimateWarning");
      const loadBadge =
        document.querySelector("#estimateLoad");

      document.querySelector("#estimateFormat").textContent =
        plan.formatLabel;
      document.querySelector("#estimateResolution").textContent =
        `${plan.width}×${plan.height}`;
      document.querySelector("#estimateFps").textContent =
        `${plan.fps} / ${plan.effectiveFps.toFixed(2)} FPS`;
      document.querySelector("#estimateDuration").textContent =
        `${plan.durationSeconds.toFixed(2)} 秒`;
      document.querySelector("#estimateFrames").textContent =
        plan.totalFrames.toLocaleString();
      document.querySelector("#estimateBars").textContent =
        plan.visibleBars.toLocaleString();
      document.querySelector("#estimateSize").textContent =
        formatBytes(plan.estimatedBytes);

      const loadText = {
        low: "低",
        medium: "中",
        high: "高",
        extreme: "极高"
      }[plan.loadLevel];

      loadBadge.textContent = loadText;
      loadBadge.className =
        `load-badge load-${plan.loadLevel}`;

      if (
        plan.loadLevel === "high" ||
        plan.loadLevel === "extreme"
      ) {
        warning.hidden = false;
        warning.textContent =
          plan.loadLevel === "extreme"
            ? (
                "本次导出负载很高，可能占用较多内存并持续较长时间。" +
                "建议降低帧率、缩短数据区间、减少显示主体或改用 720p。"
              )
            : (
                "本次导出负载较高。页面支持中途取消，" +
                "但已经编码的临时数据仍会占用一定内存。"
              );
      } else {
        warning.hidden = true;
        warning.textContent = "";
      }

      modal.hidden = false;

      return new Promise(resolve => {
        const confirmButton =
          document.querySelector("#confirmVideoExportButton");
        const cancelButton =
          document.querySelector("#cancelVideoPreflightButton");

        confirmButton.textContent =
          plan.loadLevel === "extreme"
            ? "仍然开始导出"
            : "开始导出";

        const finish = result => {
          modal.hidden = true;
          confirmButton.onclick = null;
          cancelButton.onclick = null;
          resolve(result);
        };

        confirmButton.onclick = () => finish(true);
        cancelButton.onclick = () => finish(false);
      });
    }

    function getVideoFps() {
      const input = document.querySelector("#videoFpsInput");
      const rawValue = Math.round(Number(input.value) || 60);
      const value = Math.max(1, Math.min(120, rawValue));
      input.value = String(value);
      return value;
    }

    function getVideoDimensions() {
      const [nominalWidth, height] = document
        .querySelector("#videoResolutionInput")
        .value
        .split("x")
        .map(Number);

      const targetHeight = height || 1080;
      const calculatedWidth = Math.round(targetHeight * (WIDTH / HEIGHT));
      const width = (calculatedWidth % 2 === 0) ? calculatedWidth : calculatedWidth + 1;

      return {
        width: width,
        height: targetHeight
      };
    }

    function getVideoBitrate(width, height, fps) {
      /*
       * 根据像素数量和帧率估算码率。
       * 1080p60 约 10 Mbps，1080p120 约 20 Mbps。
       */
      return Math.round(
        Math.max(
          4_000_000,
          Math.min(
            32_000_000,
            width * height * fps * 0.08
          )
        )
      );
    }

    async function loadMediabunny() {
      return import(
        "https://cdn.jsdelivr.net/npm/mediabunny@1.50.9/+esm"
      );
    }

    async function createVideoOutput(
      mediabunny,
      requestedFormat,
      width,
      height,
      bitrate
    ) {
      const {
        Output,
        BufferTarget,
        Mp4OutputFormat,
        WebMOutputFormat,
        CanvasSource,
        getFirstEncodableVideoCodec
      } = mediabunny;

      const tryMp4 = async () => {
        const format = new Mp4OutputFormat();
        const codec = await getFirstEncodableVideoCodec(
          ["avc"],
          { width, height, bitrate }
        );

        if (!codec) {
          return null;
        }

        const target = new BufferTarget();
        const output = new Output({ format, target });
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const source = new CanvasSource(canvas, {
          codec,
          bitrate,
          keyFrameInterval: 2,
          latencyMode: "quality",
          hardwareAcceleration: "prefer-hardware"
        });

        output.addVideoTrack(source);

        return {
          output,
          target,
          source,
          canvas,
          extension: "mp4",
          mimeType: "video/mp4",
          codec
        };
      };

      const tryWebM = async () => {
        const format = new WebMOutputFormat();
        const codec = await getFirstEncodableVideoCodec(
          ["vp9", "vp8", "av1"],
          { width, height, bitrate }
        );

        if (!codec) {
          return null;
        }

        const target = new BufferTarget();
        const output = new Output({ format, target });
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const source = new CanvasSource(canvas, {
          codec,
          bitrate,
          keyFrameInterval: 2,
          latencyMode: "quality",
          hardwareAcceleration: "prefer-hardware"
        });

        output.addVideoTrack(source);

        return {
          output,
          target,
          source,
          canvas,
          extension: "webm",
          mimeType: "video/webm",
          codec
        };
      };

      if (requestedFormat === "mp4") {
        return tryMp4();
      }

      if (requestedFormat === "webm") {
        return tryWebM();
      }

      return (await tryMp4()) || (await tryWebM());
    }

    async function exportVideo() {
      const exportButton =
        document.querySelector("#exportVideoButton");
      const cancelButton =
        document.querySelector("#cancelVideoButton");
      const originalFrameIndex = currentFrameIndex;
      let videoOutput = null;

      try {
        if (raceData.length === 0) {
          throw new Error("没有可导出的视频数据。");
        }

        await ensureAllIconImagesLoaded();

        if (!("VideoEncoder" in window)) {
          throw new Error(
            "当前浏览器不支持 WebCodecs 视频编码，请使用最新版 Chrome 或 Edge。"
          );
        }

        const plan = getVideoExportPlan();
        const confirmed = await showVideoPreflight(plan);

        if (!confirmed) {
          setStatus("已取消视频导出。");
          return;
        }

        stopPlayback();
        exportButton.disabled = true;
        cancelButton.hidden = false;
        videoExportCancelled = false;

        const {
          fps,
          effectiveFps,
          width,
          height,
          intervalCount,
          periodSeconds,
          framesPerPeriod,
          totalFrames,
          bitrate
        } = plan;

        const requestedFormat =
          document.querySelector("#videoFormatInput").value;

        setStatus("正在载入视频编码器……");

        const mediabunny = await loadMediabunny();

        videoOutput = await createVideoOutput(
          mediabunny,
          requestedFormat,
          width,
          height,
          bitrate
        );

        if (!videoOutput) {
          throw new Error(
            requestedFormat === "mp4"
              ? "浏览器没有可用的 H.264 编码器，请改选自动或 WebM。"
              : requestedFormat === "webm"
                ? "浏览器没有可用的 WebM 视频编码器。"
                : "浏览器没有可用的 MP4 或 WebM 视频编码器。"
          );
        }

        const {
          output,
          target,
          source,
          canvas,
          extension,
          mimeType,
          codec
        } = videoOutput;

        const context = canvas.getContext("2d", {
          alpha: false,
          desynchronized: true
        });

        if (!context) {
          throw new Error("无法创建视频 Canvas 绘图上下文。");
        }

        await output.start();

        const frameDuration =
          periodSeconds / framesPerPeriod;

        let frameNumber = 0;
        let timestamp = 0;

        const checkCancelled = () => {
          if (videoExportCancelled) {
            throw new Error("__VIDEO_EXPORT_CANCELLED__");
          }
        };

        const encodeCanvasFrame = async (
          fromFrame,
          toFrame,
          easedProgress,
          linearProgress,
          forceKeyFrame
        ) => {
          checkCancelled();

          drawDirectCanvasVideoFrame(
            context,
            width,
            height,
            fromFrame,
            toFrame,
            easedProgress,
            linearProgress
          );

          await source.add(
            timestamp,
            frameDuration,
            { keyFrame: forceKeyFrame }
          );

          timestamp += frameDuration;
          frameNumber += 1;

          const percent = Math.round(
            frameNumber / totalFrames * 100
          );

          setStatus(
            `正在导出视频：${percent}% · ` +
            `Canvas 直绘 · ` +
            `${extension.toUpperCase()} / ${codec.toUpperCase()} · ` +
            `${width}×${height} · ` +
            `有效 ${effectiveFps.toFixed(2)} FPS`
          );

          // 定期让出主线程，使取消按钮可以及时响应。
          if (frameNumber % 4 === 0) {
            await new Promise(resolve =>
              setTimeout(resolve, 0)
            );
          }
        };

        if (intervalCount === 0) {
          await encodeCanvasFrame(
            raceData[0],
            raceData[0],
            1,
            0,
            true
          );
        } else {
          const keyFrameInterval = Math.max(
            1,
            Math.round(effectiveFps * 2)
          );

          // 1. Encode initial static period for node 0 (raceData[0]) so node 0 gets full display duration
          for (let frameIndex = 0; frameIndex < framesPerPeriod; frameIndex++) {
            checkCancelled();
            await encodeCanvasFrame(
              raceData[0],
              raceData[0],
              1,
              0,
              frameNumber % keyFrameInterval === 0
            );
          }

          // 2. Encode transition periods
          for (
            let periodIndex = 0;
            periodIndex < intervalCount;
            periodIndex += 1
          ) {
            const fromFrame = raceData[periodIndex];
            const toFrame = raceData[periodIndex + 1];

            for (
              let frameIndex = 0;
              frameIndex < framesPerPeriod;
              frameIndex += 1
            ) {
              checkCancelled();

              const sampleTime =
                (frameIndex + 0.5) * frameDuration;

              const linearProgress = Math.max(
                0,
                Math.min(
                  1,
                  sampleTime /
                  (periodSeconds * MOTION_RATIO)
                )
              );

              const easedProgress =
                MOTION_EASING(linearProgress);

              await encodeCanvasFrame(
                fromFrame,
                toFrame,
                easedProgress,
                linearProgress,
                frameNumber % keyFrameInterval === 0
              );
            }
          }
        }

        checkCancelled();
        await output.finalize();

        const videoBlob = new Blob(
          [target.buffer],
          { type: mimeType }
        );

        const baseName = document.querySelector("#exportFilenameInput")?.value?.trim() || "bar-chart-race";
        downloadBlob(
          videoBlob,
          `${baseName}-${fps}fps.${extension}`
        );

        setStatus(
          `视频已导出：Canvas 直绘，` +
          `${extension.toUpperCase()} / ${codec.toUpperCase()}，` +
          `${width}×${height}，` +
          `有效 ${effectiveFps.toFixed(2)} FPS，` +
          `总时长 ${timestamp.toFixed(2)} 秒，` +
          `文件 ${formatBytes(videoBlob.size)}。`
        );
      } catch (error) {
        console.error(error);

        if (videoOutput?.output) {
          try {
            await videoOutput.output.cancel();
          } catch {
            // 忽略取消阶段的二次错误。
          }
        }

        if (error.message === "__VIDEO_EXPORT_CANCELLED__") {
          setStatus("视频导出已取消。");
        } else {
          setStatus(
            `视频导出失败：${error.message}`,
            true
          );
        }
      } finally {
        exportButton.disabled = false;
        cancelButton.hidden = true;
        videoExportCancelled = false;

        currentFrameIndex = Math.max(
          0,
          Math.min(
            raceData.length - 1,
            originalFrameIndex
          )
        );

        renderFrame(
          raceData[currentFrameIndex],
          false
        );
      }
    }

    function sampleCanvasPixels(
      context,
      width,
      height,
      stride = 2
    ) {
      const source = context.getImageData(
        0,
        0,
        width,
        height
      ).data;

      const pixelCount =
        Math.ceil(width / stride) *
        Math.ceil(height / stride);

      const sampled = new Uint8Array(
        pixelCount * 4
      );

      let targetOffset = 0;

      for (let y = 0; y < height; y += stride) {
        for (let x = 0; x < width; x += stride) {
          const sourceOffset =
            (y * width + x) * 4;

          sampled[targetOffset] =
            source[sourceOffset];
          sampled[targetOffset + 1] =
            source[sourceOffset + 1];
          sampled[targetOffset + 2] =
            source[sourceOffset + 2];
          sampled[targetOffset + 3] = 255;

          targetOffset += 4;
        }
      }

      return sampled.subarray(0, targetOffset);
    }

    function appendColorSamples(
      target,
      cssColor,
      repetitions = 24
    ) {
      const colorCanvas =
        appendColorSamples.canvas ||
        (
          appendColorSamples.canvas =
            document.createElement("canvas")
        );

      colorCanvas.width = 1;
      colorCanvas.height = 1;

      const context =
        appendColorSamples.context ||
        (
          appendColorSamples.context =
            colorCanvas.getContext("2d", {
              willReadFrequently: true
            })
        );

      context.clearRect(0, 0, 1, 1);
      context.fillStyle = cssColor;
      context.fillRect(0, 0, 1, 1);

      const rgba = context.getImageData(
        0,
        0,
        1,
        1
      ).data;

      for (let index = 0; index < repetitions; index += 1) {
        target.push(
          rgba[0],
          rgba[1],
          rgba[2],
          255
        );
      }
    }

    function getGifDimensions() {
      const height = 540;
      const calculatedWidth = Math.round(height * (WIDTH / HEIGHT));
      const width = (calculatedWidth % 2 === 0) ? calculatedWidth : calculatedWidth + 1;
      return { width, height };
    }

    async function buildGlobalGifPalette(quantize) {
      const { width: currentGifWidth, height: currentGifHeight } = getGifDimensions();
      const paletteHeight = 270;
      const paletteWidth = Math.round(paletteHeight * (WIDTH / HEIGHT));
      const canvas = document.createElement("canvas");
      canvas.width = paletteWidth;
      canvas.height = paletteHeight;

      const context = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true
      });

      if (!context) {
        throw new Error("无法创建 GIF 调色板采样画布。");
      }

      const sampleBuffers = [];
      const intervalCount = Math.max(
        0,
        raceData.length - 1
      );

      const sampleCount = Math.min(
        7,
        Math.max(1, raceData.length)
      );

      for (
        let sampleIndex = 0;
        sampleIndex < sampleCount;
        sampleIndex += 1
      ) {
        const normalized =
          sampleCount === 1
            ? 0
            : sampleIndex / (sampleCount - 1);

        if (intervalCount === 0) {
          drawDirectCanvasVideoFrame(
            context,
            paletteWidth,
            paletteHeight,
            raceData[0],
            raceData[0],
            1,
            1
          );
        } else {
          const timelinePosition =
            normalized * intervalCount;

          const periodIndex = Math.min(
            intervalCount - 1,
            Math.floor(timelinePosition)
          );

          const localProgress =
            periodIndex === intervalCount - 1 &&
            timelinePosition >= intervalCount
              ? 1
              : timelinePosition - periodIndex;

          const linearProgress = Math.max(
            0,
            Math.min(
              1,
              localProgress / MOTION_RATIO
            )
          );

          drawDirectCanvasVideoFrame(
            context,
            paletteWidth,
            paletteHeight,
            raceData[periodIndex],
            raceData[periodIndex + 1],
            MOTION_EASING(linearProgress),
            linearProgress
          );
        }

        sampleBuffers.push(
          sampleCanvasPixels(
            context,
            paletteWidth,
            paletteHeight,
            2
          )
        );

        await new Promise(resolve =>
          setTimeout(resolve, 0)
        );
      }

      const explicitColors = [];
      [
        "#ffffff",
        "#172033",
        "#263244",
        "#334155",
        "#64748b",
        "#dce3ec"
      ].forEach(color =>
        appendColorSamples(
          explicitColors,
          color,
          96
        )
      );

      categories.forEach(name =>
        appendColorSamples(
          explicitColors,
          getBarColor(name),
          64
        )
      );

      const explicitBuffer =
        Uint8Array.from(explicitColors);

      const totalLength =
        sampleBuffers.reduce(
          (sum, buffer) => sum + buffer.length,
          explicitBuffer.length
        );

      const combined = new Uint8Array(totalLength);
      let offset = 0;

      sampleBuffers.forEach(buffer => {
        combined.set(buffer, offset);
        offset += buffer.length;
      });

      combined.set(explicitBuffer, offset);

      return quantize(combined, 256);
    }

    async function exportAnimatedGif() {
      const exportButton =
        document.querySelector("#exportGifButton");
      const cancelButton =
        document.querySelector("#cancelGifButton");
      const originalFrameIndex = currentFrameIndex;

      try {
        if (raceData.length === 0) {
          throw new Error("没有可导出的数据。");
        }

        await ensureAllIconImagesLoaded();

        stopPlayback();
        exportButton.disabled = true;
        cancelButton.hidden = false;
        gifExportCancelled = false;

        const requestedGifFps = getRequestedGifFps();

        setStatus(
          `正在载入 GIF 编码器：目标 ${requestedGifFps} FPS……`
        );

        const {
          GIFEncoder,
          quantize,
          applyPalette
        } = await import(
          "https://unpkg.com/gifenc?module"
        );

        const encoder = GIFEncoder();
        const intervalCount = Math.max(
          0,
          raceData.length - 1
        );

        const exactPeriodCentiseconds = Math.max(
          1,
          Math.round(getFrameDuration() / 10)
        );

        const exactPeriodDuration =
          exactPeriodCentiseconds * 10;

        const exactMotionDuration =
          exactPeriodDuration * MOTION_RATIO;

        const desiredFramesPerPeriod = Math.max(
          1,
          Math.round(
            exactPeriodDuration *
            requestedGifFps /
            1000
          )
        );

        const minimumDelayCentiseconds =
          getGifMinimumDelayCentiseconds();

        const maximumFramesByTiming = Math.max(
          1,
          Math.floor(
            exactPeriodCentiseconds /
            minimumDelayCentiseconds
          )
        );

        const maximumFramesByMode = Math.max(
          1,
          Math.floor(
            exactPeriodDuration *
            getGifCompatibilityMaxFps() /
            1000
          )
        );

        const framesPerPeriod = Math.min(
          desiredFramesPerPeriod,
          maximumFramesByTiming,
          maximumFramesByMode
        );

        const effectiveGifFps =
          framesPerPeriod /
          (exactPeriodDuration / 1000);

        const maximumRequiredSteps =
          intervalCount > 0
            ? d3.max(
                d3.range(intervalCount),
                index => getMaximumValueSteps(
                  raceData[index],
                  raceData[index + 1]
                )
              ) || 0
            : 0;

        const availableMotionFrames = Math.max(
          1,
          Math.round(
            framesPerPeriod * MOTION_RATIO
          )
        );

        const skipsSomeDisplaySteps =
          maximumRequiredSteps >
          availableMotionFrames;

        const totalPeriods = raceData.length > 0 ? (1 + intervalCount) : 0;
        const totalCentiseconds =
          Math.max(
            1,
            (totalPeriods || 1) *
            exactPeriodCentiseconds
          );

        let completedCentiseconds = 0;
        let encodedFrames = 0;
        let mergedHoldFrames = 0;

        const { width: currentGifWidth, height: currentGifHeight } = getGifDimensions();
        const canvas = document.createElement("canvas");
        canvas.width = currentGifWidth;
        canvas.height = currentGifHeight;

        const context = canvas.getContext("2d", {
          alpha: false,
          willReadFrequently: true
        });

        if (!context) {
          throw new Error("无法创建 GIF Canvas 绘图上下文。");
        }

        setStatus("正在建立 GIF 全局调色板……");
        const globalPalette =
          await buildGlobalGifPalette(quantize);

        const checkCancelled = () => {
          if (gifExportCancelled) {
            throw new Error(
              "__GIF_EXPORT_CANCELLED__"
            );
          }
        };

        const updateGifProgress = () => {
          const percent = Math.round(
            completedCentiseconds /
            totalCentiseconds *
            100
          );

          const valueStepStatus =
            skipsSomeDisplaySteps
              ? " · 数值可能跳步"
              : " · 数值逐步覆盖";

          const compatibilityText =
            getGifCompatibilityMode() ===
            "powerpoint"
              ? "PPT 稳定"
              : "浏览器优先";

          setStatus(
            `正在生成 GIF：${percent}% · ` +
            `Canvas 直绘 · 全局调色板 · ` +
            `${compatibilityText} · ` +
            `有效 ${effectiveGifFps.toFixed(1)} FPS` +
            valueStepStatus
          );
        };

        const encodeCanvasFrame = async (
          fromFrame,
          toFrame,
          easedProgress,
          linearProgress,
          delayCentiseconds,
          isFirstFrame
        ) => {
          checkCancelled();

          drawDirectCanvasVideoFrame(
            context,
            currentGifWidth,
            currentGifHeight,
            fromFrame,
            toFrame,
            easedProgress,
            linearProgress
          );

          const rgba = context.getImageData(
            0,
            0,
            currentGifWidth,
            currentGifHeight
          ).data;

          const indexedPixels = applyPalette(
            rgba,
            globalPalette
          );

          const options = {
            palette: globalPalette,
            delay: Math.max(
              10,
              delayCentiseconds * 10
            )
          };

          if (isFirstFrame) {
            options.repeat = 0;
          }

          encoder.writeFrame(
            indexedPixels,
            currentGifWidth,
            currentGifHeight,
            options
          );

          encodedFrames += 1;
          completedCentiseconds +=
            delayCentiseconds;

          updateGifProgress();

          if (encodedFrames % 3 === 0) {
            await new Promise(resolve =>
              setTimeout(resolve, 0)
            );
          }
        };

        if (intervalCount === 0) {
          await encodeCanvasFrame(
            raceData[0],
            raceData[0],
            1,
            0,
            exactPeriodCentiseconds,
            true
          );
        } else {
          let isFirstGifFrame = true;

          // 1. Encode initial static period for node 0
          for (let frameIndex = 0; frameIndex < framesPerPeriod; frameIndex++) {
            checkCancelled();
            const delayCentiseconds = Math.max(
              minimumDelayCentiseconds,
              Math.round(exactPeriodCentiseconds / framesPerPeriod)
            );

            await encodeCanvasFrame(
              raceData[0],
              raceData[0],
              1,
              0,
              delayCentiseconds,
              isFirstGifFrame
            );
            isFirstGifFrame = false;
          }

          // 2. Encode transition periods
          for (
            let periodIndex = 0;
            periodIndex < intervalCount;
            periodIndex += 1
          ) {
            checkCancelled();

            const fromFrame =
              raceData[periodIndex];
            const toFrame =
              raceData[periodIndex + 1];

            const baseDelayCentiseconds =
              Math.floor(
                exactPeriodCentiseconds /
                framesPerPeriod
              );

            const extraDelayFrameCount =
              exactPeriodCentiseconds %
              framesPerPeriod;

            let holdDelayCentiseconds = 0;
            let holdFrameCount = 0;

            for (
              let frameIndex = 0;
              frameIndex < framesPerPeriod;
              frameIndex += 1
            ) {
              const delayCentiseconds =
                baseDelayCentiseconds +
                (
                  frameIndex <
                    extraDelayFrameCount
                    ? 1
                    : 0
                );

              const elapsedBeforeFrame =
                frameIndex *
                  baseDelayCentiseconds +
                Math.min(
                  frameIndex,
                  extraDelayFrameCount
                );

              const sampleTimeMs =
                (
                  elapsedBeforeFrame +
                  delayCentiseconds / 2
                ) * 10;

              const linearProgress = Math.max(
                0,
                Math.min(
                  1,
                  sampleTimeMs /
                  exactMotionDuration
                )
              );

              if (linearProgress >= 1) {
                holdDelayCentiseconds +=
                  delayCentiseconds;
                holdFrameCount += 1;
                continue;
              }

              await encodeCanvasFrame(
                fromFrame,
                toFrame,
                MOTION_EASING(linearProgress),
                linearProgress,
                delayCentiseconds,
                isFirstGifFrame
              );

              isFirstGifFrame = false;
            }

            if (holdDelayCentiseconds > 0) {
              await encodeCanvasFrame(
                fromFrame,
                toFrame,
                1,
                1,
                holdDelayCentiseconds,
                isFirstGifFrame
              );

              isFirstGifFrame = false;
              mergedHoldFrames += Math.max(
                0,
                holdFrameCount - 1
              );
            }
          }
        }

        checkCancelled();
        encoder.finish();

        const gifBytes = encoder.bytes();
        const gifBlob = new Blob(
          [gifBytes],
          { type: "image/gif" }
        );

        const baseName = document.querySelector("#exportFilenameInput")?.value?.trim() || "bar-chart-race";
        downloadBlob(
          gifBlob,
          `${baseName}-${requestedGifFps}fps.gif`
        );

        const totalDurationSeconds =
          (
            totalCentiseconds / 100
          ).toFixed(2);

        const compatibilityName =
          getGifCompatibilityMode() ===
          "powerpoint"
            ? "PowerPoint 稳定模式"
            : "浏览器优先模式";

        const fpsDescription =
          Math.abs(
            effectiveGifFps -
            requestedGifFps
          ) < 0.05
            ? `${requestedGifFps} FPS`
            : (
                `目标 ${requestedGifFps} FPS，` +
                `有效 ${effectiveGifFps.toFixed(1)} FPS`
              );

        const stepMessage =
          skipsSomeDisplaySteps
            ? (
                `数值跨度最多需要 ` +
                `${maximumRequiredSteps} 个步进，` +
                `当前运动帧约 ` +
                `${availableMotionFrames}，` +
                `会跳过部分中间值。`
              )
            : "当前帧数足以覆盖每个数值步进。";

        setStatus(
          `GIF 已导出：Canvas 直绘，` +
          `全局调色板，${currentGifWidth}×${currentGifHeight}，` +
          `${compatibilityName}，${fpsDescription}，` +
          `总时长 ${totalDurationSeconds} 秒，` +
          `编码 ${encodedFrames} 帧，` +
          `合并 ${mergedHoldFrames} 个重复停留帧，` +
          `文件 ${formatBytes(gifBlob.size)}。` +
          stepMessage
        );
      } catch (error) {
        console.error(error);

        if (
          error.message ===
          "__GIF_EXPORT_CANCELLED__"
        ) {
          setStatus("GIF 导出已取消。");
        } else {
          setStatus(
            `GIF 导出失败：${error.message} ` +
            `建议使用最新版 Chrome 或 Edge。`,
            true
          );
        }
      } finally {
        exportButton.disabled = false;
        cancelButton.hidden = true;
        gifExportCancelled = false;

        currentFrameIndex = Math.max(
          0,
          Math.min(
            raceData.length - 1,
            originalFrameIndex
          )
        );

        renderFrame(
          raceData[currentFrameIndex],
          false
        );
      }
    }

    async function exportCurrentFramePng() {
      try {
        stopPlayback();
        setStatus("正在渲染 PNG……");

        const canvas = await captureSvgCanvas(
          WIDTH * 2,
          HEIGHT * 2
        );

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            result => {
              if (result) {
                resolve(result);
              } else {
                reject(
                  new Error("浏览器未能生成 PNG 文件。")
                );
              }
            },
            "image/png"
          );
        });

        const time =
          raceData[currentFrameIndex]?.time || "frame";

        const baseName = document.querySelector("#exportFilenameInput")?.value?.trim() || "bar-chart-race";
        downloadBlob(
          blob,
          `${baseName}-${time}.png`
        );

        setStatus(
          "当前帧已导出为 2560×1440 PNG，可直接插入 PPT。"
        );
      } catch (error) {
        console.error(error);
        setStatus(`导出失败：${error.message}`, true);
      }
    }

    document.querySelector("#fileInput")
      .addEventListener("change", event => importFile(event.target.files[0]));

    document.querySelector("#loadSampleButton")
      .addEventListener("click", () => applyRows(structuredClone(sampleRows), "示例数据"));

    document.querySelector("#clearDataButton")
      ?.addEventListener("click", clearAllData);

    document.querySelector("#downloadTemplateButton")
      .addEventListener("click", downloadTemplateCsv);

    document.querySelector("#resetColorsButton")
      .addEventListener("click", resetCustomColors);

    document.querySelector("#startButton")
      .addEventListener("click", startPlayback);

    document.querySelector("#pauseButton")
      .addEventListener("click", stopPlayback);

    document.querySelector("#restartButton")
      .addEventListener("click", restartPlayback);

    document.querySelector("#fullscreenRestartButton")
      .addEventListener("click", restartPlayback);

    document.querySelector("#exportPngButton")
      .addEventListener("click", exportCurrentFramePng);

    document.querySelector("#exportVideoButton")
      .addEventListener("click", exportVideo);

    document.querySelector("#cancelVideoButton")
      .addEventListener("click", () => {
        videoExportCancelled = true;
        document.querySelector("#cancelVideoButton").disabled = true;
        setStatus("正在取消视频导出……");
        setTimeout(() => {
          document.querySelector("#cancelVideoButton").disabled = false;
        }, 500);
      });

    document.querySelector("#exportGifButton")
      .addEventListener("click", exportAnimatedGif);

    document.querySelector("#cancelGifButton")
      .addEventListener("click", () => {
        gifExportCancelled = true;
        const button =
          document.querySelector("#cancelGifButton");
        button.disabled = true;
        setStatus("正在取消 GIF 导出……");

        setTimeout(() => {
          button.disabled = false;
        }, 500);
      });

    document.querySelector("#speedInput")
      .addEventListener("input", updateSpeedLabel);

    document.querySelector("#valueStepInput")
      .addEventListener("change", () => {
        const step = getValueStep();
        renderFrame(raceData[currentFrameIndex], false);
        setStatus(
          `数值显示步长已设置为 ${step}。` +
          `步长 1 表示按整数显示；高速播放或帧率不足时可能跳过部分数值。`
        );
      });

    function showVideoExportStatus() {
      const fps = getVideoFps();
      const { width, height } = getVideoDimensions();
      const format =
        document.querySelector("#videoFormatInput").value;

      const formatText =
        format === "mp4"
          ? "MP4"
          : format === "webm"
            ? "WebM"
            : "自动格式";

      setStatus(
        `视频导出设置：${formatText}，` +
        `${width}×${height}，${fps} FPS。`
      );
    }

    document.querySelector("#videoFpsInput")
      .addEventListener("change", showVideoExportStatus);

    document.querySelector("#videoFormatInput")
      .addEventListener("change", showVideoExportStatus);

    document.querySelector("#videoResolutionInput")
      .addEventListener("change", showVideoExportStatus);

    function showGifCompatibilityStatus() {
      const requested = getRequestedGifFps();
      const mode = getGifCompatibilityMode();
      const maximum = getGifCompatibilityMaxFps();

      if (requested > maximum) {
        setStatus(
          `目标帧率为 ${requested} FPS。` +
          `${mode === "powerpoint" ? "PowerPoint 稳定" : "浏览器优先"}模式` +
          `会将有效帧率限制在约 ${maximum} FPS，` +
          `以避免播放变慢；GIF 总时长仍与 HTML 一致。`
        );
      } else {
        setStatus(
          `GIF 导出帧率已设置为 ${requested} FPS，` +
          `当前为${mode === "powerpoint" ? " PowerPoint 稳定" : "浏览器优先"}模式。`
        );
      }
    }

    document.querySelector("#gifFpsInput")
      .addEventListener("change", showGifCompatibilityStatus);

    document.querySelector("#gifCompatibilityInput")
      .addEventListener("change", showGifCompatibilityStatus);

    document.querySelector("#valueScaleInput")
      .addEventListener("change", () => {
        stopPlayback();
        renderFrame(
          raceData[currentFrameIndex],
          false
        );

        const requested = getRequestedValueScaleType();
        const resolved = resolveXAxisScaleType();

        const message =
          requested === "auto"
            ? (
                `数值尺度设为自动；当前数量级跨度约 ` +
                `${d3.format(".2~g")(globalValueStats.ratio)} 倍，` +
                `已使用 ${resolved === "symlog" ? "Symlog" : "线性"} 尺度。`
              )
            : requested === "symlog"
              ? "已使用 Symlog 对称对数尺度，支持负数、0 和大数量级跨度。"
              : "已使用线性尺度；跨度过大时小数值可能难以辨认。";

        setStatus(message);
      });

    document.querySelector("#xAxisModeInput")
      .addEventListener("change", () => {
        stopPlayback();
        renderFrame(
          raceData[currentFrameIndex],
          false
        );

        const mode =
          document.querySelector("#xAxisModeInput").value;

        const message =
          mode === "non-negative"
            ? "已启用非负模式：0 刻度固定在最左侧，最大程度延伸正数柱体长度。"
            : mode === "fixed"
              ? "横轴已固定为全局范围，0 刻度和柱体比例保持稳定。"
              : mode === "symmetric"
                ? "横轴已固定为对称全局范围，0 刻度固定在图表中央。"
                : mode === "smooth-symmetric"
                  ? "已启用平滑动态对称范围：0 固定在中央，正负值保持相同比例。"
                  : mode === "smooth-split"
                    ? "已启用平滑动态分侧范围：0 固定在中央，正负两侧独立缩放。"
                    : "已启用自由动态范围：0 刻度可能随数据范围移动。";

        setStatus(message);
      });

    document.querySelector("#progressInput")
      .addEventListener("input", event => {
        stopPlayback();
        currentFrameIndex = Number(event.target.value);
        renderFrame(raceData[currentFrameIndex], false);
      });

    document.querySelector("#fullscreenButton")
      .addEventListener("click", () => {
        document.querySelector("#captureArea").requestFullscreen?.();
      });

    document.querySelector("#exitFullscreenButton")
      .addEventListener("click", () => document.exitFullscreen?.());

    document.querySelector("#chartWidthScaleInput")
      ?.addEventListener("input", updateChartWidth);

    document.querySelector("#aspectRatioModeInput")
      ?.addEventListener("change", updateChartWidth);

    const dateOpacityEl = document.querySelector("#dateOpacityInput");
    if (dateOpacityEl) {
      dateOpacityEl.addEventListener("input", updateDateOpacity);
      dateOpacityEl.addEventListener("change", () => {
        updateDateOpacity();
        saveAppState();
      });
    }

    const dateColorEl = document.querySelector("#dateColorInput");
    if (dateColorEl) {
      dateColorEl.addEventListener("input", e => updateDateColor(e.target.value));
      dateColorEl.addEventListener("change", e => {
        updateDateColor(e.target.value);
        saveAppState();
      });
    }

    const dateColorCodeEl = document.querySelector("#dateColorCodeInput");
    if (dateColorCodeEl) {
      dateColorCodeEl.addEventListener("input", e => updateDateColor(e.target.value));
      dateColorCodeEl.addEventListener("change", e => {
        updateDateColor(e.target.value);
        saveAppState();
      });
    }

    document.querySelector("#maxBarHeightInput")
      ?.addEventListener("input", updateMaxBarHeight);

    configInputIds.forEach(id => {
      const el = document.querySelector(`#${id}`);
      if (el) {
        const handler = () => {
          if (raceData && raceData.length > 0) {
            renderFrame(raceData[currentFrameIndex], false);
          }
          saveAppState();
        };
        el.addEventListener("input", handler);
        el.addEventListener("change", handler);
      }
    });

    window.addEventListener("beforeunload", event => {
      saveAppState();
      if (isPlaying) {
        event.preventDefault();
        event.returnValue = "正在播放动画，确定要离开吗？";
      }
    });

    document.querySelector("#addDanmakuButton")
      ?.addEventListener("click", addDanmaku);

    document.querySelector("#danmakuTimeSelect")
      ?.addEventListener("change", (e) => {
        const time = e.target.value;
        const textInput = document.querySelector("#danmakuTextInput");
        if (danmakuMap.has(time)) {
          if (textInput) textInput.value = danmakuMap.get(time);
        } else {
          if (textInput) textInput.value = "";
        }
        updateDanmakuFormState();
      });

    document.querySelector("#danmakuTextInput")
      ?.addEventListener("keydown", event => {
        if (event.key === "Enter") addDanmaku();
      });

    document.querySelector("#showDanmakuInput")
      ?.addEventListener("change", event => {
        renderFrame(raceData[currentFrameIndex], false);
        setStatus(
          event.target.checked
            ? "已开启时间节点解说弹幕显示。"
            : "已关闭时间节点解说弹幕显示。"
        );
      });

    updateSpeedLabel();
    if (!loadAppState()) {
      applyRows(structuredClone(sampleRows), "示例数据");
    }
