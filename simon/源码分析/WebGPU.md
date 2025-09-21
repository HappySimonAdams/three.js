# WebGPU API 调用流程

## WebGPURenderer & Renderer

* new WebGPURenderer(parameters = {}) →
    * const backend = new WebGPUBackend(parameters) →
        * this.utils = new WebGPUUtils(this)
        * this.attributeUtils = new WebGPUAttributeUtils(this)
        * this.bindingUtils = new WebGPUBindingUtils(this)
        * this.pipelineUtils = new WebGPUPipelineUtils(this)
        * this.textureUtils = new WebGPUTextureUtils(this)
    * super(backend, parameters) → new Renderer()
        * this.domElement = backend.getDomElement()
        * this.info = new Info()
        * this.library = new NodeLibrary()
        * this.lighting = new Lighting()
        * this._quad = new QuadMesh(new NodeMaterial())
        * this.xr = new XRManager(this, multiview)
    * this.library = new StandardNodeLibrary()

### tick函数

* Renderer.setAnimationLoop() →
    * await this.init() →
        * await WebGPUBackend.init() →
            * const adapter = await navigator.gpu.requestAdapter()
            * this.device = await GPUAdapter.requestDevice()
            * this.device.lost.then(info => renderer.onDeviceLost())
            * canvas.getContext('webgpu')
            * navigator.gpu.getPreferredCanvasFormat()
            * GPUCanvasContext.configure()
            * this.updateSize()
        * this._nodes = new Nodes(this, backend)
        * this._animation = new Animation(this._nodes, this.info)
        * this._attributes = new Attributes(backend)
        * this._background = new Background(this, this._nodes)
        * this._geometries = new Geometries(this._attributes, this.info)
        * this._textures = new Textures(this, backend, this.info)
        * this._pipelines = new Pipelines(backend, this._nodes)
        * this._bindings = new Bindings(...)
        * this._objects = new RenderObjects(...)
        * this._renderLists = new RenderLists(this.lighting)
        * this._bundles = new RenderBundles()
        * this._renderContexts = new RenderContexts()
        * this._animation.start() →
            * requestAnimationFrame()
            * this._animationLoop?.(time, xrFrame)
    * this._animation.setAnimationLoop(callback)

### 主渲染函数

