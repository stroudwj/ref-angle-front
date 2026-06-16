import { useMemo, useRef, useState } from 'react'
import { Leva, useControls } from 'leva'
import PortraitScene from './PortraitScene'

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

function CaptureCard({ label, dataUrl, emptyLabel, kind }) {
  return (
    <section className="capture-card">
      <div className="capture-card__label">
        <span>{label}</span>
        <span>{kind}</span>
      </div>

      {dataUrl ? (
        <img className="capture-preview" src={dataUrl} alt={`${label} preview`} />
      ) : (
        <div className="capture-missing">{emptyLabel}</div>
      )}

      {dataUrl ? (
        <div className="capture-meta">Data URL ready: {dataUrl.length.toLocaleString()} chars</div>
      ) : null}
    </section>
  )
}

export default function PortraitReferenceTool() {
  const sceneRef = useRef(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [faceImage, setFaceImage] = useState(null)
  const [generatedImage, setGeneratedImage] = useState(null)
  const [captures, setCaptures] = useState({
    depthMap: '',
    shadowMap: '',
  })
  const [lightLabel, setLightLabel] = useState('Ready')
  const lighting = useControls('Lighting', {
    intensity: { value: 2.8, min: 0, max: 8, step: 0.05 },
    color: { value: '#fff4db' },
    ambientIntensity: { value: 0.8, min: 0, max: 2, step: 0.01 },
  })

  const captureSummary = useMemo(() => {
    if (!captures.depthMap && !captures.shadowMap) {
      return 'No exports yet'
    }

    return 'Latest export cached in memory'
  }, [captures.depthMap, captures.shadowMap])

  const runCapture = async () => {
    if (!sceneRef.current || isCapturing) {
      return
    }

    setIsCapturing(true)
    setLightLabel('Capturing maps...')

    try {
      const { depthMap, shadowMap } = await sceneRef.current.captureMaps()
      setCaptures({ depthMap, shadowMap })
      setLightLabel('Export complete')
    } catch (error) {
      setLightLabel(error instanceof Error ? error.message : 'Capture failed')
    } finally {
      setIsCapturing(false)
    }
  }

  const captureDepthOnly = async () => {
    if (!sceneRef.current || isCapturing) {
      return
    }

    setIsCapturing(true)
    setLightLabel('Capturing depth map...')

    try {
      const depthMap = await sceneRef.current.captureDepthMap()
      setCaptures((current) => ({ ...current, depthMap }))
      setLightLabel('Depth map updated')
    } catch (error) {
      setLightLabel(error instanceof Error ? error.message : 'Capture failed')
    } finally {
      setIsCapturing(false)
    }
  }

  const generatePortrait = async () => {
    const referenceDataUrl = captures.shadowMap || captures.depthMap;
    if (!faceImage || !referenceDataUrl) {
      setLightLabel('Missing face image or reference capture');
      return;
    }

    setIsGenerating(true);
    setLightLabel('Generating portrait via AI...');

    try {
      const referenceFile = await dataUrlToFile(referenceDataUrl, 'reference.png');
      
      const formData = new FormData();
      formData.append('face_image', faceImage);
      formData.append('reference_image', referenceFile);
      
      const response = await fetch('https://stroudw-ref-angle2.hf.space/remix-face', {
          method: 'POST',
          body: formData
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const imageBlob = await response.blob();
      const imageObjectURL = URL.createObjectURL(imageBlob);
      setGeneratedImage(imageObjectURL);
      setLightLabel('Portrait generated!');
    } catch (error) {
      setLightLabel(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="app-shell__frame">
        <header className="app-shell__header">
          <div>
            <p className="eyebrow">AI portrait reference controller</p>
            <h1 className="title">Asaro head lighting studio</h1>
            <p className="subtitle">
              Rotate the model with orbit controls, drag the light marker to reshape the
              shading, then export depth and shadow maps as image data URLs for your backend
              pipeline.
            </p>
          </div>
          <div className="status-chip" aria-live="polite">
            <span className="status-chip__dot" />
            <span>{lightLabel}</span>
          </div>
        </header>

        <section className="app-shell__hero">
          <div className="scene-card">
            <PortraitScene
              ref={sceneRef}
              lighting={lighting}
              onLightPositionChange={() => setLightLabel('Light updated')}
            />
          </div>

          <aside className="panel-card">
            <div className="panel-card__section">
              <h2 className="panel-title">Capture controls</h2>
              <p className="panel-copy">
                The scene exposes an imperative API so your AI pipeline can request a depth map,
                a shaded falloff map, or both together.
              </p>
            </div>

            <div className="panel-card__section button-row">
              <button type="button" className="button" onClick={runCapture} disabled={isCapturing}>
                {isCapturing ? 'Exporting...' : 'Capture depth + shadow'}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={captureDepthOnly}
                disabled={isCapturing}
              >
                Capture depth only
              </button>
            </div>

            <div className="panel-card__section">
              <h2 className="panel-title">Lighting controls</h2>
              <p className="panel-copy">
                Use the gizmo to place the light in 3D, then fine-tune the output with Leva.
              </p>
              <div className="leva-shell">
                <Leva
                  collapsed={false}
                  fill
                  flat
                  oneLineLabels
                  hideCopyButton
                  titleBar={false}
                />
              </div>
            </div>

            <div className="panel-card__section capture-grid">
              <CaptureCard
                label="Depth Map"
                kind="Greyscale geometry"
                dataUrl={captures.depthMap}
                emptyLabel="Capture a frame to populate the depth map preview."
              />
              <CaptureCard
                label="Shadow Map"
                kind="Greyscale falloff"
                dataUrl={captures.shadowMap}
                emptyLabel="Capture both maps to generate the lighting pass preview."
              />
            </div>

            <div className="panel-card__section capture-note">{captureSummary}</div>

            <div className="panel-card__section">
              <h2 className="panel-title">AI Portrait Generation</h2>
              <p className="panel-copy">
                Upload a source face image. Then use the captured reference (shadow or depth map) to generate a new image matching this lighting and angle.
              </p>
              
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setFaceImage(e.target.files[0])}
                  style={{ fontSize: '0.875rem' }}
                />
                
                <button
                  type="button"
                  className="button"
                  onClick={generatePortrait}
                  disabled={isGenerating || !faceImage || (!captures.shadowMap && !captures.depthMap)}
                  style={{ marginTop: '0.5rem' }}
                >
                  {isGenerating ? 'Generating...' : 'Generate AI Portrait'}
                </button>
              </div>
            </div>

            {generatedImage && (
              <div className="panel-card__section">
                <h2 className="panel-title">Generated Result</h2>
                <img 
                  src={generatedImage} 
                  alt="AI Generated Portrait" 
                  style={{ width: '100%', borderRadius: '8px', marginTop: '0.5rem' }} 
                />
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  )
}