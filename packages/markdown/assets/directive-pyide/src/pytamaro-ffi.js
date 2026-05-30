export const createPytamaroJsFFI = () => {
  const floatBuffer = new ArrayBuffer(4);
  const floatView = new DataView(floatBuffer);

  const unProxy = (obj) => {
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.toJs === "function"
    ) {
      try {
        return obj.toJs({ pyproxies: [], dict_converter: Object.fromEntries });
      } catch (e) {
        console.error("Error converting PyProxy:", e);
        return obj;
      }
    }
    return obj;
  };

  const uint32ToFloat = (u32) => {
    floatView.setUint32(0, u32 >>> 0, false);
    return floatView.getFloat32(0, false);
  };

  const decodePoint = (value, width, height) => {
    const packed = typeof value === "bigint" ? value : BigInt(value || 0);
    const x = uint32ToFloat(Number((packed >> 32n) & 0xffffffffn));
    const y = uint32ToFloat(Number(packed & 0xffffffffn));
    return { x: x * width * 0.5, y: -y * height * 0.5 };
  };

  const colorToCss = (value) => {
    const argb =
      typeof value === "bigint"
        ? Number(value & 0xffffffffn)
        : Number(value >>> 0);
    const a = ((argb >> 24) & 0xff) / 255;
    const r = (argb >> 16) & 0xff;
    const g = (argb >> 8) & 0xff;
    const b = argb & 0xff;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  const rotatePoint = (point, pivot, angleRad) => {
    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos,
    };
  };

  const buildGraphic = (specs) => {
    const stack = [];
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");

    for (const spec of specs || []) {
      if (!spec || typeof spec !== "object") continue;
      const type = spec.t;
      if (
        type === "Empty" ||
        type === "Rectangle" ||
        type === "Ellipse" ||
        type === "CircularSector" ||
        type === "Triangle" ||
        type === "Text"
      ) {
        let width = 0;
        let height = 0;
        let pin = { x: 0, y: 0 };
        let draw = () => {};

        if (type === "Rectangle") {
          width = Math.max(0, Number(spec.width) || 0);
          height = Math.max(0, Number(spec.height) || 0);
          const fill = colorToCss(spec.color);
          draw = (ctx) => {
            ctx.fillStyle = fill;
            ctx.fillRect(-width / 2, -height / 2, width, height);
          };
        } else if (type === "Ellipse") {
          width = Math.max(0, Number(spec.width) || 0);
          height = Math.max(0, Number(spec.height) || 0);
          const fill = colorToCss(spec.color);
          draw = (ctx) => {
            ctx.beginPath();
            ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, 2 * Math.PI);
            ctx.fillStyle = fill;
            ctx.fill();
          };
        } else if (type === "CircularSector") {
          const radius = Math.max(0, Number(spec.radius) || 0);
          const angle = Number(spec.angle) || 0;
          width = radius * 2;
          height = radius * 2;
          const fill = colorToCss(spec.color);
          draw = (ctx) => {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, 0, (-angle * Math.PI) / 180, true);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
          };
        } else if (type === "Triangle") {
          const side1 = Math.max(0, Number(spec.side1) || 0);
          const side2 = Math.max(0, Number(spec.side2) || 0);
          const angle = (Number(spec.angle) || 0) * (Math.PI / 180);
          const p1 = { x: 0, y: 0 };
          const p2 = { x: side1, y: 0 };
          const p3 = {
            x: side2 * Math.cos(angle),
            y: -side2 * Math.sin(angle),
          };
          const centroid = {
            x: (p1.x + p2.x + p3.x) / 3,
            y: (p1.y + p2.y + p3.y) / 3,
          };
          const points = [p1, p2, p3].map((p) => ({
            x: p.x - centroid.x,
            y: p.y - centroid.y,
          }));
          const xs = points.map((p) => p.x);
          const ys = points.map((p) => p.y);
          width = Math.max(...xs) - Math.min(...xs);
          height = Math.max(...ys) - Math.min(...ys);
          const fill = colorToCss(spec.color);
          draw = (ctx) => {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.lineTo(points[2].x, points[2].y);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
          };
        } else if (type === "Text") {
          const text = String(spec.text || "");
          const fontName = String(spec.font_name || "sans-serif");
          const textSize = Math.max(1, Number(spec.text_size) || 1);
          const fill = colorToCss(spec.color);
          measureCtx.font = `${textSize}px ${fontName}`;
          const metrics = measureCtx.measureText(text);
          width = Math.max(0, metrics.width || 0);
          const ascent = metrics.actualBoundingBoxAscent || textSize * 0.8;
          const descent = metrics.actualBoundingBoxDescent || textSize * 0.2;
          height = ascent + descent;
          pin = { x: -width / 2, y: (ascent - descent) / 2 };
          draw = (ctx) => {
            ctx.fillStyle = fill;
            ctx.font = `${textSize}px ${fontName}`;
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
            const centerY = (descent - ascent) / 2;
            ctx.fillText(text, -width / 2, -centerY);
          };
        }

        stack.push({ width, height, pin, draw });
        continue;
      }

      if (type === "Pin") {
        const child = stack.pop();
        if (!child) continue;
        const pin = decodePoint(spec.pin, child.width, child.height);
        stack.push({ ...child, pin });
        continue;
      }

      if (type === "Rotate") {
        const child = stack.pop();
        if (!child) continue;
        const angleDeg = Number(spec.angle) || 0;
        const angleRad = (-angleDeg * Math.PI) / 180;
        const corners = [
          { x: -child.width / 2, y: -child.height / 2 },
          { x: child.width / 2, y: -child.height / 2 },
          { x: child.width / 2, y: child.height / 2 },
          { x: -child.width / 2, y: child.height / 2 },
        ].map((p) => rotatePoint(p, child.pin, angleRad));
        const minX = Math.min(...corners.map((p) => p.x));
        const maxX = Math.max(...corners.map((p) => p.x));
        const minY = Math.min(...corners.map((p) => p.y));
        const maxY = Math.max(...corners.map((p) => p.y));
        const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        const offset = { x: -center.x, y: -center.y };
        const pin = { x: child.pin.x + offset.x, y: child.pin.y + offset.y };

        stack.push({
          width: maxX - minX,
          height: maxY - minY,
          pin,
          draw: (ctx) => {
            ctx.save();
            ctx.translate(offset.x, offset.y);
            ctx.translate(child.pin.x, child.pin.y);
            ctx.rotate(angleRad);
            ctx.translate(-child.pin.x, -child.pin.y);
            child.draw(ctx);
            ctx.restore();
          },
        });
        continue;
      }

      if (type === "Compose") {
        const bg = stack.pop();
        const fg = stack.pop();
        if (!fg || !bg) continue;
        const fgPin = spec.fg_pin
          ? decodePoint(spec.fg_pin, fg.width, fg.height)
          : fg.pin;
        const bgPin = spec.bg_pin
          ? decodePoint(spec.bg_pin, bg.width, bg.height)
          : bg.pin;

        const bgCenter = { x: 0, y: 0 };
        const fgCenter = { x: bgPin.x - fgPin.x, y: bgPin.y - fgPin.y };
        const minX = Math.min(
          fgCenter.x - fg.width / 2,
          bgCenter.x - bg.width / 2,
        );
        const maxX = Math.max(
          fgCenter.x + fg.width / 2,
          bgCenter.x + bg.width / 2,
        );
        const minY = Math.min(
          fgCenter.y - fg.height / 2,
          bgCenter.y - bg.height / 2,
        );
        const maxY = Math.max(
          fgCenter.y + fg.height / 2,
          bgCenter.y + bg.height / 2,
        );

        const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        const fgOffset = {
          x: fgCenter.x - center.x,
          y: fgCenter.y - center.y,
        };
        const bgOffset = {
          x: bgCenter.x - center.x,
          y: bgCenter.y - center.y,
        };
        const pin = spec.pin
          ? decodePoint(spec.pin, maxX - minX, maxY - minY)
          : { x: bgPin.x - center.x, y: bgPin.y - center.y };

        stack.push({
          width: maxX - minX,
          height: maxY - minY,
          pin,
          draw: (ctx) => {
            ctx.save();
            ctx.translate(bgOffset.x, bgOffset.y);
            bg.draw(ctx);
            ctx.restore();
            ctx.save();
            ctx.translate(fgOffset.x, fgOffset.y);
            fg.draw(ctx);
            ctx.restore();
          },
        });
      }
    }

    return (
      stack[stack.length - 1] || {
        width: 0,
        height: 0,
        pin: { x: 0, y: 0 },
        draw: () => {},
      }
    );
  };

  // SVG-based renderer — mirrors buildGraphic but produces SVG markup.
  // Each stack node has { width, height, pin, svg } where `svg` is a string
  // drawn with the coordinate origin at the graphic's centre (y-down, same as canvas).
  const buildSvgElements = (specs) => {
    const stack = [];
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");

    for (const spec of specs || []) {
      if (!spec || typeof spec !== "object") continue;
      const type = spec.t;

      if (
        type === "Empty" ||
        type === "Rectangle" ||
        type === "Ellipse" ||
        type === "CircularSector" ||
        type === "Triangle" ||
        type === "Text"
      ) {
        let width = 0,
          height = 0,
          pin = { x: 0, y: 0 };
        let svg = "";

        if (type === "Rectangle") {
          width = Math.max(0, Number(spec.width) || 0);
          height = Math.max(0, Number(spec.height) || 0);
          const fill = colorToCss(spec.color);
          svg = `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" fill="${fill}"/>`;
        } else if (type === "Ellipse") {
          width = Math.max(0, Number(spec.width) || 0);
          height = Math.max(0, Number(spec.height) || 0);
          const fill = colorToCss(spec.color);
          svg = `<ellipse cx="0" cy="0" rx="${width / 2}" ry="${height / 2}" fill="${fill}"/>`;
        } else if (type === "CircularSector") {
          const radius = Math.max(0, Number(spec.radius) || 0);
          const angle = Number(spec.angle) || 0;
          width = radius * 2;
          height = radius * 2;
          const fill = colorToCss(spec.color);
          // canvas: ctx.arc(0, 0, r, 0, -angle*PI/180, counterclockwise=true)
          // SVG arc from (r,0) counterclockwise to the same end-point (sweep=0)
          const endAngleRad = (-angle * Math.PI) / 180;
          const endX = radius * Math.cos(endAngleRad);
          const endY = radius * Math.sin(endAngleRad);
          const largeArcFlag = angle > 180 ? 1 : 0;
          svg = `<path d="M 0 0 L ${radius} 0 A ${radius} ${radius} 0 ${largeArcFlag} 0 ${endX} ${endY} Z" fill="${fill}"/>`;
        } else if (type === "Triangle") {
          const side1 = Math.max(0, Number(spec.side1) || 0);
          const side2 = Math.max(0, Number(spec.side2) || 0);
          const angle = (Number(spec.angle) || 0) * (Math.PI / 180);
          const p1 = { x: 0, y: 0 };
          const p2 = { x: side1, y: 0 };
          const p3 = {
            x: side2 * Math.cos(angle),
            y: -side2 * Math.sin(angle),
          };
          const centroid = {
            x: (p1.x + p2.x + p3.x) / 3,
            y: (p1.y + p2.y + p3.y) / 3,
          };
          const points = [p1, p2, p3].map((p) => ({
            x: p.x - centroid.x,
            y: p.y - centroid.y,
          }));
          const xs = points.map((p) => p.x);
          const ys = points.map((p) => p.y);
          width = Math.max(...xs) - Math.min(...xs);
          height = Math.max(...ys) - Math.min(...ys);
          const fill = colorToCss(spec.color);
          svg = `<polygon points="${points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${fill}"/>`;
        } else if (type === "Text") {
          const text = String(spec.text || "");
          const fontName = String(spec.font_name || "sans-serif");
          const textSize = Math.max(1, Number(spec.text_size) || 1);
          const fill = colorToCss(spec.color);
          measureCtx.font = `${textSize}px ${fontName}`;
          const metrics = measureCtx.measureText(text);
          width = Math.max(0, metrics.width || 0);
          const ascent = metrics.actualBoundingBoxAscent || textSize * 0.8;
          const descent = metrics.actualBoundingBoxDescent || textSize * 0.2;
          height = ascent + descent;
          pin = { x: -width / 2, y: (ascent - descent) / 2 };
          // y attribute is the text baseline; mirrors canvas fillText(-w/2, (ascent-descent)/2)
          svg = `<text x="${-width / 2}" y="${(ascent - descent) / 2}" font-family="${fontName}" font-size="${textSize}" fill="${fill}" text-anchor="start">${text}</text>`;
        }

        stack.push({ width, height, pin, svg });
        continue;
      }

      if (type === "Pin") {
        const child = stack.pop();
        if (!child) continue;
        const pin = decodePoint(spec.pin, child.width, child.height);
        stack.push({ ...child, pin });
        continue;
      }

      if (type === "Rotate") {
        const child = stack.pop();
        if (!child) continue;
        const angleDeg = Number(spec.angle) || 0;
        const angleRad = (-angleDeg * Math.PI) / 180;
        const corners = [
          { x: -child.width / 2, y: -child.height / 2 },
          { x: child.width / 2, y: -child.height / 2 },
          { x: child.width / 2, y: child.height / 2 },
          { x: -child.width / 2, y: child.height / 2 },
        ].map((p) => rotatePoint(p, child.pin, angleRad));
        const minX = Math.min(...corners.map((p) => p.x));
        const maxX = Math.max(...corners.map((p) => p.x));
        const minY = Math.min(...corners.map((p) => p.y));
        const maxY = Math.max(...corners.map((p) => p.y));
        const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        const offset = { x: -center.x, y: -center.y };
        const pin = { x: child.pin.x + offset.x, y: child.pin.y + offset.y };
        // SVG transform mirrors the canvas sequence: translate(offset) rotate(-angleDeg, pin)
        // SVG and canvas share the same y-down convention so signs are identical.
        const transform = `translate(${offset.x},${offset.y}) rotate(${-angleDeg},${child.pin.x},${child.pin.y})`;
        stack.push({
          width: maxX - minX,
          height: maxY - minY,
          pin,
          svg: `<g transform="${transform}">${child.svg}</g>`,
        });
        continue;
      }

      if (type === "Compose") {
        const bg = stack.pop();
        const fg = stack.pop();
        if (!fg || !bg) continue;
        const fgPin = spec.fg_pin
          ? decodePoint(spec.fg_pin, fg.width, fg.height)
          : fg.pin;
        const bgPin = spec.bg_pin
          ? decodePoint(spec.bg_pin, bg.width, bg.height)
          : bg.pin;
        const bgCenter = { x: 0, y: 0 };
        const fgCenter = { x: bgPin.x - fgPin.x, y: bgPin.y - fgPin.y };
        const minX = Math.min(
          fgCenter.x - fg.width / 2,
          bgCenter.x - bg.width / 2,
        );
        const maxX = Math.max(
          fgCenter.x + fg.width / 2,
          bgCenter.x + bg.width / 2,
        );
        const minY = Math.min(
          fgCenter.y - fg.height / 2,
          bgCenter.y - bg.height / 2,
        );
        const maxY = Math.max(
          fgCenter.y + fg.height / 2,
          bgCenter.y + bg.height / 2,
        );
        const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        const fgOffset = { x: fgCenter.x - center.x, y: fgCenter.y - center.y };
        const bgOffset = { x: bgCenter.x - center.x, y: bgCenter.y - center.y };
        const pin = spec.pin
          ? decodePoint(spec.pin, maxX - minX, maxY - minY)
          : { x: bgPin.x - center.x, y: bgPin.y - center.y };
        // bg drawn first (behind), fg on top — same draw order as canvas
        stack.push({
          width: maxX - minX,
          height: maxY - minY,
          pin,
          svg: `<g transform="translate(${bgOffset.x},${bgOffset.y})">${bg.svg}</g><g transform="translate(${fgOffset.x},${fgOffset.y})">${fg.svg}</g>`,
        });
      }
    }

    return (
      stack[stack.length - 1] || {
        width: 0,
        height: 0,
        pin: { x: 0, y: 0 },
        svg: "",
      }
    );
  };

  return {
    js_graphic_size: (specs) => {
      try {
        const unproxiedSpecs = unProxy(specs);
        const graphic = buildGraphic(unproxiedSpecs);
        return { width: graphic.width, height: graphic.height };
      } catch (e) {
        console.error("js_graphic_size error:", e);
        throw e;
      }
    },
    js_render_graphic: (specs, scalingFactor, debug) => {
      try {
        const unproxiedSpecs = unProxy(specs);
        const graphic = buildGraphic(unproxiedSpecs);
        const width = Math.max(1, Math.ceil(graphic.width));
        const height = Math.max(1, Math.ceil(graphic.height));
        const scale = Math.max(1, Number(scalingFactor) || 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(width * scale));
        canvas.height = Math.max(1, Math.ceil(height * scale));
        const ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);
        ctx.translate(width / 2, height / 2);
        graphic.draw(ctx);

        if (debug) {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 1 / scale;
          ctx.strokeRect(-width / 2, -height / 2, width, height);
          ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
          ctx.beginPath();
          ctx.moveTo(graphic.pin.x - 8, graphic.pin.y);
          ctx.lineTo(graphic.pin.x + 8, graphic.pin.y);
          ctx.moveTo(graphic.pin.x, graphic.pin.y - 8);
          ctx.lineTo(graphic.pin.x, graphic.pin.y + 8);
          ctx.stroke();
        }

        return canvas.toDataURL("image/png");
      } catch (e) {
        console.error("js_render_graphic error:", e);
        throw e;
      }
    },
    js_svg_graphic: (specs, debug) => {
      try {
        const unproxiedSpecs = unProxy(specs);
        const result = buildSvgElements(unproxiedSpecs);
        const width = Math.max(1, Math.ceil(result.width));
        const height = Math.max(1, Math.ceil(result.height));
        let inner = result.svg;
        if (debug) {
          inner += `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" fill="none" stroke="red" stroke-width="1"/>`;
          inner += `<line x1="${result.pin.x - 8}" y1="${result.pin.y}" x2="${result.pin.x + 8}" y2="${result.pin.y}" stroke="rgba(255,255,0,0.8)" stroke-width="1"/>`;
          inner += `<line x1="${result.pin.x}" y1="${result.pin.y - 8}" x2="${result.pin.x}" y2="${result.pin.y + 8}" stroke="rgba(255,255,0,0.8)" stroke-width="1"/>`;
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g transform="translate(${width / 2},${height / 2})">${inner}</g></svg>`;
      } catch (e) {
        console.error("js_svg_graphic error:", e);
        throw e;
      }
    },
    js_save: (filename, content) => {
      const link = document.createElement("a");
      link.href = String(content || "");
      link.download = String(filename || "graphic.png");
      link.click();
    },
  };
};
