import { Color, Vector2 } from '../../../../build/three.module.js';

export const PrimitivePostShader = {
	uniforms: {
		tDiffuse: { value: null },
		tDepthPick: { value: null },
		highlightIdTexture: { value: null },
		highlightColor: { value: new Color() },
		customColorIdTexture: { value: null },
		resolution: { value: new Vector2() }
	},
	defines: {
		'HIGHLIGHT_COUNT': 0,
		'CUSTOM_COLOR_COUNT': 0,
	},
	vertexShader: `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
	fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepthPick;
        uniform vec2 resolution;

        varying vec2 vUv;

		layout(location = 1) out vec4 gDepthPick;

		float packRgToNumber(vec2 color) {
			// return color.r + float(int(color.g) << 8);
			return color.r + float(int(color.g) << 11);
		}

		vec3 unpackNumber2Rgb(float num) {
			int value = int(num);
			int r = value & 255;
			int g = (value >> 8) & 255;
			int b = (value >> 16) & 255;
			return vec3(float(r) / 255.0, float(g) / 255.0, float(b) / 255.0);
		}

		#if CUSTOM_COLOR_COUNT > 0
			uniform sampler2D customColorIdTexture;
		#endif

        #if HIGHLIGHT_COUNT > 0
            uniform sampler2D highlightIdTexture;
            uniform vec3 highlightColor;

            bool selected(vec2 offset) {
                vec2 uv = vUv + offset;
                vec4 texel = texture2D(tDepthPick, uv);
                #ifdef SUPPORT_TEXTURE_FLOAT_LINEAR
                    float pickId = texel.g;
                #else
                    float pickId = packRgToNumber(texel.gb);
                #endif

                #if HIGHLIGHT_COUNT == 1
                    float highlightId = texture2D(highlightIdTexture, vec2(0.5)).r;
                    return highlightId == pickId;
                #else
                    float highlightId;
                    float highlight = 0.0;
                    for (int i = 0; i < HIGHLIGHT_COUNT; ++i) {
                        highlightId = texture2D(highlightIdTexture, vec2((float(i) + 0.5) / float(HIGHLIGHT_COUNT), 0.5)).r;
                        highlight += float(int(highlightId) == int(pickId));
                    }
                    clamp(highlight, 0.0, 1.0);
                    return bool(highlight);
                #endif
            }
        #endif

        void main() {
            vec4 fragColor = texture2D(tDiffuse, vUv);
            vec4 depthPickValue = texture2D(tDepthPick, vUv);

			#if CUSTOM_COLOR_COUNT > 0
				#ifdef SUPPORT_TEXTURE_FLOAT_LINEAR
					float pickId = depthPickValue.g;
				#else
					float pickId = packRgToNumber(depthPickValue.gb);
				#endif

				#if CUSTOM_COLOR_COUNT == 1
					vec4 customColorTexel = texture2D(customColorIdTexture, vec2(0.5));
					float customColorFlag = float(int(customColorTexel.r) == int(pickId));
					vec3 customColor = unpackNumber2Rgb(customColorTexel.g);
				#else
					vec4 customColorTexel;
					float customColorFlag = 0.0;
					vec3 customColor;
					for (int i = 0; i < CUSTOM_COLOR_COUNT; ++i) {
						customColorTexel = texture2D(customColorIdTexture, vec2((float(i) + 0.5) / float(CUSTOM_COLOR_COUNT), 0.5));
						// NOTE: 匹配后要终止循环, 否则customColor总是为最后设置的颜色
						if (int(customColorTexel.r) == int(pickId)) {
							customColorFlag = 1.0;
							customColor = unpackNumber2Rgb(customColorTexel.g);
							break;
						}
					}
				#endif
				fragColor = mix(fragColor, vec4(customColor, 1.0), customColorFlag);
			#endif

            #if HIGHLIGHT_COUNT > 0
                bool isFill = selected(vec2(0.0));
                // 判断周围的8个像素
                bool isOutline = !isFill && (
                    selected(resolution * vec2(-1.0, -1.0)) ||
                    selected(resolution * vec2(-1.0, 0.0)) ||
                    selected(resolution * vec2(-1.0, 1.0)) ||
                    selected(resolution * vec2(0.0, -1.0)) ||
                    selected(resolution * vec2(0.0, 1.0)) ||
                    selected(resolution * vec2(1.0, -1.0)) ||
                    selected(resolution * vec2(1.0, 0.0)) ||
                    selected(resolution * vec2(1.0, 1.0))
                );

				// 填充部分为浅色
                fragColor.rgb = mix(fragColor.rgb, highlightColor, float(isFill) * 0.5);
				// 轮廓部分为深色
                fragColor.rgb = mix(fragColor.rgb, highlightColor, float(isOutline));
            #endif

			gl_FragColor = fragColor;
			gDepthPick = depthPickValue;
        }
    `
};
