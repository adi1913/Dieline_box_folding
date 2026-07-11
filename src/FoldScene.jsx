import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const THICKNESS = 0.014;
const COLORS = ['#e8dcc8', '#e3d3b3', '#dfc9a3', '#ecdcc0', '#d8c298', '#e6d8ba'];

function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// One hinge group per panel, nested exactly like the fold tree. Each
// group sits at its own hinge line and rotates around it; the panel mesh
// inside is offset from the hinge to its own center. Because the groups
// are nested, rotating a parent carries every child (and its children)
// along with it - that's what actually closes the box.
function Panel({ nodeId, nodes, scale, groupRefs }) {
  const node = nodes.get(nodeId);
  const panel = node.panel;
  const ref = node.parentId ? node.hingeMid : { u: panel.cx, v: panel.cy };
  const offset = [(panel.cx - ref.u) * scale, 0, (panel.cy - ref.v) * scale];
  const children = [...nodes.values()].filter((n) => n.parentId === nodeId);
  const w = Math.max(panel.width * scale, 0.02);
  const h = Math.max(panel.height * scale, 0.02);

  return (
    <group ref={(el) => { if (el) groupRefs.current.set(nodeId, { el, node }); }}>
      <mesh position={offset} castShadow receiveShadow>
        <boxGeometry args={[w, THICKNESS, h]} />
        <meshStandardMaterial color={COLORS[node.depth % COLORS.length]} roughness={0.85} />
      </mesh>
      {children.map((c) => (
        <group key={c.id} position={[(c.hingeMid.u - ref.u) * scale, 0, (c.hingeMid.v - ref.v) * scale]}>
          <Panel nodeId={c.id} nodes={nodes} scale={scale} groupRefs={groupRefs} />
        </group>
      ))}
    </group>
  );
}

// progress (0 = flat, 1 = closed) lives in a ref, not state, so folding
// never re-renders React - only the object3D rotations get mutated
export default function FoldScene({ parsed, progressRef }) {
  const groupRefs = useRef(new Map());
  const { nodes, rootId, scale } = parsed;
  const maxDepth = useMemo(() => Math.max(1, ...[...nodes.values()].map((n) => n.depth)), [nodes]);

  useFrame(() => {
    const progress = THREE.MathUtils.clamp(progressRef.current, 0, 1);
    groupRefs.current.forEach(({ el, node }) => {
      if (!node.parentId) return;
      // stagger by depth so hinges close in sequence, not all at once
      const step = 1 / maxDepth;
      const start = (node.depth - 1) * step * 0.75;
      const local = THREE.MathUtils.clamp((progress - start) / (step * 1.6), 0, 1);
      const angle = (Math.PI / 2) * node.angleSign * ease(local);
      if (node.axis === 'x') el.rotation.set(angle, 0, 0);
      else el.rotation.set(0, 0, angle);
    });
  });

  return <Panel nodeId={rootId} nodes={nodes} scale={scale} groupRefs={groupRefs} />;
}
