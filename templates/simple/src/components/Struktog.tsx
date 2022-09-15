import { FC, useEffect, useRef, useState } from "react";
import { deserializeState } from "../utils/serge";

function renderTreeAsCanvas(
  subTree: any,
  ctx: CanvasRenderingContext2D,
  x: number,
  xmax: number,
  y: number
) {
  const printHeight = 32;
  // uses a recursive structure, termination condition is no definied element to be drawn
  if (subTree === null) {
    return y;
  } else {
    const defaultMargin = 22;
    // use for every possible element type a different drawing strategie
    switch (subTree.type) {
      case "InsertNode":
        return renderTreeAsCanvas(subTree.followElement, ctx, x, xmax, y);

      case "Placeholder": {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(xmax, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + printHeight);
        ctx.moveTo(xmax, y);
        ctx.lineTo(xmax, y + printHeight);
        ctx.stroke();

        ctx.fillStyle = "#fffff3";
        ctx.rect(x, y, xmax, printHeight);
        ctx.fill();

        ctx.beginPath();
        const centerX = x + (xmax - x) / 2;
        const centerY = y + printHeight / 2;
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.moveTo(centerX - 11, centerY + 11);
        ctx.lineTo(centerX + 11, centerY - 11);
        ctx.stroke();
        return y + printHeight;
      }

      case "InputNode": {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(xmax, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + printHeight);
        ctx.moveTo(xmax, y);
        ctx.lineTo(xmax, y + printHeight);
        ctx.stroke();

        ctx.fillStyle = "#fcedce";
        ctx.rect(x, y, xmax, printHeight);
        ctx.fill();

        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.fillText("E: " + subTree.text, x + 15, y + defaultMargin);
        ctx.stroke();
        return renderTreeAsCanvas(
          subTree.followElement,
          ctx,
          x,
          xmax,
          y + printHeight
        );
      }

      case "OutputNode": {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(xmax, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + printHeight);
        ctx.moveTo(xmax, y);
        ctx.lineTo(xmax, y + printHeight);
        ctx.stroke();

        ctx.fillStyle = "#fcedce";
        ctx.rect(x, y, xmax, printHeight);
        ctx.fill();

        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.fillText("A: " + subTree.text, x + 15, y + defaultMargin);
        ctx.stroke();
        return renderTreeAsCanvas(
          subTree.followElement,
          ctx,
          x,
          xmax,
          y + printHeight
        );
      }

      case "TaskNode": {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(xmax, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + printHeight);
        ctx.moveTo(xmax, y);
        ctx.lineTo(xmax, y + printHeight);
        ctx.stroke();

        ctx.fillStyle = "#fcedce";
        ctx.rect(x, y, xmax, printHeight);
        ctx.fill();

        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.fillText(subTree.text, x + 15, y + defaultMargin);
        ctx.stroke();
        return renderTreeAsCanvas(
          subTree.followElement,
          ctx,
          x,
          xmax,
          y + printHeight
        );
      }

      case "BranchNode": {
        ctx.fillStyle = "rgb(250, 218, 209)";
        ctx.beginPath(); // to end open paths
        ctx.rect(x, y, xmax - x, 2 * printHeight);
        ctx.fill();
        ctx.fillStyle = "black";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (xmax - x) / 2, y + 2 * printHeight);
        ctx.moveTo(xmax, y);
        ctx.lineTo(x + (xmax - x) / 2, y + 2 * printHeight);
        ctx.stroke();
        // center the text
        const textWidth = ctx.measureText(subTree.text);
        ctx.beginPath();
        ctx.fillText(
          subTree.text,
          x + Math.abs(xmax - x - textWidth.width) / 2,
          y + defaultMargin
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.fillText("Wahr", x + 15, y + printHeight + defaultMargin);
        ctx.fillText(
          "Falsch",
          xmax - 15 - ctx.measureText("Falsch").width,
          y + printHeight + defaultMargin
        );
        ctx.stroke();
        let trueChildY = renderTreeAsCanvas(
          subTree.trueChild,
          ctx,
          x,
          x + (xmax - x) / 2,
          y + 2 * printHeight
        );
        const falseChildY = renderTreeAsCanvas(
          subTree.falseChild,
          ctx,
          x + (xmax - x) / 2,
          xmax,
          y + 2 * printHeight
        );

        // determine which child sub tree is deeper y wise
        if (trueChildY < falseChildY) {
          trueChildY = falseChildY;
        }
        ctx.rect(x, y, xmax - x, trueChildY - y);
        ctx.stroke();
        return renderTreeAsCanvas(
          subTree.followElement,
          ctx,
          x,
          xmax,
          trueChildY
        );
      }

      case "CountLoopNode":
      case "HeadLoopNode": {
        const childY = renderTreeAsCanvas(
          subTree.child,
          ctx,
          x + (xmax - x) / 12,
          xmax,
          y + printHeight
        );
        ctx.rect(x, y, xmax - x, childY - y);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = "rgb(220, 239, 231)";
        ctx.rect(x, y, xmax, printHeight - 1);
        ctx.rect(x, y, (xmax - x) / 12 - 1, childY - y + printHeight);
        ctx.fill();

        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.fillText(subTree.text, x + 15, y + defaultMargin);
        ctx.stroke();
        return renderTreeAsCanvas(subTree.followElement, ctx, x, xmax, childY);
      }

      case "FootLoopNode": {
        const childY = renderTreeAsCanvas(
          subTree.child,
          ctx,
          x + (xmax - x) / 12,
          xmax,
          y
        );
        ctx.rect(x, y, xmax - x, childY - y + printHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = "rgb(220, 239, 231)";
        ctx.rect(x, y, (xmax - x) / 12, childY - y + printHeight);
        ctx.rect(x, childY, xmax, printHeight);
        ctx.fill();

        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.fillText(subTree.text, x + 15, childY + defaultMargin);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + (xmax - x) / 12, childY);
        ctx.lineTo(xmax, childY);
        ctx.stroke();
        return renderTreeAsCanvas(
          subTree.followElement,
          ctx,
          x,
          xmax,
          childY + printHeight
        );
      }

      case "CaseNode": {
        ctx.fillStyle = "rgb(250, 218, 209)";
        ctx.beginPath();
        ctx.rect(x, y, xmax - x, 2 * printHeight);
        ctx.fill();
        ctx.fillStyle = "black";
        let caseCount = subTree.cases.length;
        if (subTree.defaultOn) {
          caseCount = caseCount + 1;
        }
        // calculate the x and y distance between each case
        // yStep ist used for the positioning of the vertical lines on the diagonal line
        const xStep = (xmax - x) / caseCount;
        const yStep = printHeight / subTree.cases.length;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        if (subTree.defaultOn) {
          ctx.lineTo(xmax - xStep, y + printHeight);
          ctx.lineTo(xmax, y);
          ctx.moveTo(xmax - xStep, y + printHeight);
          ctx.lineTo(xmax - xStep, y + 2 * printHeight);
        } else {
          ctx.lineTo(xmax, y + printHeight);
        }
        ctx.stroke();
        const textWidth = ctx.measureText(subTree.text);
        ctx.beginPath();
        ctx.fillText(
          subTree.text,
          xmax - xStep - textWidth.width / 2,
          y + defaultMargin
        );
        ctx.stroke();
        let xPos = x;
        // determine the deepest tree by the y coordinate
        let yFinally = y + 3 * printHeight;
        for (const element of subTree.cases) {
          const childY = renderTreeAsCanvas(
            element,
            ctx,
            xPos,
            xPos + xStep,
            y + printHeight
          );
          if (childY > yFinally) {
            yFinally = childY;
          }
          xPos = xPos + xStep;
        }
        if (subTree.defaultOn) {
          const childY = renderTreeAsCanvas(
            subTree.defaultNode,
            ctx,
            xPos,
            xmax,
            y + printHeight
          );
          if (childY > yFinally) {
            yFinally = childY;
          }
        }
        // draw the vertical lines
        for (let i = 1; i <= subTree.cases.length; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * xStep, y + i * yStep);
          ctx.lineTo(x + i * xStep, yFinally);
          ctx.stroke();
        }
        return renderTreeAsCanvas(
          subTree.followElement,
          ctx,
          x,
          xmax,
          yFinally
        );
      }

      case "InsertCase": {
        const textWidth = ctx.measureText(subTree.text);
        ctx.beginPath();
        ctx.fillText(
          subTree.text,
          x + Math.abs(xmax - x - textWidth.width) / 2,
          y + defaultMargin
        );
        ctx.stroke();
        return renderTreeAsCanvas(
          subTree.followElement,
          ctx,
          x,
          xmax,
          y + printHeight
        );
      }
    }
  }
}

type State = {
  model: object;
  width: number;
  height: number;
};

export const Struktog: FC<{ data: string }> = ({ data }) => {
  try {
    data = data.replace(new RegExp("https://struktog.openpatch.org/?#"), "");
    const { model, width, height } = deserializeState<State>(data);
    const [lastY, setLastY] = useState(height);
    const ref = useRef<HTMLCanvasElement>();
    useEffect(() => {
      const canvas = ref.current;
      if (canvas && model) {
        const ctx = ref.current.getContext("2d");

        ctx.fillStyle = "#fffff3";
        ctx.fillRect(0, 0, width, height);
        const lastY = renderTreeAsCanvas(model, ctx, 0, width, 0);
        ctx.rect(0, 0, width, lastY);
        ctx.stroke();
        setLastY(lastY);
      }
    }, [model, width, height]);

    return (
      <div className="struktog">
        <a href={`https://struktog.openpatch.org/#${data}`} target="_blank">
          <canvas ref={ref} height={lastY} width={width}></canvas>
        </a>
      </div>
    );
  } catch (e) {
    return (
      <div className="struktog">
        <div className="error">
          We can not parse the provided data. Please check if it is correct.
        </div>
      </div>
    );
  }
};