* Renderer.render(scene, camera) → this._renderScene() →
    * this._renderContexts.get(scene, camera, renderTarget)
    * sceneRef.onBeforeRender(...)
    * this._renderLists.get(scene, camera)
    * RenderList.begin()
    * this._projectObject(...) →
        * if (isLOD && autoUpdate) → LOD.update(camera)
        * else if (isLight) → RenderList.pushLight()
        * else if (isSprite) → RenderList.push(...)
        * else if (isMesh || isLine || isPoints) → RenderList.push(...)
        * if (isBundleGroup) RenderList.pushBundle()
    * RenderList.finish()
    * if (this.sortObjects) RenderList.sort()
    * this._textures.updateRenderTarget() →
        * [this.updateTexture()](#上传纹理数据)
        * renderTarget.addEventListener('dispose', onDispose);
    * this._background.update() →
        * Nodes.getBackgroundNode()
        * if (background.isNode) {...}
    * this.backend.beginRender(renderContext) →
        * GPUQuerySet.destroy()
        * GPUDevice.createQuerySet()
        * this._getDefaultRenderPassDescriptor()
        * this._getRenderPassDescriptor()
        * this.initTimestampQuery() →
            * new WebGPUTimestampQueryPool() →
                * GPUDevice.createQuerySet()
                * GPUDevice.createBuffer()
            * WebGPUTimestampQueryPool.allocateQueriesForContext()
        * GPUDevice.createCommandEncoder()
        * GPUCommandEncoder.beginRenderPass()
        * this.updateViewport() → GPURenderPassEncoder.setViewport()
        * GPURenderPassEncoder.setScissorRect()
    * this._renderBundles() → this._renderBundle() →
        * if (renderBundleNeedsUpdate) →
            * this.backend.beginBundle() → WebGPUPipelineUtils.createBundleEncoder() →
                * GPUDevice.createRenderBundleEncoder()
            * this._renderObjects() →
            * this.backend.finishBundle() →
                * GPURenderBundleEncoder.finish()
        * else → if ([this._nodes.needsRefresh()](#判断是否需要更新)) →
            * this._nodes.updateBefore()
            * this._nodes.updateForRender() →
            * this._bindings.updateForRender() →
            * this._nodes.updateAfter() →
        * this.backend.addBundle() →
    * this._renderObjects() → this.renderObject() →
        * object.onBeforeRender(...)
        * [this._renderObjectDirect()](#渲染单个对象)
    * this.backend.finishRender(renderContext) →
        * if (...) GPURenderPassEncoder.executeBundles()
        * if (...) GPURenderPassEncoder.endOcclusionQuery()
        * if (this._isRenderCameraDepthArray(renderContext))
            * GPURenderBundleEncoder.finish()
            * GPUCommandEncoder.beginRenderPass()
            * GPURenderPassEncoder.setViewport()
            * GPURenderPassEncoder.setScissorRect()
            * GPURenderPassEncoder.executeBundles()
            * GPURenderPassEncoder.end()
        * else GPURenderPassEncoder.end()
        * if (occlusionQueryCount > 0)
            * GPUDevice.createBuffer()
            * GPUCommandEncoder.resolveQuerySet()
            * GPUCommandEncoder.copyBufferToBuffer()
            * this.resolveOccludedAsync(renderContext) →
                * GPUBuffer.mapAsync()
                * GPUBuffer.getMappedRange()
                * GPUBuffer.destroy()
        * GPUQueue.submit([GPUCommandEncoder.finish()])
        * if (texture.generateMipmaps) WebGPUTextureUtils.generateMipmaps() // [参考](#上传纹理数据)
    * if (frameBufferTarget) this._renderOutput(renderTarget) →
        * if (Nodes.hasOutputChange()) Nodes.getOutputNode()
        * this._renderScene(quad, quad.camera, false)
    * sceneRef.onAfterRender(...)

### 渲染单个对象

* Renderer._renderObjectDirect() →
    * [this._nodes.needsRefresh()](#判断渲染对象是否需要更新)
    * [this._nodes.updateBefore()](#触发所有节点的updatebefore)
    * [this._geometries.updateForRender()](#上传几何渲染数据)
    * [this._nodes.updateForRender()](#触发所有节点的update)
    * [this._bindings.updateForRender()](#资源绑定与更新)
    * [this._pipelines.updateForRender()](#创建渲染管线)
    * this.backend.draw(renderObject, info) →
        * renderObject.getBindings()
        * renderObject.getIndex()
        * renderObject.getDrawParameters()
        * GPURenderPassEncoder.endOcclusionQuery()
        * GPURenderPassEncoder.beginOcclusionQuery()
        * draw() →
            * this.pipelineUtils.setPipeline() → GPURenderPassEncoder.setPipeline()
            * GPURenderPassEncoder.setBindGroup()
            * GPURenderPassEncoder.setIndexBuffer()
            * renderObject.getVertexBuffers()
            * GPURenderPassEncoder.setVertexBuffer()
            * GPURenderPassEncoder.setStencilReference()
            * if (isBatchedMesh)
                * GPURenderPassEncoder.drawIndexed()
                * GPURenderPassEncoder.draw()
            * else if (hasIndex)
                * renderObject.getIndirect()
                * GPURenderPassEncoder.drawIndexedIndirect()
                * GPURenderPassEncoder.drawIndexed()
            * else
                * renderObject.getIndirect()
                * GPURenderPassEncoder.drawIndirect()
                * GPURenderPassEncoder.draw()
            * Info.update() →
    * [this._nodes.updateAfter()](#触发所有节点的updateafter)

## Textures

### 上传纹理数据

* Textures.updateTexture(texture, options) →
    * if (isRenderTarget && textureData.initialized)
        * backend.destroySampler(texture)
        * backend.destroyTexture(texture) → GPUTexture.destroy()
    * backend.createSampler() → GPUDevice.createSampler()
    * backend.createTexture() → GPUDevice.createTexture()
    * backend.updateTexture() →
        * this._copyBufferToTexture(...) →
            * this._getBytesPerTexel(textureDescriptorGPU.format)
            * GPUQueue.writeTexture()
            * if (flipY) this._flipY() → WebGPUTexturePassUtils.flipY() →
                * this.getTransferPipeline() → GPUDevice.createRenderPipeline()
                * this.getFlipYPipeline() → GPUDevice.createRenderPipeline()
                * GPUDevice.createTexture()
                * GPUTexture.createView()
                * GPUDevice.createCommandEncoder()
                * const pass = (...) => {} →
                    * GPURenderPipeline.getBindGroupLayout(0)
                    * GPUDevice.createBindGroup()
                    * GPUCommandEncoder.beginRenderPass()
                    * GPURenderPassEncoder.setPipeline()
                    * GPURenderPassEncoder.setBindGroup()
                    * GPURenderPassEncoder.draw()
                    * GPURenderPassEncoder.end()
                * GPUQueue.submit([GPUCommandEncoder.finish()])
                * GPUTexture.destroy()
        * this._copyCompressedBufferToTexture(...) →
            * this._getBlockData(textureDescriptorGPU.format)
            * GPUQueue.writeTexture()
        * this._copyCubeMapToTexture(...) →
            * this._copyBufferToTexture(...)
            * this._copyImageToTexture(...)
        * this._copyImageToTexture(...) →
            * GPUQueue.copyExternalImageToTexture()
    * backend.generateMipmaps(texture) → WebGPUTexturePassUtils.generateMipmaps() →
        * this._mipmapCreateBundles(...) →
            * this.getTransferPipeline() → GPUDevice.createRenderPipeline()
            * GPURenderPipeline.getBindGroupLayout(0)
            * GPUTexture.createView()
            * GPUDevice.createBindGroup()
            * GPUDevice.createRenderBundleEncoder()
            * GPURenderBundleEncoder.setPipeline()
            * GPURenderBundleEncoder.setBindGroup()
            * GPURenderBundleEncoder.draw()
            * GPURenderBundleEncoder.finish()
        * GPUDevice.createCommandEncoder()
        * this._mipmapRunBundles(...) →
            * GPUCommandEncoder.beginRenderPass()
            * GPURenderPassEncoder.executeBundles()
            * GPURenderPassEncoder.end()
        * GPUQueue.submit([GPUCommandEncoder.finish()])
    * texture.onUpdate?.(texture)
    * texture.addEventListener('dispose', onDispose);

## Nodes

### 判断渲染对象是否需要更新

* Nodes.needsRefresh(renderObject) →
    * const nodeFrame = this.getNodeFrameForRender() → this.getNodeFrame()
    * const monitor = renderObject.getMonitor() → renderObject.getNodeBuilderState().observer →
        * this._nodes.getForRender(renderObject) →
            * this.getForRenderCacheKey(renderObject)
            * const nodeBuilder = this.backend.createNodeBuilder() → new WGSLNodeBuilder() →
                * new WGSLNodeParser()
                * super() → new NodeBuilder(...)
            * this.getEnvironmentNode(scene)
            * this.getFogNode(scene)
            * [nodeBuilder.build()](#节点构建)
            * nodeBuilderState = this._createNodeBuilderState(nodeBuilder)
                * NodeBuilder.getAttributesArray()
                * NodeBuilder.getBindings()
            * return nodeBuilderState
    * monitor.needsRefresh() → NodeMaterialObserver.needsRefresh() →
        * this.firstInitialization() →
            * this.getRenderObjectData() →
                * this.getMaterialData()
                * this.getAttributesData()
                * this.getLightsData()
        * this.needsVelocity() →
            * Renderer.getMRT()
        * this.getRenderObjectData()
        * this.getLights() →
            * LightsNode.getLights()
            * this.getLightsData()
        * this.equals()
            * this.getRenderObjectData()
            * this.getAttributesData()

### 触发所有节点的updateBefore()

* Nodes.updateBefore(renderObject) →
    * const nodeBuilder = renderObject.getNodeBuilderState() // [参考](#判断渲染对象是否需要更新)
    * for (const node of nodeBuilder.updateBeforeNodes)
        * this.getNodeFrameForRender(renderObject) → return this.getNodeFrame(...)
        * NodeFrame.updateBeforeNode(node) →
            * const updateType = Node.getUpdateBeforeType()
            * const reference = node.updateReference(this)
            * if (NodeUpdateType.FRAME)
                * this._getMaps()
                * node.updateBefore(this)
            * else if (NodeUpdateType.RENDER)
                * this._getMaps()
                * node.updateBefore(this)
            * else if (NodeUpdateType.OBJECT)
                * node.updateBefore(this)

### 触发所有节点的update()

* Nodes.updateForRender(renderObject) →
    * const nodeFrame = this.getNodeFrameForRender(renderObject)
    * const nodeBuilder = renderObject.getNodeBuilderState() // [参考](#判断渲染对象是否需要更新)
    * for (const node of nodeBuilder.updateNodes)
        * NodeFrame.updateNode(node) →
            * const updateType = Node.getUpdateBeforeType()
            * const reference = node.updateReference(this)
            * if (NodeUpdateType.FRAME)
                * this._getMaps()
                * node.update(this)
            * else if (NodeUpdateType.RENDER)
                * this._getMaps()
                * node.update(this)
            * else if (NodeUpdateType.OBJECT)
                * node.update(this)

### 触发所有节点的updateAfter()

* Nodes.updateAfter(renderObject) →
    * const nodeBuilder = renderObject.getNodeBuilderState() // [参考](#判断渲染对象是否需要更新)
    * for (const node of nodeBuilder.updateAfterNodes)
        * this.getNodeFrameForRender(renderObject)
        * NodeFrame.updateAfterNode(node) →
            * const updateType = Node.getUpdateBeforeType()
            * const reference = node.updateReference(this)
            * if (NodeUpdateType.FRAME)
                * this._getMaps()
                * node.updateAfter(this)
            * else if (NodeUpdateType.RENDER)
                * this._getMaps()
                * node.updateAfter(this)
            * else if (NodeUpdateType.OBJECT)
                * node.updateAfter(this)

## WGSLNodeBuilder & NodeBuilder

### 节点构建

* NodeBuilder.build() →
    * if (material)
        * NodeLibrary.fromMaterial()
        * NodeMaterial.build(builder) → NodeMaterial.setup(builder) →
            * builder.addStack()
            * const mvp = subBuild(this.setupVertex(builder), 'VERTEX')
    * else this.addFlow('compute', object)
    * this.setBuildStage(buildStage)
    * this.flowNodeFromShaderStage('vertex', this.context.vertex)
    * this.setShaderStage(shaderStage)
    * if (buildStage === 'generate') this.flowNode(node)
    * else node.build()
    * this.setBuildStage(null)
    * this.setShaderStage(null)
    * this.buildCode()
    * this.buildUpdateNodes()

## Geometries

### 上传几何渲染数据

* Geometries.updateForRender(renderObject) →
    * this.initGeometry() →
        * geometry.addEventListener('dispose', onDispose);
    * this.updateAttributes() → this.updateAttribute() → Attributes.update() →
        * WebGPUAttributeUtils.createAttribute() →
            * GPUDevice.createBuffer()
            * GPUBuffer.getMappedRange()
            * GPUBuffer.unmap()
        * WebGPUAttributeUtils.updateAttribute() →
            * GPUQueue.writeBuffer()
            * BufferAttribute.clearUpdateRanges()

## Bindings

### 资源绑定与更新

* Bindings.updateForRender(renderObject) →
    * this.getForRender() →
        * this._init(bindGroup) →
            * if (isSampledTexture) [this.textures.updateTexture()](#上传纹理数据)
            * if (isStorageBuffer) this.attributes.update()
        * this.backend.createBindings() → WebGPUBindingUtils.createBindings() →
            * this.createBindingsLayout() → GPUDevice.createBindGroupLayout()
            * this.createBindGroup() →
                * if (isUniformBuffer) GPUDevice.createBuffer()
                * if (isStorageBuffer) ...
                * if (isSampledTexture)
                    * if (externalTexture) GPUDevice.importExternalTexture()
                    * else GPUTexture.createView()
                * if (isSampler) ...
                * GPUDevice.createBindGroup()
    * this._updateBindings() → this._update() →
        * if (isNodeUniformsGroup) this.nodes.updateGroup() →
        * if (isStorageBuffer) this.attributes.update()
        * if (isUniformBuffer)
            * binding.update() →
            * this.backend.updateBinding() → WebGPUBindingUtils.updateBinding() →
                * GPUQueue.writeBuffer()
        * else if (isSampledTexture)
            * binding.update() →
            * [this.textures.updateTexture()](#上传纹理数据)
            * if (isStorageTexture) → this.backend.generateMipmaps() → WebGPUTextureUtils.generateMipmaps() →
        * else if (isSampler) binding.update() →

## Pipelines

### 创建渲染管线

* Pipelines.getForRender(renderObject, promises = null) →
    * this._needsRenderUpdate() → this.backend.needsRenderUpdate()
    * renderObject.getNodeBuilderState() → this._nodes.getForRender() →
    * this._releaseProgram()
    * new ProgrammableStage()
    * this.backend.createProgram() → GPUDevice.createShaderModule()
    * this._getRenderCacheKey() → this.backend.getRenderCacheKey()
    * this._releasePipeline()
    * this._getRenderPipeline() →
        * new RenderPipeline()
        * this.backend.createRenderPipeline() → WebGPUPipelineUtils.createRenderPipeline() →
            * renderObject.getBindings()
            * WebGPUAttributeUtils.createShaderVertexBuffers() →
                * renderObject.getAttributes()
                * this._getVertexFormat()
            * this._getBlending()
            * this._getStencilCompare()
            * this._getStencilOperation()
            * this._getColorWriteMask()
            * WebGPUUtils.getTextureFormatGPU()
            * WebGPUUtils.getCurrentColorFormat()
            * this._getPrimitiveState() →
                * WebGPUUtils.getPrimitiveTopology()
            * this._getDepthCompare()
            * WebGPUUtils.getCurrentDepthStencilFormat()
            * this._getSampleCount() → WebGPUUtils.getSampleCountRenderContext()
            * GPUDevice.createPipelineLayout()
            * GPUDevice.createRenderPipeline()
            * GPUDevice.createRenderPipelineAsync()
