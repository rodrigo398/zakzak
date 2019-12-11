import { Profiler } from "inspector";
import { flatten } from "lodash";

/* eslint-disable no-param-reassign */
/*
 * MIT License
 *
 * Copyright (c) 2019-present Jan Nicklas
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export type Profile = {
  /**
   * The list of profile nodes. First item is the root node.
   */
  nodes: Array<ProfileNode>;
  /**
   * Profiling start timestamp in microseconds.
   */
  startTime: number;
  /**
   * Profiling end timestamp in microseconds.
   */
  endTime: number;
  /**
   * Ids of samples top nodes.
   */
  samples: Array<number>;
  /**
   * Time intervals between adjacent samples in microseconds.
   * The first delta is relative to the profile startTime.
   */
  timeDeltas: Array<number>;
};

/**
 * Profile node. Holds callsite information, execution statistics and child nodes.
 * https://chromedevtools.github.io/devtools-protocol/tot/Profiler#type-ProfileNode
 */
export type ProfileNode = {
  /**
   * Unique id of the node.
   */
  id: number;
  /**
   * Runtime.CallFrame
   * Function location
   */
  callFrame: {
    /**
     * JavaScript function name.
     */
    functionName?: string;
    /**
     * JavaScript script id.
     */
    scriptId: string;
    /**
     * JavaScript script name or url.
     */
    url: string;
    /**
     * JavaScript script line number (0-based).
     */
    lineNumber: number;
    /**
     * JavaScript script column number (0-based).
     */
    columnNumber: number;
  };
  /**
   * Number of samples where this node was on top of the call stack.
   */
  hitCount?: number;
  /**
   * Child node ids.
   */
  children?: number[];
};

/**
 * D3-FlameGraph input format
 * https://github.com/spiermar/d3-flame-graph#input-format
 */
export type FlameGraphNode = {
  /**
   * JavaScript function name.
   */
  name: string;
  /**
   * Self execution time
   */
  value: number;
  /**
   * Execution time including child nodes
   */
  executionTime: number;
  /**
   * Child nodes
   */
  children: Array<FlameGraphNode>;
  /**
   * Original profiler node
   */
  profileNode: ProfileNode;
  /**
   * nodeModule name if known
   */
  nodeModule?: string;
  /**
   * Parent node
   */
  parent?: FlameGraphNode;
};

/**
 * Extract the node_modules name from a url
 */
function getNodeModuleName(url: string): string | undefined {
  const nodeModules = "/node_modules/";
  const nodeModulesPosition = url.lastIndexOf(nodeModules);
  if (nodeModulesPosition === -1) {
    return undefined;
  }
  const folderNamePosition = url.indexOf("/", nodeModulesPosition + 1);
  const folderNamePositionEnd = url.indexOf("/", folderNamePosition + 1);
  if (folderNamePosition === -1 || folderNamePositionEnd === -1) {
    return undefined;
  }
  return url.substr(folderNamePosition + 1, folderNamePositionEnd - folderNamePosition - 1);
}

/**
 * If multiple samples in a row are the same they can be
 * combined
 *
 * This function returns a merged version of a cpuProfiles
 * samples and timeDeltas
 */
function getReducedSamples(
  cpuProfile: Profiler.Profile,
): { reducedSamples: Array<number>; reducedTimeDeltas: Array<number> } {
  const { samples, timeDeltas } = cpuProfile;

  const sampleCount = samples.length;
  const reducedSamples: Array<number> = [];
  const reducedTimeDeltas: Array<number> = [];
  if (sampleCount === 0) {
    return { reducedSamples, reducedTimeDeltas };
  }
  let reducedSampleId = samples[0];
  let reducedTimeDelta = timeDeltas[0];
  for (let i = 0; i <= sampleCount; i++) {
    if (reducedSampleId === samples[i]) {
      reducedTimeDelta += timeDeltas[i];
    } else {
      reducedSamples.push(reducedSampleId);
      reducedTimeDeltas.push(reducedTimeDelta);
      reducedSampleId = samples[i];
      reducedTimeDelta = timeDeltas[i];
    }
  }
  return { reducedSamples, reducedTimeDeltas };
}

