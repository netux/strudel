import useEvent from '@strudel.cycles/react/src/hooks/useEvent.mjs';
import useFrame from '@strudel.cycles/react/src/hooks/useFrame.mjs';
import { getAudioContext } from '@strudel.cycles/webaudio';
import { useState, useRef, useEffect } from 'react';

let Button = (props) => <button {...props} className="bg-lineHighlight p-2 rounded-md color-foreground" />;

function plotValues(ctx, values, min, max, color) {
  let { width, height } = ctx.canvas;
  ctx.strokeStyle = color;
  const thickness = 8;
  ctx.lineWidth = thickness;
  ctx.beginPath();

  let x = (f) => ((f - min) / (max - min)) * width;
  let y = (i) => (1 - i / values.length) * height;
  values.forEach((f, i, a) => {
    ctx.lineTo(x(f), y(i));
  });
  ctx.stroke();
}

function getColor(cssVariable) {
  if (typeof document === 'undefined') {
    return 'white';
  }
  const dummyElement = document.createElement('div');
  dummyElement.style.color = cssVariable;
  // Append the dummy element to the document body
  document.body.appendChild(dummyElement);
  // Get the computed style of the dummy element
  const styles = getComputedStyle(dummyElement);
  // Get the value of the CSS variable
  const color = styles.getPropertyValue(cssVariable);
  document.body.removeChild(dummyElement);
  return color;
}

let pitchColor = '#eab308';
let frequencyColor = '#3b82f6';

export function PitchSlider({
  buttons = [],
  animatable = false,
  plot = false,
  showPitchSlider = false,
  showFrequencySlider = true,
  pitchStep = '0.001',
  min = 55,
  max = 7040,
  initial = 220,
}) {
  const oscRef = useRef();
  const activeRef = useRef();
  const freqRef = useRef(initial);
  const historyRef = useRef([freqRef.current]);
  const frameRef = useRef();
  const canvasRef = useRef();
  const [hz, setHz] = useState(freqRef.current);

  useEffect(() => {
    freqRef.current = hz;
  }, [hz]);

  useEvent('mouseup', () => {
    oscRef.current?.stop();
    activeRef.current = false;
  });

  let freqSlider2freq = (progress) => min + progress * (max - min);
  let pitchSlider2freq = (progress) => min * 2 ** (progress * Math.log2(max / min));
  let freq2freqSlider = (freq) => (freq - min) / (max - min);
  let freq2pitchSlider = (freq) => {
    const [minOct, maxOct] = [Math.log2(min), Math.log2(max)];
    return (Math.log2(freq) - minOct) / (maxOct - minOct);
  };

  const freqSlider = freq2freqSlider(hz);
  const pitchSlider = freq2pitchSlider(hz);

  let startOsc = (hz) => {
    if (oscRef.current) {
      oscRef.current.stop();
    }
    oscRef.current = getAudioContext().createOscillator();
    oscRef.current.frequency.value = hz;
    oscRef.current.connect(getAudioContext().destination);
    oscRef.current.start();
    activeRef.current = true;
    setHz(hz);
  };

  let startSweep = (exp = false) => {
    let f = min;
    startOsc(f);
    const frame = () => {
      console.log('sweep');
      if (f < max) {
        if (!exp) {
          f += 10;
        } else {
          f *= 1.01;
        }
        oscRef.current.frequency.value = f;
        frameRef.current = requestAnimationFrame(frame);
      } else {
        oscRef.current.stop();
        cancelAnimationFrame(frameRef.current);
      }
      setHz(f);
    };
    requestAnimationFrame(frame);
  };

  useFrame(() => {
    historyRef.current.push(freqRef.current);
    historyRef.current = historyRef.current.slice(-1000);
    if (canvasRef.current) {
      let ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      if (showFrequencySlider) {
        plotValues(ctx, historyRef.current, min, max, frequencyColor);
      }
      if (showPitchSlider) {
        const [minOct, maxOct] = [Math.log2(min), Math.log2(max)];
        let perceptual = historyRef.current.map((v) => Math.log2(v));
        plotValues(ctx, perceptual, minOct, maxOct, pitchColor);
      }
    }
  }, plot);

  let handleChangeFrequency = (f) => {
    setHz(f);
    if (oscRef.current) {
      oscRef.current.frequency.value = f;
    }
  };
  let handleMouseDown = () => {
    cancelAnimationFrame(frameRef.current);
    startOsc(hz);
  };

  let exponent = freq2pitchSlider(hz) * Math.log2(max / min);
  const semitones = parseFloat((exponent * 12).toFixed(2));
  if (semitones % 12 === 0) {
    exponent = semitones / 12;
  } else if (semitones % 1 === 0) {
    exponent = `${semitones}/12`;
  } else {
    exponent = exponent.toFixed(2);
  }
  return (
    <>
      <span className="font-mono">
        {showFrequencySlider && <span className="text-blue-500">{hz.toFixed(0)}Hz</span>}
        {showFrequencySlider && showPitchSlider && <> = </>}
        {showPitchSlider && (
          <>
            {min}Hz * 2
            <sup>
              <span className="text-yellow-500">{exponent}</span>
            </sup>
          </>
        )}
      </span>
      <span></span>
      <div>
        {showFrequencySlider && (
          <div className="flex space-x-1 items-center">
            <input
              type="range"
              value={freqSlider}
              min={0}
              max={1}
              step={0.001}
              onMouseDown={handleMouseDown}
              className={`block w-full max-w-[600px] accent-blue-500 `}
              onChange={(e) => {
                const f = freqSlider2freq(parseFloat(e.target.value));
                handleChangeFrequency(f);
              }}
            />
          </div>
        )}
        {showPitchSlider && (
          <div>
            <input
              type="range"
              value={pitchSlider}
              min={0}
              max={1}
              //step=".001"
              step={pitchStep}
              onMouseDown={handleMouseDown}
              className={`block w-full max-w-[600px] accent-yellow-500`}
              onChange={(e) => {
                const f = pitchSlider2freq(parseFloat(e.target.value));
                handleChangeFrequency(f);
              }}
            />
          </div>
        )}
      </div>
      <div className="px-2">
        {plot && <canvas ref={canvasRef} className="w-full max-w-[584px] h-[300px]" height="600" width={800} />}
      </div>
      <div className="space-x-2">
        {animatable && (
          <Button onClick={() => startSweep()}>
            <span style={{ color: '#3b82f6' }}>Frequency Sweep</span>
          </Button>
        )}
        {animatable && (
          <Button onClick={() => startSweep(true)}>
            <span style={{ color: '#eab308' }}>Pitch Sweep</span>
          </Button>
        )}
        {buttons.map((f, i) => (
          <Button key={(f, i)} onMouseDown={() => startOsc(f)}>
            {f}Hz
          </Button>
        ))}
      </div>
    </>
  );
}
