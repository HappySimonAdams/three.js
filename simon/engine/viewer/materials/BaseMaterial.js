import { Color, ShaderMaterial } from '../../../../build/three.module.js';

const vertexShader = `
	#ifdef USE_COLOR
		varying vec3 vColor;
	#endif

	#if HIDE_COUNT > 0
		uniform sampler2D hideIdTexture;
		uniform float reverseHide;
		uniform float pickId;
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

		#if HIDE_COUNT > 0
			float hide = 0.0;
			#if HIDE_COUNT == 1
				float hideId = texture2D(hideIdTexture, vec2(0.5)).r;
				hide = float(int(pickId) == int(hideId));
			#else
				float hideId;
				for (int i = 0; i < HIDE_COUNT; ++i) {
					hideId = texture2D(hideIdTexture, vec2((float(i) + 0.5) / float(HIDE_COUNT), 0.5)).r;
					hide += float(int(pickId) == int(hideId));
				}
				clamp(hide, 0.0, 1.0);
			#endif
			hide = float(int(hide) ^ int(reverseHide));

			// 通过将顶点位置设置为NDC之外, 以取消光栅化和片段着色
			vec4 clipedPosition = vec4(2.0, 2.0, 2.0, 1.0);
			gl_Position = mix(gl_Position, clipedPosition, hide);
		#endif
	}
`;

const fragmentShader = `
	uniform vec3 color;
	uniform float pickId;

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

		#ifdef SUPPORT_TEXTURE_FLOAT_LINEAR
			gDepthPick = vec4(depth, pickId, 0.0, 1.0);
		#else
			// float值小于等于2048时, 转成的halfFloat可与float值一一对应, 超出2048后会有精度损失
			// pickId最大值为: 2047 + 2048 * 2048 = 4196351
			float pickIdA = mod(pickId, 2048.0);
        	float pickIdB = floor(pickId / 2048.0);
			gDepthPick = vec4(depth, pickIdA, pickIdB, 1.0);
		#endif
	}
`;

export class BaseMaterial extends ShaderMaterial {

	constructor( options ) {

		super( {
			vertexColors: options.vertexColors || false,
			toneMapped: false,
			uniforms: {
				color: { value: new Color() },
				pickId: { value: 0 }, // 不需要拾取时，设置pickId为0
				hideIdTexture: { value: null },
				reverseHide: { value: false },
			},
			defines: {
				'HIDE_COUNT': 0,
			},
			vertexShader,
			fragmentShader,
		} );

		if ( options.color ) {

			this.uniforms.color.value.set( options.color );

		}

	}

	onBeforeRender( renderer ) {

		if ( this.defines[ 'HIDE_COUNT' ] !== renderer.hideCount ) {

			this.defines[ 'HIDE_COUNT' ] = renderer.hideCount;
			this.needsUpdate = true;

		}

		this.uniforms.hideIdTexture.value = renderer.hideIdTexture;
		this.uniforms.reverseHide.value = renderer.reverseHide;

	}

	onBeforeCompile( parameters, renderer ) {

		if ( renderer.supportTextureFloatLinear ) {

			parameters.defines[ 'SUPPORT_TEXTURE_FLOAT_LINEAR' ] = '';

		}

	}

	setPickId( value ) {

		this.uniforms.pickId.value = value;

	}

}
