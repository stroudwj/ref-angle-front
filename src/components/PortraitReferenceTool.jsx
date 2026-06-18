import { useMemo, useRef, useState } from 'react'
import { Leva, useControls } from 'leva'
import PortraitScene from './PortraitScene'

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

export default function PortraitReferenceTool() {
  const sceneRef = useRef(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [faceImages, setFaceImages] = useState([])
  const [facePreview, setFacePreview] = useState(null)
  const [generatedImage, setGeneratedImage] = useState(null)
  const [activeMap, setActiveMap] = useState('shadow')
  const [captures, setCaptures] = useState({
    depthMap: '',
    shadowMap: '',
  })
  const [lightLabel, setLightLabel] = useState('Ready')
  const [modelType, setModelType] = useState('asaro')
  const lighting = useControls('Lighting', {
    intensity: { value: 2.8, min: 0, max: 8, step: 0.05 },
    color: { value: '#fff4db' },
    ambientIntensity: { value: 0.8, min: 0, max: 2, step: 0.01 },
  })

  const handleFaceImagesChange = (e) => {
    const files = Array.from(e.target.files)
    setFaceImages(files)
    if (facePreview) {
      URL.revokeObjectURL(facePreview)
    }
    if (files.length > 0) {
      setFacePreview(URL.createObjectURL(files[0]))
    } else {
      setFacePreview(null)
    }
  }

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
    const referenceDataUrl = activeMap === 'shadow' ? captures.shadowMap : captures.depthMap;
    if (faceImages.length === 0 || !referenceDataUrl) {
      setLightLabel('Missing face images or reference capture');
      return;
    }

    setIsGenerating(true);
    setLightLabel('Generating portrait via AI...');

    try {
      const referenceFile = await dataUrlToFile(referenceDataUrl, 'reference.png');
      
      const formData = new FormData();
      faceImages.forEach((file) => {
        formData.append('face_images', file);
      });
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
              modelType={modelType}
            />
          </div>

          <aside className="panel-card">
            <div className="panel-card__section">
              <h2 className="panel-title">Model Selection</h2>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
                className="map-dropdown"
              >
                <option value="asaro">Simple Asaro Head</option>
                <option value="human">Detailed Human Head</option>
              </select>
              {modelType === 'human' && (
                <p style={{ fontSize: '0.7rem', marginTop: '8px', color: '#a0a0a0' }}>
                  "Human head" (<a href="https://skfb.ly/pqWLr" target="_blank" rel="noreferrer" style={{ color: '#fff' }}>https://skfb.ly/pqWLr</a>) by ADAMA is licensed under <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" style={{ color: '#fff' }}>Creative Commons Attribution</a>.
                </p>
              )}
            </div>

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

            <div className="panel-card__section capture-note">{captureSummary}</div>
          </aside>
        </section>

        <section className="pipeline-section">
          <div className="pipeline-card">
            <div className="pipeline-card__header">User Upload</div>
            <div className="pipeline-card__content">
              <input 
                type="file" 
                accept="image/*" 
                multiple
                onChange={handleFaceImagesChange}
                style={{ fontSize: '0.875rem' }}
              />
              {facePreview ? (
                <img className="pipeline-preview" src={facePreview} alt="Face preview" />
              ) : (
                <div className="pipeline-missing">Upload a source image</div>
              )}
              {faceImages.length > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'gray' }}>
                  {faceImages.length} image(s) selected
                </span>
              )}
            </div>
          </div>

          <div className="pipeline-card">
            <div className="pipeline-card__header">
              <select 
                value={activeMap} 
                onChange={(e) => setActiveMap(e.target.value)}
                className="map-dropdown"
              >
                <option value="shadow">Shadow Map</option>
                <option value="depth">Depth Map</option>
              </select>
            </div>
            <div className="pipeline-card__content">
              {captures[activeMap + 'Map'] ? (
                <img className="pipeline-preview" src={captures[activeMap + 'Map']} alt={`${activeMap} preview`} />
              ) : (
                <div className="pipeline-missing">Capture a frame to populate this map</div>
              )}
              {captures[activeMap + 'Map'] && (
                <div className="capture-meta" style={{ marginTop: 'auto' }}>
                  Data URL ready: {captures[activeMap + 'Map'].length.toLocaleString()} chars
                </div>
              )}
            </div>
          </div>

          <div className="pipeline-card">
            <div className="pipeline-card__header">AI Generation</div>
            <div className="pipeline-card__content">
              {generatedImage ? (
                <img className="pipeline-preview" src={generatedImage} alt="AI Generated Portrait" />
              ) : (
                <div className="pipeline-missing">Result will appear here</div>
              )}
              
              <button
                type="button"
                className="button"
                onClick={generatePortrait}
                disabled={isGenerating || faceImages.length === 0 || (!captures.shadowMap && !captures.depthMap)}
                style={{ marginTop: 'auto' }}
              >
                {isGenerating ? 'Generating...' : 'Generate Portrait'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}