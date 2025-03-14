import rough from 'roughjs';
import type { SVG } from '../../../diagram-api/types.js';
import { log } from '../../../logger.js';
import { getIconSVG } from '../../icons.js';
import type { Node, ShapeRenderOptions } from '../../types.d.ts';
import intersect from '../intersect/index.js';
import { compileStyles, styles2String, userNodeOverrides } from './handDrawnShapeStyles.js';
import { labelHelper, updateNodeBounds } from './util.js';

export const icon = async (
  parent: SVG,
  node: Node,
  { config: { themeVariables, flowchart } }: ShapeRenderOptions
) => {
  const { labelStyles } = styles2String(node);
  node.labelStyle = labelStyles;
  const assetHeight = node.assetHeight ?? 48;
  const assetWidth = node.assetWidth ?? 48;
  const iconSize = Math.max(assetHeight, assetWidth);
  const defaultWidth = flowchart?.wrappingWidth;
  node.width = Math.max(iconSize, defaultWidth ?? 0);
  const { shapeSvg, bbox, label } = await labelHelper(parent, node, 'icon-shape default');

  const topLabel = node.pos === 't';

  const height = iconSize;
  const width = iconSize;
  const { nodeBorder } = themeVariables;
  const { stylesMap } = compileStyles(node);

  const x = -width / 2;
  const y = -height / 2;

  const labelPadding = node.label ? 8 : 0;

  const rc = rough.svg(shapeSvg);
  const options = userNodeOverrides(node, { stroke: 'none', fill: 'none' });

  if (node.look !== 'handDrawn') {
    options.roughness = 0;
    options.fillStyle = 'solid';
  }

  const iconNode = rc.rectangle(x, y, width, height, options);

  const outerWidth = Math.max(width, bbox.width);
  const outerHeight = height + bbox.height + labelPadding;

  const outerNode = rc.rectangle(-outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight, {
    ...options,
    fill: 'transparent',
    stroke: 'none',
  });

  const iconShape = shapeSvg.insert(() => iconNode, ':first-child');
  const outerShape = shapeSvg.insert(() => outerNode);

  if (node.icon) {
    const iconElem = shapeSvg.append('g');
    iconElem.html(
      `<g>${await getIconSVG(node.icon, {
        height: iconSize,
        width: iconSize,
        fallbackPrefix: '',
      })}</g>`
    );
    const iconBBox = iconElem.node().getBBox();
    const iconWidth = iconBBox.width;
    const iconHeight = iconBBox.height;
    const iconX = iconBBox.x;
    const iconY = iconBBox.y;
    iconElem.attr(
      'transform',
      `translate(${-iconWidth / 2 - iconX},${
        topLabel
          ? bbox.height / 2 + labelPadding / 2 - iconHeight / 2 - iconY
          : -bbox.height / 2 - labelPadding / 2 - iconHeight / 2 - iconY
      })`
    );
    iconElem.selectAll('path').attr('fill', stylesMap.get('stroke') || nodeBorder);
  }

  label.attr(
    'transform',
    `translate(${-bbox.width / 2 - (bbox.x - (bbox.left ?? 0))},${
      topLabel ? -outerHeight / 2 : outerHeight / 2 - bbox.height
    })`
  );

  iconShape.attr(
    'transform',
    `translate(${0},${
      topLabel ? bbox.height / 2 + labelPadding / 2 : -bbox.height / 2 - labelPadding / 2
    })`
  );

  updateNodeBounds(node, outerShape);

  node.intersect = function (point) {
    log.info('iconSquare intersect', node, point);
    if (!node.label) {
      return intersect.rect(node, point);
    }
    const dx = node.x ?? 0;
    const dy = node.y ?? 0;
    const nodeHeight = node.height ?? 0;
    let points = [];
    if (topLabel) {
      points = [
        { x: dx - bbox.width / 2, y: dy - nodeHeight / 2 },
        { x: dx + bbox.width / 2, y: dy - nodeHeight / 2 },
        { x: dx + bbox.width / 2, y: dy - nodeHeight / 2 + bbox.height + labelPadding },
        { x: dx + width / 2, y: dy - nodeHeight / 2 + bbox.height + labelPadding },
        { x: dx + width / 2, y: dy + nodeHeight / 2 },
        { x: dx - width / 2, y: dy + nodeHeight / 2 },
        { x: dx - width / 2, y: dy - nodeHeight / 2 + bbox.height + labelPadding },
        { x: dx - bbox.width / 2, y: dy - nodeHeight / 2 + bbox.height + labelPadding },
      ];
    } else {
      points = [
        { x: dx - width / 2, y: dy - nodeHeight / 2 },
        { x: dx + width / 2, y: dy - nodeHeight / 2 },
        { x: dx + width / 2, y: dy - nodeHeight / 2 + height },
        { x: dx + bbox.width / 2, y: dy - nodeHeight / 2 + height },
        { x: dx + bbox.width / 2 / 2, y: dy + nodeHeight / 2 },
        { x: dx - bbox.width / 2, y: dy + nodeHeight / 2 },
        { x: dx - bbox.width / 2, y: dy - nodeHeight / 2 + height },
        { x: dx - width / 2, y: dy - nodeHeight / 2 + height },
      ];
    }

    const pos = intersect.polygon(node, points, point);
    return pos;
  };

  return shapeSvg;
};
