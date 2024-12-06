import { BackSide, BoxGeometry, ColorManagement, CubeTextureLoader, Mesh, PlaneGeometry, ShaderMaterial, SRGBTransfer, UniformsUtils } from '../../../../build/three.module.js';
import { RenderOrder } from '../enums/RenderOrder.js';
import { RenderPrimitive } from '../primitives/RenderPrimitive.js';
import { BackgroundShader } from './BackgroundShader.js';
import { BackgroundCubeShader } from './BackgroundCubeShader.js';

export class Background extends RenderPrimitive {

	constructor( scene ) {

		super();

		this.scene = scene;
		this.blurriness = 0;
		this.intensity = 1;
		this.cubeTexture = null;
		this._cubeTextureLoader = null;
		this._boxMesh = null;
		this._planeMesh = null;
		this._currentTexture = null;
		this._currentTextureVersion = 0;
		this._currentTonemapping = null;

	}

	setSkybox( urls ) {

		if ( ! this._cubeTextureLoader ) {

			this._cubeTextureLoader = new CubeTextureLoader();

		}

		this._cubeTextureLoader.load( urls, ( cubeTexture ) => {

			this._cubeTexture = cubeTexture;
			this.scene.requestRender();

		} );

	}

	_createBoxMesh() {

		const geometry = new BoxGeometry( 1, 1, 1 );
		geometry.deleteAttribute( 'normal' );
		geometry.deleteAttribute( 'uv' );

		const material = new ShaderMaterial( {
			uniforms: UniformsUtils.clone( BackgroundShader.uniforms ),
			vertexShader: BackgroundCubeShader.vertexShader,
			fragmentShader: BackgroundCubeShader.fragmentShader,
			side: BackSide,
			depthTest: false,
			depthWrite: false,
			fog: false
		} );
		material.extensions.multiDraw = true;

		// add "envMap" material property so the renderer can evaluate it like for built-in materials
		Object.defineProperty( material, 'envMap', {
			get: function () {

				return this.uniforms.envMap.value;

			}
		} );

		this._boxMesh = new Mesh( geometry, material );
		this._boxMesh.name = 'BackgroundMesh';
		this._boxMesh.frustumCulled = false;
		this._boxMesh.matrixAutoUpdate = false;
		this._boxMesh.renderOrder = RenderOrder.BACKGROUND;
		this._boxMesh.rotation.set( Math.PI / 2, 0, 0 );
		this._boxMesh.updateMatrix();
		this._boxMesh.onBeforeRender = function ( renderer, scene, camera ) {

			this.matrixWorld.copyPosition( camera.matrixWorld );

		};

	}

	_createPlaneMesh() {

		const geometry = new PlaneGeometry( 2, 2 );
		geometry.deleteAttribute( 'normal' );
		geometry.deleteAttribute( 'uv' );

		const material = new ShaderMaterial( {
			uniforms: UniformsUtils.clone( BackgroundShader.uniforms ),
			vertexShader: BackgroundShader.vertexShader,
			fragmentShader: BackgroundShader.fragmentShader,
			depthTest: false,
			depthWrite: false,
			fog: false,
		} );
		material.extensions.multiDraw = true;

		this._planeMesh = new Mesh( geometry, material );
		this._planeMesh.name = 'BackgroundMesh';
		this._planeMesh.frustumCulled = false;
		this._planeMesh.matrixAutoUpdate = false;
		this._planeMesh.renderOrder = RenderOrder.BACKGROUND;

	}

	update( frameState ) {

		// 优先使用 cubeMap
		if ( this.cubeTexture ) {

			if ( ! this._boxMesh ) this._createBoxMesh();

			const { material } = this._boxMesh;
			const { uniforms } = material;
			uniforms.envMap.value = this.cubeTexture;
			uniforms.flipEnvMap.value = - 1;
			uniforms.backgroundBlurriness.value = this.blurriness;
			uniforms.backgroundIntensity.value = this.intensity;
			material.toneMapped = ColorManagement.getTransfer( this.cubeTexture.colorSpace ) !== SRGBTransfer;
			material.extensions.drawBuffers = true;

			const { toneMapping } = this.scene.renderer;
			if (
				this._currentTexture !== this.cubeTexture ||
                this._currentTextureVersion !== this.cubeTexture.version ||
                this._currentTonemapping !== toneMapping
			) {

				this._currentTexture = this.cubeTexture;
				this._currentTextureVersion = this.cubeTexture.version;
				this._currentTonemapping = toneMapping;
				material.needsUpdate = true;

			}

			frameState.renderList.push( this._boxMesh );

		} else {

			if ( ! this._planeMesh ) this._createPlaneMesh();

			const { material } = this._planeMesh;
			const { uniforms } = material;
			const { bgColor, bgAlpha } = this.scene;
			uniforms.color.value.set( bgColor );
			uniforms.opacity.value = bgAlpha;
			uniforms.backgroundIntensity.value = this.intensity;

			frameState.renderList.push( this._planeMesh );

		}

	}

	destroy() {

		if ( this.cubeTexture ) {

			this.cubeTexture.dispose();

		}

		if ( this._boxMesh ) {

			this._boxMesh.geometry.dispose();
			this._boxMesh.material.dispose();

		}

		if ( this._planeMesh ) {

			this._planeMesh.geometry.dispose();
			this._planeMesh.material.dispose();

		}

	}

}