function convertToTimedFlameGraph(cpuProfile: Profiler.Profile): Array<FlameGraphNode> {
  // Convert into FrameGraphNodes structure
  const linkedNodes: Array<FlameGraphNode> = cpuProfile.nodes.map((node: ProfileNode) => ({
    name: node.callFrame.functionName || "(anonymous function)",
    value: 0,
    executionTime: 0,
    children: [],
    profileNode: node,
    nodeModule: node.callFrame.url ? getNodeModuleName(node.callFrame.url) : undefined,
  }));
  // Create a map for id lookups
  const flameGraphNodeById = new Map<number, FlameGraphNode>();
  cpuProfile.nodes.forEach((node, i) => {
    flameGraphNodeById.set(node.id, linkedNodes[i]);
  });
  // Create reference to children
  linkedNodes.forEach(linkedNode => {
    const children = linkedNode.profileNode.children || [];
    // eslint-disable-next-line no-param-reassign
    linkedNode.children = children.map(
      childNodeId => flameGraphNodeById.get(childNodeId) as FlameGraphNode,
    );
    linkedNode.children.forEach(child => {
      // eslint-disable-next-line no-param-reassign
      child.parent = linkedNode;
    });
  });

  const { reducedSamples, reducedTimeDeltas } = getReducedSamples(cpuProfile);
  const timedRootNodes = reducedSamples.map((sampleId, i) => ({
    ...flameGraphNodeById.get(sampleId),
    value: reducedTimeDeltas[i],
  }));

  return timedRootNodes;
}

/**
 * Convert a cpuprofile into a FlameGraph
 */
function convertToMergedFlameGraph(cpuProfile: Profiler.Profile): FlameGraphNode {
  const nodes = convertToTimedFlameGraph(cpuProfile);
  // Add all parent nodes
  const parentNodes = nodes.map(node => {
    const executionTime = node.value;
    node = { ...node, children: [], executionTime };
    while (node.parent && node.parent.children) {
      const newParent = { ...node.parent, children: [node], executionTime };
      node.parent = newParent;
      node = newParent;
    }
    return node;
  });
  const mergedNodes: Array<FlameGraphNode> = [];
  let currentNode = parentNodes[0];
  // Merge equal parent nodes
  for (let nodeIndex = 1; nodeIndex <= parentNodes.length; nodeIndex++) {
    const nextNode = parentNodes[nodeIndex];
    const isMergeAble =
      nextNode !== undefined &&
      currentNode.profileNode === nextNode.profileNode &&
      currentNode.children.length &&
      nextNode.children.length;
    if (!isMergeAble) {
      mergedNodes.push(currentNode);
      currentNode = nextNode;
    } else {
      // Find common child
      let currentMergeNode = currentNode;
      let nextMergeNode = nextNode;

      let keepRunning = true;
      while (keepRunning) {
        // Child nodes are sorted in chronological order
        // as nextNode is executed after currentNode it
        // is only possible to merge into the last child
        const lastChildIndex = currentMergeNode.children.length - 1;
        const mergeCandidate1 = currentMergeNode.children[lastChildIndex];
        const mergeCandidate2 = nextMergeNode.children[0];
        // As `getReducedSamples` already reduced all children
        // only nodes with children are possible merge targets
        const nodesHaveChildren =
          mergeCandidate1.children.length && mergeCandidate2.children.length;
        if (
          nodesHaveChildren &&
          mergeCandidate1.profileNode.id === mergeCandidate2.profileNode.id
        ) {
          currentMergeNode = mergeCandidate1;
          nextMergeNode = mergeCandidate2;
        } else {
          keepRunning = false;
        }
      }
      // Merge the last mergeable node
      currentMergeNode.children.push(nextMergeNode.children[0]);
      nextMergeNode.children[0].parent = currentMergeNode;
      const additionalExecutionTime = nextMergeNode.executionTime;
      let currentExecutionTimeNode: FlameGraphNode | undefined = currentMergeNode;
      while (currentExecutionTimeNode) {
        currentExecutionTimeNode.executionTime += additionalExecutionTime;
        currentExecutionTimeNode = currentExecutionTimeNode.parent;
      }
    }
  }
  return mergedNodes[0];
}

interface D3FlameGraphNode {
  name: string;
  value: number;
  children: D3FlameGraphNode[];
}

function mapNode(node: FlameGraphNode): D3FlameGraphNode {
  let children: D3FlameGraphNode[] = [];
  if (node.children.length > 0) {
    children = node.children.map(c => mapNode(c));
  }
  return {
    name: node.name,
    value: node.value,
    children,
  };
}

function filterNonBenchmark(node: D3FlameGraphNode) {
  if (node.name === "zakzak_1.benchmark") {
    return [node];
  }
  const nodes: D3FlameGraphNode[] = flatten(node.children.map(n => filterNonBenchmark(n)));
  return nodes || [];
}

export default function convertToD3FlameGraph(cpuProfile: Profiler.Profile) {
  const root = convertToMergedFlameGraph(cpuProfile);
  const d3Root = mapNode(root);
  const filteredRoots = filterNonBenchmark(d3Root);
  const reduceFunction = (prev: D3FlameGraphNode, curr: D3FlameGraphNode) => {
    return {
      name: prev.name,
      value: prev.value + curr.value,
      children: prev.children.concat(curr.children),
    };
  };
  const reducedRoot = filteredRoots.reduce(reduceFunction);

  return reducedRoot;
}
