import { Color } from '../../../../build/three.module.js';

export const BackgroundShader = {
	uniforms: {
		// uvTransform: { value: new Matrix3() },
		// t2D: { value: null },
		color: { value: new Color() },
		opacity: { value: 1 },
		backgroundIntensity: { value: 1 }
	},

	vertexShader: `
        // uniform mat3 uvTransform;
        // varying vec2 vUv;

        void main() {
        	// vUv = (uvTransform * vec3(uv, 1)).xy;
            gl_Position = vec4(position.xy, 1.0, 1.0);
        }
    `,

	fragmentShader: `
        // uniform sampler2D t2D;
        uniform vec3 color;
        uniform float opacity;
        uniform float backgroundIntensity;

        // varying vec2 vUv;

		layout(location = 1) out vec4 gDepthPick;

        void main() {
            // vec4 texColor = texture2D(t2D, vUv);

            // #ifdef DECODE_VIDEO_TEXTURE
            //     // use inline sRGB decode until browsers properly support SRGB8_APLHA8 with video textures
            //     texColor = vec4(mix(pow(texColor.rgb * 0.9478672986 + vec3(0.0521327014), vec3(2.4)), texColor.rgb * 0.0773993808, vec3(lessThanEqual(texColor.rgb, vec3(0.04045)))), texColor.w);
            // #endif

            vec4 texColor = vec4(color, opacity);

            texColor.rgb *= backgroundIntensity;

            gl_FragColor = texColor;

            // #include <tonemapping_fragment>
            // #include <colorspace_fragment>

			gDepthPick = vec4(0.0); // 背景的 depth-pick 值设为 0
        }
    `,
};
