import { ViewChangeType } from './enums/ViewChangeType.js';
import { ViewZoomType } from './enums/ViewZoomType.js';

export class FrameState {

	constructor( scene ) {

		this.scene = scene;
		this.renderList = [];
		this.afterRender = [];

		this.time = 0; // 毫秒
		this.newFrame = false;

		this.viewChangeType = ViewChangeType.NONE;
		/** 当 viewChangeType 为 ZOOM 时有效 */
		this.viewZoomType = ViewZoomType.NONE;

	}

	destroy() {

		this.renderList = null;
		this.afterRender = null;

	}

}
