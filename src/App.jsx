import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Grid } from '@react-three/drei';
import { parseDielineImage } from './dielineParser';
import FoldScene from './FoldScene';
import './App.css';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that file as an image.'));
    img.src = src;
  });
}

export default function App() {
  const [parsed, setParsed] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | parsing | ready | error
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('sample_dieline.png');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressRef = useRef(0);
  const rafRef = useRef(null);
  const fileInputRef = useRef(null);

  const parseFile = useCallback(async (img, name) => {
    setStatus('parsing');
    setError('');
    await new Promise((r) => setTimeout(r, 30)); // let the spinner paint first
    try {
      setParsed(parseDielineImage(img));
      setFileName(name);
      setStatus('ready');
      progressRef.current = 0;
      setProgress(0);
      setPlaying(false);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadImage('/sample_dieline.png').then((img) => parseFile(img, 'sample_dieline.png'));
  }, [parseFile]);

  const onFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a PNG or JPG dieline (PDF export it as an image first).');
      setStatus('error');
      return;
    }
    const url = URL.createObjectURL(file);
    loadImage(url).then((img) => parseFile(img, file.name)).finally(() => URL.revokeObjectURL(url));
  };

  // play loop: animates progress toward 1 (or back to 0), driven by a ref
  // so the 3D scene doesn't need React state updates every frame
  useEffect(() => {
    if (!playing) return;
    const target = progress >= 0.999 ? 0 : 1;
    const start = progressRef.current;
    const startTime = performance.now();
    const duration = Math.max(300, 3200 * Math.abs(target - start));

    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const value = start + (target - start) * t;
      progressRef.current = value;
      setProgress(value);
      if (t >= 1) { setPlaying(false); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const handleSlider = (e) => {
    const v = parseFloat(e.target.value);
    setPlaying(false);
    setProgress(v);
    progressRef.current = v;
  };

  const handleReset = () => {
    setPlaying(false);
    setProgress(0);
    progressRef.current = 0;
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⬚</span>
          <div>
            <div className="brand-title">DIELINE → BOX</div>
            <div className="brand-sub">2D cut file to folded 3D carton</div>
          </div>
        </div>
        <div className="fileinfo">
          <span className="filename">{fileName}</span>
          {status === 'ready' && <span className="pill">{parsed.panelCount} panels</span>}
          {status === 'parsing' && <span className="pill pill-busy">parsing…</span>}
          {status === 'error' && <span className="pill pill-error">error</span>}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }}
        />
        <button className="btn btn-primary" onClick={() => fileInputRef.current.click()}>
          Upload dieline
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main className="stage">
        <Canvas shadows camera={{ position: [4.6, 3.6, 5.4], fov: 40 }}>
          <color attach="background" args={['#12151a']} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[4, 6, 3]} intensity={1.4} castShadow />
          <directionalLight position={[-4, 2, -3]} intensity={0.3} />
          {parsed && <FoldScene parsed={parsed} progressRef={progressRef} />}
          <Grid position={[0, -1.35, 0]} args={[20, 20]} cellColor="#2a3038" sectionColor="#3a4250" fadeDistance={16} infiniteGrid />
          <ContactShadows position={[0, -1.34, 0]} opacity={0.5} scale={12} blur={2.4} far={4} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2} maxDistance={14} />
        </Canvas>

        {status === 'parsing' && (
          <div className="overlay">
            <div className="spinner" />
            <div>Reading panels &amp; fold lines…</div>
          </div>
        )}
      </main>

      <footer className="controls">
        <button className="btn" onClick={() => setPlaying((p) => !p)} disabled={status !== 'ready'}>
          {playing ? '❙❙ Pause' : progress >= 0.999 ? '▶ Unfold' : '▶ Fold closed'}
        </button>
        <input className="scrubber" type="range" min={0} max={1} step={0.001} value={progress} onChange={handleSlider} disabled={status !== 'ready'} />
        <span className="progress-label">{Math.round(progress * 100)}%</span>
        <button className="btn btn-ghost" onClick={handleReset} disabled={status !== 'ready'}>Reset flat</button>
      </footer>
    </div>
  );
}
