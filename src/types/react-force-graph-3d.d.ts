// Minimal type stub for react-force-graph-3d.
// The real package is loaded dynamically (next/dynamic) so these stubs only
// satisfy TypeScript's module-resolution check at build time.
declare module "react-force-graph-3d" {
  import type { ComponentType } from "react";

  export interface NodeObject {
    id?: string | number;
    x?: number;
    y?: number;
    z?: number;
    [key: string]: unknown;
  }

  export interface LinkObject {
    source?: string | number | NodeObject;
    target?: string | number | NodeObject;
    [key: string]: unknown;
  }

  export interface ForceGraph3DProps {
    graphData?: { nodes: NodeObject[]; links: LinkObject[] };
    nodeId?: string;
    nodeLabel?: string | ((node: NodeObject) => string);
    nodeColor?: string | ((node: NodeObject) => string);
    nodeVal?: number | string | ((node: NodeObject) => number);
    linkSource?: string;
    linkTarget?: string;
    linkLabel?: string | ((link: LinkObject) => string);
    linkColor?: string | ((link: LinkObject) => string);
    linkWidth?: number | ((link: LinkObject) => number);
    linkDirectionalArrowLength?: number;
    linkDirectionalArrowRelPos?: number;
    linkCurvature?: number;
    onNodeClick?: (node: NodeObject, event: MouseEvent) => void;
    onLinkClick?: (link: LinkObject, event: MouseEvent) => void;
    backgroundColor?: string;
    width?: number;
    height?: number;
    [key: string]: unknown;
  }

  const ForceGraph3D: ComponentType<ForceGraph3DProps>;
  export default ForceGraph3D;
}
