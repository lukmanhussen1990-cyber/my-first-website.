import React, {useLayoutEffect, useRef} from 'react';
import {useVideoConfig} from 'remotion';
import {FRAG, VERT} from './cloudShader';

export type CloudUniforms = {
	time: number;
	fwd: number;
	horizon: number;
	maskX: number;
	maskY: number;
	maskR: number;
	rim: number;
	defocus: number;
	dim: number;
};

type GLState = {
	gl: WebGLRenderingContext;
	loc: Record<string, WebGLUniformLocation | null>;
};

const UNIFORMS = ['uRes', 'uScale', 'uTime', 'uFwd', 'uHorizon', 'uMaskC', 'uMaskR', 'uRim', 'uDefocus', 'uDim'];

const compile = (gl: WebGLRenderingContext, type: number, src: string) => {
	const s = gl.createShader(type)!;
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
		throw new Error(`Cloud shader: ${gl.getShaderInfoLog(s)}`);
	}
	return s;
};

const init = (canvas: HTMLCanvasElement): GLState => {
	const gl = canvas.getContext('webgl', {
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: false,
		alpha: true,
	});
	if (!gl) throw new Error('WebGL unavailable — render with --gl=angle (GPU) or --gl=swangle (CPU).');
	const prog = gl.createProgram()!;
	gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
	gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		throw new Error(`Cloud shader link: ${gl.getProgramInfoLog(prog)}`);
	}
	gl.useProgram(prog);
	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const aPos = gl.getAttribLocation(prog, 'aPos');
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
	const loc: GLState['loc'] = {};
	for (const u of UNIFORMS) loc[u] = gl.getUniformLocation(prog, u);
	return {gl, loc};
};

/**
 * Full-frame WebGL canvas. Draws synchronously in a layout effect, so each frame
 * is a pure function of the props (and therefore of the frame number).
 */
export const CloudSky: React.FC<{u: CloudUniforms; renderScale: number; style?: React.CSSProperties}> = ({
	u,
	renderScale,
	style,
}) => {
	const {width, height} = useVideoConfig();
	const cw = Math.round(width * renderScale);
	const ch = Math.round(height * renderScale);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<GLState | null>(null);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		if (!state.current) state.current = init(canvas);
		const {gl, loc} = state.current;
		gl.viewport(0, 0, cw, ch);
		gl.uniform2f(loc.uRes, cw, ch);
		gl.uniform1f(loc.uScale, renderScale);
		gl.uniform1f(loc.uTime, u.time);
		gl.uniform1f(loc.uFwd, u.fwd);
		gl.uniform1f(loc.uHorizon, u.horizon);
		gl.uniform2f(loc.uMaskC, u.maskX * renderScale, (height - u.maskY) * renderScale);
		gl.uniform1f(loc.uMaskR, u.maskR);
		gl.uniform1f(loc.uRim, u.rim);
		gl.uniform1f(loc.uDefocus, u.defocus);
		gl.uniform1f(loc.uDim, u.dim);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.finish();
	}, [u, cw, ch, height, renderScale]);

	return (
		<canvas
			ref={canvasRef}
			width={cw}
			height={ch}
			style={{position: 'absolute', left: 0, top: 0, width, height, ...style}}
		/>
	);
};
