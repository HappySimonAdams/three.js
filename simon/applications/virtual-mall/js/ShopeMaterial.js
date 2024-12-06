import { Color, ShaderMaterial } from '../../../../build/three.module.js';

const vertexShader = `
	#ifdef USE_COLOR
		varying vec3 vColor;
	#endif

	#ifdef USE_LOGDEPTHBUF
		#ifdef USE_LOGDEPTHBUF_EXT
			varying float vFragDepth;
			varying float vIsPerspective;
			uniform float logDepthBufFC;
		#else
			uniform float logDepthBufFC;
		#endif
	#endif

	bool isPerspectiveMatrix(mat4 m) {
		return m[2][3] == -1.0;
	}

	void main() {
		#ifdef USE_COLOR
			vColor = color;
		#endif

		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

		#ifdef USE_LOGDEPTHBUF
			#ifdef USE_LOGDEPTHBUF_EXT
				// vFragDepth = 1.0 + gl_Position.w;
				vFragDepth = 1.0 + gl_Position.w * 0.998; // 减小深度值 (避免轮廓线与模型 z-fighting)
				vIsPerspective = float(isPerspectiveMatrix(projectionMatrix));
			#else
				if (isPerspectiveMatrix(projectionMatrix)) {
					gl_Position.z = log2(max(EPSILON, gl_Position.w + 1.0)) * logDepthBufFC - 1.0;
					gl_Position.z *= gl_Position.w * 0.998;
				}
			#endif
		#endif
	}
`;

const fragmentShader = `
	uniform vec3 color;

	#ifdef USE_COLOR
		varying vec3 vColor;
	#endif

	layout(location = 1) out vec4 gDepthPick;

	#if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
		uniform float logDepthBufFC;
		varying float vFragDepth;
		varying float vIsPerspective;
	#endif

	void main() {
		#ifdef USE_COLOR
			vec4 fragColor = vec4(vColor, 1.0);
		#else
			vec4 fragColor = vec4(color, 1.0);
		#endif

		#if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
			gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2(vFragDepth) * logDepthBufFC * 0.5;
			float depth = gl_FragDepthEXT;
		#else
			float depth = gl_FragCoord.z;
		#endif

		gl_FragColor = fragColor;
		gDepthPick = vec4(depth, 0.0, 0.0, 1.0); // 不需要拾取, 设置pickId为0
	}
`;

export class ShopeMaterial extends ShaderMaterial {

	constructor( options ) {

		super( {
			vertexColors: options.vertexColors || false,
			toneMapped: false,
			uniforms: {
				color: { value: new Color() },

			},
			vertexShader,
			fragmentShader,
		} );

		if ( options.color ) {

			this.uniforms.color.value.set( options.color );

		}

	}

}
