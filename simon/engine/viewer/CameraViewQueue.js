/**
 * 设置相机视角的执行队列
 */
export class CameraViewQueue {

	constructor( camera ) {

		this.camera = camera;
		this._views = [];

	}

	addView( view ) {

		this._views.push( view );

	}

	/**
     * 帧循环调用
     */
	update() {

		if ( this._views.length === 0 ) return;

		// 只执行最后一个
		this.camera.flyTo( this._views.pop() );
		// 清空当前帧的执行队列
		this._views.length = 0;

	}

}
