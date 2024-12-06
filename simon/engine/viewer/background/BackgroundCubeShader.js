export const BackgroundCubeShader = {
	uniforms: {
		envMap: { value: null },
		flipEnvMap: { value: - 1 },
		backgroundBlurriness: { value: 0 },
		backgroundIntensity: { value: 1 }
	},

	vertexShader: `
        varying vec3 vWorldDirection;

        // #include <common>
        vec3 transformDirection(in vec3 dir, in mat4 matrix) {
            return normalize((matrix * vec4(dir, 0.0)).xyz);
        }

        void main() {
            vWorldDirection = transformDirection(position, modelMatrix);

            // #include <begin_vertex>
            // #include <project_vertex>

            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            gl_Position.z = gl_Position.w; // set z to camera.far
        }
    `,

	fragmentShader: `
        #ifdef ENVMAP_TYPE_CUBE
            uniform samplerCube envMap;
        #elif defined(ENVMAP_TYPE_CUBE_UV)
            uniform sampler2D envMap;
        #endif

        uniform float flipEnvMap;
        uniform float backgroundBlurriness;
        uniform float backgroundIntensity;

        varying vec3 vWorldDirection;

        #include <cube_uv_reflection_fragment>

		layout(location = 1) out vec4 gDepthPick;

        void main() {
            #ifdef ENVMAP_TYPE_CUBE
                vec4 texColor = textureCube(envMap, vec3(flipEnvMap * vWorldDirection.x, vWorldDirection.yz));
            #elif defined(ENVMAP_TYPE_CUBE_UV)
                vec4 texColor = textureCubeUV(envMap, vWorldDirection, backgroundBlurriness);
            #else
                vec4 texColor = vec4(0.0, 0.0, 0.0, 1.0);
            #endif

            texColor.rgb *= backgroundIntensity;

            gl_FragColor = texColor;

            #include <tonemapping_fragment>
            #include <colorspace_fragment>

			gDepthPick = vec4(0.0); // 背景的 depth-pick 值设为 0
        }
    `
};
